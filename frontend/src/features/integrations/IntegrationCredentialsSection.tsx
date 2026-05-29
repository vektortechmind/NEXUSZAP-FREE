import { CheckCircle2, Copy, Cog, Fingerprint, KeyRound, Link2, RotateCw, ShieldCheck, ShieldOff, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { InlineAlert } from "../../components/ui/InlineAlert";
import { Panel } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatusDot } from "../../components/ui/StatusDot";
import {
  credentialSurfaceTone,
  formatCredentialSurfaceStatus,
  getCredentialOperationalSummary,
  getCredentialPrimaryAction,
  getCredentialSecretLabel,
  getIssuableCredentialInstances,
  type IntegrationCredentialDetail,
  type IntegrationCredentialsWorkspace,
} from "./credentials";

type IntegrationCredentialsSectionProps = {
  workspace: IntegrationCredentialsWorkspace;
  expandedInstanceId: string | null;
  detail: IntegrationCredentialDetail | null;
  issueModalOpen: boolean;
  issueModalInstanceId: string | null;
  loadingWorkspace: boolean;
  loadingDetail: boolean;
  actionLoading: "issue" | "rotate" | null;
  onToggleInstance: (instanceId: string) => void;
  onOpenIssueModal: (instanceId?: string | null) => void;
  onCloseIssueModal: () => void;
  onSelectIssueInstance: (instanceId: string) => void;
  onIssueCredential: (instanceId: string) => void;
  onRotateCredential: (instanceId: string) => void;
  onCopyField: (label: string, value: string | null) => void;
};

function CompactField({
  label,
  value,
  icon,
  copyLabel,
  copyValue,
  onCopy,
  muted = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  copyLabel: string;
  copyValue: string | null;
  onCopy: (label: string, value: string | null) => void;
  muted?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</p>
          <div className={`mt-2 flex items-start gap-2 text-sm ${muted ? "text-slate-500 dark:text-slate-400" : "text-slate-950 dark:text-slate-50"}`}>
            <span className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500">{icon}</span>
            <code className="min-w-0 break-all rounded-lg bg-slate-50 px-2 py-1 font-mono text-[12px] dark:bg-slate-950/60">{value}</code>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => onCopy(copyLabel, copyValue)} className="shrink-0">
          <Copy className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function CredentialsIssueModal({
  open,
  instances,
  selectedInstanceId,
  actionLoading,
  onClose,
  onSelect,
  onIssue,
}: {
  open: boolean;
  instances: IntegrationCredentialsSectionProps["workspace"]["instances"];
  selectedInstanceId: string | null;
  actionLoading: boolean;
  onClose: () => void;
  onSelect: (instanceId: string) => void;
  onIssue: (instanceId: string) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <Panel className="max-h-[90vh] w-full max-w-3xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/35">
          <div>
            <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Criar credencial</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Escolha a instância para emitir um `secretToken` novo e liberar o card operacional.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-label="Fechar criação de credencial"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-5 overflow-y-auto p-5">
          {instances.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck size={22} aria-hidden="true" />}
              title="Todas as instâncias já têm credencial ativa"
              description="Use a rotação diretamente no card da instância quando precisar substituir um token existente."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {instances.map((instance) => {
                const selected = instance.instanceId === selectedInstanceId;
                return (
                  <button
                    key={instance.instanceId}
                    type="button"
                    onClick={() => onSelect(instance.instanceId)}
                    className={`rounded-2xl border p-4 text-left transition ${selected ? "border-emerald-500 bg-emerald-50/80 shadow-sm dark:border-emerald-500 dark:bg-emerald-950/25" : "border-slate-200 bg-white hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-900"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        <Cog size={18} aria-hidden="true" />
                      </div>
                      {selected ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" /> : null}
                    </div>
                    <p className="mt-4 text-sm font-semibold text-slate-950 dark:text-slate-50">{instance.instanceName}</p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Slot {instance.instanceSlot} · {instance.instanceStatus}</p>
                    <p className="mt-3 break-all font-mono text-[12px] text-slate-500 dark:text-slate-400">{instance.instanceId}</p>
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose}>Fechar</Button>
            <Button
              onClick={() => selectedInstanceId ? onIssue(selectedInstanceId) : undefined}
              disabled={!selectedInstanceId || instances.length === 0}
              loading={actionLoading}
            >
              <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />
              Emitir credencial
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}

export function IntegrationCredentialsSection({
  workspace,
  expandedInstanceId,
  detail,
  issueModalOpen,
  issueModalInstanceId,
  loadingWorkspace,
  loadingDetail,
  actionLoading,
  onToggleInstance,
  onOpenIssueModal,
  onCloseIssueModal,
  onSelectIssueInstance,
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

  const issuableInstances = getIssuableCredentialInstances(workspace);

  return (
    <>
      <div className="space-y-4">
        <Panel className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">Credenciais por instância</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Cada card concentra emissão, rotação, cópia e leitura operacional sem depender do seletor expandido da entrega anterior.</p>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <Button onClick={() => onOpenIssueModal()} disabled={issuableInstances.length === 0} className="w-full sm:w-auto">
                <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                Criar credencial
              </Button>
            </div>
          </div>
          {issuableInstances.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Todas as instâncias listadas já têm credencial ativa. Use a rotação diretamente no card operacional.</p>
          ) : null}
        </Panel>

        <div className="grid gap-4 xl:grid-cols-2">
          {workspace.instances.map((instance) => {
            const isExpanded = expandedInstanceId === instance.instanceId;
            const currentDetail = detail && detail.instanceId === instance.instanceId ? detail : null;
            const currentStatus = currentDetail?.credentialStatus ?? instance.credentialStatus;
            const primaryAction = getCredentialPrimaryAction(currentStatus);
            const detailVisible = isExpanded && currentDetail;
            const secretLabel = getCredentialSecretLabel(currentDetail);

            return (
              <Panel key={instance.instanceId} className="overflow-hidden">
                <div className="border-b border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/35">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white dark:bg-emerald-500 dark:text-slate-950">Instância {instance.instanceSlot}</span>
                        <StatusDot
                          tone={credentialSurfaceTone(currentStatus)}
                          pulse={currentStatus === "ACTIVE"}
                          label={formatCredentialSurfaceStatus(currentStatus)}
                          className="text-xs font-semibold text-slate-800 dark:text-slate-200"
                        />
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{instance.instanceStatus}</span>
                      </div>
                      <h3 className="mt-3 truncate text-lg font-semibold text-slate-950 dark:text-slate-50">{instance.instanceName}</h3>
                      <p className="mt-1 break-all font-mono text-[12px] text-slate-500 dark:text-slate-400">{instance.instanceId}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onToggleInstance(instance.instanceId)}
                        className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        aria-label={`${isExpanded ? "Ocultar" : "Abrir"} detalhes de ${instance.instanceName}`}
                      >
                        <Cog size={18} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {instance.tokenPreview ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{instance.tokenPreview}</span>
                    ) : (
                      <span className="rounded-full border border-dashed border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">Sem credencial ativa</span>
                    )}
                    <button
                      type="button"
                      onClick={() => onToggleInstance(instance.instanceId)}
                      className="text-xs font-semibold text-emerald-700 transition hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
                    >
                      {isExpanded ? "Ocultar detalhes" : "Ver detalhes"}
                    </button>
                  </div>

                  {isExpanded ? (
                    loadingDetail && !currentDetail ? (
                      <Skeleton className="h-56" />
                    ) : detailVisible ? (
                      <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/35">
                        <div className="grid gap-3 lg:grid-cols-3">
                          <CompactField
                            label="instanceId"
                            value={currentDetail.instanceId}
                            icon={<Fingerprint size={16} aria-hidden="true" />}
                            copyLabel="instanceId"
                            copyValue={currentDetail.instanceId}
                            onCopy={onCopyField}
                          />
                          <CompactField
                            label="endpointUrl"
                            value={currentDetail.endpointUrl ?? workspace.endpointUrl ?? "/api/integrations/events"}
                            icon={<Link2 size={16} aria-hidden="true" />}
                            copyLabel="endpointUrl"
                            copyValue={currentDetail.endpointUrl ?? workspace.endpointUrl ?? "/api/integrations/events"}
                            onCopy={onCopyField}
                            muted={!currentDetail.endpointUrl}
                          />
                          <CompactField
                            label="secretToken"
                            value={secretLabel}
                            icon={<KeyRound size={16} aria-hidden="true" />}
                            copyLabel="secretToken"
                            copyValue={currentDetail.secretToken}
                            onCopy={onCopyField}
                            muted={!currentDetail.secretToken}
                          />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          {getCredentialOperationalSummary(currentDetail).map((item) => (
                            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{item.label}</p>
                              <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-slate-50">{item.value}</p>
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row">
                          {primaryAction.kind === "issue" ? (
                            <Button onClick={() => onIssueCredential(instance.instanceId)} loading={actionLoading === "issue"} className="w-full sm:w-auto">
                              <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                              {primaryAction.label}
                            </Button>
                          ) : (
                            <Button onClick={() => onRotateCredential(instance.instanceId)} loading={actionLoading === "rotate"} className="w-full sm:w-auto">
                              <RotateCw className="mr-2 h-4 w-4" aria-hidden="true" />
                              {primaryAction.label}
                            </Button>
                          )}
                          {primaryAction.kind !== "issue" ? (
                            <Button variant="secondary" onClick={() => onOpenIssueModal(instance.instanceId)} className="w-full sm:w-auto">
                              <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                              Nova emissão guiada
                            </Button>
                          ) : null}
                        </div>

                        <InlineAlert tone={currentDetail.secretToken ? "warning" : "info"} icon={currentDetail.secretToken ? <ShieldOff size={16} aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}>
                          {currentDetail.secretToken
                            ? "Copie o secretToken explicitamente e trate a rotação como invalidação imediata do valor anterior no integrador externo."
                            : currentDetail.credentialStatus === "ACTIVE"
                              ? "O segredo completo permanece oculto até emissão ou rotação explícita nesta superfície."
                              : "Esta instância ainda não possui credencial ativa. Emita um novo secretToken para liberar integrações."}
                        </InlineAlert>
                      </div>
                    ) : null
                  ) : null}
                </div>
              </Panel>
            );
          })}
        </div>
      </div>

      <CredentialsIssueModal
        open={issueModalOpen}
        instances={issuableInstances}
        selectedInstanceId={issueModalInstanceId}
        actionLoading={actionLoading === "issue"}
        onClose={onCloseIssueModal}
        onSelect={onSelectIssueInstance}
        onIssue={onIssueCredential}
      />
    </>
  );
}
