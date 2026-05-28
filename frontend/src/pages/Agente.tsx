import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/axios";
import { AlertCircle, FileText, RefreshCw, Save, Trash2, Upload } from "lucide-react";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { InlineAlert } from "../components/ui/InlineAlert";
import { Panel } from "../components/ui/Panel";
import { Section } from "../components/ui/Section";
import { Skeleton } from "../components/ui/Skeleton";
import { StatusDot } from "../components/ui/StatusDot";
import { Toolbar } from "../components/ui/Toolbar";
import { useToast } from "../contexts/ToastContext";

type AgentConfig = {
  id: string;
  systemPrompt: string | null;
};

type KnowledgeFile = {
  id: string;
  filename: string;
  mimetype: string;
  createdAt: string;
};

function AgentSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-16" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Skeleton className="h-[34rem]" />
        <Skeleton className="h-[34rem]" />
      </div>
    </div>
  );
}

function fileKind(file: KnowledgeFile) {
  return file.mimetype.split("/")[1]?.toUpperCase() || file.mimetype || "DOC";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function Agente() {
  const [agent, setAgent] = useState<AgentConfig | null>(null);
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesRefreshing, setFilesRefreshing] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { addToast } = useToast();

  const accept = useMemo(() => ".pdf,.png,.jpg,.jpeg,.webp,.txt,.docx,.json", []);
  const promptValue = agent?.systemPrompt ?? "";
  const promptStats = useMemo(() => {
    const trimmed = promptValue.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    return { chars: promptValue.length, words };
  }, [promptValue]);

  const refreshFiles = useCallback(async (agentId: string, soft?: boolean) => {
    if (soft) setFilesRefreshing(true);
    else setFilesLoading(true);
    setFilesError(null);
    try {
      const fls = await api.get<KnowledgeFile[]>("/files/" + agentId);
      setFiles(fls.data);
    } catch (err) {
      console.error(err);
      setFiles([]);
      setFilesError("Não foi possível carregar os arquivos da base.");
    } finally {
      setFilesLoading(false);
      setFilesRefreshing(false);
    }
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const cfg = await api.get<AgentConfig>("/agent/config");
      setAgent(cfg.data);
      setError(null);
      setLoading(false);
      void refreshFiles(cfg.data.id);
    } catch (err) {
      setError("Não foi possível carregar as configurações");
      console.error(err);
      setAgent(null);
      setLoading(false);
    }
  }, [refreshFiles]);

  useEffect(() => {
    let active = true;
    const fetchLoad = async () => {
      await load();
      if (!active) return;
    };
    void fetchLoad();
    return () => {
      active = false;
    };
  }, [load]);

  const upload = async (file: File) => {
    if (!agent) return;
    setUploading(true);
    setFilesError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/files/${agent.id}/upload`, fd);
      await refreshFiles(agent.id, true);
      addToast("Arquivo enviado com sucesso", "success");
    } catch (err) {
      setFilesError("Falha ao enviar arquivo. Tente novamente.");
      addToast("Erro ao enviar arquivo", "error");
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    if (!agent) return;
    if (!window.confirm("Excluir este arquivo da base de conhecimento?")) return;
    try {
      await api.delete(`/files/${id}`);
      await refreshFiles(agent.id, true);
      addToast("Arquivo removido", "success");
    } catch (err) {
      setFilesError("Não foi possível remover o arquivo.");
      addToast("Erro ao remover arquivo", "error");
      console.error(err);
    }
  };

  const savePrompt = async () => {
    if (!agent) return;
    setSaving(true);
    try {
      await api.put("/agent/config", { systemPrompt: agent.systemPrompt });
      addToast("Prompt salvo com sucesso", "success");
    } catch (err) {
      addToast("Erro ao salvar prompt", "error");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !agent) {
    return <AgentSkeleton />;
  }

  if (error || !agent) {
    return (
      <InlineAlert tone="danger" icon={<AlertCircle size={18} aria-hidden="true" />} title="Erro ao carregar configurações">
        <div className="space-y-3">
          <p>{error || "Dados não disponíveis"}</p>
          <Button variant="secondary" size="sm" onClick={() => void load()}>Tente novamente</Button>
        </div>
      </InlineAlert>
    );
  }

  return (
    <div className="space-y-6">
      <Toolbar aria-label="Resumo do agente">
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              <StatusDot tone={promptValue.trim() ? "success" : "warning"} pulse={Boolean(promptValue.trim())} />
              Prompt {promptValue.trim() ? "configurado" : "vazio"}
            </span>
            <span>{promptStats.words} palavras</span>
            <span>{files.length} arquivos</span>
          </div>
          <Button onClick={() => void savePrompt()} disabled={saving} loading={saving} className="w-full sm:w-auto">
            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
            Salvar prompt
          </Button>
        </div>
      </Toolbar>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Section title="Editor do agente" description="Prompt do sistema usado para orientar respostas e comportamento.">
          <Panel className="flex min-h-[34rem] flex-col overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/45 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-slate-50">
                <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                Prompt do sistema
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">{promptStats.chars} caracteres</div>
            </div>
            <label className="sr-only" htmlFor="system-prompt">Prompt do sistema</label>
            <textarea
              id="system-prompt"
              value={promptValue}
              onChange={(e) => setAgent({ ...agent, systemPrompt: e.target.value })}
              className="min-h-[28rem] flex-1 resize-none border-0 bg-white px-4 py-4 font-mono text-sm leading-6 text-slate-950 outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 dark:bg-slate-900 dark:text-slate-100"
              placeholder="Defina tom, limites, contexto do negócio e regras de atendimento do agente."
            />
          </Panel>
        </Section>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Section
            title="Base de conhecimento"
            description="Arquivos usados como contexto do agente."
            actions={
              <Button variant="ghost" size="sm" onClick={() => void refreshFiles(agent.id, true)} disabled={filesRefreshing || filesLoading}>
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                Atualizar
              </Button>
            }
          >
            <Panel className={`p-4 transition-opacity duration-200 ${filesRefreshing ? "opacity-70" : ""}`}>
              <label
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition-colors duration-200 hover:border-emerald-400 hover:bg-emerald-50/50 focus-within:border-emerald-500 dark:border-slate-700 dark:bg-slate-950/45 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/20"
              >
                <input
                  type="file"
                  accept={accept}
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file);
                    e.currentTarget.value = "";
                  }}
                  disabled={uploading}
                />
                <span className="rounded-lg bg-white p-3 text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                  <Upload className={`h-5 w-5 ${uploading ? "motion-safe:animate-pulse" : ""}`} aria-hidden="true" />
                </span>
                <span className="mt-3 text-sm font-semibold text-slate-950 dark:text-slate-50">
                  {uploading ? "Enviando arquivo" : "Adicionar conhecimento"}
                </span>
                <span className="mt-1 text-xs text-slate-600 dark:text-slate-400">PDF, DOCX, TXT, JSON e imagens até 10MB</span>
              </label>

              {filesError && (
                <InlineAlert tone="warning" className="mt-4" icon={<AlertCircle size={16} aria-hidden="true" />}>
                  {filesError}
                </InlineAlert>
              )}

              <div className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                {filesLoading && (
                  <div className="space-y-2" aria-busy="true">
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                  </div>
                )}

                {!filesLoading && files.length === 0 && !filesError && (
                  <EmptyState
                    icon={<FileText size={22} aria-hidden="true" />}
                    title="Nenhum arquivo indexado"
                    description="Envie documentos para ampliar o contexto do agente."
                    className="py-8"
                  />
                )}

                {!filesLoading && files.map((file) => (
                  <div key={file.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="shrink-0 rounded-lg bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <FileText className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{file.filename}</p>
                        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{fileKind(file)} · {formatDate(file.createdAt)}</p>
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => void remove(file.id)} aria-label={`Excluir ${file.filename}`}>
                      <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
            </Panel>
          </Section>
        </aside>
      </div>
    </div>
  );
}
