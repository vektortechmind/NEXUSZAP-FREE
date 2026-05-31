import { Activity, AlertTriangle, Clock3, RefreshCw, Rows3, Webhook } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Metric } from "../../components/ui/Metric";
import { Panel } from "../../components/ui/Panel";
import { type IntegrationDashboardResponse, summarizeIntegrationCards } from "../dashboard/integrationDashboard";
import {
  formatAuditEntryType,
  formatAuditMeta,
  formatAuditStatus,
  formatDispatchDeliveryPath,
  formatSecondaryDispatchStatus,
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

function DetailField({ label, value, mono = false }: { label: string; value: string | number | null | undefined; mono?: boolean }) {
  const content = value === undefined || value === null || value === "" ? "N/D" : String(value);
  return (
    <div>
      <p className="font-semibold text-slate-950 dark:text-slate-50">{label}</p>
      {mono ? (
        <code className="break-all font-mono text-[11px] text-slate-700 dark:text-slate-200">{content}</code>
      ) : (
        <p className="break-words">{content}</p>
      )}
    </div>
  );
}

function formatBooleanSignal(value: boolean | null | undefined): string | null {
  if (value === true) return "Sim";
  if (value === false) return "Não";
  return null;
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
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{formatAuditStatus(entry)}</span>
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
                    {entry.entryType === "dispatch" && entry.status === "SENT" ? (
                      <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-200">
                        SENT indica que o runtime submeteu a mensagem ao provider. Isso não confirma entrega, leitura ou recebimento no aparelho final.
                      </p>
                    ) : null}
                    <div className="mt-2 grid gap-2 text-xs text-slate-600 dark:text-slate-400 md:grid-cols-3">
                      <DetailField label="Timestamp" value={formatDateTime(entry.timestamp)} />
                      <DetailField label="Identificador" value={entry.identifier} mono />
                      <DetailField label="Meta" value={formatAuditMeta(entry)} />
                      {entry.entryType === "dispatch" ? (
                        <>
                          <DetailField label="Destinatário" value={entry.recipientJid ?? entry.payloadSummary?.recipientJid} mono />
                          <DetailField label="Telefone recebido" value={entry.payloadSummary?.rawPhone} />
                          <DetailField label="Telefone normalizado" value={entry.payloadSummary?.normalizedPhone} mono />
                          <DetailField label="Tipo de mensagem" value={entry.payloadSummary?.dispatchedMessageType ?? entry.messageType} />
                          <DetailField label="Caminho" value={formatDispatchDeliveryPath(entry.payloadSummary?.deliveryPath)} />
                          <DetailField label="Botões" value={entry.payloadSummary?.interactiveButtonKinds?.length ? `${entry.payloadSummary.interactiveButtonKinds.join(", ")} (${entry.payloadSummary.interactiveButtonCount})` : null} />
                          <DetailField label="URL documento" value={entry.payloadSummary?.documentUrl} />
                          <DetailField label="Fallback documento" value={entry.payloadSummary?.documentFallbackReason} />
                          <DetailField label="Provider ID" value={entry.providerMessageId} mono />
                          <DetailField label="Falha" value={entry.failureCode} />
                          <DetailField label="Retry" value={entry.retryable ? "Sim" : "Não"} />
                          <DetailField label="Tentativas" value={entry.retryAttemptCount} />
                          <DetailField label="Próximo retry" value={entry.nextRetryAt ? formatDateTime(entry.nextRetryAt) : null} />
                          <DetailField label="Retry esgotado" value={entry.retryExhaustedAt ? formatDateTime(entry.retryExhaustedAt) : null} />
                          <DetailField label="Último erro retry" value={entry.lastRetryError} />
                          <DetailField label="Mensagem secundária" value={formatSecondaryDispatchStatus(entry.payloadSummary?.secondaryDispatchStatus)} />
                          <DetailField label="Provider ID secundário" value={entry.payloadSummary?.secondaryProviderMessageId} mono />
                          <DetailField label="Falha secundária" value={entry.payloadSummary?.secondaryDispatchFailureCode} />
                          <DetailField label="Lookup WhatsApp" value={entry.payloadSummary?.whatsappLookupStatus} />
                          <DetailField label="Lookup existe" value={formatBooleanSignal(entry.payloadSummary?.whatsappLookupExists)} />
                          <DetailField label="JID lookup" value={entry.payloadSummary?.whatsappLookupJid} mono />
                          <DetailField label="Erro lookup" value={entry.payloadSummary?.whatsappLookupError} />
                          <DetailField label="Erro provider" value={entry.payloadSummary?.providerSendErrorMessage} />
                          <DetailField label="Código provider" value={entry.payloadSummary?.providerSendErrorCode} mono />
                          <DetailField label="Tipo provider" value={entry.payloadSummary?.providerSendErrorType} />
                          <DetailField label="Recibo pós-envio" value={entry.payloadSummary?.deliveryReceiptStatus} />
                          <DetailField label="Recibo observado em" value={entry.payloadSummary?.deliveryReceiptObservedAt ? formatDateTime(entry.payloadSummary.deliveryReceiptObservedAt) : null} />
                          <DetailField label="Status provider recibo" value={entry.payloadSummary?.deliveryReceiptProviderStatus} />
                          <DetailField label="Origem recibo" value={entry.payloadSummary?.deliveryReceiptSource} />
                          <DetailField label="JID recibo" value={entry.payloadSummary?.deliveryReceiptRemoteJid} mono />
                        </>
                      ) : null}
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
