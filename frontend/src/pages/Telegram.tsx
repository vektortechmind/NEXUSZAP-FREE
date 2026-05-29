import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/axios";
import { AlertCircle, FileText, RefreshCw, Save, Send, Trash2, Upload } from "lucide-react";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { InlineAlert } from "../components/ui/InlineAlert";
import { Panel } from "../components/ui/Panel";
import { Section } from "../components/ui/Section";
import { Skeleton } from "../components/ui/Skeleton";
import { StatusDot } from "../components/ui/StatusDot";
import { Toolbar } from "../components/ui/Toolbar";
import { useToast } from "../contexts/ToastContext";

type TelegramConfig = {
  instanceId: string | null;
  instanceName: string | null;
  agentWorkspaceId: string | null;
  agentWorkspaceName: string | null;
  telegramSystemPrompt: string | null;
  canEdit: boolean;
  blockingReason: string | null;
};

type KnowledgeFile = {
  id: string;
  filename: string;
  mimetype: string;
  createdAt: string;
};

function TelegramSkeleton() {
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

export function Telegram() {
  const [cfg, setCfg] = useState<TelegramConfig | null>(null);
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
  const promptValue = cfg?.telegramSystemPrompt ?? "";
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
      const fls = await api.get<KnowledgeFile[]>(`/telegram-files/agent/${agentId}`);
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
      const response = await api.get<TelegramConfig>("/agent/telegram/config");
      const nextCfg = response.data;
      setCfg(nextCfg);
      setError(null);
      setLoading(false);
      if (nextCfg.agentWorkspaceId) {
        void refreshFiles(nextCfg.agentWorkspaceId);
      } else {
        setFiles([]);
      }
    } catch (err) {
      setError("Não foi possível carregar as configurações");
      console.error(err);
      setCfg(null);
      setFiles([]);
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
    if (!cfg?.canEdit || !cfg.agentWorkspaceId) {
      addToast(cfg?.blockingReason || "Vincule um agente ao Telegram antes de enviar arquivos.", "error");
      return;
    }
    setUploading(true);
    setFilesError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/telegram-files/agent/${cfg.agentWorkspaceId}/upload`, fd);
      await refreshFiles(cfg.agentWorkspaceId, true);
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
    if (!cfg?.canEdit || !cfg.agentWorkspaceId) {
      addToast(cfg?.blockingReason || "Vincule um agente ao Telegram antes de remover arquivos.", "error");
      return;
    }
    if (!window.confirm("Excluir este arquivo da base de conhecimento do Telegram?")) return;
    try {
      await api.delete(`/telegram-files/${id}`);
      await refreshFiles(cfg.agentWorkspaceId, true);
      addToast("Arquivo removido", "success");
    } catch (err) {
      setFilesError("Não foi possível remover o arquivo.");
      addToast("Erro ao remover arquivo", "error");
      console.error(err);
    }
  };

  const savePrompt = async () => {
    if (!cfg?.canEdit) {
      addToast(cfg?.blockingReason || "Vincule um agente ao Telegram antes de editar o prompt.", "error");
      return;
    }
    setSaving(true);
    try {
      const response = await api.put<TelegramConfig>("/agent/telegram/config", { telegramSystemPrompt: cfg.telegramSystemPrompt });
      setCfg(response.data);
      addToast("Prompt salvo com sucesso", "success");
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      addToast(errorObj?.response?.data?.error || "Erro ao salvar prompt", "error");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !cfg) {
    return <TelegramSkeleton />;
  }

  if (error || !cfg) {
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
      <Toolbar aria-label="Resumo do Telegram">
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              <StatusDot tone={cfg.canEdit && promptValue.trim() ? "info" : "warning"} pulse={Boolean(cfg.canEdit && promptValue.trim())} />
              {cfg.canEdit ? `Prompt ${promptValue.trim() ? "configurado" : "vazio"}` : "Edição bloqueada"}
            </span>
            <span>{promptStats.words} palavras</span>
            <span>{files.length} arquivos</span>
          </div>
          <Button onClick={() => void savePrompt()} disabled={saving || !cfg.canEdit} loading={saving} className="w-full sm:w-auto">
            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
            Salvar prompt
          </Button>
        </div>
      </Toolbar>

      {!cfg.canEdit && cfg.blockingReason ? (
        <InlineAlert tone="warning" icon={<AlertCircle size={16} aria-hidden="true" />}>
          {cfg.blockingReason}
        </InlineAlert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Section title="Editor do Telegram" description="Prompt do sistema usado para orientar respostas e comportamento do canal Telegram.">
          <Panel className="flex min-h-[34rem] flex-col overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/45 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-slate-50">
                <Send className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                Prompt do sistema
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">{promptStats.chars} caracteres</div>
            </div>
            <label className="sr-only" htmlFor="telegram-system-prompt">Prompt do sistema do Telegram</label>
            <textarea
              id="telegram-system-prompt"
              value={promptValue}
              onChange={(e) => setCfg({ ...cfg, telegramSystemPrompt: e.target.value })}
              disabled={!cfg.canEdit}
              className="min-h-[28rem] flex-1 resize-none border-0 bg-white px-4 py-4 font-mono text-sm leading-6 text-slate-950 outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-950 dark:disabled:text-slate-500"
              placeholder="Defina tom, limites, contexto do negócio e regras de atendimento do Telegram."
            />
          </Panel>
        </Section>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Section
            title="Base de conhecimento"
            description="Arquivos usados como contexto do agente no Telegram."
            actions={
              <Button variant="ghost" size="sm" onClick={() => cfg.agentWorkspaceId ? void refreshFiles(cfg.agentWorkspaceId, true) : undefined} disabled={filesRefreshing || filesLoading || !cfg.agentWorkspaceId}>
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                Atualizar
              </Button>
            }
          >
            <Panel className={`p-4 transition-opacity duration-200 ${filesRefreshing ? "opacity-70" : ""}`}>
              <label className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition-colors duration-200 dark:border-slate-700 dark:bg-slate-950/45 ${cfg.canEdit ? "cursor-pointer hover:border-sky-400 hover:bg-sky-50/50 focus-within:border-sky-500 dark:hover:border-sky-700 dark:hover:bg-sky-950/20" : "cursor-not-allowed opacity-70"}`}>
                <input
                  type="file"
                  accept={accept}
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file);
                    e.currentTarget.value = "";
                  }}
                  disabled={uploading || !cfg.canEdit}
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
                    description={cfg.canEdit ? "Envie documentos para ampliar o contexto do Telegram." : "Vincule um agente à instância Telegram para liberar a base de conhecimento do canal."}
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
                    <Button type="button" variant="ghost" size="sm" onClick={() => void remove(file.id)} disabled={!cfg.canEdit} aria-label={`Excluir ${file.filename}`}>
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
