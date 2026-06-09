import {
  WASocket,
  WAMessage,
  WAMessageContent,
  WAMessageKey,
  proto,
  extractMessageContent,
  normalizeMessageContent,
  isJidStatusBroadcast,
  downloadMediaMessage,
} from "@whiskeysockets/baileys";
import type { Instance } from "@prisma/client";
import { prisma } from "../database/prisma";
import { askChat, getKeys, isAudioTranscriptionEnabled, transcribeAudio } from "../ai/providerSelector";
import { getResolvedAgentPrompt } from "../services/runtime-ai/agentPrompt.service";
import { buildCompleteSystemPrompt, resolveAgentDisplayName } from "../ai/systemPrompt";
import { recordMessageEvent } from "../services/analytics/messageEvent.service";
import { chatService } from "../services/chat.service";
import { resolveContactPhoneDisplay } from "../utils/whatsappJid";
import { recordLastMessageForChat } from "./lastMessageCache";
import { globalMemoryManager } from "../utils/ai/memoryManager";
import { splitLongText } from "../utils/textSplitter";
import {
  ensureKnowledgeExtracted,
  buildFileContextSuffix,
  listKnowledgeFilesByInstance,
} from "../services/knowledge/knowledge.service";
import { safeLogError } from "../utils/redaction";

type MediaDownloadContext = NonNullable<Parameters<typeof downloadMediaMessage>[3]>;

function hasRequiredMessageKey(m: proto.IWebMessageInfo): m is WAMessage {
  return Boolean(m.key);
}

const silentBaileysLogger: MediaDownloadContext["logger"] = {
  level: "silent",
  child: () => silentBaileysLogger,
  trace(_obj: unknown, _msg?: string) {},
  debug(_obj: unknown, _msg?: string) {},
  info(_obj: unknown, _msg?: string) {},
  warn(_obj: unknown, _msg?: string) {},
  error(_obj: unknown, _msg?: string) {},
};

async function downloadAudioFromMessage(sock: WASocket, m: proto.IWebMessageInfo): Promise<Buffer | null> {
  try {
    if (!hasRequiredMessageKey(m)) return null;
    const buffer = await downloadMediaMessage(
      m,
      "buffer",
      {},
      {
        logger: silentBaileysLogger,
        reuploadRequest: sock.updateMediaMessage,
      }
    );
    return buffer ? Buffer.from(buffer) : null;
  } catch (err) {
    console.error("[downloadAudioFromMessage] Erro:", safeLogError(err));
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sleepWithComposingRefresh(sock: WASocket, remoteJid: string, totalMs: number) {
  if (totalMs <= 0) return;
  const step = 2500;
  let elapsed = 0;
  while (elapsed < totalMs) {
    try {
      await sock.sendPresenceUpdate("composing", remoteJid);
    } catch {
      // ignore presence refresh failures
    }
    const chunk = Math.min(step, totalMs - elapsed);
    await sleep(chunk);
    elapsed += chunk;
  }
}

async function withComposingWhile<T>(sock: WASocket, remoteJid: string, fn: () => Promise<T>): Promise<T> {
  try {
    await sock.sendPresenceUpdate("composing", remoteJid);
  } catch {
    // ignore composing failures
  }
  const id = setInterval(() => {
    void sock.sendPresenceUpdate("composing", remoteJid).catch(() => {});
  }, 3500);
  try {
    return await fn();
  } finally {
    clearInterval(id);
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function randomInt(min: number, max: number) {
  const a = Math.ceil(min);
  const b = Math.floor(max);
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function messageDateFromBaileysTimestamp(timestamp: proto.IWebMessageInfo["messageTimestamp"]): Date | undefined {
  if (!timestamp) return undefined;
  const raw = typeof timestamp === "number"
    ? timestamp
    : typeof timestamp === "string"
      ? Number(timestamp)
      : typeof timestamp === "object" && "toNumber" in timestamp && typeof timestamp.toNumber === "function"
        ? timestamp.toNumber()
        : Number(timestamp);
  if (!Number.isFinite(raw) || raw <= 0) return undefined;
  return new Date(raw * 1000);
}

function resolveChatMessageType(content: WAMessageContent) {
  if (content.imageMessage) return "IMAGE" as const;
  if (content.audioMessage) return "AUDIO" as const;
  if (content.documentMessage) return "DOCUMENT" as const;
  if ((content as { buttonsResponseMessage?: unknown }).buttonsResponseMessage) return "BUTTONS_REPLY" as const;
  if ((content as { listResponseMessage?: unknown }).listResponseMessage) return "LIST_REPLY" as const;
  if (content.conversation || content.extendedTextMessage) return "TEXT" as const;
  return "UNKNOWN" as const;
}

function resolveChatBody(content: WAMessageContent): string | null {
  return content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.documentMessage?.caption ||
    (content as { listResponseMessage?: { title?: string; description?: string } }).listResponseMessage?.title ||
    (content as { buttonsResponseMessage?: { selectedDisplayText?: string } }).buttonsResponseMessage?.selectedDisplayText ||
    null;
}

export async function handleIncomingMessage(sock: WASocket, instanceId: string, m: proto.IWebMessageInfo) {
  try {
    if (!m.message) return;
    const key = m.key;
    if (!key || key.fromMe) return;

    const remoteJid = key.remoteJid;
    if (!remoteJid || remoteJid.includes("@g.us")) return;
    if (isJidStatusBroadcast(remoteJid)) return;

    recordLastMessageForChat(instanceId, remoteJid, m);

    const instance = (await prisma.instance.findUnique({ where: { id: instanceId } })) as Instance | null;
    if (!instance) return;

    if (instance.aiWhatsappEnabled) {
      try {
        await sock.readMessages([key]);
        await sock.sendPresenceUpdate("available", remoteJid);
      } catch (e) {
        console.warn("[Baileys] readMessages / available:", safeLogError(e));
      }
    }

    const raw: WAMessageContent = m.message;
    const norm = normalizeMessageContent(raw);
    const content = extractMessageContent(norm) ?? norm;
    if (!content) return;

    const textMsg =
      content.conversation ||
      content.extendedTextMessage?.text ||
      (content as { listResponseMessage?: { title?: string } }).listResponseMessage?.title ||
      "";

    const audioMessage = content.audioMessage;
    await chatService.persistInboundMessage({
      instanceId,
      jid: remoteJid,
      body: resolveChatBody(content),
      messageType: resolveChatMessageType(content),
      providerMessageId: key.id ?? null,
      mediaMimeType: audioMessage?.mimetype || content.imageMessage?.mimetype || content.documentMessage?.mimetype || null,
      mediaDurationMs: audioMessage?.seconds ? Number(audioMessage.seconds) * 1000 : null,
      createdAt: messageDateFromBaileysTimestamp(m.messageTimestamp),
      contactName: m.pushName ?? null,
    });

    const hasSupportedInboundContent = Boolean(textMsg.trim() || audioMessage);
    if (!hasSupportedInboundContent) return;

    await recordMessageEvent({
      instanceId,
      channel: "WHATSAPP",
      direction: "INBOUND",
      usedAi: instance.aiWhatsappEnabled,
    });

    if (!instance.aiWhatsappEnabled) return;

    let userContent: string | undefined = textMsg || undefined;

    if (audioMessage && await isAudioTranscriptionEnabled(instanceId)) {
      try {
        const audioBuffer = await downloadAudioFromMessage(sock, m);
        if (audioBuffer && audioBuffer.length > 0) {
          const mimeType = audioMessage.mimetype || "audio/ogg; codecs=opus";
          const transcribed = await transcribeAudio(instanceId, audioBuffer, mimeType, "pt");
          userContent = `[Áudio transcrito]: ${transcribed}`;
          console.log("[WhatsApp] Áudio transcrito com sucesso.");
        } else {
          console.warn("[WhatsApp] Áudio: download retornou buffer vazio ou nulo");
        }
      } catch (err) {
        console.error("[WhatsApp] Erro ao transcrever áudio:", safeLogError(err));
      }
    }

    if (!userContent || !String(userContent).trim()) return;

    if (instance.typing) {
      try {
        await sock.sendPresenceUpdate("composing", remoteJid);
      } catch {
        // ignore composing failures
      }
    }

    if (instance.typing && textMsg) {
      const min = clamp(instance.delayMin ?? 4000, 4000, 7000);
      const max = clamp(instance.delayMax ?? 7000, 4000, 7000);
      const safeMax = Math.max(min, max);
      const delay = randomInt(min, safeMax);
      await sleepWithComposingRefresh(sock, remoteJid, delay);
    } else if (instance.typing) {
      await sleepWithComposingRefresh(sock, remoteJid, randomInt(4000, 7000));
    }

    const memoryKey = `${instanceId}:${remoteJid}`;

    const runAgentReply = async () => {
      await resolveContactPhoneDisplay(sock, remoteJid, (key as WAMessageKey).remoteJidAlt);
      globalMemoryManager.addMessage(memoryKey, "user", userContent);
      const { memoryLimit } = await getKeys(instanceId);
      const memory = globalMemoryManager.getMemory(memoryKey, memoryLimit);

      const knowledgeFiles = (await listKnowledgeFilesByInstance(instanceId, "WHATSAPP")) ?? [];
      await ensureKnowledgeExtracted(
        knowledgeFiles as Array<{ id: string; mimetype: string; data: Buffer; extracted: string | null }>
      );
      const combinedKnowledge = buildFileContextSuffix(knowledgeFiles) || "";
      const behavioral = await getResolvedAgentPrompt(instanceId);
      const systemContent = buildCompleteSystemPrompt({
        agentName: resolveAgentDisplayName(instance),
        behavioralPrompt: behavioral,
        fileContextSuffix: combinedKnowledge.trim() || undefined,
      });

      const messagesForAi = [{ role: "system" as const, content: systemContent }, ...memory];
      return askChat(instanceId, messagesForAi);
    };

    const aiResponse = instance.typing
      ? await withComposingWhile(sock, remoteJid, runAgentReply)
      : await runAgentReply();

    const parts = splitLongText(aiResponse, 800);
    if (parts.length === 0) return;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (instance.typing) {
        try {
          await sock.sendPresenceUpdate("composing", remoteJid);
        } catch {
          // ignore composing failures
        }
        await sleep(randomInt(900, 1700));
      }

      const sent = await sock.sendMessage(remoteJid, { text: part });
      if (sent) recordLastMessageForChat(instanceId, remoteJid, sent);
      await chatService.persistOutboundMessage({
        instanceId,
        jid: remoteJid,
        body: part,
        messageType: "TEXT",
        status: "SENT",
        providerMessageId: sent?.key?.id ?? null,
      });
      await recordMessageEvent({
        instanceId,
        channel: "WHATSAPP",
        direction: "OUTBOUND",
        usedAi: true,
      });

      if (instance.typing) {
        try {
          await sock.sendPresenceUpdate("paused", remoteJid);
        } catch {
          // ignore paused failures
        }
      }

      if (i < parts.length - 1) {
        await sleep(randomInt(4000, 7000));
      }
    }

    globalMemoryManager.addMessage(memoryKey, "assistant", aiResponse);
  } catch (err) {
    console.error("[CRÍTICO] Falha no handleIncomingMessage:", safeLogError(err));
  }
}
