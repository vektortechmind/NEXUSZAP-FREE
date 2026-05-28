import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/axios";
import { AlertCircle, Bot, FileAudio2, FileText, Plus, RefreshCw, Save, Trash2, Upload } from "lucide-react";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { InlineAlert } from "../components/ui/InlineAlert";
import { Panel } from "../components/ui/Panel";
import { Section } from "../components/ui/Section";
import { Skeleton } from "../components/ui/Skeleton";
import { StatusDot } from "../components/ui/StatusDot";
import { Toolbar } from "../components/ui/Toolbar";
import { useToast } from "../contexts/ToastContext";

type AgentSummary = {
  id: string;
  name: string;
  telegramEnabled: boolean;
  voiceEnabled: boolean;
  voiceProvider: "groq" | null;
  voiceModel: string | null;
  voicePersona: string | null;
  voiceModelFallback: boolean;
  createdAt: string;
  instanceId: string;
  instanceName: string;
  instanceSlot: number;
  instanceStatus: string;
  instanceChatProvider: "groq" | "gemini" | "openrouter" | null;
  instanceOpenrouterModel: string | null;
  systemPrompt?: string | null;
};

type AgentWorkspace = AgentSummary & {
  systemPrompt: string | null;
};

type VoiceProviderOption = {
  id: "groq";
  label: string;
  description: string;
  supportsModel: boolean;
  defaultModel: string;
  models: Array<{
    id: string;
    label: string;
    description: string;
  }>;
};

type VoiceOptionsResponse = {
  providers: VoiceProviderOption[];
  defaults: {
    voiceEnabled: boolean;
  };
};

type EligibleInstance = {
  id: string;
  slot: number;
  name: string;
  status: string;
  available: boolean;
  occupied: boolean;
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
      <Skeleton className="h-40" />
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedAgentId = searchParams.get("agentId");
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [agent, setAgent] = useState<AgentWorkspace | null>(null);
  const [eligibleInstances, setEligibleInstances] = useState<EligibleInstance[]>([]);
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [voiceOptions, setVoiceOptions] = useState<VoiceOptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesRefreshing, setFilesRefreshing] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [selectedInstanceId, setSelectedInstanceId] = useState("");
  const { addToast } = useToast();

  const accept = useMemo(() => ".pdf,.png,.jpg,.jpeg,.webp,.txt,.docx,.json", []);
  const promptValue = agent?.systemPrompt ?? "";
  const promptStats = useMemo(() => {
    const trimmed = promptValue.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    return { chars: promptValue.length, words };
  }, [promptValue]);

  const selectedVoiceProvider = useMemo(
    () => voiceOptions?.providers.find((provider) => provider.id === agent?.voiceProvider) ?? null,
    [agent?.voiceProvider, voiceOptions?.providers],
  );

  const voiceProviderLabel = selectedVoiceProvider?.label ?? "Nao configurado";
  const textProviderLabel = agent?.instanceChatProvider ? agent.instanceChatProvider : "fallback automatico";

  const refreshFiles = useCallback(async (agentId: string, soft?: boolean) => {
    if (soft) setFilesRefreshing(true);
    else setFilesLoading(true);
    setFilesError(null);
    try {
      const fls = await api.get<KnowledgeFile[]>(`/files/agent/${agentId}`);
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
      const [agentsRes, eligibleRes, voiceOptionsRes] = await Promise.all([
        api.get<AgentSummary[]>("/agent/agents"),
        api.get<EligibleInstance[]>("/agent/agents/eligible-instances"),
        api.get<VoiceOptionsResponse>("/agent/agents/voice-options"),
      ]);

      setAgents(agentsRes.data);
      setEligibleInstances(eligibleRes.data);
      setVoiceOptions(voiceOptionsRes.data);

      if (!selectedAgentId) {
        setAgent(null);
        setFiles([]);
        if (agentsRes.data.length > 0) {
          navigate(`/agente?agentId=${agentsRes.data[0].id}`, { replace: true });
          return;
        }
        setShowCreate(true);
        return;
      }

      const agentRes = await api.get<AgentWorkspace>(`/agent/agents/${selectedAgentId}`);
      setAgent(agentRes.data);
      void refreshFiles(agentRes.data.id);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar os agentes.");
      setAgent(null);
    } finally {
      setLoading(false);
    }
  }, [navigate, refreshFiles, selectedAgentId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load().catch(() => {});
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const createBlocked = eligibleInstances.length === 0;

  const createAgent = async () => {
    if (!createName.trim() || !selectedInstanceId) return;
    setCreating(true);
    try {
      const res = await api.post<AgentWorkspace>("/agent/agents", {
        name: createName.trim(),
        instanceId: selectedInstanceId,
      });
      setCreateName("");
      setSelectedInstanceId("");
      setShowCreate(false);
      addToast("Agente criado com sucesso", "success");
      navigate(`/agente?agentId=${res.data.id}`);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      addToast(errorObj?.response?.data?.error || "Erro ao criar agente", "error");
    } finally {
      setCreating(false);
    }
  };

  const upload = async (file: File) => {
    if (!agent) return;
    setUploading(true);
    setFilesError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/files/agent/${agent.id}/upload`, fd);
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

  const saveAgentConfig = async () => {
    if (!agent) return;
    setSaving(true);
    try {
      const res = await api.put<AgentWorkspace>(`/agent/agents/${agent.id}`, {
        systemPrompt: agent.systemPrompt,
        voiceEnabled: agent.voiceEnabled,
        voiceProvider: agent.voiceProvider,
        voiceModel: agent.voiceModel,
        voicePersona: agent.voicePersona,
      });
      setAgent(res.data);
      addToast("Configuracao do agente salva com sucesso", "success");
    } catch (err) {
      addToast("Erro ao salvar configuracao do agente", "error");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <AgentSkeleton />;
  }

  if (error) {
    return (
      <InlineAlert tone="danger" icon={<AlertCircle size={18} aria-hidden="true" />} title="Erro ao carregar agentes">
        <div className="space-y-3">
          <p>{error}</p>
          <Button variant="secondary" size="sm" onClick={() => { setLoading(true); void load(); }}>
            Tente novamente
          </Button>
        </div>
      </InlineAlert>
    );
  }

  return (
    <div className="space-y-6">
      <Toolbar aria-label="Ações dos agentes">
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              <StatusDot tone={agents.length > 0 ? "success" : "warning"} pulse={agents.length > 0} />
              {agents.length} agentes criados
            </span>
            <span>{eligibleInstances.length} instâncias elegíveis</span>
            {agent ? <span>Canal: {agent.instanceName}</span> : <span>Crie um agente para iniciar</span>}
          </div>
          <Button onClick={() => setShowCreate((value) => !value)} className="w-full sm:w-auto" variant={showCreate ? "secondary" : "primary"}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            {showCreate ? "Ocultar criação" : "Criar agente"}
          </Button>
        </div>
      </Toolbar>

      {showCreate && (
        <Section title="Criar agente" description="Selecione apenas instâncias conectadas e ainda livres.">
          <Panel className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              <span className="mb-1.5 block">Nome do agente</span>
              <input
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                maxLength={80}
                placeholder="Ex.: Agente Comercial"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              <span className="mb-1.5 block">Instância WhatsApp live e livre</span>
              <select
                value={selectedInstanceId}
                onChange={(event) => setSelectedInstanceId(event.target.value)}
                disabled={createBlocked}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Selecione uma instância</option>
                {eligibleInstances.map((instance) => (
                  <option key={instance.id} value={instance.id}>
                    Slot {instance.slot} · {instance.name}
                  </option>
                ))}
              </select>
            </label>
            <Button onClick={() => void createAgent()} disabled={createBlocked || !createName.trim() || !selectedInstanceId || creating} loading={creating} className="w-full lg:w-auto">
              <Bot className="mr-2 h-4 w-4" aria-hidden="true" />
              Salvar agente
            </Button>
          </Panel>
          <div className="mt-3">
            {createBlocked ? (
              <InlineAlert tone="warning" icon={<AlertCircle size={16} aria-hidden="true" />}>
                Nenhuma instância conectada e livre está disponível agora. Conecte uma instância WhatsApp antes de criar o agente.
              </InlineAlert>
            ) : (
              <InlineAlert tone="info" icon={<StatusDot tone="info" />}>
                Telegram nasce pré-definido como capacidade lógica do agente, mas continua singleton operacional da plataforma nesta story.
              </InlineAlert>
            )}
          </div>
        </Section>
      )}

      {agents.length > 0 && (
        <Section title="Agentes" description="Selecione um agente para abrir sua base de conhecimento.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((item) => {
              const active = item.id === agent?.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(`/agente?agentId=${item.id}`)}
                  className={`rounded-xl border p-4 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${active ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/25" : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{item.name}</p>
                    <StatusDot tone={item.instanceStatus === "CONNECTED" ? "success" : item.instanceStatus === "RECONNECTING" ? "warning" : "danger"} pulse={item.instanceStatus === "CONNECTED"} />
                  </div>
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">Slot {item.instanceSlot} · {item.instanceName}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Telegram {item.telegramEnabled ? "pré-definido" : "desativado"}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Voz {item.voiceEnabled && item.voiceProvider ? item.voiceProvider : "desligada"}</p>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {!agent ? (
        <EmptyState
          icon={<Bot size={22} aria-hidden="true" />}
          title="Nenhum agente aberto"
          description={agents.length === 0 ? "Crie o primeiro agente para acessar a base de conhecimento." : "Selecione um agente acima para editar prompt e arquivos."}
          className="py-10"
        />
      ) : (
        <>
          <Toolbar aria-label="Resumo do agente">
            <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                  <StatusDot tone={promptValue.trim() ? "success" : "warning"} pulse={Boolean(promptValue.trim())} />
                  Prompt {promptValue.trim() ? "configurado" : "vazio"}
                </span>
                <span>{promptStats.words} palavras</span>
                <span>{files.length} arquivos</span>
                <span>Instância {agent.instanceName}</span>
                <span>Texto: {textProviderLabel}</span>
                <span>Voz: {agent.voiceEnabled ? voiceProviderLabel : "desligada"}</span>
              </div>
              <Button onClick={() => void saveAgentConfig()} disabled={saving} loading={saving} className="w-full sm:w-auto">
                <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                Salvar agente
              </Button>
            </div>
          </Toolbar>

          <Section
            title="Voz do agente"
            description="Esta camada e logica do agente. O provider textual continua na instancia WhatsApp vinculada."
          >
            <Panel className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
                <div className="flex items-center gap-2 font-semibold">
                  <FileAudio2 className="h-4 w-4" aria-hidden="true" />
                  Separacao operacional
                </div>
                <p className="mt-2">Texto da instancia: <span className="font-semibold">{textProviderLabel}</span>{agent.instanceOpenrouterModel ? ` · modelo ${agent.instanceOpenrouterModel}` : ""}</p>
                <p className="mt-1">Voz do agente: <span className="font-semibold">{agent.voiceEnabled ? voiceProviderLabel : "desligada"}</span>{agent.voiceEnabled && agent.voiceModel ? ` · modelo ${agent.voiceModel}` : ""}</p>
                <p className="mt-2 text-xs opacity-80">Audio recebido usa a configuracao de voz do agente quando ativada. Mensagens de texto continuam usando o provider configurado na instancia.</p>
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={agent.voiceEnabled}
                  onChange={(event) => setAgent({ ...agent, voiceEnabled: event.target.checked, voiceProvider: event.target.checked ? (agent.voiceProvider ?? voiceOptions?.providers[0]?.id ?? null) : agent.voiceProvider, voiceModel: event.target.checked ? (agent.voiceModel ?? voiceOptions?.providers[0]?.defaultModel ?? null) : agent.voiceModel })}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>
                  <span className="block font-semibold text-slate-950 dark:text-slate-50">Ativar voz por agente</span>
                  <span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">Quando desligado, o projeto continua no fluxo padrao de audio/transcricao da instancia.</span>
                </span>
              </label>

              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                <span className="mb-1.5 block">Provider de voz</span>
                <select
                  value={agent.voiceProvider ?? ""}
                  onChange={(event) => {
                    const nextProvider = event.target.value === "" ? null : (event.target.value as AgentWorkspace["voiceProvider"]);
                    const providerMeta = voiceOptions?.providers.find((provider) => provider.id === nextProvider) ?? null;
                    setAgent({
                      ...agent,
                      voiceProvider: nextProvider,
                      voiceModel: providerMeta?.defaultModel ?? null,
                    });
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="">Selecione um provider</option>
                  {(voiceOptions?.providers ?? []).map((provider) => (
                    <option key={provider.id} value={provider.id}>{provider.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Catalogo de voz independente do provider textual da instancia.</p>
              </label>

              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                <span className="mb-1.5 block">Modelo de voz</span>
                <select
                  value={agent.voiceModel ?? ""}
                  onChange={(event) => setAgent({ ...agent, voiceModel: event.target.value === "" ? null : event.target.value })}
                  disabled={!selectedVoiceProvider}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="">Selecione um modelo</option>
                  {(selectedVoiceProvider?.models ?? []).map((model) => (
                    <option key={model.id} value={model.id}>{model.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {selectedVoiceProvider?.description ?? "Selecione um provider para ver os modelos disponiveis."}
                </p>
                {agent.voiceModelFallback && (
                  <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">O modelo salvo anterior caiu para o default suportado do provider.</p>
                )}
              </label>

              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 lg:col-span-2">
                <span className="mb-1.5 block">Persona de voz</span>
                <textarea
                  value={agent.voicePersona ?? ""}
                  onChange={(event) => setAgent({ ...agent, voicePersona: event.target.value })}
                  maxLength={280}
                  rows={4}
                  placeholder="Ex.: Voz objetiva, acolhedora e profissional para respostas em audio e operacao futura de voz do agente."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <div className="mt-1 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>Identidade operacional de voz do agente, separada do prompt textual da instancia.</span>
                  <span>{(agent.voicePersona ?? "").length}/280</span>
                </div>
              </label>
            </Panel>
          </Section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <Section title={agent.name} description="Base de conhecimento e comportamento do agente vinculado à instância selecionada.">
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
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition-colors duration-200 hover:border-emerald-400 hover:bg-emerald-50/50 focus-within:border-emerald-500 dark:border-slate-700 dark:bg-slate-950/45 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/20">
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
        </>
      )}
    </div>
  );
}
