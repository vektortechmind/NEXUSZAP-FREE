import { Prisma, type ChatMessageStatus, type ChatMessageType, type MessageDirection } from "@prisma/client";
import { WAMessageStatus, type WAMessage, type WAMessageUpdate } from "@whiskeysockets/baileys";
import { prisma } from "../database/prisma";
import { safeLogError } from "../utils/redaction";
import { recordMessageEvent } from "./analytics/messageEvent.service";
import { transcodeAudioToOggOpus } from "./chat.audioTranscode";
import { readChatMedia, validateChatMedia, writeChatMedia, type ChatMediaKind } from "./chat.mediaStorage";
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
  remoteJidAlt: string | null;
  name: string | null;
  profilePicUrl: string | null;
  isGroup: boolean;
  aiPaused: boolean;
  aiPausedAt: Date | null;
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
  senderJid: string | null;
  senderName: string | null;
  mediaUrl: string | null;
  mediaMimeType: string | null;
  mediaDurationMs: number | null;
  reactionEmoji: string | null;
  editedAt: Date | null;
  isDeleted: boolean;
  quotedMessageId: string | null;
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
  reactionEmoji?: string | null;
  quotedMessageId?: string | null;
  createdAt?: Date;
  contactName?: string | null;
  remoteJidAlt?: string | null;
  profilePicUrl?: string | null;
  isGroup?: boolean;
  senderJid?: string | null;
  senderName?: string | null;
};

type UpsertConversationInput = {
  instanceId: string;
  jid: string;
  name?: string | null;
  profilePicUrl?: string | null;
  isGroup?: boolean;
  lastMessageAt?: Date;
};

export type ChatStore = {
  findInstance(instanceId: string): Promise<{ id: string } | null>;
  listConversations(input: { instanceId?: string }): Promise<ChatConversationSummary[]>;
  listMessages(input: { instanceId: string; jid: string; cursor?: Date; limit: number }): Promise<ChatMessage[]>;
  findMessageByProviderId(input: { instanceId: string; providerMessageId: string }): Promise<ChatMessage | null>;
  getConversationSummary(input: { instanceId: string; jid: string }): Promise<ChatConversationSummary | null>;
  upsertConversation(input: UpsertConversationInput): Promise<ChatConversationSummary>;
  persistMessage(input: PersistMessageInput): Promise<{ conversation: ChatConversation; message: ChatMessage }>;
  updateMessageStatus(input: { messageId: string; status: ChatMessageStatus; providerMessageId?: string | null }): Promise<ChatMessage>;
  updateMessageMedia(input: { messageId: string; mediaUrl: string; mediaMimeType?: string | null; mediaDurationMs?: number | null }): Promise<ChatMessage>;
  updateMessageReaction(input: { messageId: string; reactionEmoji: string | null }): Promise<ChatMessage>;
  updateMessageText(input: { messageId: string; body: string; editedAt?: Date }): Promise<ChatMessage>;
  softDeleteMessage(input: { messageId: string }): Promise<ChatMessage>;
  listMessagesForConversation(input: { instanceId: string; jid: string }): Promise<ChatMessage[]>;
  softDeleteConversationMessages(input: { instanceId: string; jid: string }): Promise<ChatMessage[]>;
  getConversationAiState(input: { instanceId: string; jid: string }): Promise<{ aiPaused: boolean; aiPausedAt: Date | null } | null>;
  setConversationAiPaused(input: { instanceId: string; jid: string; paused: boolean }): Promise<ChatConversationSummary | null>;
  resetUnreadCount(input: { instanceId: string; jid: string }): Promise<ChatConversationSummary | null>;
  deleteConversation(input: { instanceId: string; jid: string }): Promise<void>;
};

export type ChatEventRecorder = (input: { instanceId: string; channel: "WHATSAPP"; direction: MessageDirection; usedAi: boolean }) => Promise<unknown>;

export class ChatValidationError extends Error {
  code = "CHAT_VALIDATION_ERROR";

  constructor(message: string, public statusCode = 400) {
    super(message);
  }
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

export type ChatDeleteMode = "for_everyone";
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const DELETE_FOR_EVERYONE_WINDOW_MS = 48 * 60 * 60 * 1000;

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildConversationSummary(conversation: ChatConversation, message: ChatMessage): ChatConversationSummary {
  return { ...conversation, lastMessage: message };
}

function isUniqueConstraintError(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

function chatStatusFromBaileysStatus(status: unknown): ChatMessageStatus | null {
  if (status === WAMessageStatus.ERROR) return "FAILED";
  if (status === WAMessageStatus.PENDING || status === WAMessageStatus.SERVER_ACK) return "SENT";
  if (status === WAMessageStatus.DELIVERY_ACK) return "DELIVERED";
  if (status === WAMessageStatus.READ || status === WAMessageStatus.PLAYED) return "READ";
  return null;
}

function messagePreviewBody(message: ChatMessage) {
  if (message.isDeleted) return "Mensagem apagada";
  if (message.body?.trim()) return message.body;
  if (message.messageType === "IMAGE") return "[Imagem]";
  if (message.messageType === "VIDEO") return "[Video]";
  if (message.messageType === "AUDIO") return "[Audio]";
  if (message.messageType === "DOCUMENT") return "[Documento]";
  return "Mensagem";
}

function buildQuotedWAMessage(message: ChatMessage): WAMessage {
  return {
    key: {
      id: message.providerMessageId ?? undefined,
      remoteJid: message.jid,
      fromMe: message.fromMe,
    },
    message: {
      conversation: messagePreviewBody(message),
    },
    messageTimestamp: Math.floor(message.createdAt.getTime() / 1000),
  } as WAMessage;
}

export function normalizeChatJid(value: string): string {
  const raw = value.trim();
  if (!raw) throw new ChatValidationError("JID obrigatorio.");
  if (raw.includes("@")) return raw.toLowerCase();
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) throw new ChatValidationError("JID invalido.");
  return `${digits}@s.whatsapp.net`;
}

function isGroupJid(jid: string) {
  return jid.toLowerCase().endsWith("@g.us");
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
          where: { isDeleted: false },
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
        isDeleted: false,
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

  async getConversationSummary(input) {
    const jid = normalizeChatJid(input.jid);
    const conversation = await prisma.conversation.findUnique({
      where: { instanceId_jid: { instanceId: input.instanceId, jid } },
      include: {
        messages: {
          where: { isDeleted: false },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    if (!conversation) return null;
    const { messages, ...row } = conversation;
    return { ...row, lastMessage: messages[0] ?? null };
  },

  async upsertConversation(input) {
    const jid = normalizeChatJid(input.jid);
    const now = input.lastMessageAt ?? new Date();
    const conversation = await prisma.conversation.upsert({
      where: { instanceId_jid: { instanceId: input.instanceId, jid } },
      create: {
        instanceId: input.instanceId,
        jid,
        name: input.name ?? null,
        profilePicUrl: input.profilePicUrl ?? null,
        isGroup: input.isGroup ?? isGroupJid(jid),
        lastMessageAt: now,
        unreadCount: 0,
      },
      update: {
        name: input.name ?? undefined,
        profilePicUrl: input.profilePicUrl ?? undefined,
        isGroup: input.isGroup ?? (isGroupJid(jid) ? true : undefined),
      },
      include: {
        messages: {
          where: { isDeleted: false },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    const { messages, ...row } = conversation;
    return { ...row, lastMessage: messages[0] ?? null };
  },

  async persistMessage(input) {
    const jid = normalizeChatJid(input.jid);
    const remoteJidAlt = input.remoteJidAlt ? normalizeChatJid(input.remoteJidAlt) : null;
    const senderJid = input.senderJid ? normalizeChatJid(input.senderJid) : null;
    const group = input.isGroup ?? isGroupJid(jid);
    const createdAt = input.createdAt ?? new Date();
    try {
      return await prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.upsert({
        where: { instanceId_jid: { instanceId: input.instanceId, jid } },
        create: {
          instanceId: input.instanceId,
          jid,
          remoteJidAlt,
          name: input.contactName ?? null,
          profilePicUrl: input.profilePicUrl ?? null,
          isGroup: group,
          lastMessageAt: createdAt,
          unreadCount: input.fromMe ? 0 : 1,
        },
        update: {
          remoteJidAlt: remoteJidAlt ?? undefined,
          name: input.contactName ?? undefined,
          profilePicUrl: input.profilePicUrl ?? undefined,
          isGroup: group ? true : undefined,
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
          senderJid,
          senderName: input.senderName ?? null,
          mediaUrl: input.mediaUrl ?? null,
          mediaMimeType: input.mediaMimeType ?? null,
          mediaDurationMs: input.mediaDurationMs ?? null,
          reactionEmoji: input.reactionEmoji ?? null,
          quotedMessageId: input.quotedMessageId ?? null,
          createdAt,
        },
      });

      return { conversation, message };
      });
    } catch (err) {
      if (input.providerMessageId && isUniqueConstraintError(err)) {
        const existing = await prisma.message.findFirst({
          where: { instanceId: input.instanceId, providerMessageId: input.providerMessageId },
          include: { conversation: true },
        });
        if (existing) {
          const { conversation, ...message } = existing;
          return { conversation, message };
        }
      }
      throw err;
    }
  },

  async updateMessageStatus(input) {
    try {
      return await prisma.message.update({
        where: { id: input.messageId },
        data: {
          status: input.status,
          providerMessageId: input.providerMessageId ?? undefined,
        },
      });
    } catch (err) {
      if (input.providerMessageId && isUniqueConstraintError(err)) {
        const current = await prisma.message.findUnique({
          where: { id: input.messageId },
          select: { instanceId: true },
        });
        const existing = await prisma.message.findFirst({
          where: { instanceId: current?.instanceId, providerMessageId: input.providerMessageId },
        });
        if (existing) return existing;
      }
      throw err;
    }
  },

  async updateMessageMedia(input) {
    return prisma.message.update({
      where: { id: input.messageId },
      data: {
        mediaUrl: input.mediaUrl,
        mediaMimeType: input.mediaMimeType ?? undefined,
        mediaDurationMs: input.mediaDurationMs ?? undefined,
      },
    });
  },

  async updateMessageReaction(input) {
    return prisma.message.update({
      where: { id: input.messageId },
      data: { reactionEmoji: input.reactionEmoji },
    });
  },

  async updateMessageText(input) {
    return prisma.message.update({
      where: { id: input.messageId },
      data: { body: input.body, editedAt: input.editedAt ?? new Date() },
    });
  },

  async softDeleteMessage(input) {
    return prisma.message.update({
      where: { id: input.messageId },
      data: { isDeleted: true, body: null },
    });
  },

  async listMessagesForConversation(input) {
    const jid = normalizeChatJid(input.jid);
    return prisma.message.findMany({
      where: { instanceId: input.instanceId, jid, isDeleted: false },
      orderBy: { createdAt: "asc" },
    });
  },

  async softDeleteConversationMessages(input) {
    const jid = normalizeChatJid(input.jid);
    const messages = await prisma.message.findMany({
      where: { instanceId: input.instanceId, jid, isDeleted: false },
      orderBy: { createdAt: "asc" },
    });
    if (messages.length === 0) return [];
    await prisma.message.updateMany({
      where: { id: { in: messages.map((message) => message.id) } },
      data: { isDeleted: true, body: null },
    });
    return messages.map((message) => ({ ...message, isDeleted: true, body: null }));
  },

  async getConversationAiState(input) {
    const jid = normalizeChatJid(input.jid);
    return prisma.conversation.findUnique({
      where: { instanceId_jid: { instanceId: input.instanceId, jid } },
      select: { aiPaused: true, aiPausedAt: true },
    });
  },

  async setConversationAiPaused(input) {
    const jid = normalizeChatJid(input.jid);
    const conversation = await prisma.conversation.update({
      where: { instanceId_jid: { instanceId: input.instanceId, jid } },
      data: {
        aiPaused: input.paused,
        aiPausedAt: input.paused ? new Date() : null,
      },
      include: {
        messages: {
          where: { isDeleted: false },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }).catch(() => null);
    if (!conversation) return null;
    const { messages, ...row } = conversation;
    return { ...row, lastMessage: messages[0] ?? null };
  },

  async resetUnreadCount(input) {
    const jid = normalizeChatJid(input.jid);
    const conversation = await prisma.conversation.update({
      where: { instanceId_jid: { instanceId: input.instanceId, jid } },
      data: { unreadCount: 0 },
      include: {
        messages: {
          where: { isDeleted: false },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }).catch(() => null);
    if (!conversation) return null;
    const { messages, ...row } = conversation;
    return { ...row, lastMessage: messages[0] ?? null };
  },

  async deleteConversation(input) {
    const jid = normalizeChatJid(input.jid);
    await prisma.conversation.deleteMany({ where: { instanceId: input.instanceId, jid } });
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

  function latestMessageForConversation(conversationId: string): ChatMessage | null {
    let latest: ChatMessage | null = null;
    for (const message of messages.values()) {
      if (message.conversationId !== conversationId) continue;
      if (message.isDeleted) continue;
      if (!latest || message.createdAt > latest.createdAt) latest = message;
    }
    return latest;
  }

  return {
    conversations,
    messages,
    async findInstance(instanceId) {
      return instances.get(instanceId) ?? null;
    },
    async listConversations(input) {
      const rows: ChatConversationSummary[] = [];
      for (const conversation of conversations.values()) {
        if (input.instanceId && conversation.instanceId !== input.instanceId) continue;
        rows.push({ ...conversation, lastMessage: latestMessageForConversation(conversation.id) });
      }
      return rows.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
    },
    async listMessages(input) {
      const jid = normalizeChatJid(input.jid);
      const conversation = conversations.get(conversationKey(input.instanceId, jid));
      if (!conversation) return [];
      return Array.from(messages.values())
        .filter((message) => (
          message.conversationId === conversation.id
          && !message.isDeleted
          && (!input.cursor || message.createdAt < input.cursor)
        ))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, input.limit);
    },
    async findMessageByProviderId(input) {
      return Array.from(messages.values()).find(
        (message) => message.instanceId === input.instanceId && message.providerMessageId === input.providerMessageId
      ) ?? null;
    },
    async getConversationSummary(input) {
      const jid = normalizeChatJid(input.jid);
      const conversation = conversations.get(conversationKey(input.instanceId, jid));
      return conversation ? { ...conversation, lastMessage: latestMessageForConversation(conversation.id) } : null;
    },
    async upsertConversation(input) {
      const jid = normalizeChatJid(input.jid);
      const now = input.lastMessageAt ?? new Date();
      const key = conversationKey(input.instanceId, jid);
      const existing = conversations.get(key);
      const conversation: ChatConversation = existing
        ? {
            ...existing,
            name: input.name ?? existing.name,
            profilePicUrl: input.profilePicUrl ?? existing.profilePicUrl,
            isGroup: input.isGroup ?? existing.isGroup,
            updatedAt: now,
          }
        : {
            id: newId("conversation"),
            instanceId: input.instanceId,
            jid,
            remoteJidAlt: null,
            name: input.name ?? null,
            profilePicUrl: input.profilePicUrl ?? null,
            isGroup: input.isGroup ?? isGroupJid(jid),
            aiPaused: false,
            aiPausedAt: null,
            lastMessageAt: now,
            unreadCount: 0,
            createdAt: now,
            updatedAt: now,
          };
      conversations.set(key, conversation);
      return { ...conversation, lastMessage: latestMessageForConversation(conversation.id) };
    },
    async persistMessage(input) {
      const jid = normalizeChatJid(input.jid);
      if (input.providerMessageId) {
        const existing = await this.findMessageByProviderId({ instanceId: input.instanceId, providerMessageId: input.providerMessageId });
        if (existing) {
          const conversation = conversations.get(conversationKey(input.instanceId, existing.jid));
          if (!conversation) throw new Error("Conversa nao encontrada para mensagem duplicada.");
          return { conversation, message: existing };
        }
      }
      const remoteJidAlt = input.remoteJidAlt ? normalizeChatJid(input.remoteJidAlt) : null;
      const senderJid = input.senderJid ? normalizeChatJid(input.senderJid) : null;
      const group = input.isGroup ?? isGroupJid(jid);
      const now = input.createdAt ?? new Date();
      const key = conversationKey(input.instanceId, jid);
      const existing = conversations.get(key);
      const conversation: ChatConversation = existing
        ? {
            ...existing,
            remoteJidAlt: remoteJidAlt ?? existing.remoteJidAlt,
            name: input.contactName ?? existing.name,
            profilePicUrl: input.profilePicUrl ?? existing.profilePicUrl,
            isGroup: group || existing.isGroup,
            lastMessageAt: now,
            unreadCount: input.fromMe ? existing.unreadCount : existing.unreadCount + 1,
            updatedAt: now,
          }
        : {
            id: newId("conversation"),
            instanceId: input.instanceId,
            jid,
            remoteJidAlt,
            name: input.contactName ?? null,
            profilePicUrl: input.profilePicUrl ?? null,
            isGroup: group,
            aiPaused: false,
            aiPausedAt: null,
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
        senderJid,
        senderName: input.senderName ?? null,
        mediaUrl: input.mediaUrl ?? null,
        mediaMimeType: input.mediaMimeType ?? null,
        mediaDurationMs: input.mediaDurationMs ?? null,
        reactionEmoji: input.reactionEmoji ?? null,
        editedAt: null,
        isDeleted: false,
        quotedMessageId: input.quotedMessageId ?? null,
        createdAt: now,
      };
      messages.set(message.id, message);
      return { conversation, message };
    },
    async updateMessageStatus(input) {
      const existing = messages.get(input.messageId);
      if (!existing) throw new Error("Mensagem nao encontrada.");
      if (input.providerMessageId) {
        const duplicate = Array.from(messages.values()).find(
          (message) => message.id !== input.messageId && message.instanceId === existing.instanceId && message.providerMessageId === input.providerMessageId
        );
        if (duplicate) return duplicate;
      }
      const updated = {
        ...existing,
        status: input.status,
        providerMessageId: input.providerMessageId ?? existing.providerMessageId,
      };
      messages.set(updated.id, updated);
      return updated;
    },
    async updateMessageMedia(input) {
      const existing = messages.get(input.messageId);
      if (!existing) throw new Error("Mensagem nao encontrada.");
      const updated = {
        ...existing,
        mediaUrl: input.mediaUrl,
        mediaMimeType: input.mediaMimeType ?? existing.mediaMimeType,
        mediaDurationMs: input.mediaDurationMs ?? existing.mediaDurationMs,
      };
      messages.set(updated.id, updated);
      return updated;
    },
    async updateMessageReaction(input) {
      const existing = messages.get(input.messageId);
      if (!existing) throw new Error("Mensagem nao encontrada.");
      const updated = {
        ...existing,
        reactionEmoji: input.reactionEmoji,
      };
      messages.set(updated.id, updated);
      return updated;
    },
    async updateMessageText(input) {
      const existing = messages.get(input.messageId);
      if (!existing) throw new Error("Mensagem nao encontrada.");
      const updated = { ...existing, body: input.body, editedAt: input.editedAt ?? new Date() };
      messages.set(updated.id, updated);
      return updated;
    },
    async softDeleteMessage(input) {
      const existing = messages.get(input.messageId);
      if (!existing) throw new Error("Mensagem nao encontrada.");
      const updated = { ...existing, body: null, isDeleted: true };
      messages.set(updated.id, updated);
      return updated;
    },
    async listMessagesForConversation(input) {
      const jid = normalizeChatJid(input.jid);
      return Array.from(messages.values())
        .filter((message) => message.instanceId === input.instanceId && message.jid === jid && !message.isDeleted)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },
    async softDeleteConversationMessages(input) {
      const rows = await this.listMessagesForConversation(input);
      const updated = rows.map((message) => ({ ...message, body: null, isDeleted: true }));
      updated.forEach((message) => messages.set(message.id, message));
      return updated;
    },
    async getConversationAiState(input) {
      const jid = normalizeChatJid(input.jid);
      const existing = conversations.get(conversationKey(input.instanceId, jid));
      return existing ? { aiPaused: existing.aiPaused, aiPausedAt: existing.aiPausedAt } : null;
    },
    async setConversationAiPaused(input) {
      const jid = normalizeChatJid(input.jid);
      const key = conversationKey(input.instanceId, jid);
      const existing = conversations.get(key);
      if (!existing) return null;
      const updated = {
        ...existing,
        aiPaused: input.paused,
        aiPausedAt: input.paused ? new Date() : null,
        updatedAt: new Date(),
      };
      conversations.set(key, updated);
      return { ...updated, lastMessage: latestMessageForConversation(updated.id) };
    },
    async resetUnreadCount(input) {
      const jid = normalizeChatJid(input.jid);
      const key = conversationKey(input.instanceId, jid);
      const existing = conversations.get(key);
      if (!existing) return null;
      const updated = { ...existing, unreadCount: 0, updatedAt: new Date() };
      conversations.set(key, updated);
      return { ...updated, lastMessage: latestMessageForConversation(updated.id) };
    },
    async deleteConversation(input) {
      const jid = normalizeChatJid(input.jid);
      const key = conversationKey(input.instanceId, jid);
      const existing = conversations.get(key);
      if (!existing) return;
      conversations.delete(key);
      for (const [messageId, message] of messages.entries()) {
        if (message.conversationId === existing.id) messages.delete(messageId);
      }
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

  function withoutProfilePictureUrls(conversations: ChatConversationSummary[]) {
    return conversations.map((conversation) => ({ ...conversation, profilePicUrl: null }));
  }

  return {
    async listConversations(input: { instanceId?: string }) {
      if (input.instanceId) await ensureInstance(input.instanceId);
      return withoutProfilePictureUrls(await store.listConversations(input));
    },

    async syncGroups(input: { instanceId: string }) {
      await ensureInstance(input.instanceId);
      const groups = await baileys.syncGroups(input.instanceId);
      const synced: ChatConversationSummary[] = [];
      for (const group of groups) {
        // react-doctor-disable-next-line react-doctor/async-await-in-loop -- Group sync persists and emits each conversation in order so realtime consumers see stable incremental updates.
        const conversation = await store.upsertConversation({
          instanceId: input.instanceId,
          jid: group.jid,
          name: group.name,
          profilePicUrl: group.profilePicUrl,
          isGroup: true,
        });
        synced.push(conversation);
        chatRealtime.emitConversationUpdate({ instanceId: input.instanceId, conversation });
      }
      return withoutProfilePictureUrls(synced);
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
      const jid = normalizeChatJid(input.jid);
      const group = isGroupJid(jid);
      if (input.providerMessageId) {
        const existing = await store.findMessageByProviderId({ instanceId: input.instanceId, providerMessageId: input.providerMessageId });
        if (existing) return existing;
      }
      let groupName = input.contactName ?? null;
      if (group) {
        try {
          const metadata = await baileys.getGroupMetadata({ instanceId: input.instanceId, jid });
          groupName = metadata.name ?? groupName;
        } catch (err) {
          console.warn("[Chat] Falha ao buscar metadados do grupo:", safeLogError(err));
        }
      }
      const result = await store.persistMessage({
        ...input,
        jid,
        fromMe: false,
        status: "DELIVERED",
        contactName: groupName,
        remoteJidAlt: input.remoteJidAlt ?? null,
        profilePicUrl: null,
        isGroup: group,
      });
      chatRealtime.emitMessageNew({ instanceId: input.instanceId, message: result.message });
      chatRealtime.emitConversationUpdate({ instanceId: input.instanceId, conversation: buildConversationSummary(result.conversation, result.message) });
      return result.message;
    },

    async persistOutboundMessage(input: Omit<PersistMessageInput, "fromMe">) {
      await ensureInstance(input.instanceId);
      if (input.providerMessageId) {
        const existing = await store.findMessageByProviderId({ instanceId: input.instanceId, providerMessageId: input.providerMessageId });
        if (existing) return existing;
      }
      const jid = normalizeChatJid(input.jid);
      const result = await store.persistMessage({
        ...input,
        jid,
        fromMe: true,
        status: input.status ?? "SENT",
      });
      chatRealtime.emitMessageSent({ instanceId: input.instanceId, message: result.message });
      chatRealtime.emitConversationUpdate({ instanceId: input.instanceId, conversation: buildConversationSummary(result.conversation, result.message) });

      return result.message;
    },

    async sendTextMessage(input: { instanceId: string; jid: string; body: string; quotedMessageId?: string | null }) {
      await ensureInstance(input.instanceId);
      const jid = normalizeChatJid(input.jid);
      const body = input.body.trim();
      if (!body) throw new ChatValidationError("Corpo da mensagem obrigatorio.");
      const quotedProviderMessageId = input.quotedMessageId?.trim() || null;
      const quotedMessage = quotedProviderMessageId
        ? await store.findMessageByProviderId({ instanceId: input.instanceId, providerMessageId: quotedProviderMessageId })
        : null;
      if (quotedProviderMessageId && !quotedMessage) throw new ChatValidationError("Mensagem citada nao encontrada.");

      const result = await store.persistMessage({
        instanceId: input.instanceId,
        jid,
        fromMe: true,
        body,
        messageType: "TEXT",
        status: "SENT",
        quotedMessageId: quotedProviderMessageId,
        profilePicUrl: null,
      });

      try {
        const sent = await baileys.sendTextMessage({
          instanceId: input.instanceId,
          jid,
          body,
          quotedMessage: quotedMessage ? buildQuotedWAMessage(quotedMessage) : null,
        });
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

    async sendMediaMessage(input: {
      instanceId: string;
      jid: string;
      messageType: ChatMediaKind;
      buffer: Buffer;
      mimeType: string;
      caption?: string | null;
      fileName?: string | null;
      quotedMessageId?: string | null;
    }) {
      await ensureInstance(input.instanceId);
      const jid = normalizeChatJid(input.jid);
      if (input.buffer.length === 0) throw new ChatValidationError("Arquivo obrigatorio.");
      validateChatMedia({ messageType: input.messageType, mimeType: input.mimeType, sizeBytes: input.buffer.length });

      const media = input.messageType === "AUDIO"
        ? await transcodeAudioToOggOpus({ buffer: input.buffer, mimeType: input.mimeType })
        : { buffer: input.buffer, mimeType: input.mimeType };
      validateChatMedia({ messageType: input.messageType, mimeType: media.mimeType, sizeBytes: media.buffer.length });
      const mediaBody = input.caption?.trim() || (input.messageType === "DOCUMENT" ? input.fileName?.trim() || null : null);

      const quotedProviderMessageId = input.quotedMessageId?.trim() || null;
      const quotedMessage = quotedProviderMessageId
        ? await store.findMessageByProviderId({ instanceId: input.instanceId, providerMessageId: quotedProviderMessageId })
        : null;
      if (quotedProviderMessageId && !quotedMessage) throw new ChatValidationError("Mensagem citada nao encontrada.");

      const result = await store.persistMessage({
        instanceId: input.instanceId,
        jid,
        fromMe: true,
        body: mediaBody,
        messageType: input.messageType,
        status: "PENDING",
        mediaMimeType: media.mimeType,
        quotedMessageId: quotedProviderMessageId,
      });
      chatRealtime.emitMessageSent({ instanceId: input.instanceId, message: result.message });

      try {
        const sent = await baileys.sendMediaMessage({
          instanceId: input.instanceId,
          jid,
          messageType: input.messageType,
          buffer: media.buffer,
          mimeType: media.mimeType,
          caption: input.caption,
          fileName: input.fileName,
          quotedMessage: quotedMessage ? buildQuotedWAMessage(quotedMessage) : null,
        });
        const providerMessageId = sent.providerMessageId ?? result.message.id;
        const stored = await writeChatMedia({
          instanceId: input.instanceId,
          providerMessageId,
          buffer: media.buffer,
          messageType: input.messageType,
          mimeType: media.mimeType,
        });
        const withProvider = await store.updateMessageStatus({
          messageId: result.message.id,
          status: "SENT",
          providerMessageId,
        });
        const updated = await store.updateMessageMedia({
          messageId: withProvider.id,
          mediaUrl: stored.mediaUrl,
          mediaMimeType: media.mimeType,
        });
        await eventRecorder({ instanceId: input.instanceId, channel: "WHATSAPP", direction: "OUTBOUND", usedAi: false }).catch((eventErr) => {
          console.error("[Chat] Falha ao registrar MessageEvent outbound media:", safeLogError(eventErr));
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
        if (err instanceof ChatInstanceOfflineError || err instanceof ChatProviderSendError || err instanceof ChatValidationError) throw err;
        throw new ChatProviderSendError(err instanceof Error ? err.message : undefined);
      }
    },

    async editMessage(input: { instanceId: string; jid: string; providerMessageId: string; body: string }) {
      await ensureInstance(input.instanceId);
      const jid = normalizeChatJid(input.jid);
      const providerMessageId = input.providerMessageId.trim();
      const body = input.body.trim();
      if (!providerMessageId) throw new ChatValidationError("ID da mensagem obrigatorio.");
      if (!body) throw new ChatValidationError("Corpo da mensagem obrigatorio.");
      const message = await store.findMessageByProviderId({ instanceId: input.instanceId, providerMessageId });
      if (!message) throw new ChatValidationError("Mensagem nao encontrada.");
      if (!message.fromMe) throw new ChatValidationError("So pode editar mensagens proprias.");
      if (message.messageType !== "TEXT") throw new ChatValidationError("So pode editar mensagens de texto.");
      if (message.isDeleted) throw new ChatValidationError("Mensagem apagada nao pode ser editada.");
      if (Date.now() - message.createdAt.getTime() > EDIT_WINDOW_MS) {
        throw new ChatValidationError("So pode editar ate 15 minutos apos o envio.", 422);
      }
      await baileys.editMessage({ instanceId: input.instanceId, jid, providerMessageId, body });
      const updated = await store.updateMessageText({ messageId: message.id, body, editedAt: new Date() });
      chatRealtime.emitMessageEdited({ instanceId: input.instanceId, message: updated });
      return updated;
    },

    async editMessageFromProvider(input: { instanceId: string; providerMessageId: string; body: string | null }) {
      await ensureInstance(input.instanceId);
      const providerMessageId = input.providerMessageId.trim();
      if (!providerMessageId || !input.body?.trim()) return null;
      const message = await store.findMessageByProviderId({ instanceId: input.instanceId, providerMessageId });
      if (!message) return null;
      const updated = await store.updateMessageText({ messageId: message.id, body: input.body.trim(), editedAt: new Date() });
      chatRealtime.emitMessageEdited({ instanceId: input.instanceId, message: updated });
      return updated;
    },

    async deleteMessage(input: { instanceId: string; jid: string; providerMessageId: string; mode: ChatDeleteMode }) {
      await ensureInstance(input.instanceId);
      const jid = normalizeChatJid(input.jid);
      const providerMessageId = input.providerMessageId.trim();
      if (!providerMessageId) throw new ChatValidationError("ID da mensagem obrigatorio.");
      const message = await store.findMessageByProviderId({ instanceId: input.instanceId, providerMessageId });
      if (!message) throw new ChatValidationError("Mensagem nao encontrada.");
      if (!message.fromMe) throw new ChatValidationError("So pode apagar mensagens proprias por esta acao.");
      if (Date.now() - message.createdAt.getTime() > DELETE_FOR_EVERYONE_WINDOW_MS) {
        throw new ChatValidationError("So pode apagar para todos ate 48 horas apos o envio.", 422);
      }
      await baileys.deleteMessage({ instanceId: input.instanceId, jid, providerMessageId });
      const updated = await store.softDeleteMessage({ messageId: message.id });
      chatRealtime.emitMessageDeleted({ instanceId: input.instanceId, message: updated });
      const conversation = await store.getConversationSummary({ instanceId: input.instanceId, jid });
      if (conversation) chatRealtime.emitConversationUpdate({ instanceId: input.instanceId, conversation });
      return updated;
    },

    async markMessageDeleted(input: { instanceId: string; providerMessageId: string }) {
      await ensureInstance(input.instanceId);
      const providerMessageId = input.providerMessageId.trim();
      if (!providerMessageId) return null;
      const message = await store.findMessageByProviderId({ instanceId: input.instanceId, providerMessageId });
      if (!message) return null;
      const updated = await store.softDeleteMessage({ messageId: message.id });
      chatRealtime.emitMessageDeleted({ instanceId: input.instanceId, message: updated });
      const conversation = await store.getConversationSummary({ instanceId: input.instanceId, jid: updated.jid });
      if (conversation) chatRealtime.emitConversationUpdate({ instanceId: input.instanceId, conversation });
      return updated;
    },

    async clearConversation(input: { instanceId: string; jid: string }) {
      await ensureInstance(input.instanceId);
      const jid = normalizeChatJid(input.jid);
      const [deleted, conversation] = await Promise.all([
        store.softDeleteConversationMessages({ instanceId: input.instanceId, jid }),
        store.resetUnreadCount({ instanceId: input.instanceId, jid }),
      ]);
      if (conversation) chatRealtime.emitConversationCleared({ instanceId: input.instanceId, conversation });
      await store.deleteConversation({ instanceId: input.instanceId, jid });
      return { deletedCount: deleted.length };
    },

    async markConversationRead(input: { instanceId: string; jid: string }) {
      await ensureInstance(input.instanceId);
      const jid = normalizeChatJid(input.jid);
      await baileys.markRead({ instanceId: input.instanceId, jid });
      const conversation = await store.resetUnreadCount({ instanceId: input.instanceId, jid });
      if (conversation) chatRealtime.emitConversationUpdate({ instanceId: input.instanceId, conversation });
      return conversation;
    },

    async isConversationAiPaused(input: { instanceId: string; jid: string }) {
      await ensureInstance(input.instanceId);
      const jid = normalizeChatJid(input.jid);
      const state = await store.getConversationAiState({ instanceId: input.instanceId, jid });
      return Boolean(state?.aiPaused);
    },

    async setConversationAiPaused(input: { instanceId: string; jid: string; paused: boolean }) {
      await ensureInstance(input.instanceId);
      const jid = normalizeChatJid(input.jid);
      const conversation = await store.setConversationAiPaused({ instanceId: input.instanceId, jid, paused: input.paused });
      if (!conversation) throw new ChatValidationError("Conversa nao encontrada.", 404);
      chatRealtime.emitConversationUpdate({ instanceId: input.instanceId, conversation });
      return conversation;
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

    async attachMessageMedia(input: { instanceId: string; messageId: string; mediaUrl: string; mediaMimeType?: string | null; mediaDurationMs?: number | null }) {
      await ensureInstance(input.instanceId);
      const updated = await store.updateMessageMedia(input);
      chatRealtime.emitMessageStatus({ instanceId: input.instanceId, message: updated });
      return updated;
    },

    async persistReaction(input: { instanceId: string; jid: string; targetProviderMessageId: string; emoji: string | null }) {
      await ensureInstance(input.instanceId);
      const targetProviderMessageId = input.targetProviderMessageId.trim();
      if (!targetProviderMessageId) return null;
      const existing = await store.findMessageByProviderId({ instanceId: input.instanceId, providerMessageId: targetProviderMessageId });
      if (!existing) return null;
      const reactionEmoji = input.emoji?.trim() ? input.emoji : null;
      const updated = await store.updateMessageReaction({ messageId: existing.id, reactionEmoji });
      chatRealtime.emitReaction({ instanceId: input.instanceId, jid: normalizeChatJid(input.jid), message: updated });
      return updated;
    },

    async sendReaction(input: { instanceId: string; jid: string; providerMessageId: string; emoji: string }) {
      await ensureInstance(input.instanceId);
      const jid = normalizeChatJid(input.jid);
      const providerMessageId = input.providerMessageId.trim();
      if (!providerMessageId) throw new ChatValidationError("ID da mensagem obrigatorio.");
      const existing = await store.findMessageByProviderId({ instanceId: input.instanceId, providerMessageId });
      if (!existing) throw new ChatValidationError("Mensagem original nao encontrada.");
      await baileys.sendReaction({ instanceId: input.instanceId, jid, providerMessageId, emoji: input.emoji, targetFromMe: existing.fromMe });
      const reactionEmoji = input.emoji?.trim() ? input.emoji : null;
      const updated = await store.updateMessageReaction({ messageId: existing.id, reactionEmoji });
      chatRealtime.emitReaction({ instanceId: input.instanceId, jid, message: updated });
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
