import { Activity, AlertTriangle, Clock3, Webhook } from "lucide-react";
import { EmptyState } from "../../components/ui/EmptyState";
import { Metric } from "../../components/ui/Metric";
import { Panel } from "../../components/ui/Panel";
import { StatusDot } from "../../components/ui/StatusDot";
import {
  type IntegrationDashboardItem,
  type IntegrationDashboardResponse,
  formatIntegrationCredentialStatus,
  formatIntegrationOperationalStatus,
  formatWindowMinutes,
  integrationOperationalTone,
  summarizeIntegrationCards,
} from "../dashboard/integrationDashboard";

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

type IntegrationOperationsOverviewProps = {
  overview: IntegrationDashboardResponse;
};

export function IntegrationOperationsOverview({ overview }: IntegrationOperationsOverviewProps) {
  const integrations = overview.integrations;
  const integrationSummary = summarizeIntegrationCards(integrations);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Conexões ativas" value={integrationSummary.activeConnections} description="Credenciais ativas" icon={<Webhook size={20} aria-hidden="true" />} tone="success" />
        <Metric label="Atividade recente" value={integrationSummary.recentActivity} description="Integrações com uso recente" icon={<Activity size={20} aria-hidden="true" />} tone="success" />
        <Metric label="Sem atividade" value={integrationSummary.idle} description="Ativas sem uso recente" icon={<Clock3 size={20} aria-hidden="true" />} tone="info" />
        <Metric label="Falhas recentes" value={integrationSummary.failures} description="Ingressos ou dispatches com erro" icon={<AlertTriangle size={20} aria-hidden="true" />} tone="danger" />
      </div>

      <Panel className="p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">Instâncias monitoradas</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Conexões ativas, últimos ingressos e últimos dispatches persistidos.</p>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">{overview.summary.trackedInstances} instâncias</div>
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
          <EmptyState icon={<Webhook size={22} aria-hidden="true" />} title="Sem integrações operacionais" description="As credenciais e os registros persistidos aparecerão aqui quando houver integração ativa ou atividade recente." />
        )}
      </Panel>
    </div>
  );
}
