import { AlertTriangle, Check, CheckCheck, Eye, X } from "lucide-react";
import type { ChatMessage, ChatMessageStatus } from "./types";
import { AudioPlayer } from "./AudioPlayer";
import { getKnownMessageFallback, getMessageStatusLabel } from "./chatDisplay";

type MessageBubbleProps = {
  message: ChatMessage;
  onReact?: (message: ChatMessage, emoji: string) => Promise<void> | void;
};

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "🙏"];

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

function MessageMeta({ message, inline = false }: { message: ChatMessage; inline?: boolean }) {
  const fromMe = message.fromMe;
  return (
    <span className={`${inline ? "ml-2 inline-flex align-baseline" : "mt-1 flex justify-end"} items-center gap-1 text-[11px] ${fromMe ? "text-white/78 dark:text-slate-950/70" : "text-slate-500 dark:text-slate-400"}`}>
      <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
      {fromMe ? <MessageStatus status={message.status} /> : null}
    </span>
  );
}

export function MessageBubble({ message, onReact }: MessageBubbleProps) {
  const fromMe = message.fromMe;
  const showAudio = message.messageType === "AUDIO" && Boolean(message.mediaUrl);
  const showImage = message.messageType === "IMAGE" && Boolean(message.mediaUrl);
  const showVideo = message.messageType === "VIDEO" && Boolean(message.mediaUrl);
  const missingVisualMedia = (message.messageType === "IMAGE" || message.messageType === "VIDEO") && !message.mediaUrl;
  const showMedia = showAudio || showImage || showVideo;
  const showInlineMeta = !showMedia;
  const isViewOnce = Boolean(showMedia && message.body?.startsWith("Visualizacao unica"));
  const displayBody = isViewOnce ? message.body?.replace(/^Visualizacao unica\n?/, "").trim() : message.body;
  const canReact = Boolean(onReact && message.providerMessageId);
  return (
    <div className={`flex ${fromMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`group relative w-fit max-w-[min(82%,42rem)] rounded-lg px-2.5 py-1.5 shadow-[0_1px_0_rgba(15,23,42,0.08)] ${fromMe ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950" : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"}`}
      >
        {canReact ? (
          <div className={`absolute top-0 z-10 hidden -translate-y-1/2 items-center gap-0.5 rounded-full border border-slate-200 bg-white px-1 py-0.5 text-sm shadow-lg shadow-slate-900/10 group-hover:flex group-focus-within:flex dark:border-slate-700 dark:bg-slate-900 ${fromMe ? "right-full mr-1" : "left-full ml-1"}`}>
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact?.(message, emoji)}
                className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-slate-800"
                aria-label={`Reagir com ${emoji}`}
              >
                {emoji}
              </button>
            ))}
            {message.reactionEmoji ? (
              <button
                type="button"
                onClick={() => onReact?.(message, "")}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Remover reacao"
              >
                <X size={14} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ) : null}
        {isViewOnce ? (
          <div className={`mb-1 flex items-center gap-1 text-xs ${fromMe ? "text-white/80 dark:text-slate-950/70" : "text-slate-500 dark:text-slate-400"}`}>
            <Eye size={13} aria-hidden="true" />
            <span>Visualizacao unica</span>
          </div>
        ) : null}
        {showAudio ? <AudioPlayer src={message.mediaUrl!} durationMs={message.mediaDurationMs} fromMe={fromMe} /> : null}
        {showImage ? <img src={message.mediaUrl!} alt="" loading="lazy" className="max-h-[24rem] max-w-full rounded-md object-contain" /> : null}
        {showVideo ? <video src={message.mediaUrl!} controls className="max-h-[24rem] max-w-full rounded-md" /> : null}
        {displayBody ? (
          <p className="whitespace-pre-wrap break-words text-sm leading-5">
            {displayBody}
            {showInlineMeta ? <MessageMeta message={message} inline /> : null}
          </p>
        ) : null}
        {missingVisualMedia && !displayBody ? (
          <p className="text-sm italic opacity-75">{message.messageType === "IMAGE" ? "[Imagem]" : "[Video]"}</p>
        ) : null}
        {!showMedia && !missingVisualMedia && !displayBody ? (
          <p className="text-sm italic opacity-75">
            {getKnownMessageFallback(message)}
            {showInlineMeta ? <MessageMeta message={message} inline /> : null}
          </p>
        ) : null}
        {!showInlineMeta ? <MessageMeta message={message} /> : null}
        {message.reactionEmoji ? (
          <span className={`absolute -bottom-3 ${fromMe ? "left-2" : "right-2"} rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-base leading-none shadow-sm dark:border-slate-700 dark:bg-slate-900`}>
            {message.reactionEmoji}
          </span>
        ) : null}
      </div>
    </div>
  );
}
