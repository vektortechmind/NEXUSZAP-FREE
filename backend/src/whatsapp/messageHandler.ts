import {
  WASocket,
  WAMessageKey,
  proto,
  extractMessageContent,
  normalizeMessageContent,
  isJidStatusBroadcast,
  downloadMediaMessage
} from "@whiskeysockets/baileys";
import { prisma } from "../database/prisma";
import { CHAT_MEMORY_MAX_MESSAGES } from "../ai/chatMemory";
import { askChat, transcribeAudio } from "../ai/providerSelector";
import { getResolvedAgentPrompt } from "../services/agentPrompt";
import { buildCompleteSystemPrompt, resolveAgentDisplayName } from "../ai/systemPrompt";
import { resolveContactPhoneDisplay } from "../utils/whatsappJid";
import { recordLastMessageForChat } from "./lastMessageCache";
import { extractTextFromBuffer } from "../services/fileExtractor";

const chatMemory = new Map<string, { role: "user" | "assistant" | "system", content: string }[]>();

/**
 * Baixa o áudio de uma mensagem do WhatsApp e retorna como Buffer.
 */
async function downloadAudioFromMessage(sock: WASocket, m: proto.IWebMessageInfo): Promise<Buffer | null> {
  try {
    const buffer = await downloadMediaMessage(
      m as any,
      "buffer",
      {},
      { 
        logger: console as any,
        reuploadRequest: sock.updateMediaMessage 
      }
    );
    return buffer ? Buffer.from(buffer) : null;
  } catch (err) {
    console.error("[downloadAudioFromMessage] Erro:", err);
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Mantém o indicador "digitando..." ativo durante esperas longas (o cliente costuma esconder se não houver renovação). */
async function sleepWithComposingRefresh(sock: WASocket, remoteJid: string, totalMs: number) {
  if (totalMs <= 0) return;
  const step = 2500;
  let elapsed = 0;
  while (elapsed < totalMs) {
    try {
      await sock.sendPresenceUpdate("composing", remoteJid);
    } catch {
      /* ignore */
    }
    const chunk = Math.min(step, totalMs - elapsed);
    await sleep(chunk);
    elapsed += chunk;
  }
}

/** Composição imediata + renovação periódica enquanto a operação assíncrona roda (ex.: resposta da IA). */
async function withComposingWhile<T>(
  sock: WASocket,
  remoteJid: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    await sock.sendPresenceUpdate("composing", remoteJid);
  } catch {
    /* ignore */
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

function splitLongTextForWhatsApp(text: string, maxChunkLen = 800): string[] {
  const t = String(text ?? "").trim();
  if (!t) return [];

  // 1) quebra por parágrafos
  const paragraphs = t.split(/\n{2,}/g).map((p) => p.trim()).filter(Boolean);

  const chunks: string[] = [];
  const push = (s: string) => {
    const v = s.trim();
    if (!v) return;
    if (v.length <= maxChunkLen) {
      chunks.push(v);
      return;
    }
    // 2) se ainda estiver grande, quebra por frases
    const sentences = v.split(/(?<=[.!?])\s+/g);
    let cur = "";
    for (const sentence of sentences) {
      const candidate = cur ? `${cur} ${sentence}` : sentence;
      if (candidate.length <= maxChunkLen) {
        cur = candidate;
      } else {
        if (cur) chunks.push(cur.trim());
        cur = sentence;
        // 3) fallback: quebra “na marra”
        while (cur.length > maxChunkLen) {
          chunks.push(cur.slice(0, maxChunkLen));
          cur = cur.slice(maxChunkLen);
        }
      }
    }
    if (cur.trim()) chunks.push(cur.trim());
  };

  for (const p of paragraphs) push(p);
  return chunks;
}

async function ensureKnowledgeExtracted(
  files: Array<{ id: string; mimetype: string; data: Buffer; extracted: string | null }>
) {
  for (const f of files) {
    if (f.extracted && f.extracted.trim()) continue;
    const canExtract = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/json",
      "text/plain"
    ].includes(f.mimetype);
    if (!canExtract) continue;
    try {
      const text = await extractTextFromBuffer(Buffer.from(f.data), f.mimetype);
      if (text && text.trim()) {
        await prisma.file.update({
          where: { id: f.id },
          data: { extracted: text }
        });
        f.extracted = text;
      }
    } catch {
      // Mantém sem extracted caso o arquivo seja inválido/ilegível.
    }
  }
}

export async function handleIncomingMessage(
  sock: WASocket,
  instanceId: string,
  m: proto.IWebMessageInfo
) {
  try {
    if (!m.message) return;
    const key = m.key;
    if (!key || key.fromMe) return;

    const remoteJid = key.remoteJid;
    if (!remoteJid || remoteJid.includes("@g.us")) return;
    /** Stories / Status do WhatsApp — não tratar como conversa de cliente */
    if (isJidStatusBroadcast(remoteJid)) return;

    recordLastMessageForChat(instanceId, remoteJid, m);

    const instance = await prisma.instance.findUnique({ where: { id: instanceId } });
    if (!instance) return;

    // Só marca como lida / presença quando a automação (IA) está ativa — senão o contato vê "visualização" instantânea sem atendimento automático.
    if (instance.aiWhatsappEnabled) {
      try {
        await sock.readMessages([key]);
        await sock.sendPresenceUpdate("available", remoteJid);
      } catch (e) {
        console.warn("[Baileys] readMessages / available:", e);
      }
    }

    const raw = m.message;
    const norm = normalizeMessageContent(raw as any);
    const content = extractMessageContent(norm as any) ?? norm;
    if (!content) return;

    const textMsg =
      content.conversation ||
      content.extendedTextMessage?.text ||
      (content as { listResponseMessage?: { title?: string } }).listResponseMessage?.title ||
      "";

    if (!instance.aiWhatsappEnabled) return;

    // Detectar e transcrever áudio (notas de voz do WhatsApp)
    let userContent: string | undefined = textMsg || undefined;

    // Verificar se é mensagem de áudio (nota de voz)
    const audioMessage = content.audioMessage;
    if (audioMessage && instance.aiWhatsappEnabled) {
      try {
        // Baixar sempre que houver audioMessage — fileEncSha256 é opcional no proto;
        // exigir esse campo impedia o download em várias notas de voz.
        const audioBuffer = await downloadAudioFromMessage(sock, m);

        if (audioBuffer && audioBuffer.length > 0) {
          const mimeType = audioMessage.mimetype || "audio/ogg; codecs=opus";
          const transcribed = await transcribeAudio(instanceId, audioBuffer, mimeType, "pt");
          userContent = `[Áudio transcrito]: ${transcribed}`;
          console.log(`[WhatsApp] Áudio transcrito: ${transcribed.slice(0, 100)}...`);
        } else {
          console.warn("[WhatsApp] Áudio: download retornou buffer vazio ou nulo");
        }
      } catch (err) {
        console.error("[WhatsApp] Erro ao transcrever áudio:", err);
      }
    }

    if (!userContent || !String(userContent).trim()) return;

    if (instance.typing) {
      try {
        await sock.sendPresenceUpdate("composing", remoteJid);
      } catch {
        /* ignore */
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

    const runAgentReply = async () => {
      const phoneDisplay = await resolveContactPhoneDisplay(
        sock,
        remoteJid,
        (key as WAMessageKey).remoteJidAlt
      );
      const pushName = m.pushName || undefined;

      let memory = chatMemory.get(remoteJid) || [];

      let lastAssistantContent: string | null = null;
      for (let i = memory.length - 1; i >= 0; i--) {
        if (memory[i].role === "assistant") {
          lastAssistantContent = memory[i].content;
          break;
        }
      }

      memory.push({ role: "user", content: userContent });
      if (memory.length > CHAT_MEMORY_MAX_MESSAGES) memory.shift();
      chatMemory.set(remoteJid, memory);

      const knowledgeFiles = await prisma.file.findMany({
        where: { instanceId, channel: "WHATSAPP" },
        orderBy: { createdAt: "asc" }
      });
      await ensureKnowledgeExtracted(knowledgeFiles as Array<{ id: string; mimetype: string; data: Buffer; extracted: string | null }>);

      const extractedParts = knowledgeFiles
        .map((f) => f.extracted)
        .filter((t): t is string => typeof t === "string" && t.trim().length > 0);
      let combinedKnowledge = "";
      if (extractedParts.length > 0) {
        combinedKnowledge =
          "\n[CONTEXTO DE ARQUIVOS (priorize quando relevante)]:\n" +
          extractedParts.join("\n---\n") +
          "\n[FIM DO CONTEXTO]\n";
      }
      const behavioral = await getResolvedAgentPrompt(instanceId);
      const systemContent = buildCompleteSystemPrompt({
        agentName: resolveAgentDisplayName(instance),
        behavioralPrompt: behavioral,
        fileContextSuffix: combinedKnowledge.trim() || undefined
      });

      const messagesForAi = [
        { role: "system" as const, content: systemContent },
        ...memory
      ];

      return askChat(instanceId, messagesForAi);
    };

    const aiResponse = instance.typing
      ? await withComposingWhile(sock, remoteJid, runAgentReply)
      : await runAgentReply();

    const parts = splitLongTextForWhatsApp(aiResponse, 800);
    if (parts.length === 0) return;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (instance.typing) {
        try {
          await sock.sendPresenceUpdate("composing", remoteJid);
        } catch {
          /* ignore */
        }
        await sleep(randomInt(900, 1700));
      }

      const sent = await sock.sendMessage(remoteJid, { text: part });
      if (sent) recordLastMessageForChat(instanceId, remoteJid, sent);

      if (instance.typing) {
        try {
          await sock.sendPresenceUpdate("paused", remoteJid);
        } catch {
          /* ignore */
        }
      }

      // delay humano entre “frases”/partes (exceto na última)
      if (i < parts.length - 1) {
        await sleep(randomInt(4000, 7000));
      }
    }

    let mem = chatMemory.get(remoteJid) || [];
    mem.push({ role: "assistant", content: aiResponse });
    if (mem.length > CHAT_MEMORY_MAX_MESSAGES) mem.shift();
    chatMemory.set(remoteJid, mem);
  } catch (err) {
    console.error(`[CRÍTICO] Falha no handleIncomingMessage:`, err);
  }
}
