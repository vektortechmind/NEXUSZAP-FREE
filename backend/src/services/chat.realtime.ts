import type { ChatConversationSummary, ChatMessage } from "./chat.service";

export type ChatRealtimeMessagePayload = Omit<ChatMessage, "createdAt"> & {
  createdAt: string;
};

export type ChatRealtimeConversationPayload = Omit<ChatConversationSummary, "createdAt" | "updatedAt" | "lastMessageAt" | "lastMessage"> & {
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  lastMessage: ChatRealtimeMessagePayload | null;
};

export type ChatRealtimeStatusPayload = {
  messageId: string;
  providerMessageId: string | null;
  jid: string;
  status: ChatMessage["status"];
  conversationId: string;
};

export type ChatRealtimePresencePayload = {
  jid: string;
  instanceId: string;
  isTyping: boolean;
};

export type ChatRealtimeEmitter = {
  emitToInstance(instanceId: string, event: string, payload: unknown): void;
};

function serializeMessage(message: ChatMessage): ChatRealtimeMessagePayload {
  return {
    ...message,
    createdAt: message.createdAt.toISOString(),
  };
}

function serializeConversation(conversation: ChatConversationSummary): ChatRealtimeConversationPayload {
  return {
    ...conversation,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    lastMessage: conversation.lastMessage ? serializeMessage(conversation.lastMessage) : null,
  };
}

class ChatRealtimeHub {
  private emitter: ChatRealtimeEmitter | null = null;

  setEmitter(emitter: ChatRealtimeEmitter | null) {
    this.emitter = emitter;
  }

  emitMessageNew(input: { instanceId: string; message: ChatMessage }) {
    this.emitter?.emitToInstance(input.instanceId, "message:new", serializeMessage(input.message));
  }

  emitMessageSent(input: { instanceId: string; message: ChatMessage }) {
    this.emitter?.emitToInstance(input.instanceId, "message:sent", serializeMessage(input.message));
  }

  emitMessageStatus(input: { instanceId: string; message: ChatMessage }) {
    const payload: ChatRealtimeStatusPayload = {
      messageId: input.message.id,
      providerMessageId: input.message.providerMessageId,
      jid: input.message.jid,
      status: input.message.status,
      conversationId: input.message.conversationId,
    };
    this.emitter?.emitToInstance(input.instanceId, "message:status", payload);
  }

  emitConversationUpdate(input: { instanceId: string; conversation: ChatConversationSummary }) {
    this.emitter?.emitToInstance(input.instanceId, "conversation:update", serializeConversation(input.conversation));
  }

  emitPresenceUpdate(payload: ChatRealtimePresencePayload) {
    this.emitter?.emitToInstance(payload.instanceId, "presence:update", payload);
  }
}

export const chatRealtime = new ChatRealtimeHub();
