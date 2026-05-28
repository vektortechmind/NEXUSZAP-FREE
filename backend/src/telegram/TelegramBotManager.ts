import { Context, Telegraf } from "telegraf";
import { prisma } from "../database/prisma";
import { askChat, transcribeAudio } from "../ai/providerSelector";
import { getResolvedTelegramPrompt } from "../services/agentPrompt";
import { encryptToken, tryDecryptSecret } from "../services/crypto.service";
import { recordMessageEvent } from "../services/messageEvent.service";
import { buildCompleteSystemPrompt, resolveAgentDisplayName } from "../ai/systemPrompt";
import { ensureKnowledgeExtracted, buildFileContextSuffix } from "../services/knowledgeService";
import { safeLogError } from "../utils/redaction";
import { globalMemoryManager } from "../utils/ai/memoryManager";
import { splitLongText } from "../utils/textSplitter";

async function downloadTelegramFile(ctx: Context, filePath: string): Promise<Buffer | null> {
  try {
    const link = await ctx.telegram.getFileLink(filePath);
    const response = await fetch(link.href);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error("[downloadTelegramFile] Erro:", safeLogError(err));
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function getTelegramInstance() {
  let instance = await prisma.instance.findFirst();
  if (!instance) {
    instance = await prisma.instance.create({
      data: { name: "Agente Principal", typing: true, delayMin: 4000, delayMax: 7000 },
    });
  }
  return instance;
}

async function getDecryptedTelegramToken(instanceId: string): Promise<string | null> {
  const instance = await prisma.instance.findUnique({ where: { id: instanceId } });
  if (!instance?.telegramBotToken) return null;
  try {
    return tryDecryptSecret(instance.telegramBotToken);
  } catch {
    return null;
  }
}

async function handleTelegramMessage(ctx: Context) {
  const message = ctx.message;
  if (!message || !("chat" in message) || message.chat.type !== "private") return;

  const chatId = message.chat.id;
  const fromId = message.from?.id;
  if (!fromId) return;

  const instance = await getTelegramInstance();
  const hasTextMessage = "text" in message && typeof message.text === "string" && message.text.trim().length > 0;
  const hasAudioMessage = "audio" in message && Boolean(message.audio);
  const hasVoiceMessage = "voice" in message && Boolean(message.voice);
  const hasSupportedInboundContent = hasTextMessage || hasAudioMessage || hasVoiceMessage;
  if (!hasSupportedInboundContent) return;

  await recordMessageEvent({
    instanceId: instance.id,
    channel: "TELEGRAM",
    direction: "INBOUND",
    usedAi: instance.aiTelegramEnabled,
  });

  if (!instance.aiTelegramEnabled) return;

  let userContent: string | undefined;

  if (hasTextMessage && "text" in message) {
    userContent = message.text.trim();
  }

  if (!userContent && hasAudioMessage && "audio" in message && message.audio) {
    try {
      const audioFile = message.audio;
      const file = await ctx.telegram.getFile(audioFile.file_id);
      if (file && "file_path" in file && file.file_path) {
        const audioBuffer = await downloadTelegramFile(ctx, file.file_path);
        if (audioBuffer) {
          const transcribed = await transcribeAudio(instance.id, audioBuffer, audioFile.mime_type || "audio/mpeg", "pt");
          userContent = `[Áudio transcrito]: ${transcribed}`;
        }
      }
    } catch (err) {
      console.error("[Telegram] Erro ao transcrever áudio:", safeLogError(err));
    }
  }

  if (!userContent && hasVoiceMessage && "voice" in message && message.voice) {
    try {
      const voiceFile = message.voice;
      const file = await ctx.telegram.getFile(voiceFile.file_id);
      if (file && "file_path" in file && file.file_path) {
        const audioBuffer = await downloadTelegramFile(ctx, file.file_path);
        if (audioBuffer) {
          const transcribed = await transcribeAudio(instance.id, audioBuffer, voiceFile.mime_type || "audio/ogg", "pt");
          userContent = `[Nota de voz transcrita]: ${transcribed}`;
        }
      }
    } catch (err) {
      console.error("[Telegram] Erro ao transcrever nota de voz:", safeLogError(err));
    }
  }

  if (!userContent || !userContent.trim()) return;

  const knowledgeFiles = await prisma.file.findMany({
    where: { instanceId: instance.id, channel: "TELEGRAM" },
  });
  await ensureKnowledgeExtracted(
    knowledgeFiles as Array<{ id: string; mimetype: string; data: Buffer; extracted: string | null }>
  );
  const combinedKnowledge = buildFileContextSuffix(knowledgeFiles);

  const behavioral = await getResolvedTelegramPrompt(instance.id);
  const systemContent = buildCompleteSystemPrompt({
    agentName: resolveAgentDisplayName(instance),
    behavioralPrompt: behavioral,
    fileContextSuffix: combinedKnowledge,
  });

  const memoryKey = `${instance.id}:${fromId}`;
  const memory = globalMemoryManager.getMemory(memoryKey);
  globalMemoryManager.addMessage(memoryKey, "user", userContent);

  if (instance.typing) {
    const min = clamp(instance.delayMin ?? 4000, 4000, 7000);
    const max = clamp(instance.delayMax ?? 7000, 4000, 7000);
    await ctx.telegram.sendChatAction(chatId, "typing");
    await sleep(randomInt(min, Math.max(min, max)));
  }

  const aiResponse = await askChat(instance.id, [{ role: "system", content: systemContent }, ...memory]);
  const parts = splitLongText(aiResponse, 3500);
  if (parts.length === 0) return;

  for (let i = 0; i < parts.length; i++) {
    if (instance.typing) {
      await ctx.telegram.sendChatAction(chatId, "typing");
      await sleep(randomInt(700, 1400));
    }
    await ctx.telegram.sendMessage(chatId, parts[i]);
    await recordMessageEvent({
      instanceId: instance.id,
      channel: "TELEGRAM",
      direction: "OUTBOUND",
      usedAi: true,
    });
    if (i < parts.length - 1 && instance.typing) {
      await sleep(randomInt(900, 1600));
    }
  }

  globalMemoryManager.addMessage(memoryKey, "assistant", aiResponse);
}

export class TelegramBotManager {
  private static currentInstanceId: string | null = null;
  private static currentToken: string | null = null;
  private static bot: Telegraf<Context> | null = null;
  private static started = false;
  private static botLabel: string | null = null;

  static async startForInstance(instanceId: string) {
    const token = await getDecryptedTelegramToken(instanceId);
    if (!token) {
      console.log("[Telegram] Token não configurado para esta instância");
      return;
    }

    if (this.started && this.currentInstanceId === instanceId) {
      console.log("[Telegram] Bot já está rodando para esta instância");
      return;
    }

    await this.stop();

    this.currentInstanceId = instanceId;
    this.currentToken = token;

    const bot = new Telegraf(token);
    this.bot = bot;

    try {
      const me = await bot.telegram.getMe();
      this.botLabel = me.username ? `@${me.username}` : me.first_name || null;
    } catch (err) {
      console.warn("[Telegram] Não foi possível obter dados do bot:", safeLogError(err));
    }

    bot.on("message", async (messageCtx) => {
      try {
        await handleTelegramMessage(messageCtx);
      } catch (err) {
        console.error("[Telegram] Falha ao processar mensagem:", safeLogError(err));
      }
    });

    bot.catch((err) => {
      console.error("[Telegram] polling_error:", safeLogError(err));
    });

    void bot.launch();
    this.started = true;
    console.log("[Telegram] Bot iniciado com polling para instância:", instanceId);
  }

  static async stop() {
    if (!this.bot) return;
    try {
      this.bot.stop("manual-stop");
    } finally {
      this.bot = null;
      this.started = false;
      this.botLabel = null;
      this.currentInstanceId = null;
      this.currentToken = null;
    }
  }

  static async restartForInstance(instanceId: string) {
    await this.startForInstance(instanceId);
  }

  static getStatus() {
    return {
      online: this.started,
      label: this.botLabel,
      instanceId: this.currentInstanceId,
    };
  }

  static async isConfigured(instanceId: string): Promise<boolean> {
    const token = await getDecryptedTelegramToken(instanceId);
    return !!token;
  }

  static async validateToken(token: string): Promise<{ valid: boolean; botName?: string; error?: string }> {
    try {
      const testBot = new Telegraf(token);
      const me = await testBot.telegram.getMe();
      return { valid: true, botName: me.username || me.first_name || "Bot" };
    } catch (err: any) {
      if (err?.response?.error_code === 401) {
        return { valid: false, error: "Token inválido" };
      }
      if (err?.response?.error_code === 404) {
        return { valid: false, error: "Bot não encontrado" };
      }
      return { valid: false, error: "Erro ao validar token" };
    }
  }

  static async saveAndStart(instanceId: string, token: string): Promise<{ success: boolean; error?: string }> {
    const validation = await this.validateToken(token);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const encrypted = encryptToken(token);
    await prisma.instance.update({
      where: { id: instanceId },
      data: { telegramBotToken: encrypted },
    });

    await this.startForInstance(instanceId);
    return { success: true };
  }
}
