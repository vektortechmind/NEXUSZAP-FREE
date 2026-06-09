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
  sendReaction(input: { instanceId: string; jid: string; providerMessageId: string; emoji: string; targetFromMe: boolean }): Promise<void>;
  editMessage(input: { instanceId: string; jid: string; providerMessageId: string; body: string }): Promise<void>;
  deleteMessage(input: { instanceId: string; jid: string; providerMessageId: string }): Promise<void>;
  clearChat(input: { instanceId: string; jid: string }): Promise<void>;
  markRead(input: { instanceId: string; jid: string }): Promise<void>;
  getContactProfile(input: { instanceId: string; jid: string }): Promise<{ name: string | null; profilePicUrl: string | null }>;
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

  async clearChat(input) {
    const sock = getSocket(input.instanceId);
    try {
      await sock.chatModify({ clear: true, lastMessages: [] }, input.jid);
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

  async getContactProfile(input) {
    const sock = InstanceManager.get(input.instanceId);
    if (!sock) return { name: null, profilePicUrl: null };

    let profilePicUrl: string | null = null;
    try {
      profilePicUrl = typeof sock.profilePictureUrl === "function"
        ? (await sock.profilePictureUrl(input.jid, "image")) ?? null
        : null;
    } catch {
      profilePicUrl = null;
    }

    return { name: null, profilePicUrl };
  },
};
