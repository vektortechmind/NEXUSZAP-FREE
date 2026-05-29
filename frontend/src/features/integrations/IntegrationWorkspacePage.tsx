import { BookOpenText, Cable, KeyRound, LifeBuoy, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Panel } from "../../components/ui/Panel";
import { Section } from "../../components/ui/Section";
import { type IntegrationDashboardResponse } from "../dashboard/integrationDashboard";
import { type IntegrationCredentialDetail, type IntegrationCredentialsWorkspace } from "./credentials";
import { INTEGRATION_DOCUMENTATION_ROUTE } from "./integrationDocumentationContent";
import { IntegrationCredentialsSection } from "./IntegrationCredentialsSection";
import { IntegrationOperationsOverview } from "./IntegrationOperationsOverview";
import { INTEGRATION_WORKSPACE_SECTIONS } from "./workspace";

type IntegrationWorkspacePageProps = {
  overview: IntegrationDashboardResponse;
  credentialsWorkspace: IntegrationCredentialsWorkspace;
  expandedCredentialInstanceId: string | null;
  credentialDetail: IntegrationCredentialDetail | null;
  issueModalOpen: boolean;
  issueModalInstanceId: string | null;
  credentialsLoading: boolean;
  credentialDetailLoading: boolean;
  credentialActionLoading: "issue" | "rotate" | null;
  refreshing: boolean;
  onRefresh: () => void;
  onToggleCredentialInstance: (instanceId: string) => void;
  onOpenIssueModal: (instanceId?: string | null) => void;
  onCloseIssueModal: () => void;
  onSelectIssueInstance: (instanceId: string) => void;
  onIssueCredential: (instanceId: string) => void;
  onRotateCredential: (instanceId: string) => void;
  onCopyCredentialField: (label: string, value: string | null) => void;
};

export function IntegrationWorkspacePage({
  overview,
  credentialsWorkspace,
  expandedCredentialInstanceId,
  credentialDetail,
  issueModalOpen,
  issueModalInstanceId,
  credentialsLoading,
  credentialDetailLoading,
  credentialActionLoading,
  refreshing,
  onRefresh,
  onToggleCredentialInstance,
  onOpenIssueModal,
  onCloseIssueModal,
  onSelectIssueInstance,
  onIssueCredential,
  onRotateCredential,
  onCopyCredentialField,
}: IntegrationWorkspacePageProps) {
  const documentationPath = overview.documentation.path || INTEGRATION_DOCUMENTATION_ROUTE;

  return (
    <div className="space-y-8">
      <div aria-label="Ações da área de integrações" className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.35)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/70 sm:p-5">
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">Workspace de integrações</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Esta área separa credenciais, operação e documentação técnica para evitar que o dashboard principal concentre configuração e auditoria no mesmo fluxo.</p>
          </div>
          <Button onClick={onRefresh} disabled={refreshing} loading={refreshing} className="w-full lg:w-auto">
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Atualizar operação
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {INTEGRATION_WORKSPACE_SECTIONS.map((section) => {
          const Icon = section.id === "credenciais" ? KeyRound : section.id === "operacao" ? Cable : BookOpenText;
          const isDocumentation = section.id === "documentacao";
          return (
            <Panel key={section.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300">
                  <Icon size={20} aria-hidden="true" />
                </div>
                {isDocumentation ? (
                  <Link to={documentationPath} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition-colors hover:border-emerald-500 hover:bg-emerald-500 dark:border-emerald-500 dark:bg-emerald-500 dark:text-slate-950 dark:hover:border-emerald-400 dark:hover:bg-emerald-400">
                    Abrir documentação
                  </Link>
                ) : null}
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-950 dark:text-slate-50">{section.label}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{section.description}</p>
            </Panel>
          );
        })}
      </div>

      <Section id="credenciais" title="Credenciais" description="Cards compactos por instância com emissão guiada, rotação explícita e detalhamento sob demanda do `secretToken`.">
        <IntegrationCredentialsSection
          workspace={credentialsWorkspace}
          expandedInstanceId={expandedCredentialInstanceId}
          detail={credentialDetail}
          issueModalOpen={issueModalOpen}
          issueModalInstanceId={issueModalInstanceId}
          loadingWorkspace={credentialsLoading}
          loadingDetail={credentialDetailLoading}
          actionLoading={credentialActionLoading}
          onToggleInstance={onToggleCredentialInstance}
          onOpenIssueModal={onOpenIssueModal}
          onCloseIssueModal={onCloseIssueModal}
          onSelectIssueInstance={onSelectIssueInstance}
          onIssueCredential={onIssueCredential}
          onRotateCredential={onRotateCredential}
          onCopyField={onCopyCredentialField}
        />
      </Section>

      <Section id="operacao" title="Operação" description="Estado básico das integrações por instância com base em credenciais, ingressos e dispatches persistidos.">
        <IntegrationOperationsOverview overview={overview} />
      </Section>

      <Section id="documentacao" title="Documentação" description="Superfície dedicada para a documentação técnica, separada da operação e sem expor caminho local do repositório como se fosse uma URL de produto.">
        <Panel tone="muted" className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">Página própria de documentação disponível no painel</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">Abra a documentação pública do endpoint para consultar auth, body, eventos suportados, respostas HTTP e troubleshooting. O fluxo correto continua sendo selecionar a instância e obter `instanceId`, `endpointUrl` e `secretToken` na seção `Credenciais` antes de configurar o sistema externo.</p>
            </div>
            <div className="flex flex-col items-stretch gap-3 sm:items-end">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                <LifeBuoy size={14} aria-hidden="true" />
                Story 040
              </div>
            </div>
          </div>
        </Panel>
      </Section>
    </div>
  );
}
