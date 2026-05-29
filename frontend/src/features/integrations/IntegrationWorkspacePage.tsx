import { ArrowRight, BookOpenText, Cable, KeyRound, LifeBuoy, RefreshCw } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Panel } from "../../components/ui/Panel";
import { Section } from "../../components/ui/Section";
import { type IntegrationDashboardResponse } from "../dashboard/integrationDashboard";
import { type IntegrationCredentialDetail, type IntegrationCredentialsWorkspace } from "./credentials";
import { IntegrationCredentialsSection } from "./IntegrationCredentialsSection";
import { IntegrationOperationsOverview } from "./IntegrationOperationsOverview";
import { INTEGRATION_WORKSPACE_SECTIONS } from "./workspace";

type IntegrationWorkspacePageProps = {
  overview: IntegrationDashboardResponse;
  credentialsWorkspace: IntegrationCredentialsWorkspace;
  selectedCredentialInstanceId: string | null;
  credentialDetail: IntegrationCredentialDetail | null;
  credentialsLoading: boolean;
  credentialDetailLoading: boolean;
  credentialActionLoading: "issue" | "rotate" | null;
  refreshing: boolean;
  onRefresh: () => void;
  onSelectCredentialInstance: (instanceId: string) => void;
  onIssueCredential: () => void;
  onRotateCredential: () => void;
  onCopyCredentialField: (label: string, value: string | null) => void;
};

export function IntegrationWorkspacePage({
  overview,
  credentialsWorkspace,
  selectedCredentialInstanceId,
  credentialDetail,
  credentialsLoading,
  credentialDetailLoading,
  credentialActionLoading,
  refreshing,
  onRefresh,
  onSelectCredentialInstance,
  onIssueCredential,
  onRotateCredential,
  onCopyCredentialField,
}: IntegrationWorkspacePageProps) {
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
          return (
            <Panel key={section.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300">
                  <Icon size={20} aria-hidden="true" />
                </div>
                <a href={`#${section.id}`} className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 transition-colors hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300">
                  Ver seção
                  <ArrowRight size={14} aria-hidden="true" />
                </a>
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-950 dark:text-slate-50">{section.label}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{section.description}</p>
            </Panel>
          );
        })}
      </div>

      <Section id="credenciais" title="Credenciais" description="Superfície operacional reservada para a próxima entrega: seleção da instância, leitura de instanceId, endpointUrl e geração ou rotação do secretToken.">
        <IntegrationCredentialsSection
          workspace={credentialsWorkspace}
          selectedInstanceId={selectedCredentialInstanceId}
          detail={credentialDetail}
          loadingWorkspace={credentialsLoading}
          loadingDetail={credentialDetailLoading}
          actionLoading={credentialActionLoading}
          onSelectInstance={onSelectCredentialInstance}
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
              <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">Página própria de documentação na próxima fase</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">A documentação técnica será promovida para uma rota dedicada do frontend. O objetivo é abrir uma página própria a partir daqui, com contrato navegável, exemplos e orientação explícita de onde obter `instanceId` e `secretToken` no próprio painel.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <LifeBuoy size={14} aria-hidden="true" />
              Story 040
            </div>
          </div>
        </Panel>
      </Section>
    </div>
  );
}
