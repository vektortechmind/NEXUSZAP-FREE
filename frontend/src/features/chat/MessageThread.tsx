import { MessageCircle } from "lucide-react";
import { Button } from "../../components/ui/Button";
import type { ChatConversation, ChatMessage } from "./types";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";

type MessageThreadProps = {
  conversation: ChatConversation | null;
  messages: ChatMessage[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  sending: boolean;
  onLoadMore: () => void;
  onSend: (body: string) => Promise<void> | void;
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
}: MessageThreadProps) {
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
    <div className="flex min-h-0 flex-1 flex-col bg-slate-50 dark:bg-slate-950/60">
      <div
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
        onScroll={(event) => {
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
            {messages.map((message) => <MessageBubble key={message.id} message={message} />)}
          </div>
        )}
      </div>
      <ChatInput disabled={!conversation} sending={sending} onSend={onSend} />
    </div>
  );
}
