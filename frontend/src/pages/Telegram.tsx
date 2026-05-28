import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/axios";
import { Upload, FileText, Trash2, MessageSquareText, Sparkles, Save, AlertCircle } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useToast } from "../contexts/ToastContext";

type TelegramConfig = {
  id: string;
  telegramSystemPrompt: string | null;
};

type KnowledgeFile = {
  id: string;
  filename: string;
  mimetype: string;
  createdAt: string;
};

export function Telegram() {
  const [cfg, setCfg] = useState<TelegramConfig | null>(null);
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesRefreshing, setFilesRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { addToast } = useToast();

  const accept = useMemo(() => ".pdf,.png,.jpg,.jpeg,.webp,.txt,.docx,.json", []);

  const refreshFiles = useCallback(async (instanceId: string, soft?: boolean) => {
    if (soft) setFilesRefreshing(true);
    else setFilesLoading(true);
    try {
      const fls = await api.get("/telegram-files/" + instanceId);
      setFiles(fls.data);
    } catch (err) {
      console.error(err);
      setFiles([]);
    } finally {
      setFilesLoading(false);
      setFilesRefreshing(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const agent = await api.get("/agent/config");
      setCfg({
        id: agent.data.id,
        telegramSystemPrompt: agent.data.telegramSystemPrompt ?? null
      });
      setLoading(false);
      void refreshFiles(agent.data.id);
    } catch (err) {
      setError("Não foi possível carregar as configurações do Telegram");
      console.error(err);
      setCfg(null);
      setLoading(false);
    }
  }, [refreshFiles]);

  useEffect(() => {
    let mounted = true;
    const fetchLoad = async () => {
      await load();
      if (!mounted) return;
    };
    void fetchLoad();
    return () => { mounted = false; };
  }, [load]);

  const upload = async (file: File) => {
    if (!cfg) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/telegram-files/${cfg.id}/upload`, fd);
      await refreshFiles(cfg.id, true);
      addToast("Arquivo enviado com sucesso", "success");
    } catch (err) {
      addToast("Erro ao enviar arquivo", "error");
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    if (!cfg) return;
    if (!confirm("Excluir este arquivo da base do Telegram?")) return;
    try {
      await api.delete(`/telegram-files/${id}`);
      await refreshFiles(cfg.id, true);
      addToast("Arquivo removido", "success");
    } catch (err) {
      addToast("Erro ao remover arquivo", "error");
      console.error(err);
    }
  };

  const savePrompt = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      await api.put("/agent/config", { telegramSystemPrompt: cfg.telegramSystemPrompt });
      addToast("Configuração do Telegram salva", "success");
    } catch (err) {
      addToast("Erro ao salvar configuração", "error");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !cfg) {
    return (
      <div className="space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
              Telegram
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Personalidade da IA (Telegram)
          </h1>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 h-[min(28rem,60vh)] rounded-lg bg-gray-200 dark:bg-slate-700 animate-pulse" />
          <div className="lg:col-span-2 h-[min(28rem,60vh)] rounded-lg bg-gray-200 dark:bg-slate-700 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !cfg) {
    return (
      <Card className="p-8">
        <div className="flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900 dark:text-red-300 mb-1">
              Erro ao carregar configurações
            </h3>
            <p className="text-sm text-red-700 dark:text-red-400 mb-4">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              Tente novamente
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">Telegram</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Personalidade da IA (Telegram)
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Configure o comportamento e a base de conhecimento exclusiva do Telegram
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center">
                <MessageSquareText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Prompt do Sistema (Telegram)
              </h2>
            </div>
            <Button onClick={() => void savePrompt()} disabled={saving} loading={saving} size="sm">
              <Save className="w-4 h-4 mr-2" />
              Salvar
            </Button>
          </div>

          <div className="flex-1 flex flex-col min-h-[400px]">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-3">
              Instruções de Personalidade
            </label>
            <textarea
              value={cfg.telegramSystemPrompt ?? ""}
              onChange={(e) => setCfg({ ...cfg, telegramSystemPrompt: e.target.value })}
              className="flex-1 w-full rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 text-sm font-mono text-slate-900 backdrop-blur-xl resize-none transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/80 focus:border-blue-400/80 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.12)] dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-100"
              placeholder="Digite as instruções de personalidade para o bot do Telegram..."
            />
          </div>
        </Card>

        <Card
          className={`lg:col-span-2 flex flex-col relative transition-opacity duration-150 ${
            filesRefreshing ? "opacity-70 pointer-events-none" : ""
          }`}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Base de Conhecimento (Telegram)
            </h2>
          </div>

          <div className="space-y-4 flex-1">
            <input
              type="file"
              accept={accept}
              id="telegram-kb-upload"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.currentTarget.value = "";
              }}
              disabled={uploading}
            />
            <label
              htmlFor="telegram-kb-upload"
              className="group block cursor-pointer rounded-2xl border-2 border-dashed border-slate-300/90 bg-white/65 p-6 text-center backdrop-blur-xl transition-all hover:border-blue-400 dark:border-slate-700 dark:bg-slate-800/45 dark:hover:border-blue-500 dark:hover:bg-slate-800/70"
            >
              <div className="flex flex-col items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center group-hover:scale-110 transition-transform ${
                    uploading ? "animate-pulse" : ""
                  }`}
                >
                  <Upload
                    className={`w-5 h-5 ${
                      uploading ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"
                    }`}
                  />
                </div>
                <div>
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100 block">
                    {uploading ? "Enviando arquivo..." : "Upload de Conhecimento"}
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    PDF, DOCX, TXT, JSON, PNG, JPG, WEBP
                  </p>
                </div>
              </div>
            </label>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {filesLoading && (
                <div className="space-y-2 py-1" aria-busy="true">
                  <div className="h-14 rounded-lg bg-gray-200/80 dark:bg-slate-700/80 animate-pulse" />
                  <div className="h-14 rounded-lg bg-gray-200/80 dark:bg-slate-700/80 animate-pulse" />
                </div>
              )}
              {!filesLoading &&
                files.map((f) => (
                  <div
                    key={f.id}
                    className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/65 p-3 backdrop-blur-xl transition-all hover:bg-white dark:border-slate-700/80 dark:bg-slate-800/50 dark:hover:bg-slate-800/75"
                  >
                    <div className="min-w-0 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-gray-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      </div>
                      <div className="truncate">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {f.filename}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {f.mimetype.split("/")[1]?.toUpperCase() || "DOC"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void remove(f.id)}
                      className="opacity-0 group-hover:opacity-100 p-2 rounded-md hover:bg-red-100 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 transition-all"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              {!filesLoading && files.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    Nenhum arquivo indexado
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
