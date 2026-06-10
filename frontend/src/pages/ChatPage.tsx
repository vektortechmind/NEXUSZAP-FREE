import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "../contexts/ToastContext";
import { ChatHeader } from "../features/chat/ChatHeader";
import { ConversationList } from "../features/chat/ConversationList";
import { MediaViewer } from "../features/chat/MediaViewer";
import { MessageThread } from "../features/chat/MessageThread";
import { upsertMessage } from "../features/chat/chatState";
import { useChat } from "../features/chat/useChat";
import { CHAT_UNREAD_TOTAL_EVENT, type ChatConversation, type ChatMessage, type ChatPresence, type ChatReactionEvent } from "../features/chat/types";
import { getUnreadTotal, type ChatFilter, useConversations } from "../features/chat/useConversations";
import { MessageContextMenu } from "../features/chat/MessageContextMenu";
import type { MessageContextMenuAction } from "../features/chat/messageContextActions";

function conversationKey(conversation: Pick<ChatConversation, "instanceId" | "jid">) {
  return `${conversation.instanceId}:${conversation.jid}`;
}

function messageBelongsToConversation(message: ChatMessage, conversation: ChatConversation | null) {
  return Boolean(conversation && message.instanceId === conversation.instanceId && message.jid === conversation.jid);
}

function latestVisibleMessage(messages: ChatMessage[], deletedMessageId: string) {
  let latest: ChatMessage | null = null;
  let latestTimestamp = -Infinity;

  for (const message of messages) {
    if (message.id === deletedMessageId || message.isDeleted) continue;
    const timestamp = new Date(message.createdAt).getTime();
    if (timestamp > latestTimestamp) {
      latest = message;
      latestTimestamp = timestamp;
    }
  }

  return latest;
}

function upsertConversation(list: ChatConversation[], next: ChatConversation) {
  const exists = list.some((conversation) => conversationKey(conversation) === conversationKey(next));
  const merged = exists
    ? list.map((conversation) => conversationKey(conversation) === conversationKey(next)
      ? { ...conversation, ...next }
      : conversation)
    : [next, ...list];
  return merged.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
}

export function ChatPage() {
  const { addToast } = useToast();
  const [selectedInstanceId, setSelectedInstanceId] = useState("all");
  const [conversationFilter, setConversationFilter] = useState<ChatFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [mediaViewerMessage, setMediaViewerMessage] = useState<ChatMessage | null>(null);
  const [contextMenu, setContextMenu] = useState<{ message: ChatMessage; position: { x: number; y: number } } | null>(null);
  const [syncingGroups, setSyncingGroups] = useState(false);

  const {
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
    syncGroups,
    sendReaction,
    editMessage,
    deleteMessage,
    clearConversation,
    markConversationRead,
    unreadTotal,
  } = useConversations(selectedInstanceId, search, conversationFilter);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversationKey(conversation) === selectedKey) ?? null,
    [conversations, selectedKey],
  );

  const publishUnreadTotal = useCallback((nextConversations: ChatConversation[]) => {
    window.dispatchEvent(new CustomEvent(CHAT_UNREAD_TOTAL_EVENT, { detail: { total: getUnreadTotal(nextConversations) } }));
  }, []);

  useEffect(() => {
    publishUnreadTotal(conversations);
  }, [conversations, publishUnreadTotal]);

  const handleConversationUpdate = useCallback((conversation: ChatConversation) => {
    const key = conversationKey(conversation);
    if (conversation.cleared) {
      if (selectedKey === key) {
        setMessages([]);
        setReplyingTo(null);
        setMediaViewerMessage(null);
        setContextMenu(null);
        setSelectedKey(null);
        setMobileThreadOpen(false);
      }
      setConversations((current) => {
        const next = current.filter((item) => conversationKey(item) !== key);
        publishUnreadTotal(next);
        return next;
      });
      return;
    }
    const nextConversation = selectedKey === key && conversation.unreadCount > 0
      ? { ...conversation, unreadCount: 0 }
      : conversation;
    setConversations((current) => {
      const next = upsertConversation(current, nextConversation);
      publishUnreadTotal(next);
      return next;
    });
    if (selectedKey === key && conversation.unreadCount > 0) {
      void markConversationRead({ instanceId: conversation.instanceId, jid: conversation.jid }).catch((err) => {
        console.error(err);
      });
    }
  }, [markConversationRead, publishUnreadTotal, selectedKey, setConversations]);

  const handleMessage = useCallback((message: ChatMessage) => {
    if (messageBelongsToConversation(message, selectedConversation)) {
      setMessages((current) => upsertMessage(current, message));
    }
  }, [selectedConversation]);

  const handleStatus = useCallback((message: ChatMessage) => {
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, ...message } : item));
    setConversations((current) => current.map((conversation) => (
      conversation.lastMessage?.id === message.id ? { ...conversation, lastMessage: { ...conversation.lastMessage, ...message } } : conversation
    )));
  }, [setConversations]);

  const handleReaction = useCallback((event: ChatReactionEvent) => {
    handleStatus(event.message);
  }, [handleStatus]);

  const handleDeleted = useCallback((message: ChatMessage) => {
    const fallbackLastMessage = latestVisibleMessage(messages, message.id);
    setMessages((current) => current.filter((item) => item.id !== message.id));
    setConversations((current) => current.map((conversation) => (
      conversation.lastMessage?.id === message.id ? { ...conversation, lastMessage: fallbackLastMessage } : conversation
    )));
  }, [messages, setConversations]);

  const handlePresence = useCallback((presence: ChatPresence) => {
    const key = `${presence.instanceId}:${presence.jid}`;
    setTyping((current) => ({ ...current, [key]: presence.isTyping }));
    if (presence.isTyping) {
      window.setTimeout(() => setTyping((current) => ({ ...current, [key]: false })), 5000);
    }
  }, []);

  const handleSyncGroups = useCallback(async () => {
    const targetInstanceIds = selectedInstanceId === "all"
      ? instances.map((instance) => instance.id)
      : [selectedInstanceId];
    if (targetInstanceIds.length === 0) {
      addToast("Nenhuma instancia disponivel para sincronizar grupos.", "error");
      return;
    }
    setSyncingGroups(true);
    try {
      const results = await Promise.all(targetInstanceIds.map((instanceId) => syncGroups(instanceId)));
      const total = results.reduce((sum, result) => sum + result.synced, 0);
      addToast(total > 0 ? `${total} grupo(s) sincronizado(s).` : "Nenhum grupo encontrado.", "success");
    } catch (err) {
      console.error(err);
      addToast("Nao foi possivel sincronizar grupos.", "error");
    } finally {
      setSyncingGroups(false);
    }
  }, [addToast, instances, selectedInstanceId, syncGroups]);

  const chatCallbacks = useMemo(() => ({
    onMessageNew: handleMessage,
    onMessageSent: handleMessage,
    onMessageStatus: handleStatus,
    onMessageReaction: handleReaction,
    onMessageEdited: handleStatus,
    onMessageDeleted: handleDeleted,
    onConversationUpdate: handleConversationUpdate,
    onPresenceUpdate: handlePresence,
  }), [handleConversationUpdate, handleDeleted, handleMessage, handlePresence, handleReaction, handleStatus]);

  const { connectionState } = useChat(chatCallbacks);
  const selectedInstanceForSync = selectedConversation?.instanceId ?? null;
  const selectedJidForSync = selectedConversation?.jid ?? null;

  useEffect(() => {
    if (connectionState !== "connected") return;
    void loadConversations();
    if (selectedInstanceForSync && selectedJidForSync) {
      void loadMessages({ instanceId: selectedInstanceForSync, jid: selectedJidForSync }).then((result) => {
        setMessages(result.messages);
        setNextCursor(result.nextCursor);
      }).catch((err) => {
        console.error(err);
      });
    }
  }, [connectionState, loadConversations, loadMessages, selectedInstanceForSync, selectedJidForSync]);

  const selectConversation = useCallback(async (conversation: ChatConversation) => {
    const key = conversationKey(conversation);
    setSelectedKey(key);
    setMobileThreadOpen(true);
    setMessagesLoading(true);
    const previousUnreadCount = conversation.unreadCount;
    setConversations((current) => current.map((item) => conversationKey(item) === key ? { ...item, unreadCount: 0 } : item));
    if (conversation.unreadCount > 0) {
      try {
        await markConversationRead({ instanceId: conversation.instanceId, jid: conversation.jid });
      } catch (err) {
        console.error(err);
        setConversations((current) => current.map((item) => conversationKey(item) === key ? { ...item, unreadCount: previousUnreadCount } : item));
        addToast("Nao foi possivel marcar a conversa como lida.", "error");
      }
    }
    try {
      const result = await loadMessages({ instanceId: conversation.instanceId, jid: conversation.jid });
      setMessages(result.messages);
      setNextCursor(result.nextCursor);
    } catch (err) {
      console.error(err);
      addToast("Nao foi possivel carregar a conversa.", "error");
    } finally {
      setMessagesLoading(false);
    }
  }, [addToast, loadMessages, markConversationRead, setConversations]);

  const loadOlderMessages = useCallback(async () => {
    if (!selectedConversation || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await loadMessages({ instanceId: selectedConversation.instanceId, jid: selectedConversation.jid, cursor: nextCursor });
      setMessages((current) => result.messages.reduce((merged, message) => upsertMessage(merged, message), current));
      setNextCursor(result.nextCursor);
    } catch (err) {
      console.error(err);
      addToast("Nao foi possivel carregar mensagens anteriores.", "error");
    } finally {
      setLoadingMore(false);
    }
  }, [addToast, loadMessages, loadingMore, nextCursor, selectedConversation]);

  const sendMessage = useCallback(async (body: string) => {
    if (!selectedConversation) return;
    const optimisticId = `optimistic-${Date.now().toString(36)}`;
    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      conversationId: selectedConversation.id,
      instanceId: selectedConversation.instanceId,
      jid: selectedConversation.jid,
      fromMe: true,
      body,
      messageType: "TEXT",
      status: "PENDING",
      providerMessageId: null,
      senderJid: null,
      senderName: null,
      mediaUrl: null,
      mediaMimeType: null,
      mediaDurationMs: null,
      reactionEmoji: null,
      editedAt: null,
      isDeleted: false,
      quotedMessageId: replyingTo?.providerMessageId ?? null,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => upsertMessage(current, optimisticMessage));
    setSending(true);
    try {
      const message = await sendTextMessage({
        instanceId: selectedConversation.instanceId,
        jid: selectedConversation.jid,
        body,
        quotedMessageId: replyingTo?.providerMessageId ?? null,
      });
      setMessages((current) => upsertMessage(current.filter((item) => item.id !== optimisticId), message));
      setReplyingTo(null);
    } catch (err) {
      console.error(err);
      setMessages((current) => current.map((item) => item.id === optimisticId ? { ...item, status: "FAILED" } : item));
      addToast("Nao foi possivel enviar a mensagem.", "error");
    } finally {
      setSending(false);
    }
  }, [addToast, replyingTo, selectedConversation, sendTextMessage]);

  const sendMedia = useCallback(async (input: { file: File; messageType: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT"; caption?: string | null }) => {
    if (!selectedConversation) return;
    setSending(true);
    try {
      const message = await sendMediaMessage({
        instanceId: selectedConversation.instanceId,
        jid: selectedConversation.jid,
        file: input.file,
        messageType: input.messageType,
        caption: input.caption,
        quotedMessageId: replyingTo?.providerMessageId ?? null,
      });
      setMessages((current) => upsertMessage(current, message));
      setReplyingTo(null);
    } catch (err) {
      console.error(err);
      addToast("Nao foi possivel enviar a midia.", "error");
    } finally {
      setSending(false);
    }
  }, [addToast, replyingTo, selectedConversation, sendMediaMessage]);

  const reactToMessage = useCallback(async (message: ChatMessage, emoji: string) => {
    if (!selectedConversation || !message.providerMessageId) return;
    const previousEmoji = message.reactionEmoji;
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, reactionEmoji: emoji.trim() ? emoji : null } : item));
    try {
      const updated = await sendReaction({
        instanceId: selectedConversation.instanceId,
        jid: selectedConversation.jid,
        providerMessageId: message.providerMessageId,
        emoji,
      });
      if (updated) handleStatus(updated);
    } catch (err) {
      console.error(err);
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, reactionEmoji: previousEmoji } : item));
      addToast("Nao foi possivel enviar a reacao.", "error");
    }
  }, [addToast, handleStatus, selectedConversation, sendReaction]);

  const handleMessageAction = useCallback(async (action: MessageContextMenuAction, message: ChatMessage) => {
    setContextMenu(null);
    if (!selectedConversation || !message.providerMessageId) return;
    if (action === "reply") {
      setReplyingTo(message);
      return;
    }
    if (action === "edit") {
      const body = window.prompt("Editar mensagem", message.body ?? "");
      if (!body?.trim()) return;
      try {
        const updated = await editMessage({ instanceId: selectedConversation.instanceId, jid: selectedConversation.jid, providerMessageId: message.providerMessageId, body });
        handleStatus(updated);
      } catch (err) {
        console.error(err);
        addToast("Nao foi possivel editar a mensagem.", "error");
      }
      return;
    }
    if (action !== "delete_for_everyone") return;
    const confirmed = window.confirm("Apagar para todos?");
    if (!confirmed) return;
    try {
      const updated = await deleteMessage({ instanceId: selectedConversation.instanceId, jid: selectedConversation.jid, providerMessageId: message.providerMessageId, mode: "for_everyone" });
      if (updated) handleStatus(updated);
    } catch (err) {
      console.error(err);
      addToast("Nao foi possivel apagar a mensagem.", "error");
    }
  }, [addToast, deleteMessage, editMessage, handleStatus, selectedConversation]);

  const executeClearConversation = useCallback(async (conversation: ChatConversation) => {
    const key = conversationKey(conversation);
    try {
      await clearConversation({ instanceId: conversation.instanceId, jid: conversation.jid });
      if (selectedKey === key) {
        setMessages([]);
        setReplyingTo(null);
        setMediaViewerMessage(null);
        setContextMenu(null);
        setSelectedKey(null);
        setMobileThreadOpen(false);
      }
      setConversations((current) => current.filter((item) => conversationKey(item) !== key));
      addToast("Conversa limpa.", "success");
    } catch (err) {
      console.error(err);
      addToast("Nao foi possivel limpar a conversa.", "error");
    }
  }, [addToast, clearConversation, selectedKey, setConversations]);

  const clearSelectedConversation = useCallback(async () => {
    if (!selectedConversation) return;
    await executeClearConversation(selectedConversation);
  }, [executeClearConversation, selectedConversation]);

  const clearConversationFromList = useCallback(async (conversation: ChatConversation) => {
    const confirmed = window.confirm("Limpar conversa somente no painel? As mensagens continuam no WhatsApp.");
    if (!confirmed) return;
    await executeClearConversation(conversation);
  }, [executeClearConversation]);

  const selectedTyping = selectedConversation ? Boolean(typing[conversationKey(selectedConversation)]) : false;

  return (
    <section className="h-[calc(100svh-3.5rem)] min-h-[38rem] overflow-hidden border-y border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="grid h-full min-h-0 md:grid-cols-[320px_minmax(0,1fr)]">
        <div className={`${mobileThreadOpen ? "hidden" : "block"} h-full min-h-0 overflow-hidden md:block`}>
          <ConversationList
            conversations={visibleConversations}
            instances={instances}
            selectedConversationKey={selectedKey}
            selectedInstanceId={selectedInstanceId}
            search={search}
            loading={loading}
            error={error}
            activeFilter={conversationFilter}
            syncingGroups={syncingGroups}
            onSelect={(conversation) => void selectConversation(conversation)}
            onInstanceChange={setSelectedInstanceId}
            onSearchChange={setSearch}
            onFilterChange={setConversationFilter}
            onSyncGroups={() => void handleSyncGroups()}
            onClearConversation={(conversation) => void clearConversationFromList(conversation)}
          />
        </div>
        <div className={`${mobileThreadOpen ? "flex" : "hidden"} h-full min-h-0 flex-col overflow-hidden md:flex`}>
          <ChatHeader
            conversation={selectedConversation}
            instances={instances}
            connectionState={connectionState}
            isTyping={selectedTyping}
            onBack={() => setMobileThreadOpen(false)}
            onClear={() => void clearSelectedConversation()}
          />
          <MessageThread
            conversation={selectedConversation}
            messages={messages}
            loading={messagesLoading}
            loadingMore={loadingMore}
            hasMore={Boolean(nextCursor)}
            sending={sending}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            onLoadMore={() => void loadOlderMessages()}
            onSend={(body) => void sendMessage(body)}
            onSendMedia={(input) => void sendMedia(input)}
            onReact={(message, emoji) => void reactToMessage(message, emoji)}
            onOpenMenu={(message, position) => setContextMenu({ message, position })}
            onOpenMedia={setMediaViewerMessage}
          />
        </div>
      </div>
      {mediaViewerMessage ? (
        <MediaViewer
          message={mediaViewerMessage}
          onClose={() => setMediaViewerMessage(null)}
          onReact={(message, emoji) => void reactToMessage(message, emoji)}
          onReply={(message) => setReplyingTo(message)}
        />
      ) : null}
      {contextMenu ? (
        <MessageContextMenu
          message={contextMenu.message}
          position={contextMenu.position}
          onAction={(action, message) => void handleMessageAction(action, message)}
          onClose={() => setContextMenu(null)}
        />
      ) : null}
      <span className="sr-only">Total de conversas nao lidas: {unreadTotal}</span>
    </section>
  );
}
