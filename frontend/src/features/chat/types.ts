export type ChatMessageType = "TEXT" | "IMAGE" | "AUDIO" | "DOCUMENT" | "VIDEO" | "BUTTONS_REPLY" | "LIST_REPLY" | "UNKNOWN";
export type ChatMessageStatus = "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";

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
  createdAt: string;
};

export type ChatConversation = {
  id: string;
  instanceId: string;
  jid: string;
  name: string | null;
  profilePicUrl: string | null;
  lastMessageAt: string;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  lastMessage: ChatMessage | null;
};

export type ChatInstanceOption = {
  id: string;
  name: string;
};

export type ChatPresence = {
  instanceId: string;
  jid: string;
  isTyping: boolean;
};

export type ChatConnectionState = "idle" | "connecting" | "connected" | "reconnecting" | "offline" | "error";

export type ChatUnreadTotalEvent = CustomEvent<{ total: number }>;

export const CHAT_UNREAD_TOTAL_EVENT = "nexus-chat-unread-total";
