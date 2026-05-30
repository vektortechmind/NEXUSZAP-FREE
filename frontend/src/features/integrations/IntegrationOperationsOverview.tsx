import { Activity, AlertTriangle, Clock3, RefreshCw, Rows3, Webhook } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Metric } from "../../components/ui/Metric";
import { Panel } from "../../components/ui/Panel";
import { type IntegrationDashboardResponse, summarizeIntegrationCards } from "../dashboard/integrationDashboard";
import {
  formatAuditEntryType,
  formatAuditMeta,
  getVisibleAuditLogs,
  INTEGRATION_AUDIT_SCROLL_CONTAINER_CLASSNAME,
  INTEGRATION_AUDIT_VISIBLE_LIMIT,
} from "./integrationAuditOverview";

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

type IntegrationOperationsOverviewProps = {
  overview: IntegrationDashboardResponse;
  refreshing: boolean;
  onRefresh: () => void;
};

export function IntegrationOperationsOverview({ overview, refreshing, onRefresh }: IntegrationOperationsOverviewProps) {
  const integrationSummary = summarizeIntegrationCards(overview.summary);
  const auditLogs = getVisibleAuditLogs(overview.auditLogs);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button onClick={onRefresh} disabled={refreshing} loading={refreshing} className="w-full sm:w-auto">
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Atualizar operação
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Conexões ativas" value={integrationSummary.activeConnections} description="Credenciais ativas" icon={<Webhook size={20} aria-hidden="true" />} tone="success" />
        <Metric label="Atividade recente" value={integrationSummary.recentActivity} description="Integrações com uso recente" icon={<Activity size={20} aria-hidden="true" />} tone="success" />
        <Metric label="Sem atividade" value={integrationSummary.idle} description="Ativas sem uso recente" icon={<Clock3 size={20} aria-hidden="true" />} tone="info" />
        <Metric label="Falhas recentes" value={integrationSummary.failures} description="Ingressos ou dispatches com erro" icon={<AlertTriangle size={20} aria-hidden="true" />} tone="danger" />
      </div>

      <Panel className="p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">Auditoria global</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Ultimos {INTEGRATION_AUDIT_VISIBLE_LIMIT} registros em lista compacta, do mais novo para o mais antigo.</p>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">{auditLogs.length} visiveis</div>
        </div>

        {auditLogs.length > 0 ? (
          <div className={INTEGRATION_AUDIT_SCROLL_CONTAINER_CLASSNAME}>
            <div className="space-y-2">
              {auditLogs.map((entry) => (
                <article key={`${entry.entryType}-${entry.identifier}`} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/45">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{formatAuditEntryType(entry.entryType)}</span>
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{entry.status}</span>
                        <span className="truncate text-xs text-slate-500 dark:text-slate-400">{entry.instanceName}</span>
                      </div>
                      <p className="mt-2 truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{entry.eventSlug ?? "evento"}</p>
                      <div className="mt-1 flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-400 sm:flex-row sm:items-center sm:gap-3">
                        <code className="truncate rounded bg-white px-2 py-1 font-mono text-[11px] text-slate-700 dark:bg-slate-900 dark:text-slate-200">{entry.identifier}</code>
                        <span className="truncate">{formatAuditMeta(entry)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 lg:flex-col lg:items-end lg:text-right">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{formatDateTime(entry.timestamp)}</p>
                    </div>
                  </div>

                  <details className="mt-2 rounded-lg border border-slate-200 bg-white/80 p-2 dark:border-slate-800 dark:bg-slate-900/70">
                    <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Detalhes</summary>
                    <div className="mt-2 grid gap-2 text-xs text-slate-600 dark:text-slate-400 md:grid-cols-3">
                      <div>
                        <p className="font-semibold text-slate-950 dark:text-slate-50">Timestamp</p>
                        <p>{formatDateTime(entry.timestamp)}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-950 dark:text-slate-50">Identificador</p>
                        <code className="break-all font-mono text-[11px] text-slate-700 dark:text-slate-200">{entry.identifier}</code>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-950 dark:text-slate-50">Meta</p>
                        <p className="break-all">{formatAuditMeta(entry)}</p>
                      </div>
                    </div>
                  </details>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState icon={<Rows3 size={22} aria-hidden="true" />} title="Sem registros na auditoria global" description="Ingressos e dispatches recentes aparecerão aqui assim que a integração registrar atividade persistida." />
        )}
      </Panel>
    </div>
  );
}
