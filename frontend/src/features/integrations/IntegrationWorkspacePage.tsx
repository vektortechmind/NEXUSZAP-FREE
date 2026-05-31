import { BookOpenText } from "lucide-react";
import { Link } from "react-router-dom";
import { Panel } from "../../components/ui/Panel";
import { Section } from "../../components/ui/Section";
import { type IntegrationDashboardResponse } from "../dashboard/integrationDashboard";
import { type IntegrationCredentialDetail, type IntegrationCredentialsWorkspace } from "./credentials";
import { INTEGRATION_DOCUMENTATION_ROUTE } from "./integrationDocumentationContent";
import { IntegrationCredentialsSection } from "./IntegrationCredentialsSection";
import { IntegrationOperationsOverview } from "./IntegrationOperationsOverview";

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
      <Panel aria-label="Ações da área de integrações" className="rounded-3xl p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">Workspace de integrações</p>
            <h1 className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-50">Credenciais e operação em um fluxo enxuto</h1>
          </div>
          <Link
            to={documentationPath}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:border-emerald-500 hover:bg-emerald-500 dark:border-emerald-500 dark:bg-emerald-500 dark:text-slate-950 dark:hover:border-emerald-400 dark:hover:bg-emerald-400"
          >
            <BookOpenText className="mr-2 h-4 w-4" aria-hidden="true" />
            Abrir documentação
          </Link>
        </div>
      </Panel>

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
        <IntegrationOperationsOverview overview={overview} refreshing={refreshing} onRefresh={onRefresh} />
      </Section>
    </div>
  );
}
