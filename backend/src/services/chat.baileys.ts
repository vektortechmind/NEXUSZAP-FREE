import type { WASocket, WAMessage } from "@whiskeysockets/baileys";
import { InstanceManager } from "../whatsapp/InstanceManager";

export class ChatInstanceOfflineError extends Error {
  code = "CHAT_INSTANCE_OFFLINE";

  constructor(instanceId: string) {
    super(`Instancia WhatsApp ${instanceId} nao esta conectada.`);
  }
}

export class ChatProviderSendError extends Error {
  code = "CHAT_PROVIDER_SEND_FAILED";

  constructor(message = "Falha ao enviar mensagem pelo WhatsApp.") {
    super(message);
  }
}

export type ChatBaileysAdapter = {
  sendTextMessage(input: { instanceId: string; jid: string; body: string; quotedMessage?: WAMessage | null }): Promise<{ providerMessageId: string | null; raw: WAMessage | null }>;
  sendMediaMessage(input: {
    instanceId: string;
    jid: string;
    messageType: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
    buffer: Buffer;
    mimeType: string;
    caption?: string | null;
    fileName?: string | null;
    quotedMessage?: WAMessage | null;
  }): Promise<{ providerMessageId: string | null; raw: WAMessage | null }>;
  sendReaction(input: { instanceId: string; jid: string; providerMessageId: string; emoji: string; targetFromMe: boolean }): Promise<void>;
  editMessage(input: { instanceId: string; jid: string; providerMessageId: string; body: string }): Promise<void>;
  deleteMessage(input: { instanceId: string; jid: string; providerMessageId: string }): Promise<void>;
  markRead(input: { instanceId: string; jid: string }): Promise<void>;
};

function getSocket(instanceId: string): WASocket {
  const sock = InstanceManager.get(instanceId);
  if (!sock) throw new ChatInstanceOfflineError(instanceId);
  return sock;
}

export const baileysChatAdapter: ChatBaileysAdapter = {
  async sendTextMessage(input) {
    const sock = getSocket(input.instanceId);
    try {
      const sent = await sock.sendMessage(input.jid, { text: input.body }, input.quotedMessage ? { quoted: input.quotedMessage } : undefined);
      return {
        providerMessageId: sent?.key?.id ?? null,
        raw: sent ?? null,
      };
    } catch (err) {
      if (err instanceof ChatInstanceOfflineError) throw err;
      throw new ChatProviderSendError(err instanceof Error ? err.message : undefined);
    }
  },

  async sendMediaMessage(input) {
    const sock = getSocket(input.instanceId);
    try {
      const payload = input.messageType === "IMAGE"
        ? { image: input.buffer, mimetype: input.mimeType, caption: input.caption ?? undefined }
        : input.messageType === "VIDEO"
          ? { video: input.buffer, mimetype: input.mimeType, caption: input.caption ?? undefined }
          : input.messageType === "AUDIO"
            ? { audio: input.buffer, mimetype: input.mimeType, ptt: true }
            : {
                document: input.buffer,
                mimetype: input.mimeType,
                fileName: input.fileName ?? "arquivo",
                caption: input.caption ?? undefined,
              };
      const sent = await sock.sendMessage(input.jid, payload, input.quotedMessage ? { quoted: input.quotedMessage } : undefined);
      return {
        providerMessageId: sent?.key?.id ?? null,
        raw: sent ?? null,
      };
    } catch (err) {
      if (err instanceof ChatInstanceOfflineError) throw err;
      throw new ChatProviderSendError(err instanceof Error ? err.message : undefined);
    }
  },

  async editMessage(input) {
    const sock = getSocket(input.instanceId);
    try {
      await sock.sendMessage(input.jid, {
        text: input.body,
        edit: { id: input.providerMessageId, remoteJid: input.jid, fromMe: true },
      });
    } catch (err) {
      if (err instanceof ChatInstanceOfflineError) throw err;
      throw new ChatProviderSendError(err instanceof Error ? err.message : undefined);
    }
  },

  async deleteMessage(input) {
    const sock = getSocket(input.instanceId);
    try {
      await sock.sendMessage(input.jid, {
        delete: { id: input.providerMessageId, remoteJid: input.jid, fromMe: true },
      });
    } catch (err) {
      if (err instanceof ChatInstanceOfflineError) throw err;
      throw new ChatProviderSendError(err instanceof Error ? err.message : undefined);
    }
  },

  async markRead(input) {
    const sock = getSocket(input.instanceId);
    try {
      await sock.chatModify({ markRead: true, lastMessages: [] }, input.jid);
    } catch (err) {
      if (err instanceof ChatInstanceOfflineError) throw err;
      throw new ChatProviderSendError(err instanceof Error ? err.message : undefined);
    }
  },

  async sendReaction(input) {
    const sock = getSocket(input.instanceId);
    try {
      await sock.sendMessage(input.jid, {
        react: {
          text: input.emoji,
          key: {
            id: input.providerMessageId,
            remoteJid: input.jid,
            fromMe: input.targetFromMe,
          },
        },
      });
    } catch (err) {
      if (err instanceof ChatInstanceOfflineError) throw err;
      throw new ChatProviderSendError(err instanceof Error ? err.message : undefined);
    }
  },
};
