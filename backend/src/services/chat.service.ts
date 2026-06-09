import type { ChatMessageStatus, ChatMessageType, MessageDirection } from "@prisma/client";
import { WAMessageStatus, type WAMessageUpdate } from "@whiskeysockets/baileys";
import { prisma } from "../database/prisma";
import { safeLogError } from "../utils/redaction";
import { recordMessageEvent } from "./analytics/messageEvent.service";
import { readChatMedia } from "./chat.mediaStorage";
import {
  baileysChatAdapter,
  ChatInstanceOfflineError,
  ChatProviderSendError,
  type ChatBaileysAdapter,
} from "./chat.baileys";
import { chatRealtime } from "./chat.realtime";

export type ChatConversation = {
  id: string;
  instanceId: string;
  jid: string;
  name: string | null;
  profilePicUrl: string | null;
  lastMessageAt: Date;
  unreadCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  instanceId: string;
  jid: string;
  fromMe: boolean;
  body: string | null;
  messageType: ChatMessageType;
  status: ChatMessageStatus;
  providerMessageId: string | null;
  mediaUrl: string | null;
  mediaMimeType: string | null;
  mediaDurationMs: number | null;
  createdAt: Date;
};

export type ChatConversationSummary = ChatConversation & {
  lastMessage: ChatMessage | null;
};

type PersistMessageInput = {
  instanceId: string;
  jid: string;
  fromMe: boolean;
  body?: string | null;
  messageType?: ChatMessageType;
  status?: ChatMessageStatus;
  providerMessageId?: string | null;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaDurationMs?: number | null;
  createdAt?: Date;
  contactName?: string | null;
  profilePicUrl?: string | null;
};

export type ChatStore = {
  findInstance(instanceId: string): Promise<{ id: string } | null>;
  listConversations(input: { instanceId?: string }): Promise<ChatConversationSummary[]>;
  listMessages(input: { instanceId: string; jid: string; cursor?: Date; limit: number }): Promise<ChatMessage[]>;
  findMessageByProviderId(input: { instanceId: string; providerMessageId: string }): Promise<ChatMessage | null>;
  persistMessage(input: PersistMessageInput): Promise<{ conversation: ChatConversation; message: ChatMessage }>;
  updateMessageStatus(input: { messageId: string; status: ChatMessageStatus; providerMessageId?: string | null }): Promise<ChatMessage>;
};

export type ChatEventRecorder = (input: { instanceId: string; channel: "WHATSAPP"; direction: MessageDirection; usedAi: boolean }) => Promise<unknown>;

export class ChatValidationError extends Error {
  code = "CHAT_VALIDATION_ERROR";
}

export class ChatInstanceNotFoundError extends Error {
  code = "CHAT_INSTANCE_NOT_FOUND";

  constructor(instanceId: string) {
    super(`Instancia ${instanceId} nao encontrada.`);
  }
}

export class ChatMediaNotFoundError extends Error {
  code = "CHAT_MEDIA_NOT_FOUND";

  constructor() {
    super("Midia da mensagem nao encontrada.");
  }
}

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildConversationSummary(conversation: ChatConversation, message: ChatMessage): ChatConversationSummary {
  return { ...conversation, lastMessage: message };
}

function chatStatusFromBaileysStatus(status: unknown): ChatMessageStatus | null {
  if (status === WAMessageStatus.ERROR) return "FAILED";
  if (status === WAMessageStatus.PENDING || status === WAMessageStatus.SERVER_ACK) return "SENT";
  if (status === WAMessageStatus.DELIVERY_ACK) return "DELIVERED";
  if (status === WAMessageStatus.READ || status === WAMessageStatus.PLAYED) return "READ";
  return null;
}

export function normalizeChatJid(value: string): string {
  const raw = value.trim();
  if (!raw) throw new ChatValidationError("JID obrigatorio.");
  if (raw.includes("@")) return raw.toLowerCase();
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) throw new ChatValidationError("JID invalido.");
  return `${digits}@s.whatsapp.net`;
}

export const prismaChatStore: ChatStore = {
  async findInstance(instanceId) {
    return prisma.instance.findUnique({ where: { id: instanceId }, select: { id: true } });
  },

  async listConversations(input) {
    const rows = await prisma.conversation.findMany({
      where: input.instanceId ? { instanceId: input.instanceId } : undefined,
      orderBy: { lastMessageAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return rows.map(({ messages, ...conversation }) => ({
      ...conversation,
      lastMessage: messages[0] ?? null,
    }));
  },

  async listMessages(input) {
    const conversation = await prisma.conversation.findUnique({
      where: { instanceId_jid: { instanceId: input.instanceId, jid: input.jid } },
      select: { id: true },
    });
    if (!conversation) return [];

    return prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        ...(input.cursor ? { createdAt: { lt: input.cursor } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: input.limit,
    });
  },

  async findMessageByProviderId(input) {
    return prisma.message.findFirst({
      where: { instanceId: input.instanceId, providerMessageId: input.providerMessageId },
    });
  },

  async persistMessage(input) {
    const jid = normalizeChatJid(input.jid);
    const createdAt = input.createdAt ?? new Date();
    return prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.upsert({
        where: { instanceId_jid: { instanceId: input.instanceId, jid } },
        create: {
          instanceId: input.instanceId,
          jid,
          name: input.contactName ?? null,
          profilePicUrl: input.profilePicUrl ?? null,
          lastMessageAt: createdAt,
          unreadCount: input.fromMe ? 0 : 1,
        },
        update: {
          name: input.contactName ?? undefined,
          profilePicUrl: input.profilePicUrl ?? undefined,
          lastMessageAt: createdAt,
          unreadCount: input.fromMe ? undefined : { increment: 1 },
        },
      });

      const message = await tx.message.create({
        data: {
          conversationId: conversation.id,
          instanceId: input.instanceId,
          jid,
          fromMe: input.fromMe,
          body: input.body ?? null,
          messageType: input.messageType ?? "TEXT",
          status: input.status ?? "SENT",
          providerMessageId: input.providerMessageId ?? null,
          mediaUrl: input.mediaUrl ?? null,
          mediaMimeType: input.mediaMimeType ?? null,
          mediaDurationMs: input.mediaDurationMs ?? null,
          createdAt,
        },
      });

      return { conversation, message };
    });
  },

  async updateMessageStatus(input) {
    return prisma.message.update({
      where: { id: input.messageId },
      data: {
        status: input.status,
        providerMessageId: input.providerMessageId ?? undefined,
      },
    });
  },
};

export function createInMemoryChatStore(seed: { instances?: Array<{ id: string }> } = {}): ChatStore & {
  conversations: Map<string, ChatConversation>;
  messages: Map<string, ChatMessage>;
} {
  const instances = new Map((seed.instances ?? []).map((instance) => [instance.id, instance]));
  const conversations = new Map<string, ChatConversation>();
  const messages = new Map<string, ChatMessage>();

  function conversationKey(instanceId: string, jid: string) {
    return `${instanceId}:${jid}`;
  }

  return {
    conversations,
    messages,
    async findInstance(instanceId) {
      return instances.get(instanceId) ?? null;
    },
    async listConversations(input) {
      return Array.from(conversations.values())
        .filter((conversation) => !input.instanceId || conversation.instanceId === input.instanceId)
        .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
        .map((conversation) => ({
          ...conversation,
          lastMessage: Array.from(messages.values())
            .filter((message) => message.conversationId === conversation.id)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null,
        }));
    },
    async listMessages(input) {
      const jid = normalizeChatJid(input.jid);
      const conversation = conversations.get(conversationKey(input.instanceId, jid));
      if (!conversation) return [];
      return Array.from(messages.values())
        .filter((message) => message.conversationId === conversation.id)
        .filter((message) => !input.cursor || message.createdAt < input.cursor)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, input.limit);
    },
    async findMessageByProviderId(input) {
      return Array.from(messages.values()).find(
        (message) => message.instanceId === input.instanceId && message.providerMessageId === input.providerMessageId
      ) ?? null;
    },
    async persistMessage(input) {
      const jid = normalizeChatJid(input.jid);
      const now = input.createdAt ?? new Date();
      const key = conversationKey(input.instanceId, jid);
      const existing = conversations.get(key);
      const conversation: ChatConversation = existing
        ? {
            ...existing,
            name: input.contactName ?? existing.name,
            profilePicUrl: input.profilePicUrl ?? existing.profilePicUrl,
            lastMessageAt: now,
            unreadCount: input.fromMe ? existing.unreadCount : existing.unreadCount + 1,
            updatedAt: now,
          }
        : {
            id: newId("conversation"),
            instanceId: input.instanceId,
            jid,
            name: input.contactName ?? null,
            profilePicUrl: input.profilePicUrl ?? null,
            lastMessageAt: now,
            unreadCount: input.fromMe ? 0 : 1,
            createdAt: now,
            updatedAt: now,
          };
      conversations.set(key, conversation);
      const message: ChatMessage = {
        id: newId("message"),
        conversationId: conversation.id,
        instanceId: input.instanceId,
        jid,
        fromMe: input.fromMe,
        body: input.body ?? null,
        messageType: input.messageType ?? "TEXT",
        status: input.status ?? "SENT",
        providerMessageId: input.providerMessageId ?? null,
        mediaUrl: input.mediaUrl ?? null,
        mediaMimeType: input.mediaMimeType ?? null,
        mediaDurationMs: input.mediaDurationMs ?? null,
        createdAt: now,
      };
      messages.set(message.id, message);
      return { conversation, message };
    },
    async updateMessageStatus(input) {
      const existing = messages.get(input.messageId);
      if (!existing) throw new Error("Mensagem nao encontrada.");
      const updated = {
        ...existing,
        status: input.status,
        providerMessageId: input.providerMessageId ?? existing.providerMessageId,
      };
      messages.set(updated.id, updated);
      return updated;
    },
  };
}

export function createChatService(deps: {
  store?: ChatStore;
  baileys?: ChatBaileysAdapter;
  eventRecorder?: ChatEventRecorder;
} = {}) {
  const store = deps.store ?? prismaChatStore;
  const baileys = deps.baileys ?? baileysChatAdapter;
  const eventRecorder = deps.eventRecorder ?? recordMessageEvent;

  async function ensureInstance(instanceId: string) {
    const instance = await store.findInstance(instanceId);
    if (!instance) throw new ChatInstanceNotFoundError(instanceId);
  }

  return {
    async listConversations(input: { instanceId?: string }) {
      if (input.instanceId) await ensureInstance(input.instanceId);
      return store.listConversations(input);
    },

    async listMessages(input: { instanceId: string; jid: string; cursor?: Date; limit?: number }) {
      await ensureInstance(input.instanceId);
      return store.listMessages({
        instanceId: input.instanceId,
        jid: normalizeChatJid(input.jid),
        cursor: input.cursor,
        limit: Math.min(Math.max(input.limit ?? 50, 1), 100),
      });
    },

    async persistInboundMessage(input: Omit<PersistMessageInput, "fromMe" | "status">) {
      await ensureInstance(input.instanceId);
      if (input.providerMessageId) {
        const existing = await store.findMessageByProviderId({ instanceId: input.instanceId, providerMessageId: input.providerMessageId });
        if (existing) return existing;
      }
      const profile = await baileys.getContactProfile({ instanceId: input.instanceId, jid: normalizeChatJid(input.jid) });
      const result = await store.persistMessage({
        ...input,
        jid: normalizeChatJid(input.jid),
        fromMe: false,
        status: "DELIVERED",
        contactName: input.contactName ?? profile.name,
        profilePicUrl: input.profilePicUrl ?? profile.profilePicUrl,
      });
      chatRealtime.emitMessageNew({ instanceId: input.instanceId, message: result.message });
      chatRealtime.emitConversationUpdate({ instanceId: input.instanceId, conversation: buildConversationSummary(result.conversation, result.message) });
      return result.message;
    },

    async persistOutboundMessage(input: Omit<PersistMessageInput, "fromMe">) {
      await ensureInstance(input.instanceId);
      const result = await store.persistMessage({
        ...input,
        jid: normalizeChatJid(input.jid),
        fromMe: true,
        status: input.status ?? "SENT",
      });
      chatRealtime.emitMessageSent({ instanceId: input.instanceId, message: result.message });
      chatRealtime.emitConversationUpdate({ instanceId: input.instanceId, conversation: buildConversationSummary(result.conversation, result.message) });
      return result.message;
    },

    async sendTextMessage(input: { instanceId: string; jid: string; body: string }) {
      await ensureInstance(input.instanceId);
      const jid = normalizeChatJid(input.jid);
      const body = input.body.trim();
      if (!body) throw new ChatValidationError("Corpo da mensagem obrigatorio.");

      const result = await store.persistMessage({
        instanceId: input.instanceId,
        jid,
        fromMe: true,
        body,
        messageType: "TEXT",
        status: "SENT",
      });

      try {
        const sent = await baileys.sendTextMessage({ instanceId: input.instanceId, jid, body });
        const updated = await store.updateMessageStatus({
          messageId: result.message.id,
          status: "SENT",
          providerMessageId: sent.providerMessageId,
        });
        await eventRecorder({ instanceId: input.instanceId, channel: "WHATSAPP", direction: "OUTBOUND", usedAi: false }).catch((eventErr) => {
          console.error("[Chat] Falha ao registrar MessageEvent outbound:", safeLogError(eventErr));
        });
        chatRealtime.emitMessageSent({ instanceId: input.instanceId, message: updated });
        chatRealtime.emitConversationUpdate({
          instanceId: input.instanceId,
          conversation: buildConversationSummary(result.conversation, updated),
        });
        return updated;
      } catch (err) {
        const failed = await store.updateMessageStatus({ messageId: result.message.id, status: "FAILED" });
        chatRealtime.emitMessageStatus({ instanceId: input.instanceId, message: failed });
        if (err instanceof ChatInstanceOfflineError || err instanceof ChatProviderSendError) throw err;
        throw new ChatProviderSendError(err instanceof Error ? err.message : undefined);
      }
    },

    async recordBaileysMessageUpdate(instanceId: string, update: WAMessageUpdate) {
      const providerMessageId = typeof update.key?.id === "string" && update.key.id.trim() ? update.key.id : null;
      if (!providerMessageId) return null;

      const status = chatStatusFromBaileysStatus(update.update?.status);
      if (!status) return null;

      const existing = await store.findMessageByProviderId({ instanceId, providerMessageId });
      if (!existing) return null;

      const updated = await store.updateMessageStatus({ messageId: existing.id, status });
      chatRealtime.emitMessageStatus({ instanceId, message: updated });
      return updated;
    },

    emitPresenceUpdate(input: { instanceId: string; jid: string; isTyping: boolean }) {
      chatRealtime.emitPresenceUpdate(input);
    },

    async getMessageMedia(input: { instanceId: string; providerMessageId: string }) {
      await ensureInstance(input.instanceId);
      const message = await store.findMessageByProviderId({ instanceId: input.instanceId, providerMessageId: input.providerMessageId });
      if (!message || !message.mediaUrl) throw new ChatMediaNotFoundError();
      try {
        const buffer = await readChatMedia(input);
        return {
          buffer,
          mimeType: message.mediaMimeType || "application/octet-stream",
        };
      } catch {
        throw new ChatMediaNotFoundError();
      }
    },
  };
}

export const chatService = createChatService();
