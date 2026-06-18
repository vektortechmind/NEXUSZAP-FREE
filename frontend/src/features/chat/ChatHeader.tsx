import { AlertTriangle, ArrowLeft, Bot, MoreVertical, UserCheck, Wifi, WifiOff } from "lucide-react";
import { useState } from "react";
import type { ChatConnectionState, ChatConversation, ChatInstanceOption } from "./types";
import { getContactDisplayName } from "./useConversations";

type ChatHeaderProps = {
  conversation: ChatConversation | null;
  instances: ChatInstanceOption[];
  connectionState: ChatConnectionState;
  isTyping: boolean;
  onBack: () => void;
  onClear?: () => void;
  onToggleAiPaused?: () => void;
};

function Avatar({ conversation }: { conversation: ChatConversation }) {
  const name = getContactDisplayName(conversation);
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function connectionLabel(state: ChatConnectionState) {
  if (state === "connected") return "Conectado";
  if (state === "reconnecting" || state === "connecting") return "Reconectando";
  if (state === "error") return "Erro no realtime";
  return "Offline";
}

export function ChatHeader({ conversation, instances, connectionState, isTyping, onBack, onClear, onToggleAiPaused }: ChatHeaderProps) {
  const instanceName = conversation ? instances.find((instance) => instance.id === conversation.instanceId)?.name ?? conversation.instanceId : null;
  const connected = connectionState === "connected";
  const [menuOpen, setMenuOpen] = useState(false);
  const hasConversationActions = Boolean(conversation && (onClear || onToggleAiPaused));
  const handleClear = () => {
    setMenuOpen(false);
    const confirmed = window.confirm("Limpar conversa somente no painel? As mensagens continuam no WhatsApp.");
    if (confirmed) onClear?.();
  };
  const handleToggleAiPaused = () => {
    setMenuOpen(false);
    onToggleAiPaused?.();
  };

  return (
    <header className="flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-950">
      {conversation ? (
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900 md:hidden"
            aria-label="Voltar para conversas"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <Avatar conversation={conversation} />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{getContactDisplayName(conversation)}</h2>
            <p className="flex min-w-0 items-center gap-2 truncate text-xs text-slate-500 dark:text-slate-400">
              <span className="truncate">{isTyping ? "digitando..." : `${instanceName} - ${conversation.jid}`}</span>
              {conversation.aiPaused ? (
                <span className="inline-flex shrink-0 items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-300">
                  Atendimento humano
                </span>
              ) : null}
            </p>
          </div>
        </div>
      ) : (
        <div>
          <h2 className="text-sm font-semibold text-slate-950 dark:text-slate-50">Selecione uma conversa</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Mensagens e status aparecem em tempo real.</p>
        </div>
      )}
      <div className="relative flex items-center gap-2">
        <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${connected ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-300"}`}>
          {connected ? <Wifi size={13} aria-hidden="true" /> : <WifiOff size={13} aria-hidden="true" />}
          {connectionLabel(connectionState)}
        </div>
        {hasConversationActions ? (
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-slate-300 dark:hover:bg-slate-900"
            aria-label="Acoes da conversa"
          >
            <MoreVertical size={17} aria-hidden="true" />
          </button>
        ) : null}
        {menuOpen ? (
          <div className="absolute right-0 top-11 z-40 min-w-56 rounded-md border border-slate-200 bg-white py-1 text-sm shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900">
            {conversation && onToggleAiPaused ? (
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800" onClick={handleToggleAiPaused}>
                {conversation.aiPaused ? <Bot size={15} aria-hidden="true" /> : <UserCheck size={15} aria-hidden="true" />}
                {conversation.aiPaused ? "Voltar IA" : "Assumir conversa"}
              </button>
            ) : null}
            {onClear ? (
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-amber-800 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-950/30" onClick={handleClear}>
                <AlertTriangle size={15} aria-hidden="true" />
                Limpar conversa!
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
