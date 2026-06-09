import { Download, MessageSquareReply, Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ChatMessage } from "./types";
import { EmojiMartPopup } from "./EmojiMartPopup";
import { QUICK_REACTIONS } from "./chatReactions";

type MediaViewerProps = {
  message: ChatMessage;
  onClose: () => void;
  onReact?: (message: ChatMessage, emoji: string) => Promise<void> | void;
  onReply?: (message: ChatMessage) => void;
};

export function MediaViewer({ message, onClose, onReact, onReply }: MediaViewerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const isVideo = message.messageType === "VIDEO";
  const canReact = Boolean(onReact && message.providerMessageId && !message.isDeleted);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const selectEmoji = useCallback((emoji: string) => {
    setShowPicker(false);
    void onReact?.(message, emoji);
  }, [message, onReact]);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-slate-950/92 text-white" role="dialog" aria-modal="true" aria-label="Visualizador de midia" onClick={onClose}>
      <div className="flex min-h-14 items-center justify-end gap-2 px-4 py-3">
        {message.mediaUrl ? (
          <a
            href={message.mediaUrl}
            download
            onClick={(event) => event.stopPropagation()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            aria-label="Baixar midia"
          >
            <Download size={18} aria-hidden="true" />
          </a>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          aria-label="Fechar visualizador"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-4" onClick={onClose}>
        {isVideo ? (
          <video src={message.mediaUrl ?? undefined} controls autoPlay className="max-h-[82vh] max-w-[92vw] rounded-lg" onClick={(event) => event.stopPropagation()} />
        ) : (
          <img src={message.mediaUrl ?? undefined} alt="" className="max-h-[82vh] max-w-[92vw] rounded-lg object-contain" onClick={(event) => event.stopPropagation()} />
        )}
      </div>
      <div className="relative flex min-h-16 flex-wrap items-center justify-center gap-2 border-t border-white/10 bg-slate-950/80 px-4 py-3" onClick={(event) => event.stopPropagation()}>
        {canReact ? (
          <div className="relative inline-flex items-center gap-1 rounded-full bg-white px-1 py-0.5 text-slate-900 shadow-xl">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => void onReact?.(message, emoji)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-base transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                aria-label={`Reagir com ${emoji}`}
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowPicker((current) => !current)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label="Mais emojis"
            >
              <Plus size={15} aria-hidden="true" />
            </button>
            {showPicker ? <EmojiMartPopup className="absolute bottom-full left-0 mb-2" onSelect={selectEmoji} onClose={() => setShowPicker(false)} /> : null}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => {
            onReply?.(message);
            onClose();
          }}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <MessageSquareReply size={16} aria-hidden="true" />
          Responder
        </button>
      </div>
    </div>
  );
}
