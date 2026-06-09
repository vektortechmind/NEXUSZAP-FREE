import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "../contexts/ToastContext";
import { ChatHeader } from "../features/chat/ChatHeader";
import { ConversationList } from "../features/chat/ConversationList";
import { MediaViewer } from "../features/chat/MediaViewer";
import { MessageThread } from "../features/chat/MessageThread";
import { upsertMessage } from "../features/chat/chatState";
import { useChat } from "../features/chat/useChat";
import { CHAT_UNREAD_TOTAL_EVENT, type ChatConversation, type ChatMessage, type ChatPresence, type ChatReactionEvent } from "../features/chat/types";
import { getUnreadTotal, useConversations } from "../features/chat/useConversations";
import { MessageContextMenu } from "../features/chat/MessageContextMenu";
import type { MessageContextMenuAction } from "../features/chat/messageContextActions";

function conversationKey(conversation: Pick<ChatConversation, "instanceId" | "jid">) {
  return `${conversation.instanceId}:${conversation.jid}`;
}

function messageBelongsToConversation(message: ChatMessage, conversation: ChatConversation | null) {
  return Boolean(conversation && message.instanceId === conversation.instanceId && message.jid === conversation.jid);
}

function upsertConversation(list: ChatConversation[], next: ChatConversation) {
  const exists = list.some((conversation) => conversationKey(conversation) === conversationKey(next));
  const merged = exists
    ? list.map((conversation) => conversationKey(conversation) === conversationKey(next) ? { ...conversation, ...next } : conversation)
    : [next, ...list];
  return merged.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
}

export function ChatPage() {
  const { addToast } = useToast();
  const [selectedInstanceId, setSelectedInstanceId] = useState("all");
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
    sendReaction,
    editMessage,
    deleteMessage,
    clearConversation,
    markConversationRead,
    unreadTotal,
  } = useConversations(selectedInstanceId, search);

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
    setConversations((current) => {
      const next = upsertConversation(current, conversation);
      publishUnreadTotal(next);
      return next;
    });
  }, [publishUnreadTotal, setConversations]);

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
    handleStatus(message);
  }, [handleStatus]);

  const handlePresence = useCallback((presence: ChatPresence) => {
    const key = `${presence.instanceId}:${presence.jid}`;
    setTyping((current) => ({ ...current, [key]: presence.isTyping }));
    if (presence.isTyping) {
      window.setTimeout(() => setTyping((current) => ({ ...current, [key]: false })), 5000);
    }
  }, []);

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
    setConversations((current) => current.map((item) => conversationKey(item) === key ? { ...item, unreadCount: 0 } : item));
    try {
      if (conversation.unreadCount > 0) {
        void markConversationRead({ instanceId: conversation.instanceId, jid: conversation.jid }).catch((err) => {
          console.error(err);
        });
      }
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
    const mode = action === "delete_for_me" ? "for_me" : action === "delete_for_everyone" ? "for_everyone" : "for_everyone_and_erase";
    const confirmed = window.confirm(action === "delete_for_everyone" ? "Apagar para todos?" : action === "delete_forever" ? "Apagar para todos e remover do painel?" : "Apagar para mim?");
    if (!confirmed) return;
    try {
      const updated = await deleteMessage({ instanceId: selectedConversation.instanceId, jid: selectedConversation.jid, providerMessageId: message.providerMessageId, mode });
      if (updated) handleStatus(updated);
    } catch (err) {
      console.error(err);
      addToast("Nao foi possivel apagar a mensagem.", "error");
    }
  }, [addToast, deleteMessage, editMessage, handleStatus, selectedConversation]);

  const clearSelectedConversation = useCallback(async (mode: "panel_only" | "panel_and_whatsapp") => {
    if (!selectedConversation) return;
    const confirmed = window.confirm(mode === "panel_only" ? "Limpar mensagens apenas do painel?" : "Isso limpara as mensagens no painel e no seu aparelho WhatsApp. O contato continuara vendo as mensagens normalmente.");
    if (!confirmed) return;
    try {
      await clearConversation({ instanceId: selectedConversation.instanceId, jid: selectedConversation.jid, mode });
      setMessages([]);
      setReplyingTo(null);
      setConversations((current) => current.map((item) => conversationKey(item) === conversationKey(selectedConversation) ? { ...item, unreadCount: 0 } : item));
      addToast("Conversa limpa.", "success");
    } catch (err) {
      console.error(err);
      addToast("Nao foi possivel limpar a conversa.", "error");
    }
  }, [addToast, clearConversation, selectedConversation, setConversations]);

  const selectedTyping = selectedConversation ? Boolean(typing[conversationKey(selectedConversation)]) : false;

  return (
    <section className="h-[calc(100svh-3.5rem)] min-h-[38rem] overflow-hidden border-y border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="grid h-full min-h-0 md:grid-cols-[320px_minmax(0,1fr)]">
        <div className={`${mobileThreadOpen ? "hidden" : "block"} min-h-0 md:block`}>
          <ConversationList
            conversations={visibleConversations}
            instances={instances}
            selectedConversationKey={selectedKey}
            selectedInstanceId={selectedInstanceId}
            search={search}
            loading={loading}
            error={error}
            onSelect={(conversation) => void selectConversation(conversation)}
            onInstanceChange={setSelectedInstanceId}
            onSearchChange={setSearch}
          />
        </div>
        <div className={`${mobileThreadOpen ? "flex" : "hidden"} min-h-0 flex-col md:flex`}>
          <ChatHeader
            conversation={selectedConversation}
            instances={instances}
            connectionState={connectionState}
            isTyping={selectedTyping}
            onBack={() => setMobileThreadOpen(false)}
            onClear={(mode) => void clearSelectedConversation(mode)}
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
