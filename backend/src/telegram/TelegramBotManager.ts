import { Telegraf, Context } from "telegraf";
import { prisma } from "../database/prisma";
import { askChat, transcribeAudio } from "../ai/providerSelector";
import { getResolvedTelegramPrompt } from "../services/agentPrompt";
import { buildCompleteSystemPrompt, resolveAgentDisplayName } from "../ai/systemPrompt";
import { extractTextFromBuffer } from "../services/fileExtractor";
import { encryptToken, decryptToken, maskToken } from "../services/crypto.service";

type MemoryItem = { role: "user" | "assistant"; content: string };

const userMemory = new Map<string, MemoryItem[]>();

async function downloadTelegramFile(ctx: Context, filePath: string): Promise<Buffer | null> {
  try {
    const link = await ctx.telegram.getFileLink(filePath);
    const response = await fetch(link.href);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error("[downloadTelegramFile] Erro:", err);
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

function splitLongTextForTelegram(text: string, maxChunkLen = 3500): string[] {
  const t = String(text ?? "").trim();
  if (!t) return [];
  const paragraphs = t.split(/\n{2,}/g).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  for (const p of paragraphs) {
    const v = p.trim();
    if (!v) continue;
    if (v.length <= maxChunkLen) {
      chunks.push(v);
    } else {
      const sentences = v.split(/(?<=[.!?])\s+/g);
      let current = "";
      for (const sentence of sentences) {
        const candidate = current ? `${current} ${sentence}` : sentence;
        if (candidate.length <= maxChunkLen) {
          current = candidate;
        } else {
          if (current) chunks.push(current.trim());
          current = sentence;
          while (current.length > maxChunkLen) {
            chunks.push(current.slice(0, maxChunkLen));
            current = current.slice(maxChunkLen);
          }
        }
      }
      if (current.trim()) chunks.push(current.trim());
    }
  }
  return chunks;
}

async function getTelegramInstance() {
  let instance = await prisma.instance.findFirst();
  if (!instance) {
    instance = await prisma.instance.create({
      data: { name: "Agente Principal", typing: true, delayMin: 4000, delayMax: 7000 }
    });
  }
  return instance;
}

async function getDecryptedTelegramToken(instanceId: string): Promise<string | null> {
  const instance = await prisma.instance.findUnique({ where: { id: instanceId } });
  if (!instance?.telegramBotToken) return null;
  try {
    return decryptToken(instance.telegramBotToken);
  } catch {
    return null;
  }
}

async function ensureKnowledgeExtracted(
  files: Array<{ id: string; mimetype: string; data: Buffer; extracted: string | null }>
) {
  for (const file of files) {
    if (file.extracted && file.extracted.trim()) continue;
    const canExtract = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/json",
      "text/plain"
    ].includes(file.mimetype);
    if (!canExtract) continue;
    try {
      const text = await extractTextFromBuffer(Buffer.from(file.data), file.mimetype);
      if (text && text.trim()) {
        await prisma.file.update({ where: { id: file.id }, data: { extracted: text } });
        file.extracted = text;
      }
    } catch { }
  }
}

async function handleTelegramMessage(ctx: Context) {
  const message = ctx.message;
  if (!message || !("chat" in message) || message.chat.type !== "private") return;
  
  const chatId = message.chat.id;
  const fromId = message.from?.id;
  if (!fromId) return;

  const instance = await getTelegramInstance();
  if (!instance.aiTelegramEnabled) return;

  let userContent: string | undefined;

  if ("text" in message && typeof message.text === "string") {
    userContent = message.text.trim();
  }
  
  if (!userContent && "audio" in message && message.audio) {
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
      console.error("[Telegram] Erro ao transcrever áudio:", err);
    }
  }

  if (!userContent && "voice" in message && message.voice) {
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
      console.error("[Telegram] Erro ao transcrever nota de voz:", err);
    }
  }

  if (!userContent || !userContent.trim()) return;

  const knowledgeFiles = await prisma.file.findMany({
    where: { instanceId: instance.id, channel: "TELEGRAM" }
  });
  await ensureKnowledgeExtracted(knowledgeFiles as Array<{ id: string; mimetype: string; data: Buffer; extracted: string | null }>);
  const extractedParts = knowledgeFiles.map((f) => f.extracted).filter((t): t is string => typeof t === "string" && t.trim().length > 0);
  const combinedKnowledge = extractedParts.length > 0
    ? "\n[CONTEXTO DE ARQUIVOS]:\n" + extractedParts.join("\n---\n") + "\n[FIM DO CONTEXTO]\n"
    : undefined;

  const behavioral = await getResolvedTelegramPrompt(instance.id);
  const systemContent = buildCompleteSystemPrompt({
    agentName: resolveAgentDisplayName(instance),
    behavioralPrompt: behavioral,
    fileContextSuffix: combinedKnowledge
  });

  const memoryKey = `${instance.id}:${fromId}`;
  let memory = userMemory.get(memoryKey) ?? [];
  memory.push({ role: "user", content: userContent });
  if (memory.length > 15) memory = memory.slice(memory.length - 15);
  userMemory.set(memoryKey, memory);

  if (instance.typing) {
    const min = clamp(instance.delayMin ?? 4000, 4000, 7000);
    const max = clamp(instance.delayMax ?? 7000, 4000, 7000);
    await ctx.telegram.sendChatAction(chatId, "typing");
    await sleep(randomInt(min, Math.max(min, max)));
  }

  const aiResponse = await askChat(instance.id, [{ role: "system", content: systemContent }, ...memory]);
  const parts = splitLongTextForTelegram(aiResponse, 3500);
  if (parts.length === 0) return;

  for (let i = 0; i < parts.length; i++) {
    if (instance.typing) {
      await ctx.telegram.sendChatAction(chatId, "typing");
      await sleep(randomInt(700, 1400));
    }
    await ctx.telegram.sendMessage(chatId, parts[i]);
    if (i < parts.length - 1 && instance.typing) {
      await sleep(randomInt(900, 1600));
    }
  }

  let finalMemory = userMemory.get(memoryKey) ?? memory;
  finalMemory.push({ role: "assistant", content: aiResponse });
  if (finalMemory.length > 15) finalMemory = finalMemory.slice(finalMemory.length - 15);
  userMemory.set(memoryKey, finalMemory);
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
      console.warn("[Telegram] Não foi possível obter dados do bot:", err);
    }

    bot.on("message", async (ctx) => {
      try {
        await handleTelegramMessage(ctx);
      } catch (err) {
        console.error("[Telegram] Falha ao processar mensagem:", err);
      }
    });

    bot.catch((err) => {
      console.error("[Telegram] polling_error:", err);
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
      instanceId: this.currentInstanceId
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
      data: { telegramBotToken: encrypted }
    });

    await this.startForInstance(instanceId);
    return { success: true };
  }
}
