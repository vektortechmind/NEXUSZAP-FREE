import { Edit3, MessageSquareReply, MoreVertical, Trash2, XCircle } from "lucide-react";
import type { MouseEvent } from "react";
import { useEffect } from "react";
import type { ChatMessage } from "./types";
import { getMessageContextActions, type MessageContextMenuAction } from "./messageContextActions";

type MessageContextMenuProps = {
  message: ChatMessage;
  position: { x: number; y: number } | null;
  onAction: (action: MessageContextMenuAction, message: ChatMessage) => void;
  onClose: () => void;
};

const labels: Record<MessageContextMenuAction, string> = {
  reply: "Responder",
  edit: "Editar",
  delete_for_me: "Apagar para mim",
  delete_for_everyone: "Apagar para todos",
  delete_forever: "Apagar para sempre",
};

function actionIcon(action: MessageContextMenuAction) {
  if (action === "reply") return <MessageSquareReply size={15} aria-hidden="true" />;
  if (action === "edit") return <Edit3 size={15} aria-hidden="true" />;
  if (action === "delete_forever") return <XCircle size={15} aria-hidden="true" />;
  return <Trash2 size={15} aria-hidden="true" />;
}

export function MessageContextMenu({ message, position, onAction, onClose }: MessageContextMenuProps) {
  const actions = getMessageContextActions(message);

  useEffect(() => {
    const close = () => onClose();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  if (!position || actions.length === 0) return null;

  return (
    <div
      role="menu"
      className="fixed z-50 min-w-44 rounded-md border border-slate-200 bg-white py-1 text-sm shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900"
      style={{ left: position.x, top: position.y }}
      onClick={(event) => event.stopPropagation()}
    >
      {actions.map((action) => (
        <button
          key={action}
          type="button"
          role="menuitem"
          onClick={() => onAction(action, message)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {actionIcon(action)}
          <span>{labels[action]}</span>
        </button>
      ))}
    </div>
  );
}

export function MessageMenuButton({ onClick }: { onClick: (event: MouseEvent<HTMLButtonElement>) => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-1 top-1 hidden h-7 w-7 items-center justify-center rounded-full bg-white/85 text-slate-600 shadow-sm transition hover:bg-white focus-visible:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 group-hover:flex dark:bg-slate-900/85 dark:text-slate-200"
      aria-label="Abrir menu da mensagem"
    >
      <MoreVertical size={15} aria-hidden="true" />
    </button>
  );
}
