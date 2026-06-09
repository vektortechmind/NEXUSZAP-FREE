import { ArrowDown, MessageCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import type { ChatConversation, ChatMessage } from "./types";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import type { MessageContextMenuAction } from "./messageContextActions";

type MessageThreadProps = {
  conversation: ChatConversation | null;
  messages: ChatMessage[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  sending: boolean;
  onLoadMore: () => void;
  onSend: (body: string) => Promise<void> | void;
  onSendMedia?: (input: { file: File; messageType: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT"; caption?: string | null }) => Promise<void> | void;
  onReact?: (message: ChatMessage, emoji: string) => Promise<void> | void;
  replyingTo?: ChatMessage | null;
  onCancelReply?: () => void;
  onOpenMenu?: (message: ChatMessage, position: { x: number; y: number }) => void;
  onOpenMedia?: (message: ChatMessage) => void;
  onMessageAction?: (action: MessageContextMenuAction, message: ChatMessage) => void;
};

export function MessageThread({
  conversation,
  messages,
  loading,
  loadingMore,
  hasMore,
  sending,
  onLoadMore,
  onSend,
  onSendMedia,
  onReact,
  replyingTo,
  onCancelReply,
  onOpenMenu,
  onOpenMedia,
}: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);
  const [showNewMessagesButton, setShowNewMessagesButton] = useState(false);
  const lastMessageId = messages[messages.length - 1]?.id ?? null;

  const isNearBottom = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return true;
    return element.scrollHeight - element.scrollTop - element.clientHeight <= 96;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior });
    nearBottomRef.current = true;
    setShowNewMessagesButton(false);
  }, []);

  useEffect(() => {
    if (!conversation || loading || !lastMessageId) return;
    if (nearBottomRef.current) {
      requestAnimationFrame(() => scrollToBottom("auto"));
      return;
    }
    setShowNewMessagesButton(true);
  }, [conversation, lastMessageId, loading, scrollToBottom]);

  if (!conversation) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-50 p-6 text-center dark:bg-slate-950/60">
        <div>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <MessageCircle size={22} aria-hidden="true" />
          </div>
          <h2 className="mt-3 text-sm font-semibold text-slate-950 dark:text-slate-50">Nenhuma conversa aberta</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Selecione um contato para acompanhar a thread.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-slate-50 dark:bg-slate-950/60">
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
        onScroll={(event) => {
          nearBottomRef.current = isNearBottom();
          setShowNewMessagesButton(!nearBottomRef.current);
          if (event.currentTarget.scrollTop <= 24 && hasMore && !loadingMore && !loading) {
            onLoadMore();
          }
        }}
      >
        {hasMore ? (
          <div className="mb-4 flex justify-center">
            <Button variant="secondary" size="sm" onClick={onLoadMore} loading={loadingMore}>Carregar anteriores</Button>
          </div>
        ) : null}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className={`h-12 rounded-lg bg-slate-200 dark:bg-slate-800 ${index % 2 ? "ml-auto w-2/3" : "w-1/2"}`} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <p className="mt-10 text-center text-sm text-slate-500 dark:text-slate-400">Sem mensagens nesta conversa.</p>
        ) : (
          <div className="space-y-2">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                quotedMessage={message.quotedMessageId ? messages.find((item) => item.providerMessageId === message.quotedMessageId) ?? null : null}
                onReact={onReact}
                onOpenMenu={onOpenMenu}
                onOpenMedia={onOpenMedia}
              />
            ))}
          </div>
        )}
      </div>
      {showNewMessagesButton ? (
        <button
          type="button"
          onClick={() => scrollToBottom()}
          className="absolute bottom-20 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-slate-900/15 transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-emerald-500 dark:text-emerald-950"
        >
          <ArrowDown size={14} aria-hidden="true" />
          Novas mensagens
        </button>
      ) : null}
      <ChatInput disabled={!conversation} sending={sending} replyingTo={replyingTo} onCancelReply={onCancelReply} onSend={onSend} onSendMedia={onSendMedia} />
    </div>
  );
}
