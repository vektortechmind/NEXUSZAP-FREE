import { SendHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";

type ChatInputProps = {
  disabled?: boolean;
  sending?: boolean;
  onSend: (body: string) => Promise<void> | void;
};

export function ChatInput({ disabled, sending, onSend }: ChatInputProps) {
  const [value, setValue] = useState("");

  const submit = async () => {
    const body = value.trim();
    if (!body || disabled || sending) return;
    setValue("");
    await onSend(body);
  };

  return (
    <form
      className="flex items-end gap-2 border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
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
    </form>
  );
}
