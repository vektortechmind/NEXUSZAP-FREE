import { AlertTriangle, Check, CheckCheck, Eye, Pencil, Plus, SmilePlus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { createPortal } from "react-dom";
import type { ChatMessage, ChatMessageStatus } from "./types";
import { AudioPlayer } from "./AudioPlayer";
import { getKnownMessageFallback, getMessagePreviewText, getMessageStatusLabel } from "./chatDisplay";
import { MessageMenuButton } from "./MessageContextMenu";
import { EMOJI_PICKER_HEIGHT, EMOJI_PICKER_WIDTH, EmojiMartPopup } from "./EmojiMartPopup";
import { QUICK_REACTIONS } from "./chatReactions";
import { getViewportAwarePopupPosition, type PopupPosition } from "./emojiPickerPosition";

type MessageBubbleProps = {
  message: ChatMessage;
  quotedMessage?: ChatMessage | null;
  onReact?: (message: ChatMessage, emoji: string) => Promise<void> | void;
  onOpenMenu?: (message: ChatMessage, position: { x: number; y: number }) => void;
  onOpenMedia?: (message: ChatMessage) => void;
};

const QUICK_REACTION_POPUP_WIDTH = 292;
const QUICK_REACTION_POPUP_HEIGHT = 44;

function getPopupPosition(anchor: DOMRect, width: number, height: number): PopupPosition {
  return getViewportAwarePopupPosition({
    anchorRect: anchor,
    popupWidth: width,
    popupHeight: height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  });
}

function QuickReactionPopup({
  position,
  hasReaction,
  onSelect,
  onMore,
  onRemove,
  onClose,
}: {
  position: PopupPosition;
  hasReaction: boolean;
  onSelect: (emoji: string) => void;
  onMore: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[90] flex items-center gap-0.5 rounded-full border border-slate-200 bg-white px-1 py-0.5 text-sm shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900"
      style={{ left: position.left, top: position.top, width: QUICK_REACTION_POPUP_WIDTH }}
      onClick={(event) => event.stopPropagation()}
    >
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSelect(emoji)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-base transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-slate-800"
          aria-label={`Reagir com ${emoji}`}
        >
          {emoji}
        </button>
      ))}
      <button
        type="button"
        onClick={onMore}
        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label="Mais emojis"
      >
        <Plus size={14} aria-hidden="true" />
      </button>
      {hasReaction ? (
        <button
          type="button"
          onClick={onRemove}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Remover reacao"
        >
          <X size={14} aria-hidden="true" />
        </button>
      ) : null}
    </div>,
    document.body,
  );
}

function MessageStatus({ status }: { status: ChatMessageStatus }) {
  if (status === "FAILED") return <AlertTriangle size={13} className="text-red-500" aria-label="Falhou" />;
  if (status === "SENT" || status === "PENDING") return <Check size={14} aria-label={getMessageStatusLabel(status)} />;
  return <CheckCheck size={14} className={status === "READ" ? "text-sky-500" : undefined} aria-label={getMessageStatusLabel(status)} />;
}

const MESSAGE_TIME_FORMATTER = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return MESSAGE_TIME_FORMATTER.format(date);
}

function MessageMeta({ message, inline = false }: { message: ChatMessage; inline?: boolean }) {
  const fromMe = message.fromMe;
  return (
    <span className={`${inline ? "ml-2 inline-flex align-baseline" : "mt-1 flex justify-end"} items-center gap-1 text-[11px] ${fromMe ? "text-white/78 dark:text-slate-950/70" : "text-slate-500 dark:text-slate-400"}`}>
      <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
      {message.editedAt ? <Pencil size={11} aria-label="Editado" /> : null}
      {fromMe ? <MessageStatus status={message.status} /> : null}
    </span>
  );
}

export function MessageBubble({ message, quotedMessage, onReact, onOpenMenu, onOpenMedia }: MessageBubbleProps) {
  const [showQuickReactions, setShowQuickReactions] = useState(false);
  const [showFullPicker, setShowFullPicker] = useState(false);
  const [quickPosition, setQuickPosition] = useState<PopupPosition | null>(null);
  const [pickerPosition, setPickerPosition] = useState<PopupPosition | null>(null);
  const fromMe = message.fromMe;
  const showAudio = message.messageType === "AUDIO" && Boolean(message.mediaUrl);
  const showImage = message.messageType === "IMAGE" && Boolean(message.mediaUrl);
  const showVideo = message.messageType === "VIDEO" && Boolean(message.mediaUrl);
  const missingVisualMedia = (message.messageType === "IMAGE" || message.messageType === "VIDEO") && !message.mediaUrl;
  const showMedia = showAudio || showImage || showVideo;
  const hasVisualMedia = showImage || showVideo;
  const showInlineMeta = !showMedia;
  const isViewOnce = Boolean(showMedia && message.body?.startsWith("Visualizacao unica"));
  const displayBody = isViewOnce ? message.body?.replace(/^Visualizacao unica\n?/, "").trim() : message.body;
  const canReact = Boolean(onReact && message.providerMessageId && !message.isDeleted);
  const bubblePadding = hasVisualMedia ? "p-0 overflow-hidden" : "px-2.5 py-1.5";
  const handleSelectEmoji = useCallback((emoji: string) => {
    setShowQuickReactions(false);
    setShowFullPicker(false);
    setQuickPosition(null);
    setPickerPosition(null);
    void onReact?.(message, emoji);
  }, [message, onReact]);

  const handleOpenQuickReactions = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setQuickPosition(getPopupPosition(rect, QUICK_REACTION_POPUP_WIDTH, QUICK_REACTION_POPUP_HEIGHT));
    setPickerPosition(getPopupPosition(rect, EMOJI_PICKER_WIDTH, EMOJI_PICKER_HEIGHT));
    setShowFullPicker(false);
    setShowQuickReactions((current) => !current);
  }, []);

  const closeReactions = useCallback(() => {
    setShowQuickReactions(false);
    setShowFullPicker(false);
    setQuickPosition(null);
    setPickerPosition(null);
  }, []);

  return (
    <div className={`flex ${fromMe ? "justify-end" : "justify-start"}`}>
      <div className={`group/message-row flex max-w-[min(92%,44rem)] items-center gap-1 ${fromMe ? "flex-row-reverse" : "flex-row"}`}>
        <div
          className={`group relative w-fit max-w-full rounded-lg shadow-[0_1px_0_rgba(15,23,42,0.08)] ${bubblePadding} ${fromMe ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950" : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"}`}
          onContextMenu={(event) => {
            if (!onOpenMenu) return;
            event.preventDefault();
            onOpenMenu(message, { x: event.clientX, y: event.clientY });
          }}
        >
        {onOpenMenu && !message.isDeleted ? (
          <MessageMenuButton onClick={(event) => {
            event.stopPropagation();
            const rect = event.currentTarget.getBoundingClientRect();
            onOpenMenu(message, { x: rect.left, y: rect.bottom + 4 });
          }} />
        ) : null}
        {isViewOnce ? (
          <div className={`mb-1 flex items-center gap-1 text-xs ${fromMe ? "text-white/80 dark:text-slate-950/70" : "text-slate-500 dark:text-slate-400"}`}>
            <Eye size={13} aria-hidden="true" />
            <span>Visualizacao unica</span>
          </div>
        ) : null}
        {message.isDeleted ? (
          <p className="pr-5 text-sm italic opacity-65">Mensagem apagada{showInlineMeta ? <MessageMeta message={message} inline /> : null}</p>
        ) : null}
        {!message.isDeleted && quotedMessage ? (
          <div className={`mb-1 max-w-72 rounded-md border-l-4 px-2 py-1 ${fromMe ? "border-white/70 bg-white/15 dark:border-slate-950/40 dark:bg-slate-950/10" : "border-emerald-500 bg-white/70 dark:bg-slate-900/70"}`}>
            <p className="text-xs font-semibold">{quotedMessage.fromMe ? "Voce" : "Contato"}</p>
            <p className="truncate text-xs opacity-80">{getMessagePreviewText(quotedMessage)}</p>
          </div>
        ) : null}
        {!message.isDeleted && showAudio ? <AudioPlayer src={message.mediaUrl!} durationMs={message.mediaDurationMs} fromMe={fromMe} /> : null}
        {!message.isDeleted && showImage ? (
          <button type="button" onClick={() => onOpenMedia?.(message)} className="block cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" aria-label="Abrir imagem">
            <img src={message.mediaUrl!} alt="" loading="lazy" className="max-h-[24rem] max-w-full rounded-lg object-contain" />
          </button>
        ) : null}
        {!message.isDeleted && showVideo ? (
          <button type="button" onClick={() => onOpenMedia?.(message)} className="block cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" aria-label="Abrir video">
            <video src={message.mediaUrl!} className="max-h-[24rem] max-w-full rounded-lg" />
          </button>
        ) : null}
        {!message.isDeleted && displayBody ? (
          <p className="whitespace-pre-wrap break-words text-sm leading-5">
            {displayBody}
            {showInlineMeta ? <MessageMeta message={message} inline /> : null}
          </p>
        ) : null}
        {!message.isDeleted && missingVisualMedia && !displayBody ? (
          <p className="text-sm italic opacity-75">{message.messageType === "IMAGE" ? "[Imagem]" : "[Video]"}</p>
        ) : null}
        {!message.isDeleted && !showMedia && !missingVisualMedia && !displayBody ? (
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
      {canReact ? (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={handleOpenQuickReactions}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 ${showQuickReactions || showFullPicker ? "opacity-100" : "opacity-0 group-hover/message-row:opacity-100"}`}
          aria-label="Abrir reacoes"
        >
          <SmilePlus size={16} aria-hidden="true" />
        </button>
      ) : null}
      {showQuickReactions && quickPosition ? (
        <QuickReactionPopup
          position={quickPosition}
          hasReaction={Boolean(message.reactionEmoji)}
          onSelect={handleSelectEmoji}
          onMore={() => {
            setShowQuickReactions(false);
            setShowFullPicker(true);
          }}
          onRemove={() => handleSelectEmoji("")}
          onClose={closeReactions}
        />
      ) : null}
      {showFullPicker && pickerPosition ? <EmojiMartPopup position={pickerPosition} onSelect={handleSelectEmoji} onClose={closeReactions} /> : null}
      </div>
    </div>
  );
}
