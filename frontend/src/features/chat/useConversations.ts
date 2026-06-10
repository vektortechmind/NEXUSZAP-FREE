import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/axios";
import type { InstanceStatus } from "../instances/types";
import { getKnownMessageFallback } from "./chatDisplay";
import type { ChatConversation, ChatInstanceOption, ChatMessage } from "./types";

type ConversationsResponse = { conversations: ChatConversation[] };
type MessagesResponse = { messages: ChatMessage[]; nextCursor: string | null };
type ReactionResponse = { success: boolean; message: ChatMessage | null };
type DeleteMode = "for_everyone";
type SendMediaType = "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";

export function getContactDisplayName(conversation: Pick<ChatConversation, "name" | "jid">) {
  return conversation.name?.trim() || conversation.jid.split("@")[0] || "Contato";
}

export function getMessagePreview(message: ChatMessage | null) {
  if (!message) return "Sem mensagens";
  return message.body?.trim() || getKnownMessageFallback(message);
}

export function getUnreadTotal(conversations: ChatConversation[]) {
  return conversations.reduce((total, conversation) => total + Math.max(conversation.unreadCount || 0, 0), 0);
}

export function filterConversations(conversations: ChatConversation[], selectedInstanceId: string, search: string) {
  const query = search.trim().toLowerCase();
  return conversations
    .filter((conversation) => {
      if (selectedInstanceId !== "all" && conversation.instanceId !== selectedInstanceId) return false;
      if (!query) return true;
      return [getContactDisplayName(conversation), getMessagePreview(conversation.lastMessage), conversation.jid]
        .some((value) => value.toLowerCase().includes(query));
    })
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
}

export function useConversations(selectedInstanceId: string, search: string) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [instances, setInstances] = useState<ChatInstanceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const [conversationRes, instancesRes] = await Promise.all([
        api.get<ConversationsResponse>("/chat/conversations"),
        api.get<InstanceStatus[]>("/agent/instances").catch(() => ({ data: [] as InstanceStatus[] })),
      ]);
      setConversations(conversationRes.data.conversations);
      setInstances(instancesRes.data.map((instance) => ({ id: instance.id, name: instance.name })));
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Nao foi possivel carregar as conversas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      await loadConversations();
      if (ignore) return;
    }
    void load();
    return () => {
      ignore = true;
    };
  }, [loadConversations]);

  const visibleConversations = useMemo(
    () => filterConversations(conversations, selectedInstanceId, search),
    [conversations, search, selectedInstanceId],
  );

  const loadMessages = useCallback(async (input: { instanceId: string; jid: string; cursor?: string | null; limit?: number }) => {
    const res = await api.get<MessagesResponse>(`/chat/conversations/${encodeURIComponent(input.jid)}/messages`, {
      params: {
        instanceId: input.instanceId,
        cursor: input.cursor || undefined,
        limit: input.limit ?? 50,
      },
    });
    return {
      messages: [...res.data.messages].reverse(),
      nextCursor: res.data.nextCursor,
    };
  }, []);

  const sendTextMessage = useCallback(async (input: { instanceId: string; jid: string; body: string; quotedMessageId?: string | null }) => {
    const res = await api.post<{ message: ChatMessage }>("/chat/send", input);
    return res.data.message;
  }, []);

  const sendMediaMessage = useCallback(async (input: { instanceId: string; jid: string; file: File; messageType: SendMediaType; caption?: string | null; quotedMessageId?: string | null }) => {
    const form = new FormData();
    form.append("instanceId", input.instanceId);
    form.append("jid", input.jid);
    form.append("messageType", input.messageType);
    if (input.caption?.trim()) form.append("caption", input.caption.trim());
    if (input.quotedMessageId?.trim()) form.append("quotedMessageId", input.quotedMessageId.trim());
    form.append("file", input.file);
    const res = await api.post<{ message: ChatMessage }>("/chat/send/media", form);
    return res.data.message;
  }, []);

  const sendReaction = useCallback(async (input: { instanceId: string; jid: string; providerMessageId: string; emoji: string }) => {
    const res = await api.post<ReactionResponse>("/chat/react", input);
    return res.data.message;
  }, []);

  const editMessage = useCallback(async (input: { instanceId: string; jid: string; providerMessageId: string; body: string }) => {
    const res = await api.post<{ message: ChatMessage }>("/chat/edit", input);
    return res.data.message;
  }, []);

  const deleteMessage = useCallback(async (input: { instanceId: string; jid: string; providerMessageId: string; mode: DeleteMode }) => {
    const res = await api.post<{ success: boolean; message: ChatMessage | null }>("/chat/delete", input);
    return res.data.message;
  }, []);

  const clearConversation = useCallback(async (input: { instanceId: string; jid: string }) => {
    const res = await api.post<{ success: boolean; deletedCount: number }>(`/chat/conversations/${encodeURIComponent(input.jid)}/clear`, {
      instanceId: input.instanceId,
    });
    return res.data;
  }, []);

  const markConversationRead = useCallback(async (input: { instanceId: string; jid: string }) => {
    const res = await api.post<{ success: boolean; conversation: ChatConversation | null }>(`/chat/conversations/${encodeURIComponent(input.jid)}/read`, {
      instanceId: input.instanceId,
    });
    return res.data.conversation;
  }, []);

  return {
    conversations,
    setConversations,
    visibleConversations,
    instances,
    loading,
    error,
    loadConversations,
    loadMessages,
    sendTextMessage,
    sendMediaMessage,
    sendReaction,
    editMessage,
    deleteMessage,
    clearConversation,
    markConversationRead,
    unreadTotal: getUnreadTotal(conversations),
  };
}
