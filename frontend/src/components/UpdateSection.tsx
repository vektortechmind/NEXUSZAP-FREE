import { useCallback, useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { api } from "../lib/axios";
import { AlertCircle, Check, ExternalLink, GitFork, RefreshCw, Shield, TerminalSquare } from "lucide-react";
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
  job: UpdateJob | null;
};

type UpdateJob = {
  id: string;
  status: "queued" | "running" | "success" | "failed";
  currentVersion: string;
  targetVersion: string;
  releaseUrl: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  pid: number | null;
  summary: string | null;
  error: string | null;
  logTail: string[];
  active: boolean;
};

export function UpdateSection() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkUpdate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<UpdateStatus>("/update/status");
      setStatus(res.data);
      setRunning(Boolean(res.data.job?.active));
    } catch (err) {
      const message = isAxiosError(err)
        ? (err.response?.data as { error?: string } | undefined)?.error ?? "Não foi possível verificar atualizações"
        : "Não foi possível verificar atualizações";
      setError(message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const applyUpdate = useCallback(async () => {
    if (!status?.hasUpdate) return;
    if (!window.confirm(`Iniciar atualização remota para ${status.latestVersion}? O painel ficará apenas acompanhando o job em background.`)) {
      return;
    }

    setRunning(true);
    setError(null);
    try {
      await api.post<{ success: boolean; message: string; job: UpdateJob }>("/update/apply");
      await checkUpdate();
    } catch (err) {
      const message = isAxiosError(err)
        ? (err.response?.data as { error?: string } | undefined)?.error ?? "Não foi possível iniciar a atualização"
        : "Não foi possível iniciar a atualização";
      setError(message);
      setRunning(false);
      console.error(err);
    }
  }, [checkUpdate, status]);

  const job = status?.job ?? null;
  const jobTone = job?.status === "success" ? "success" : job?.status === "failed" ? "danger" : "warning";
  const jobLabel = job?.status === "queued"
    ? "Na fila"
    : job?.status === "running"
      ? "Executando"
      : job?.status === "success"
        ? "Concluído"
        : job?.status === "failed"
          ? "Falhou"
          : null;

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => {
      void checkUpdate();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [checkUpdate, running, job?.status]);

  return (
    <Section
      title="Update Center"
      description="Consulta e execução controlada de atualização para o cenário oficial de VPS/Linux."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => void checkUpdate()} disabled={loading} loading={loading}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Verificar
          </Button>
          {status?.hasUpdate && (
            <Button size="sm" onClick={() => void applyUpdate()} disabled={loading || running || Boolean(job?.active)} loading={running && Boolean(job?.active)}>
              <TerminalSquare className="mr-2 h-4 w-4" aria-hidden="true" />
              Executar atualização
            </Button>
          )}
        </div>
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
            description="Consulte o repositório configurado para comparar a versão instalada com a versão publicada no GitHub."
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
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Última versão</p>
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
              <InlineAlert tone="warning" icon={<Shield size={17} aria-hidden="true" />} title="Update disponível">
                <div className="space-y-3">
                  <p>Você pode disparar o fluxo oficial de update da VPS pelo painel. O backend executa apenas o script controlado e mantém status/log do job.</p>
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

            {job && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/45">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">Execução remota</p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Job {job.id} · alvo {job.targetVersion}</p>
                  </div>
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-slate-50">
                    <StatusDot tone={jobTone} pulse={job.active} />
                    {jobLabel}
                  </p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
                    <p className="font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Criado em</p>
                    <p className="mt-2 text-sm text-slate-950 dark:text-slate-50">{new Date(job.createdAt).toLocaleString("pt-BR")}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
                    <p className="font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Iniciado em</p>
                    <p className="mt-2 text-sm text-slate-950 dark:text-slate-50">{job.startedAt ? new Date(job.startedAt).toLocaleString("pt-BR") : "Aguardando"}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
                    <p className="font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Finalizado em</p>
                    <p className="mt-2 text-sm text-slate-950 dark:text-slate-50">{job.finishedAt ? new Date(job.finishedAt).toLocaleString("pt-BR") : "Em andamento"}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
                    <p className="font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Worker PID</p>
                    <p className="mt-2 text-sm text-slate-950 dark:text-slate-50">{job.pid ?? "n/d"}</p>
                  </div>
                </div>

                {(job.summary || job.error) && (
                  <div className="mt-4 space-y-2 text-sm">
                    {job.summary && <p className="text-slate-700 dark:text-slate-300"><strong>Resumo:</strong> {job.summary}</p>}
                    {job.error && <p className="text-red-700 dark:text-red-300"><strong>Erro:</strong> {job.error}</p>}
                  </div>
                )}

                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Logs recentes</p>
                  <pre className="max-h-48 overflow-y-auto rounded-lg bg-white p-3 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-300">{job.logTail.length > 0 ? job.logTail.join("\n") : "Sem logs disponíveis ainda."}</pre>
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>
    </Section>
  );
}
