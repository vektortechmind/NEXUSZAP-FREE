import { AlertTriangle, Check, CheckCheck } from "lucide-react";
import type { ChatMessage, ChatMessageStatus } from "./types";
import { AudioPlayer } from "./AudioPlayer";
import { getKnownMessageFallback, getMessageStatusLabel } from "./chatDisplay";

type MessageBubbleProps = {
  message: ChatMessage;
};

function MessageStatus({ status }: { status: ChatMessageStatus }) {
  if (status === "FAILED") return <AlertTriangle size={13} className="text-red-500" aria-label="Falhou" />;
  if (status === "SENT" || status === "PENDING") return <Check size={14} aria-label={getMessageStatusLabel(status)} />;
  return <CheckCheck size={14} className={status === "READ" ? "text-sky-500" : undefined} aria-label={getMessageStatusLabel(status)} />;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const fromMe = message.fromMe;
  const showAudio = message.messageType === "AUDIO" && Boolean(message.mediaUrl);
  return (
    <div className={`flex ${fromMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`group w-fit max-w-[min(82%,42rem)] rounded-lg px-2.5 py-1.5 shadow-[0_1px_0_rgba(15,23,42,0.08)] ${fromMe ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950" : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"}`}
      >
        {showAudio ? <AudioPlayer src={message.mediaUrl!} durationMs={message.mediaDurationMs} fromMe={fromMe} /> : null}
        {message.body ? <p className="whitespace-pre-wrap break-words text-sm leading-5">{message.body}</p> : null}
        {!showAudio && !message.body ? <p className="text-sm italic opacity-75">{getKnownMessageFallback(message)}</p> : null}
        <div className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${fromMe ? "text-white/78 dark:text-slate-950/70" : "text-slate-500 dark:text-slate-400"}`}>
          <time className="w-0 overflow-hidden whitespace-nowrap opacity-0 transition-opacity group-hover:w-auto group-hover:opacity-100" dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
          {fromMe ? <MessageStatus status={message.status} /> : null}
        </div>
      </div>
    </div>
  );
}
