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
import { writeChatMedia } from "../services/chat.mediaStorage";
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

async function downloadMediaFromMessage(sock: WASocket, m: proto.IWebMessageInfo): Promise<Buffer | null> {
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
    console.error("[downloadMediaFromMessage] Erro:", safeLogError(err));
    return null;
  }
}

function isViewOnceChatContent(content: WAMessageContent): boolean {
  const wrapped = content as WAMessageContent & {
    viewOnceMessage?: { message?: WAMessageContent | null };
    viewOnceMessageV2?: { message?: WAMessageContent | null };
  };
  return Boolean(wrapped.viewOnceMessage?.message || wrapped.viewOnceMessageV2?.message);
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

function unwrapChatContent(content: WAMessageContent, depth = 0): WAMessageContent {
  if (depth > 5) return content;
  const wrapped = content as WAMessageContent & {
    ephemeralMessage?: { message?: WAMessageContent | null };
    viewOnceMessage?: { message?: WAMessageContent | null };
    viewOnceMessageV2?: { message?: WAMessageContent | null };
    documentWithCaptionMessage?: { message?: WAMessageContent | null };
    editedMessage?: { message?: WAMessageContent | null };
  };
  const next = wrapped.ephemeralMessage?.message ||
    wrapped.viewOnceMessage?.message ||
    wrapped.viewOnceMessageV2?.message ||
    wrapped.documentWithCaptionMessage?.message ||
    wrapped.editedMessage?.message ||
    null;
  return next ? unwrapChatContent(extractMessageContent(normalizeMessageContent(next)) ?? next, depth + 1) : content;
}

export function resolveChatMessageType(content: WAMessageContent) {
  const resolved = unwrapChatContent(content);
  if (resolved !== content) return resolveChatMessageType(resolved);
  const protocolMessage = (resolved as { protocolMessage?: { editedMessage?: WAMessageContent } }).protocolMessage;
  if (protocolMessage?.editedMessage) return resolveChatMessageType(protocolMessage.editedMessage);
  if (resolved.imageMessage) return "IMAGE" as const;
  if (resolved.audioMessage) return "AUDIO" as const;
  if (resolved.videoMessage) return "VIDEO" as const;
  if (resolved.documentMessage) return "DOCUMENT" as const;
  if ((resolved as { buttonsResponseMessage?: unknown }).buttonsResponseMessage) return "BUTTONS_REPLY" as const;
  if ((resolved as { listResponseMessage?: unknown }).listResponseMessage) return "LIST_REPLY" as const;
  if (resolved.conversation || resolved.extendedTextMessage) return "TEXT" as const;
  return "UNKNOWN" as const;
}

export function shouldPersistChatMessage(input: { body: string | null; messageType: ReturnType<typeof resolveChatMessageType>; mediaMimeType?: string | null }) {
  if (input.body?.trim()) return true;
  if (input.messageType !== "UNKNOWN") return true;
  return Boolean(input.mediaMimeType?.toLowerCase().startsWith("audio/"));
}

export function resolveChatBody(content: WAMessageContent): string | null {
  const resolved = unwrapChatContent(content);
  const listResponse = (resolved as { listResponseMessage?: { title?: string; description?: string } }).listResponseMessage;
  const buttonsResponse = (resolved as { buttonsResponseMessage?: { selectedDisplayText?: string; selectedButtonId?: string } }).buttonsResponseMessage;
  const templateButtonReply = (resolved as { templateButtonReplyMessage?: { selectedDisplayText?: string; selectedId?: string } }).templateButtonReplyMessage;
  const interactiveResponse = (resolved as { interactiveResponseMessage?: { body?: { text?: string }; nativeFlowResponseMessage?: { name?: string } } }).interactiveResponseMessage;
  const protocolMessage = (resolved as { protocolMessage?: { editedMessage?: WAMessageContent } }).protocolMessage;
  if (protocolMessage?.editedMessage) return resolveChatBody(protocolMessage.editedMessage);
  return resolved.conversation ||
    resolved.extendedTextMessage?.text ||
    resolved.imageMessage?.caption ||
    resolved.videoMessage?.caption ||
    resolved.documentMessage?.caption ||
    resolved.documentMessage?.fileName ||
    listResponse?.title ||
    listResponse?.description ||
    buttonsResponse?.selectedDisplayText ||
    buttonsResponse?.selectedButtonId ||
    templateButtonReply?.selectedDisplayText ||
    templateButtonReply?.selectedId ||
    interactiveResponse?.body?.text ||
    interactiveResponse?.nativeFlowResponseMessage?.name ||
    null;
}

export async function handleIncomingMessage(sock: WASocket, instanceId: string, m: proto.IWebMessageInfo) {
  try {
    if (!m.message) return;
    const key = m.key;
    if (!key) return;
    const fromMe = Boolean(key.fromMe);

    const remoteJid = key.remoteJid;
    if (!remoteJid || remoteJid.includes("@g.us")) return;
    if (isJidStatusBroadcast(remoteJid)) return;
    const remoteJidAlt = (key as WAMessageKey).remoteJidAlt ?? null;

    recordLastMessageForChat(instanceId, remoteJid, m);

    const instance = (await prisma.instance.findUnique({ where: { id: instanceId } })) as Instance | null;
    if (!instance) return;

    if (!fromMe && instance.aiWhatsappEnabled) {
      try {
        await sock.readMessages([key]);
        await sock.sendPresenceUpdate("available", remoteJid);
      } catch (e) {
        console.warn("[Baileys] readMessages / available:", safeLogError(e));
      }
    }

    const raw: WAMessageContent = m.message;
    const norm = normalizeMessageContent(raw);
    if (!norm) return;
    const isViewOnce = isViewOnceChatContent(norm);
    const content = unwrapChatContent(extractMessageContent(norm) ?? norm);
    if (!content) return;

    const protocolMessage = (content as { protocolMessage?: proto.Message.IProtocolMessage }).protocolMessage;
    if (protocolMessage && protocolMessage.type === proto.Message.ProtocolMessage.Type.REVOKE) {
      const targetProviderMessageId = protocolMessage.key?.id;
      if (typeof targetProviderMessageId === "string") {
        await chatService.markMessageDeleted({ instanceId, providerMessageId: targetProviderMessageId });
      }
      return;
    }
    if (protocolMessage && protocolMessage.type === proto.Message.ProtocolMessage.Type.MESSAGE_EDIT) {
      const targetProviderMessageId = protocolMessage.key?.id;
      if (typeof targetProviderMessageId === "string" && protocolMessage.editedMessage) {
        await chatService.editMessageFromProvider({
          instanceId,
          providerMessageId: targetProviderMessageId,
          body: resolveChatBody(protocolMessage.editedMessage),
        });
      }
      return;
    }

    const reactionMessage = (content as { reactionMessage?: { key?: { id?: string | null }; text?: string | null } }).reactionMessage;
    if (reactionMessage?.key && typeof reactionMessage.key.id === "string") {
      await chatService.persistReaction({
        instanceId,
        jid: remoteJid,
        targetProviderMessageId: reactionMessage.key.id,
        emoji: reactionMessage.text ?? null,
      });
      return;
    }

    const resolvedChatBody = resolveChatBody(content);
    const chatMessageType = resolveChatMessageType(content);
    const mediaMessage = content.imageMessage || content.videoMessage || content.audioMessage || null;
    const chatBody = isViewOnce && mediaMessage
      ? ["Visualizacao unica", resolvedChatBody].filter(Boolean).join("\n")
      : resolvedChatBody;
    const textMsg =
      chatBody ||
      (content as { listResponseMessage?: { title?: string } }).listResponseMessage?.title ||
      "";

    const audioMessage = content.audioMessage;
    const imageMessage = content.imageMessage;
    const videoMessage = content.videoMessage;
    let audioBuffer: Buffer | null = null;
    let mediaBuffer: Buffer | null = null;
    const messageInput = {
      instanceId,
      jid: remoteJid,
      remoteJidAlt,
      body: chatBody,
      messageType: chatMessageType,
      providerMessageId: key.id ?? null,
      mediaUrl: null,
      mediaMimeType: audioMessage?.mimetype || imageMessage?.mimetype || videoMessage?.mimetype || content.documentMessage?.mimetype || null,
      mediaDurationMs: audioMessage?.seconds ? Number(audioMessage.seconds) * 1000 : null,
      createdAt: messageDateFromBaileysTimestamp(m.messageTimestamp),
    };
    if (!shouldPersistChatMessage(messageInput)) return;

    const persistedMessage = fromMe
      ? await chatService.persistOutboundMessage({ ...messageInput, status: "SENT" })
      : await chatService.persistInboundMessage({ ...messageInput, contactName: m.pushName ?? null });

    if (mediaMessage && key.id && !persistedMessage.mediaUrl) {
      mediaBuffer = await downloadMediaFromMessage(sock, m);
      if (mediaBuffer && mediaBuffer.length > 0) {
        try {
          const stored = await writeChatMedia({
            instanceId,
            providerMessageId: key.id,
            buffer: mediaBuffer,
            messageType: chatMessageType === "IMAGE" || chatMessageType === "VIDEO" || chatMessageType === "AUDIO" || chatMessageType === "DOCUMENT" ? chatMessageType : undefined,
            mimeType: audioMessage?.mimetype || imageMessage?.mimetype || videoMessage?.mimetype || content.documentMessage?.mimetype || null,
          });
          await chatService.attachMessageMedia({
            instanceId,
            messageId: persistedMessage.id,
            mediaUrl: stored.mediaUrl,
            mediaMimeType: audioMessage?.mimetype || imageMessage?.mimetype || videoMessage?.mimetype || null,
            mediaDurationMs: audioMessage?.seconds ? Number(audioMessage.seconds) * 1000 : null,
          });
        } catch (err) {
          console.error("[Chat] Falha ao salvar midia recebida:", safeLogError(err));
        }
      }
    }

    if (audioMessage) audioBuffer = mediaBuffer;

    if (fromMe) return;

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
        remoteJidAlt,
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
