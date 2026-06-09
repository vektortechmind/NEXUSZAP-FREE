import { FileText, Image, Mic, SendHorizontal, Video, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import type { ChatMessage } from "./types";
import { getMessagePreviewText } from "./chatDisplay";

type ChatInputProps = {
  disabled?: boolean;
  sending?: boolean;
  replyingTo?: ChatMessage | null;
  onCancelReply?: () => void;
  onSend: (body: string) => Promise<void> | void;
  onSendMedia?: (input: { file: File; messageType: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT"; caption?: string | null }) => Promise<void> | void;
};

export function ChatInput({ disabled, sending, replyingTo, onCancelReply, onSend, onSendMedia }: ChatInputProps) {
  const [value, setValue] = useState("");
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);

  const submit = async () => {
    const body = value.trim();
    if (!body || disabled || sending) return;
    setValue("");
    await onSend(body);
  };

  const submitMedia = async (file: File | undefined, messageType: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT") => {
    if (!file || disabled || sending || !onSendMedia) return;
    const caption = value.trim() || null;
    setValue("");
    await onSendMedia({ file, messageType, caption });
  };

  const attachmentButtons = [
    { label: "Anexar imagem", icon: Image, ref: imageInputRef, accept: "image/jpeg,image/png,image/webp,image/gif", type: "IMAGE" as const },
    { label: "Anexar video", icon: Video, ref: videoInputRef, accept: "video/mp4,video/mpeg,video/quicktime,video/webm", type: "VIDEO" as const },
    { label: "Anexar audio", icon: Mic, ref: audioInputRef, accept: "audio/mpeg,audio/mp4,audio/ogg,audio/webm,audio/wav,audio/aac", type: "AUDIO" as const },
    { label: "Anexar documento", icon: FileText, ref: documentInputRef, accept: ".pdf,.txt,.doc,.docx,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document", type: "DOCUMENT" as const },
  ];

  return (
    <div
      className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
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
        <div className="flex h-11 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1 dark:border-slate-800 dark:bg-slate-900">
          {attachmentButtons.map((item) => {
            const Icon = item.icon;
            return (
              <span key={item.type}>
                <input
                  ref={item.ref}
                  type="file"
                  accept={item.accept}
                  className="sr-only"
                  disabled={disabled || sending || !onSendMedia}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    void submitMedia(file, item.type);
                  }}
                />
                <button
                  type="button"
                  onClick={() => item.ref.current?.click()}
                  disabled={disabled || sending || !onSendMedia}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-white hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-emerald-300"
                  aria-label={item.label}
                  title={item.label}
                >
                  <Icon size={16} aria-hidden="true" />
                </button>
              </span>
            );
          })}
        </div>
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
        <Button type="button" size="md" disabled={!value.trim() || disabled} loading={sending} aria-label="Enviar mensagem" onClick={() => void submit()}>
          <SendHorizontal size={17} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
