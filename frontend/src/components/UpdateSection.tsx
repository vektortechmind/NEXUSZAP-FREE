import { useCallback, useState } from "react";
import { api } from "../lib/axios";
import { AlertCircle, Check, ExternalLink, GitFork, RefreshCw, Shield } from "lucide-react";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { InlineAlert } from "./ui/InlineAlert";
import { Panel } from "./ui/Panel";
import { Section } from "./ui/Section";
import { StatusDot } from "./ui/StatusDot";

type UpdateStatus = {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseUrl: string;
  changelog: string;
  githubRepo: string;
};

export function UpdateSection() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkUpdate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<UpdateStatus>("/update/status");
      setStatus(res.data);
    } catch (err) {
      setError("Não foi possível verificar atualizações");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <Section
      title="Update Center"
      description="Consulta segura de versão. Aplicação remota permanece desabilitada por segurança."
      actions={
        <Button variant="secondary" size="sm" onClick={() => void checkUpdate()} disabled={loading} loading={loading}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Verificar
        </Button>
      }
    >
      <Panel className="p-4">
        {error && (
          <InlineAlert tone="danger" className="mb-4" icon={<AlertCircle size={16} aria-hidden="true" />}>
            {error}
          </InlineAlert>
        )}

        {!status ? (
          <EmptyState
            icon={<GitFork size={22} aria-hidden="true" />}
            title="Atualizações ainda não verificadas"
            description="Consulte o repositório configurado para comparar a versão instalada com a última release."
            action={
              <Button variant="secondary" size="sm" onClick={() => void checkUpdate()} disabled={loading} loading={loading}>
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                Verificar agora
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/45">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Versão atual</p>
                <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-50">{status.currentVersion}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/45">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Última release</p>
                <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-50">{status.latestVersion}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/45">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Estado</p>
                <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-slate-50">
                  <StatusDot tone={status.hasUpdate ? "warning" : "success"} pulse={status.hasUpdate} />
                  {status.hasUpdate ? "Update disponível" : "Atualizado"}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/45">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Token GitHub</p>
                <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-slate-50">
                  <StatusDot tone="neutral" />
                  Não exposto no frontend
                </p>
              </div>
            </div>

            {status.hasUpdate ? (
              <InlineAlert tone="warning" icon={<Shield size={17} aria-hidden="true" />} title="Ação manual necessária">
                <div className="space-y-3">
                  <p>Aplicação remota está desabilitada. Atualize pela VPS usando o runbook ou `update.sh`.</p>
                  {status.changelog && (
                    <pre className="max-h-36 overflow-y-auto rounded-lg bg-white/70 p-3 text-xs text-slate-700 dark:bg-slate-900/65 dark:text-slate-300">{status.changelog}</pre>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => window.open(status.releaseUrl, "_blank", "noopener,noreferrer")}>
                    <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                    Ver release no GitHub
                  </Button>
                </div>
              </InlineAlert>
            ) : (
              <InlineAlert tone="success" icon={<Check size={17} aria-hidden="true" />}>
                A instalação está na versão mais recente disponível para `{status.githubRepo}`.
              </InlineAlert>
            )}
          </div>
        )}
      </Panel>
    </Section>
  );
}
