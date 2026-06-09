import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/axios";
import type { InstanceStatus } from "../instances/types";
import type { ChatConversation, ChatInstanceOption, ChatMessage } from "./types";

type ConversationsResponse = { conversations: ChatConversation[] };
type MessagesResponse = { messages: ChatMessage[]; nextCursor: string | null };

export function getContactDisplayName(conversation: Pick<ChatConversation, "name" | "jid">) {
  return conversation.name?.trim() || conversation.jid.split("@")[0] || "Contato";
}

export function getMessagePreview(message: ChatMessage | null) {
  if (!message) return "Sem mensagens";
  if (message.messageType === "AUDIO") return "Audio recebido";
  return message.body?.trim() || "Mensagem sem texto";
}

export function getUnreadTotal(conversations: ChatConversation[]) {
  return conversations.reduce((total, conversation) => total + Math.max(conversation.unreadCount || 0, 0), 0);
}

export function filterConversations(conversations: ChatConversation[], selectedInstanceId: string, search: string) {
  const query = search.trim().toLowerCase();
  return conversations
    .filter((conversation) => selectedInstanceId === "all" || conversation.instanceId === selectedInstanceId)
    .filter((conversation) => {
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

  const sendTextMessage = useCallback(async (input: { instanceId: string; jid: string; body: string }) => {
    const res = await api.post<{ message: ChatMessage }>("/chat/send", input);
    return res.data.message;
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
    unreadTotal: getUnreadTotal(conversations),
  };
}
