import { Search } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import type { ChatConversation, ChatInstanceOption } from "./types";
import { getContactDisplayName, getMessagePreview } from "./useConversations";
import { FilterDropdown } from "./FilterDropdown";

type ConversationListProps = {
  conversations: ChatConversation[];
  instances: ChatInstanceOption[];
  selectedConversationKey: string | null;
  selectedInstanceId: string;
  search: string;
  loading: boolean;
  error: string | null;
  onSelect: (conversation: ChatConversation) => void;
  onInstanceChange: (value: string) => void;
  onSearchChange: (value: string) => void;
};

const CONVERSATION_TIME_FORMATTER = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return CONVERSATION_TIME_FORMATTER.format(date);
}

function Avatar({ conversation }: { conversation: ChatConversation }) {
  const name = getContactDisplayName(conversation);
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function ConversationList({
  conversations,
  instances,
  selectedConversationKey,
  selectedInstanceId,
  search,
  loading,
  error,
  onSelect,
  onInstanceChange,
  onSearchChange,
}: ConversationListProps) {
  return (
    <aside className="flex min-h-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="space-y-3 border-b border-slate-200 p-3 dark:border-slate-800">
        <FilterDropdown instances={instances} value={selectedInstanceId} onChange={onInstanceChange} />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar nome ou mensagem"
          icon={<Search size={16} aria-hidden="true" />}
          aria-label="Buscar conversas"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-3 p-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 rounded-lg bg-slate-100 dark:bg-slate-900" />
            ))}
          </div>
        ) : error ? (
          <p className="p-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : conversations.length === 0 ? (
          <p className="p-4 text-sm text-slate-500 dark:text-slate-400">Nenhuma conversa encontrada.</p>
        ) : (
          conversations.map((conversation) => {
            const active = selectedConversationKey === `${conversation.instanceId}:${conversation.jid}`;
            const instanceName = instances.find((instance) => instance.id === conversation.instanceId)?.name ?? conversation.instanceId;
            return (
              <button
                key={`${conversation.instanceId}:${conversation.jid}`}
                type="button"
                onClick={() => onSelect(conversation)}
                className={`grid w-full grid-cols-[2.75rem_minmax(0,1fr)_auto] gap-3 border-b border-slate-100 px-3 py-3 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-900 dark:hover:bg-slate-900/70 ${active ? "bg-emerald-50/70 dark:bg-emerald-950/25" : ""}`}
              >
                <Avatar conversation={conversation} />
                <span className="min-w-0">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{getContactDisplayName(conversation)}</span>
                    {selectedInstanceId === "all" ? <Badge variant="info" className="shrink-0">{instanceName}</Badge> : null}
                  </span>
                  <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">{getMessagePreview(conversation.lastMessage)}</span>
                </span>
                <span className="flex flex-col items-end gap-2">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{formatTime(conversation.lastMessageAt)}</span>
                  {conversation.unreadCount > 0 ? (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 py-0.5 text-[11px] font-bold text-white dark:bg-emerald-500 dark:text-emerald-950">
                      {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
