import { Activity, AlertTriangle, Clock3, RefreshCw, Rows3, Webhook } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Metric } from "../../components/ui/Metric";
import { Panel } from "../../components/ui/Panel";
import { type IntegrationAuditEntry, type IntegrationDashboardResponse, summarizeIntegrationCards } from "../dashboard/integrationDashboard";

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

function formatEntryType(type: IntegrationAuditEntry["entryType"]): string {
  return type === "ingress" ? "Ingress" : "Dispatch";
}

function formatAuditMeta(entry: IntegrationAuditEntry): string {
  if (entry.providerMessageId) return entry.providerMessageId;
  if (entry.failureCode) return entry.failureCode;
  return entry.instanceName;
}

type IntegrationOperationsOverviewProps = {
  overview: IntegrationDashboardResponse;
  refreshing: boolean;
  onRefresh: () => void;
};

export function IntegrationOperationsOverview({ overview, refreshing, onRefresh }: IntegrationOperationsOverviewProps) {
  const integrationSummary = summarizeIntegrationCards(overview.summary);
  const auditLogs = overview.auditLogs;

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
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Linha única com ingressos e dispatches recentes, ordenada do registro mais novo para o mais antigo.</p>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">{auditLogs.length} registros</div>
        </div>

        {auditLogs.length > 0 ? (
          <div className="space-y-3">
            {auditLogs.map((entry) => (
              <div key={`${entry.entryType}-${entry.identifier}`} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/45">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{formatEntryType(entry.entryType)}</span>
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{entry.status}</span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-950 dark:text-slate-50">{entry.eventSlug ?? "evento"}</p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{entry.instanceName}</p>
                  </div>
                  <div className="flex flex-col items-start gap-2 text-left lg:items-end lg:text-right">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{formatDateTime(entry.timestamp)}</p>
                    <code className="rounded-lg bg-white px-2 py-1 font-mono text-[12px] text-slate-700 dark:bg-slate-900 dark:text-slate-200">{entry.identifier}</code>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Timestamp</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">{formatDateTime(entry.timestamp)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Identificador</p>
                    <p className="mt-1 truncate font-mono text-sm font-semibold text-slate-950 dark:text-slate-50">{entry.identifier}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Meta</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">{formatAuditMeta(entry)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Rows3 size={22} aria-hidden="true" />} title="Sem registros na auditoria global" description="Ingressos e dispatches recentes aparecerão aqui assim que a integração registrar atividade persistida." />
        )}
      </Panel>
    </div>
  );
}
