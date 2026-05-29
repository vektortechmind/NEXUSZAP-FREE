import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/axios";
import { Activity, AlertTriangle, Bot, Calendar, Clock3, Copy, FileText, Inbox, MessageSquare, RefreshCw, Send, ShieldOff, Webhook } from "lucide-react";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Metric } from "../components/ui/Metric";
import { Panel } from "../components/ui/Panel";
import { Section } from "../components/ui/Section";
import { Skeleton } from "../components/ui/Skeleton";
import { StatusDot } from "../components/ui/StatusDot";
import { Toolbar } from "../components/ui/Toolbar";
import { useToast } from "../contexts/ToastContext";
import {
  type IntegrationDashboardItem,
  type IntegrationDashboardResponse,
  formatIntegrationCredentialStatus,
  formatIntegrationOperationalStatus,
  formatWindowMinutes,
  integrationOperationalTone,
  summarizeIntegrationCards,
} from "../features/dashboard/integrationDashboard";

type MessageStats = {
  date: string;
  channel: "WHATSAPP" | "TELEGRAM";
  inboundCount: number;
  outboundCount: number;
  withAiCount: number;
  withoutAiCount: number;
  totalCount: number;
};

type DashboardSummary = {
  totalMessages: number;
  totalInbound: number;
  totalOutbound: number;
  totalWithAi: number;
  totalWithoutAi: number;
  whatsappMessages: number;
  telegramMessages: number;
  totalKnowledgeFiles: number;
};

type FilterStats = {
  messages: MessageStats[];
  summary: DashboardSummary;
};

type ChannelFilter = "all" | MessageStats["channel"];

const EMPTY_STATS: FilterStats = {
  messages: [],
  summary: {
    totalMessages: 0,
    totalInbound: 0,
    totalOutbound: 0,
    totalWithAi: 0,
    totalWithoutAi: 0,
    whatsappMessages: 0,
    telegramMessages: 0,
    totalKnowledgeFiles: 0,
  },
};

const EMPTY_INTEGRATIONS: IntegrationDashboardResponse = {
  summary: {
    trackedInstances: 0,
    activeConnections: 0,
    activeWithRecentActivity: 0,
    activeWithoutRecentActivity: 0,
    recentFailures: 0,
    inactiveConnections: 0,
    missingCredential: 0,
  },
  documentation: {
    path: "docs/integrations/nexuszap-plugin-api.md",
    endpointPath: "/api/integrations/events",
    endpointUrl: null,
    supportedEvents: [],
    supportedMessageTypes: ["text", "link", "document"],
  },
  integrations: [],
};

function isoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7);
  return { start: isoDate(start), end: isoDate(end) };
}

function channelLabel(channel: MessageStats["channel"]): string {
  return channel === "WHATSAPP" ? "WhatsApp" : "Telegram";
}

function formatDisplayDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date);
}

function formatDateTime(value: string | null): string {
  if (!value) return "Sem registro";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatInstanceLabel(item: IntegrationDashboardItem): string {
  return item.instanceSlot ? `${item.instanceName} · slot ${item.instanceSlot}` : item.instanceName;
}

function formatRecentDispatch(item: IntegrationDashboardItem): string {
  if (!item.lastDispatch) return "Nenhum disparo recente";
  const last = item.lastDispatch;
  return `${last.eventSlug ?? "evento"} · ${last.dispatchStatus}${last.providerMessageId ? ` · ${last.providerMessageId}` : ""}`;
}

function formatRecentIngress(item: IntegrationDashboardItem): string {
  if (!item.lastIngress) return "Nenhum ingresso recente";
  const last = item.lastIngress;
  return `${last.eventSlug ?? "evento"} · ${last.status}${last.failureCode ? ` · ${last.failureCode}` : ""}`;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-16" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32" />)}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.8fr)]">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

export function Dashboard() {
  const [initialRange] = useState(defaultDateRange);
  const [stats, setStats] = useState<FilterStats | null>(null);
  const [integrationOverview, setIntegrationOverview] = useState<IntegrationDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startDate, setStartDate] = useState<string>(initialRange.start);
  const [endDate, setEndDate] = useState<string>(initialRange.end);
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const { addToast } = useToast();

  const fetchDashboard = useCallback(async (range: { start: string; end: string }) => {
    try {
      const [statsResponse, integrationsResponse] = await Promise.all([
        api.get<FilterStats>("/dashboard/stats", {
          params: { startDate: range.start, endDate: range.end },
        }),
        api.get<IntegrationDashboardResponse>("/dashboard/integrations"),
      ]);
      setStats(statsResponse.data);
      setIntegrationOverview(integrationsResponse.data);
      return true;
    } catch {
      addToast("Erro ao carregar dados do dashboard", "error");
      return false;
    }
  }, [addToast]);

  useEffect(() => {
    let active = true;
    const loadInitialStats = async () => {
      const loaded = await fetchDashboard(initialRange);
      if (!active) return;
      if (!loaded) {
        setStats(EMPTY_STATS);
        setIntegrationOverview(EMPTY_INTEGRATIONS);
      }
      setLoading(false);
    };
    void loadInitialStats();
    return () => {
      active = false;
    };
  }, [fetchDashboard, initialRange]);

  const loadStats = useCallback(async () => {
    setRefreshing(true);
    try {
      const loaded = await fetchDashboard({ start: startDate, end: endDate });
      if (loaded) addToast("Filtros aplicados", "success");
    } finally {
      setRefreshing(false);
    }
  }, [addToast, endDate, fetchDashboard, startDate]);

  const filteredMessages = useMemo(() => {
    const messages = stats?.messages ?? [];
    return channel === "all" ? messages : messages.filter((message) => message.channel === channel);
  }, [channel, stats?.messages]);

  const summary = useMemo(() => {
    if (!stats) {
      return {
        totalMessages: 0,
        totalInbound: 0,
        totalOutbound: 0,
        totalWithAi: 0,
        totalWithoutAi: 0,
        whatsappMessages: 0,
        telegramMessages: 0,
        totalKnowledgeFiles: 0,
      } satisfies DashboardSummary;
    }

    if (channel === "all") return stats.summary;

    return filteredMessages.reduce<DashboardSummary>((acc, message) => {
      acc.totalMessages += message.totalCount;
      acc.totalInbound += message.inboundCount;
      acc.totalOutbound += message.outboundCount;
      acc.totalWithAi += message.withAiCount;
      acc.totalWithoutAi += message.withoutAiCount;
      if (message.channel === "WHATSAPP") acc.whatsappMessages += message.totalCount;
      if (message.channel === "TELEGRAM") acc.telegramMessages += message.totalCount;
      acc.totalKnowledgeFiles = stats.summary.totalKnowledgeFiles;
      return acc;
    }, {
      totalMessages: 0,
      totalInbound: 0,
      totalOutbound: 0,
      totalWithAi: 0,
      totalWithoutAi: 0,
      whatsappMessages: 0,
      telegramMessages: 0,
      totalKnowledgeFiles: stats.summary.totalKnowledgeFiles,
    });
  }, [channel, filteredMessages, stats]);

  const hasMessages = filteredMessages.length > 0 && summary.totalMessages > 0;
  const operationalStatus = [
    {
      label: "API de métricas",
      detail: stats ? "Respondendo" : "Aguardando dados",
      tone: stats ? "success" : "warning",
      pulse: Boolean(stats),
    },
    {
      label: "WhatsApp",
      detail: summary.whatsappMessages > 0 ? `${summary.whatsappMessages} eventos no período` : "Sem atividade no período",
      tone: summary.whatsappMessages > 0 ? "success" : "neutral",
      pulse: summary.whatsappMessages > 0,
    },
    {
      label: "Telegram",
      detail: summary.telegramMessages > 0 ? `${summary.telegramMessages} eventos no período` : "Sem atividade no período",
      tone: summary.telegramMessages > 0 ? "info" : "neutral",
      pulse: summary.telegramMessages > 0,
    },
    {
      label: "IA",
      detail: summary.totalWithAi > 0 ? `${summary.totalWithAi} eventos com IA` : "Sem uso de IA no período",
      tone: summary.totalWithAi > 0 ? "success" : "warning",
      pulse: summary.totalWithAi > 0,
    },
  ] as const;

  const timeline = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const message of filteredMessages) {
      byDate.set(message.date, (byDate.get(message.date) ?? 0) + message.totalCount);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  }, [filteredMessages]);

  const maxTimelineCount = Math.max(...timeline.map((item) => item.count), 1);
  const topActivity = useMemo(() => {
    return [...filteredMessages]
      .sort((a, b) => b.totalCount - a.totalCount)
      .slice(0, 6);
  }, [filteredMessages]);

  const integrations = useMemo(() => integrationOverview?.integrations ?? [], [integrationOverview]);
  const integrationSummary = useMemo(() => summarizeIntegrationCards(integrations), [integrations]);
  const documentation = integrationOverview?.documentation ?? EMPTY_INTEGRATIONS.documentation;

  const copyText = useCallback(async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      addToast(successMessage, "success");
    } catch {
      addToast("Não foi possível copiar o conteúdo", "error");
    }
  }, [addToast]);

  const handleFilter = () => {
    void loadStats();
  };

  if (loading && !stats) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <Toolbar aria-label="Filtros do dashboard">
        <div className="grid w-full gap-3 md:grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(11rem,1fr)_auto] md:items-end">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            <span className="mb-1.5 block">Data inicial</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            <span className="mb-1.5 block">Data final</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            <span className="mb-1.5 block">Canal</span>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as ChannelFilter)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="all">Todos os canais</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="TELEGRAM">Telegram</option>
            </select>
          </label>
          <Button onClick={handleFilter} disabled={refreshing} loading={refreshing} className="w-full md:w-auto">
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Atualizar
          </Button>
        </div>
      </Toolbar>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {operationalStatus.map((item) => (
          <Panel key={item.label} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{item.label}</p>
              <p className="mt-1 truncate text-xs text-slate-600 dark:text-slate-400">{item.detail}</p>
            </div>
            <StatusDot tone={item.tone} pulse={item.pulse} />
          </Panel>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Metric
          label={channel === "all" ? "Mensagens no período" : `Mensagens ${channelLabel(channel)}`}
          value={summary.totalMessages}
          description="Eventos registrados"
          icon={<MessageSquare size={20} aria-hidden="true" />}
          tone="success"
        />
        <Metric
          label="WhatsApp"
          value={summary.whatsappMessages}
          description="Eventos registrados"
          icon={<Inbox size={20} aria-hidden="true" />}
          tone="success"
        />
        <Metric
          label="Telegram"
          value={summary.telegramMessages}
          description="Eventos registrados"
          icon={<Send size={20} aria-hidden="true" />}
          tone="info"
        />
        <Metric
          label="Com IA"
          value={summary.totalWithAi}
          description="Eventos automatizados"
          icon={<Bot size={20} aria-hidden="true" />}
          tone="success"
        />
        <Metric
          label="Sem IA"
          value={summary.totalWithoutAi}
          description="Eventos não automatizados"
          icon={<ShieldOff size={20} aria-hidden="true" />}
          tone="warning"
        />
        <Metric
          label="Arquivos"
          value={summary.totalKnowledgeFiles}
          description="Base de conhecimento"
          icon={<FileText size={20} aria-hidden="true" />}
          tone="warning"
        />
      </div>

      <Section title="Integrações operacionais" description="Estado básico das integrações por instância com base em credenciais, ingressos e dispatches persistidos.">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Metric
              label="Conexões ativas"
              value={integrationSummary.activeConnections}
              description="Credenciais ativas"
              icon={<Webhook size={20} aria-hidden="true" />}
              tone="success"
            />
            <Metric
              label="Atividade recente"
              value={integrationSummary.recentActivity}
              description="Integrações com uso recente"
              icon={<Activity size={20} aria-hidden="true" />}
              tone="success"
            />
            <Metric
              label="Sem atividade"
              value={integrationSummary.idle}
              description="Ativas sem uso recente"
              icon={<Clock3 size={20} aria-hidden="true" />}
              tone="info"
            />
            <Metric
              label="Falhas recentes"
              value={integrationSummary.failures}
              description="Ingressos ou dispatches com erro"
              icon={<AlertTriangle size={20} aria-hidden="true" />}
              tone="danger"
            />
            <Metric
              label="Sem credencial"
              value={integrationSummary.missingCredential}
              description="Instâncias sem integração ativa"
              icon={<ShieldOff size={20} aria-hidden="true" />}
              tone="warning"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.8fr)]">
            <Panel className="p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">Instâncias monitoradas</p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Conexões ativas, últimos ingressos e últimos dispatches persistidos.</p>
                </div>
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                  {integrationOverview?.summary.trackedInstances ?? 0} instâncias
                </div>
              </div>

              {integrations.length > 0 ? (
                <div className="space-y-3">
                  {integrations.map((item) => (
                    <div key={item.instanceId} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/45">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{formatInstanceLabel(item)}</p>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{item.instanceStatus} · credencial {formatIntegrationCredentialStatus(item.credentialStatus)}</p>
                        </div>
                        <StatusDot tone={integrationOperationalTone(item.operationalStatus)} pulse={item.operationalStatus === "ACTIVE_RECENT_ACTIVITY"} label={formatIntegrationOperationalStatus(item.operationalStatus)} />
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Credencial</p>
                          <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">{item.tokenPreview ?? "Sem preview"}</p>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Replay {formatWindowMinutes(item.replayWindowMs)} · Dedup {formatWindowMinutes(item.dedupWindowMs)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Último ingresso</p>
                          <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">{formatRecentIngress(item)}</p>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{formatDateTime(item.lastIngress?.receivedAt ?? null)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Último disparo</p>
                          <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">{formatRecentDispatch(item)}</p>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{formatDateTime(item.lastDispatch?.createdAt ?? null)}</p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ingressos recentes</p>
                          <div className="mt-2 space-y-2">
                            {item.recentIngresses.length > 0 ? item.recentIngresses.map((log) => (
                              <div key={log.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:bg-slate-950/45 dark:text-slate-300">
                                <p className="font-semibold text-slate-900 dark:text-slate-100">{log.eventSlug ?? "evento"} · {log.status}</p>
                                <p className="mt-1">{log.failureCode ?? "Sem falha registrada"}</p>
                              </div>
                            )) : <p className="text-xs text-slate-500 dark:text-slate-400">Nenhum ingresso recente.</p>}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Dispatches recentes</p>
                          <div className="mt-2 space-y-2">
                            {item.recentDispatches.length > 0 ? item.recentDispatches.map((log) => (
                              <div key={log.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:bg-slate-950/45 dark:text-slate-300">
                                <p className="font-semibold text-slate-900 dark:text-slate-100">{log.eventSlug ?? "evento"} · {log.dispatchStatus}</p>
                                <p className="mt-1">{log.providerMessageId ?? log.failureCode ?? "Sem providerMessageId"}</p>
                              </div>
                            )) : <p className="text-xs text-slate-500 dark:text-slate-400">Nenhum dispatch recente.</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Webhook size={22} aria-hidden="true" />}
                  title="Sem integrações operacionais"
                  description="As credenciais e os registros persistidos aparecerão aqui quando houver integração ativa ou atividade recente."
                />
              )}
            </Panel>

            <Panel className="space-y-4 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">Contrato técnico</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Resumo operacional para configurar plugins externos sem depender de `baseUrl` separado.</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/45">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">endpointUrl</p>
                <p className="mt-1 break-all text-sm font-semibold text-slate-950 dark:text-slate-50">{documentation.endpointUrl ?? documentation.endpointPath}</p>
                {documentation.endpointUrl ? (
                  <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={() => void copyText(documentation.endpointUrl!, "endpointUrl copiado")}> 
                    <Copy className="mr-2 h-4 w-4" aria-hidden="true" />Copiar endpointUrl
                  </Button>
                ) : null}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/45">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Documentação local</p>
                <p className="mt-1 break-all text-sm font-semibold text-slate-950 dark:text-slate-50">{documentation.path}</p>
                <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={() => void copyText(documentation.path, "Caminho da documentação copiado")}>
                  <FileText className="mr-2 h-4 w-4" aria-hidden="true" />Copiar caminho do arquivo
                </Button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/45">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Eventos suportados</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {documentation.supportedEvents.map((eventSlug) => (
                    <span key={eventSlug} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{eventSlug}</span>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/45">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Templates desta fase</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {documentation.supportedMessageTypes.map((messageType) => (
                    <span key={messageType} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 dark:border-slate-700 dark:bg-slate-900">{messageType}</span>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">A trilha atual suporta mensagens `text`, `link` e `document`, com dispatch real via `/api/integrations/events`.</p>
              </div>
            </Panel>
          </div>
        </div>
      </Section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.85fr)]">
        <Section title="Tendência de mensagens" description="Volume agregado por dia dentro do período selecionado.">
          <Panel className="p-5">
            {hasMessages ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                  <StatusDot tone="success" label="WhatsApp" />
                  <StatusDot tone="info" label="Telegram" />
                  <span className="ml-auto inline-flex items-center gap-2">
                    <Calendar size={16} aria-hidden="true" />
                    {startDate} a {endDate}
                  </span>
                </div>
                <div className="flex h-64 items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/45">
                  {timeline.map((item) => {
                    const height = Math.max((item.count / maxTimelineCount) * 100, 6);
                    return (
                      <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                        <div className="flex h-52 w-full items-end">
                          <div
                            className="w-full rounded-t-md bg-emerald-500/85 dark:bg-emerald-400/80"
                            style={{ height: `${height}%` }}
                            title={`${formatDisplayDate(item.date)}: ${item.count} eventos`}
                            aria-label={`${formatDisplayDate(item.date)}: ${item.count} eventos`}
                          />
                        </div>
                        <span className="max-w-full truncate text-[11px] text-slate-500 dark:text-slate-500">{formatDisplayDate(item.date)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<Activity size={22} aria-hidden="true" />}
                title="Sem mensagens no período"
                description="Ajuste os filtros ou conecte um canal para começar a visualizar atividade."
              />
            )}
          </Panel>
        </Section>

        <Section title="Atividade em destaque" description="Dias e canais com maior volume no filtro atual.">
          <Panel className="p-4">
            {topActivity.length > 0 ? (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {topActivity.map((item, index) => (
                  <div key={`${item.date}-${item.channel}-${index}`} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{formatDisplayDate(item.date)}</p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        {channelLabel(item.channel)} · {item.inboundCount} entrada · {item.outboundCount} saída
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold tabular-nums text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                      {item.totalCount}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nenhuma atividade"
                description="Ainda não existem registros para os filtros selecionados."
                className="border-0 bg-transparent py-8"
              />
            )}
          </Panel>
        </Section>
      </div>
    </div>
  );
}
