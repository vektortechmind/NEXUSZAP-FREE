import { Copy, Fingerprint, KeyRound, Link2, RotateCw, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { InlineAlert } from "../../components/ui/InlineAlert";
import { Panel } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatusDot } from "../../components/ui/StatusDot";
import {
  credentialSurfaceTone,
  formatCredentialSurfaceStatus,
  formatCredentialTimestamp,
  getCredentialPrimaryAction,
  type IntegrationCredentialDetail,
  type IntegrationCredentialsWorkspace,
} from "./credentials";

type IntegrationCredentialsSectionProps = {
  workspace: IntegrationCredentialsWorkspace;
  selectedInstanceId: string | null;
  detail: IntegrationCredentialDetail | null;
  loadingWorkspace: boolean;
  loadingDetail: boolean;
  actionLoading: "issue" | "rotate" | null;
  onSelectInstance: (instanceId: string) => void;
  onIssueCredential: () => void;
  onRotateCredential: () => void;
  onCopyField: (label: string, value: string | null) => void;
};

function ReadonlyField({
  label,
  value,
  onCopy,
  icon,
  muted = false,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  icon: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
          <div className={`mt-2 flex items-center gap-2 text-sm ${muted ? "text-slate-500 dark:text-slate-400" : "text-slate-950 dark:text-slate-50"}`}>
            <span className="shrink-0 text-slate-400 dark:text-slate-500">{icon}</span>
            <code className="min-w-0 break-all rounded bg-slate-50 px-2 py-1 font-mono text-[13px] dark:bg-slate-950/60">{value}</code>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={onCopy} className="shrink-0">
          <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
          Copiar
        </Button>
      </div>
    </div>
  );
}

export function IntegrationCredentialsSection({
  workspace,
  selectedInstanceId,
  detail,
  loadingWorkspace,
  loadingDetail,
  actionLoading,
  onSelectInstance,
  onIssueCredential,
  onRotateCredential,
  onCopyField,
}: IntegrationCredentialsSectionProps) {
  if (loadingWorkspace && workspace.instances.length === 0) {
    return <Skeleton className="h-[24rem]" />;
  }

  if (workspace.instances.length === 0) {
    return (
      <EmptyState
        icon={<KeyRound size={22} aria-hidden="true" />}
        title="Nenhuma instância elegível"
        description="Cadastre ou conecte uma instância WhatsApp para emitir credenciais de integração por instância."
      />
    );
  }

  const selectedSummary = workspace.instances.find((instance) => instance.instanceId === selectedInstanceId) ?? workspace.instances[0];
  const currentDetail = detail && detail.instanceId === selectedSummary.instanceId ? detail : null;
  const currentStatus = currentDetail?.credentialStatus ?? selectedSummary.credentialStatus;
  const primaryAction = getCredentialPrimaryAction(currentStatus);

  return (
    <div className="space-y-4">
      <Panel className="p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              <span className="mb-1.5 block">Instância</span>
              <select
                value={selectedSummary.instanceId}
                onChange={(event) => onSelectInstance(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {workspace.instances.map((instance) => (
                  <option key={instance.instanceId} value={instance.instanceId}>{instance.instanceName} · slot {instance.instanceSlot}</option>
                ))}
              </select>
            </label>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Selecione a instância para obter `instanceId`, `endpointUrl` e a credencial operacional sem inferência manual.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/45">
            <div className="flex flex-wrap items-center gap-3">
              <StatusDot tone={credentialSurfaceTone(currentStatus)} pulse={currentStatus === "ACTIVE"} label={formatCredentialSurfaceStatus(currentStatus)} className="text-sm font-semibold text-slate-800 dark:text-slate-200" />
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{selectedSummary.instanceStatus}</span>
              {selectedSummary.tokenPreview ? <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{selectedSummary.tokenPreview}</span> : null}
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{primaryAction.helper}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              {primaryAction.kind === "issue" ? (
                <Button onClick={onIssueCredential} loading={actionLoading === "issue"} className="w-full sm:w-auto">
                  <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                  {primaryAction.label}
                </Button>
              ) : (
                <Button onClick={onRotateCredential} loading={actionLoading === "rotate"} className="w-full sm:w-auto">
                  <RotateCw className="mr-2 h-4 w-4" aria-hidden="true" />
                  {primaryAction.label}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Panel>

      {loadingDetail && !currentDetail ? <Skeleton className="h-[22rem]" /> : null}

      {currentDetail ? (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-3">
            <ReadonlyField label="instanceId" value={currentDetail.instanceId} icon={<Fingerprint size={16} aria-hidden="true" />} onCopy={() => onCopyField("instanceId", currentDetail.instanceId)} />
            <ReadonlyField label="endpointUrl" value={currentDetail.endpointUrl ?? "/api/integrations/events"} icon={<Link2 size={16} aria-hidden="true" />} onCopy={() => onCopyField("endpointUrl", currentDetail.endpointUrl ?? "/api/integrations/events")} muted={!currentDetail.endpointUrl} />
            <ReadonlyField label="secretToken" value={currentDetail.secretToken ?? "Nenhuma credencial ativa para esta instância."} icon={<KeyRound size={16} aria-hidden="true" />} onCopy={() => onCopyField("secretToken", currentDetail.secretToken)} muted={!currentDetail.secretToken} />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Panel className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Emissão</p><p className="mt-2 text-sm font-semibold text-slate-950 dark:text-slate-50">{formatCredentialTimestamp(currentDetail.issuedAt)}</p></Panel>
            <Panel className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Último uso</p><p className="mt-2 text-sm font-semibold text-slate-950 dark:text-slate-50">{formatCredentialTimestamp(currentDetail.lastUsedAt)}</p></Panel>
            <Panel className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Replay window</p><p className="mt-2 text-sm font-semibold text-slate-950 dark:text-slate-50">{currentDetail.replayWindowMs ? `${Math.round(currentDetail.replayWindowMs / 60000)} min` : "N/D"}</p></Panel>
            <Panel className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Dedup window</p><p className="mt-2 text-sm font-semibold text-slate-950 dark:text-slate-50">{currentDetail.dedupWindowMs ? `${Math.round(currentDetail.dedupWindowMs / 60000)} min` : "N/D"}</p></Panel>
          </div>

          <InlineAlert tone={currentDetail.secretToken ? "warning" : "info"} icon={currentDetail.secretToken ? <ShieldOff size={16} aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}>
            {currentDetail.secretToken
              ? "Copie o secretToken explicitamente e trate a rotação como invalidacão imediata do valor anterior no integrador externo."
              : "Sem credencial ativa no momento. Gere um novo secretToken para habilitar integrações nesta instância."}
          </InlineAlert>
        </div>
      ) : null}
    </div>
  );
}
