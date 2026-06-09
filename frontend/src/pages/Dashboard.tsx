import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/axios";
import { Activity, Bot, Calendar, FileText, Inbox, MessageSquare, RefreshCw, Send, ShieldOff } from "lucide-react";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Metric } from "../components/ui/Metric";
import { Panel } from "../components/ui/Panel";
import { Section } from "../components/ui/Section";
import { Skeleton } from "../components/ui/Skeleton";
import { StatusDot } from "../components/ui/StatusDot";
import { Toolbar } from "../components/ui/Toolbar";
import { useToast } from "../contexts/ToastContext";
import { BrandLogo } from "../components/BrandLogo";

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

const DASHBOARD_DISPLAY_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

function formatDisplayDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return DASHBOARD_DISPLAY_DATE_FORMATTER.format(date);
}

function sortMessagesByTotalDesc(messages: MessageStats[]): MessageStats[] {
  return Array.from(messages).sort((a, b) => b.totalCount - a.totalCount);
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startDate, setStartDate] = useState<string>(initialRange.start);
  const [endDate, setEndDate] = useState<string>(initialRange.end);
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const { addToast } = useToast();

  const fetchDashboard = useCallback(async (range: { start: string; end: string }) => {
    try {
      const statsResponse = await api.get<FilterStats>("/dashboard/stats", {
        params: { startDate: range.start, endDate: range.end },
      });
      setStats(statsResponse.data);
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
    return sortMessagesByTotalDesc(filteredMessages).slice(0, 6);
  }, [filteredMessages]);

  const handleFilter = () => {
    void loadStats();
  };

  if (loading && !stats) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <Panel className="overflow-hidden border-emerald-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_38%),linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(240,253,244,0.88))] p-5 shadow-[0_24px_70px_-50px_rgba(16,185,129,0.55)] dark:border-emerald-900/70 dark:bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_30%),linear-gradient(135deg,_rgba(2,6,23,0.96),_rgba(3,15,10,0.94))] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">Painel operacional</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50 sm:text-3xl">Visão consolidada de canais, IA e base ativa</h2>
            <p className="mt-3 text-sm leading-7 text-slate-700 dark:text-slate-300">Acompanhe o volume do período, a atividade por canal e o uso operacional do runtime em um único painel.</p>
          </div>
          <div className="flex justify-center rounded-3xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/55">
            <BrandLogo className="mx-auto h-24 w-auto max-w-[280px] object-contain sm:h-28 sm:max-w-[320px]" />
          </div>
        </div>
      </Panel>
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
