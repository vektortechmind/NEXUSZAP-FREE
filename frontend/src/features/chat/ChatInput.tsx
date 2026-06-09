import { SendHorizontal, X } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import type { ChatMessage } from "./types";
import { getMessagePreviewText } from "./chatDisplay";

type ChatInputProps = {
  disabled?: boolean;
  sending?: boolean;
  replyingTo?: ChatMessage | null;
  onCancelReply?: () => void;
  onSend: (body: string) => Promise<void> | void;
};

export function ChatInput({ disabled, sending, replyingTo, onCancelReply, onSend }: ChatInputProps) {
  const [value, setValue] = useState("");

  const submit = async () => {
    const body = value.trim();
    if (!body || disabled || sending) return;
    setValue("");
    await onSend(body);
  };

  return (
    <form
      className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {replyingTo ? (
        <div className="mb-2 flex items-center gap-2 rounded-md border-l-4 border-emerald-500 bg-slate-100 px-3 py-2 dark:bg-slate-900">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Respondendo {replyingTo.fromMe ? "Voce" : "contato"}</p>
            <p className="truncate text-xs text-slate-600 dark:text-slate-400">{getMessagePreviewText(replyingTo)}</p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-slate-800"
            aria-label="Cancelar resposta"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        <label className="sr-only" htmlFor="chat-message-input">Mensagem</label>
        <textarea
          id="chat-message-input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          disabled={disabled || sending}
          rows={1}
          placeholder="Digite uma mensagem"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-500 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
        />
        <Button type="submit" size="md" disabled={!value.trim() || disabled} loading={sending} aria-label="Enviar mensagem">
          <SendHorizontal size={17} aria-hidden="true" />
        </Button>
      </div>
    </form>
  );
}
