import { useCallback, useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { api } from "../lib/axios";
import { AlertCircle, Check, ExternalLink, RefreshCw, Shield, TerminalSquare } from "lucide-react";
import { Button } from "./ui/Button";
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
  const updateInProgress = Boolean(job?.active || running);
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
      description="Status e execução do update remoto."
      actions={status ? (
        <div className="flex flex-wrap gap-2">
          {updateInProgress ? (
            <span className="inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-200">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Atualização em andamento
            </span>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={() => void checkUpdate()} disabled={loading} loading={loading}>
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                Verificar
              </Button>
              {status?.hasUpdate && (
                <Button size="sm" onClick={() => void applyUpdate()} disabled={loading}>
                  <TerminalSquare className="mr-2 h-4 w-4" aria-hidden="true" />
                  Atualizar
                </Button>
              )}
            </>
          )}
        </div>
      ) : undefined}
    >
      <Panel className="p-3">
        {error && (
          <InlineAlert tone="danger" className="mb-3" icon={<AlertCircle size={16} aria-hidden="true" />}>
            {error}
          </InlineAlert>
        )}

        {!status ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">Atualizações ainda não verificadas</p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Compare a versão instalada com a release publicada.</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void checkUpdate()} disabled={loading} loading={loading}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Verificar agora
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/45">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Atual</p>
                <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">{status.currentVersion}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/45">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Última</p>
                <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">{status.latestVersion}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/45">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Estado</p>
                <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-slate-50">
                  <StatusDot tone={status.hasUpdate ? "warning" : "success"} pulse={status.hasUpdate} />
                  {status.hasUpdate ? "Update disponível" : "Atualizado"}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => window.open(status.releaseUrl, "_blank", "noopener,noreferrer")} className="w-full md:w-auto">
                <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                Release
              </Button>
            </div>

            {status.hasUpdate ? (
              <InlineAlert tone="warning" icon={<Shield size={16} aria-hidden="true" />} title="Update disponível">
                <div className="space-y-2">
                  <p className="text-sm">O backend executa o script controlado e mantém status do job.</p>
                  {status.changelog && <pre className="max-h-28 overflow-y-auto rounded-lg bg-white/70 p-2 text-[11px] text-slate-700 dark:bg-slate-900/65 dark:text-slate-300">{status.changelog}</pre>}
                </div>
              </InlineAlert>
            ) : (
              <InlineAlert tone="success" icon={<Check size={16} aria-hidden="true" />}>
                {status.githubRepo} já está na versão mais recente.
              </InlineAlert>
            )}

            {job && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/45">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">Execução remota</p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Job {job.id} · alvo {job.targetVersion} · PID {job.pid ?? "n/d"}</p>
                  </div>
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-slate-50">
                    <StatusDot tone={jobTone} pulse={job.active} />
                    {jobLabel}
                  </p>
                </div>

                {(job.summary || job.error) && (
                  <div className="mt-3 space-y-1 text-xs">
                    {job.summary && <p className="text-slate-700 dark:text-slate-300"><strong>Resumo:</strong> {job.summary}</p>}
                    {job.error && <p className="text-red-700 dark:text-red-300"><strong>Erro:</strong> {job.error}</p>}
                  </div>
                )}

                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900">
                    <p className="font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Criado</p>
                    <p className="mt-1 text-slate-950 dark:text-slate-50">{new Date(job.createdAt).toLocaleString("pt-BR")}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900">
                    <p className="font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Iniciado</p>
                    <p className="mt-1 text-slate-950 dark:text-slate-50">{job.startedAt ? new Date(job.startedAt).toLocaleString("pt-BR") : "Aguardando"}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900">
                    <p className="font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Finalizado</p>
                    <p className="mt-1 text-slate-950 dark:text-slate-50">{job.finishedAt ? new Date(job.finishedAt).toLocaleString("pt-BR") : "Em andamento"}</p>
                  </div>
                </div>

                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Logs recentes</summary>
                  <pre className="mt-2 max-h-36 overflow-y-auto rounded-lg bg-white p-3 text-[11px] text-slate-700 dark:bg-slate-900 dark:text-slate-300">{job.logTail.length > 0 ? job.logTail.join("\n") : "Sem logs disponíveis ainda."}</pre>
                </details>
              </div>
            )}
          </div>
        )}
      </Panel>
    </Section>
  );
}
