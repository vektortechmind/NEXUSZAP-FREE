import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bot,
  Check,
  MessageCircle,
  Plus,
  Power,
  QrCode,
  RefreshCw,
  Save,
  Send,
  Smartphone,
  Square,
  Trash2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { InlineAlert } from "../components/ui/InlineAlert";
import { Panel } from "../components/ui/Panel";
import { Section } from "../components/ui/Section";
import { Skeleton } from "../components/ui/Skeleton";
import { StatusDot } from "../components/ui/StatusDot";
import { Toolbar } from "../components/ui/Toolbar";
import { useToast } from "../contexts/ToastContext";
import { api } from "../lib/axios";

type InstanceStatus = {
  id: string;
  slot: number;
  name: string;
  status: string;
  qr: string | null;
  active: boolean;
  connected: boolean;
  available: boolean;
  occupied: boolean;
  agent: { id: string; name: string } | null;
  aiWhatsappEnabled: boolean;
  chatProvider: "groq" | "gemini" | "openrouter" | null;
  openrouterModel: string | null;
  memoryLimit: number;
  providerFallback: boolean;
  providerFallbackLabel: string | null;
  modelFallback: boolean;
  modelFallbackLabel: string | null;
};

type RuntimeProviderOption = {
  id: "groq" | "gemini" | "openrouter";
  label: string;
  supportsModel: boolean;
  defaultModel?: string;
};

type RuntimeOptionsResponse = {
  providers: RuntimeProviderOption[];
  defaults: {
    memoryLimit: number;
  };
};

type InstanceRuntimeDraft = {
  chatProvider: "groq" | "gemini" | "openrouter" | "";
  openrouterModel: string;
  memoryLimit: number;
};

type PrimaryAgentStatus = {
  id: string;
  slot: number;
  name: string;
  status: string;
  qr: string | null;
  active: boolean;
  aiWhatsappEnabled: boolean;
  aiTelegramEnabled: boolean;
  telegram?: {
    online: boolean;
    label: string | null;
  };
};

type TelegramStatus = {
  configured: boolean;
  online: boolean;
  label: string | null;
  instanceId?: string;
};

type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

function statusText(status: string) {
  switch (status) {
    case "CONNECTED":
      return "Conectado";
    case "DISCONNECTED":
      return "Desconectado";
    case "RECONNECTING":
      return "Reconectando";
    default:
      return status || "Indefinido";
  }
}

function statusTone(status: string): StatusTone {
  switch (status) {
    case "CONNECTED":
      return "success";
    case "RECONNECTING":
      return "warning";
    case "DISCONNECTED":
      return "danger";
    default:
      return "neutral";
  }
}

function availabilityLabel(instance: InstanceStatus) {
  if (instance.occupied) return "Ocupada";
  if (instance.connected) return "Disponível";
  if (instance.status === "RECONNECTING") return "Reconectando";
  return "Inativa";
}

function availabilityTone(instance: InstanceStatus): StatusTone {
  if (instance.occupied) return "warning";
  if (instance.connected) return "info";
  if (instance.status === "RECONNECTING") return "warning";
  return "neutral";
}

function availabilityDetail(instance: InstanceStatus) {
  if (instance.occupied && instance.agent) {
    return `Vinculada ao agente ${instance.agent.name}.`;
  }
  if (instance.connected) {
    return "Conectada e livre para vínculo operacional.";
  }
  if (instance.status === "RECONNECTING") {
    return "Tentando restaurar a conexão do canal.";
  }
  return "Ainda não está pronta para uso operacional.";
}

function StatusPill({ tone, label, pulse }: { tone: StatusTone; label: string; pulse?: boolean }) {
  return (
    <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
      <StatusDot tone={tone} pulse={pulse} />
      {label}
    </span>
  );
}

function InstanceSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-24" />
      <div className="grid gap-5 xl:grid-cols-3">
        <Skeleton className="h-[23rem]" />
        <Skeleton className="h-[23rem]" />
        <Skeleton className="h-[23rem]" />
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

function TelegramTokenField({
  token,
  savingToken,
  onChange,
  onSave,
}: {
  token: string;
  savingToken: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="grid gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        <span className="mb-1.5 block">Token do bot</span>
        <input
          type="password"
          value={token}
          onChange={(e) => onChange(e.target.value)}
          placeholder="123456789:ABCdef..."
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </label>
      <div className="flex justify-end">
        <Button onClick={onSave} disabled={!token.trim() || savingToken} loading={savingToken} className="w-full sm:w-auto">
          <Save className="mr-2 h-4 w-4" aria-hidden="true" />
          Salvar token
        </Button>
      </div>
    </div>
  );
}

export function Instancia() {
  const [instances, setInstances] = useState<InstanceStatus[]>([]);
  const [runtimeOptions, setRuntimeOptions] = useState<RuntimeOptionsResponse | null>(null);
  const [runtimeDrafts, setRuntimeDrafts] = useState<Record<string, InstanceRuntimeDraft>>({});
  const [primaryAgent, setPrimaryAgent] = useState<PrimaryAgentStatus | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyInstanceId, setBusyInstanceId] = useState<string | null>(null);
  const [telegramBusy, setTelegramBusy] = useState(false);
  const [showTelegramToken, setShowTelegramToken] = useState(false);
  const [token, setToken] = useState("");
  const [savingToken, setSavingToken] = useState(false);
  const { addToast } = useToast();

  const loadData = useCallback(async () => {
    try {
      const statusRes = await api.get<PrimaryAgentStatus>("/agent/status");
      const [instancesRes, telegramRes, runtimeOptionsRes] = await Promise.all([
        api.get<InstanceStatus[]>("/agent/instances"),
        api.get<TelegramStatus>("/agent/telegram/status").catch(() => ({
          data: { configured: false, online: false, label: null } as TelegramStatus,
        })),
        api.get<RuntimeOptionsResponse>("/agent/instances/runtime-options").catch(() => ({
          data: {
            providers: [
              { id: "groq", label: "Groq", supportsModel: false },
              { id: "gemini", label: "Google Gemini", supportsModel: false },
              { id: "openrouter", label: "OpenRouter", supportsModel: true },
            ],
            defaults: { memoryLimit: 5 },
          } satisfies RuntimeOptionsResponse,
        })),
      ]);

      setPrimaryAgent(statusRes.data);
      setInstances(instancesRes.data);
      setTelegramStatus(telegramRes.data);
      setRuntimeOptions(runtimeOptionsRes.data);
      setRuntimeDrafts(
        Object.fromEntries(
          instancesRes.data.map((instance) => [
            instance.id,
            {
              chatProvider: instance.chatProvider ?? "",
              openrouterModel: instance.openrouterModel ?? "",
              memoryLimit: instance.memoryLimit,
            },
          ])
        )
      );
      setError(null);
    } catch (err) {
      setError("Não foi possível carregar as instâncias.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      loadData().catch(() => {});
    }, 0);
    const interval = window.setInterval(() => {
      loadData().catch(() => {});
    }, 2500);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadData]);

  const totalConnected = useMemo(
    () => instances.filter((instance) => instance.status === "CONNECTED").length,
    [instances]
  );
  const totalAvailable = useMemo(
    () => instances.filter((instance) => instance.available).length,
    [instances]
  );
  const hasCapacity = instances.length < 3;
  const telegramConfigured = Boolean(telegramStatus?.configured);
  const telegramOnline = Boolean(telegramStatus?.online);

  const updateDraft = (instanceId: string, patch: Partial<InstanceRuntimeDraft>) => {
    setRuntimeDrafts((current) => ({
      ...current,
      [instanceId]: {
        chatProvider: current[instanceId]?.chatProvider ?? "",
        openrouterModel: current[instanceId]?.openrouterModel ?? "",
        memoryLimit: current[instanceId]?.memoryLimit ?? runtimeOptions?.defaults.memoryLimit ?? 5,
        ...patch,
      },
    }));
  };

  const handleCreateInstance = async () => {
    const name = createName.trim();
    if (!name) return;

    setCreating(true);
    try {
      await api.post("/agent/instances", { name });
      setCreateName("");
      addToast("Instância criada", "success");
      await loadData();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      addToast(errorObj?.response?.data?.error || "Erro ao criar instância", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleInstanceToggle = async (instance: InstanceStatus) => {
    setBusyInstanceId(instance.id);
    try {
      if (instance.status === "CONNECTED") {
        await api.post(`/agent/instances/${instance.id}/stop`);
        addToast(`Instância ${instance.name} desconectada`, "success");
      } else {
        await api.post(`/agent/instances/${instance.id}/start`);
        addToast(`Conectando ${instance.name}...`, "info");
      }
      await loadData();
    } catch {
      addToast("Erro ao alterar o estado da instância", "error");
    } finally {
      setBusyInstanceId(null);
    }
  };

  const handleInstanceAiToggle = async (instance: InstanceStatus) => {
    setBusyInstanceId(instance.id);
    try {
      await api.put(`/agent/instances/${instance.id}/config`, {
        aiWhatsappEnabled: !instance.aiWhatsappEnabled,
      });
      addToast(
        !instance.aiWhatsappEnabled
          ? `IA ativada em ${instance.name}`
          : `IA desativada em ${instance.name}`,
        "success"
      );
      await loadData();
    } catch {
      addToast("Erro ao alterar a IA da instância", "error");
    } finally {
      setBusyInstanceId(null);
    }
  };

  const handleSaveRuntime = async (instance: InstanceStatus) => {
    const draft = runtimeDrafts[instance.id];
    if (!draft) return;

    setBusyInstanceId(instance.id);
    try {
      await api.put(`/agent/instances/${instance.id}/config`, {
        chatProvider: draft.chatProvider || null,
        openrouterModel: draft.chatProvider === "openrouter" ? (draft.openrouterModel.trim() || null) : null,
        memoryLimit: draft.memoryLimit,
      });
      addToast(`Runtime salvo em ${instance.name}`, "success");
      await loadData();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      addToast(errorObj?.response?.data?.error || "Erro ao salvar runtime da instância", "error");
    } finally {
      setBusyInstanceId(null);
    }
  };

  const handleTelegramAiToggle = async () => {
    if (!primaryAgent) return;
    setTelegramBusy(true);
    try {
      await api.put("/agent/config", { aiTelegramEnabled: !primaryAgent.aiTelegramEnabled });
      addToast(
        !primaryAgent.aiTelegramEnabled ? "IA do Telegram ativada" : "IA do Telegram desativada",
        "success"
      );
      await loadData();
    } catch {
      addToast("Erro ao alterar IA do Telegram", "error");
    } finally {
      setTelegramBusy(false);
    }
  };

  const handleSaveToken = async () => {
    if (!token.trim()) return;
    setSavingToken(true);
    try {
      const res = await api.post("/agent/telegram/save-token", { token: token.trim() });
      if (res.data.success) {
        setToken("");
        setShowTelegramToken(false);
        addToast("Token salvo e bot iniciado", "success");
        await loadData();
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      addToast(errorObj?.response?.data?.error || "Erro ao salvar token", "error");
    } finally {
      setSavingToken(false);
    }
  };

  const handleRemoveToken = async () => {
    if (!window.confirm("Remover token do Telegram desta instância?")) return;

    setTelegramBusy(true);
    try {
      await api.delete("/agent/telegram/token");
      setShowTelegramToken(false);
      addToast("Token removido", "success");
      await loadData();
    } catch {
      addToast("Erro ao remover token", "error");
    } finally {
      setTelegramBusy(false);
    }
  };

  if (loading && !primaryAgent) {
    return <InstanceSkeleton />;
  }

  if (error || !primaryAgent) {
    return (
      <InlineAlert tone="danger" icon={<AlertCircle size={18} aria-hidden="true" />} title="Erro ao carregar instâncias">
        <div className="space-y-3">
          <p>{error || "Dados não disponíveis"}</p>
          <Button variant="secondary" size="sm" onClick={() => void loadData()}>
            Tente novamente
          </Button>
        </div>
      </InlineAlert>
    );
  }

  return (
    <div className="space-y-6">
      <Toolbar aria-label="Resumo das instâncias">
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="info" label={`${instances.length}/3 instâncias WhatsApp`} />
              <StatusPill tone={totalConnected > 0 ? "success" : "neutral"} pulse={totalConnected > 0} label={`${totalConnected} conectadas`} />
              <StatusPill tone={totalAvailable > 0 ? "info" : "neutral"} label={`${totalAvailable} disponíveis`} />
              <StatusPill tone={telegramOnline ? "info" : telegramConfigured ? "danger" : "neutral"} pulse={telegramOnline} label={telegramConfigured ? `Telegram ${telegramOnline ? "online" : "offline"}` : "Telegram sem token"} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">Instâncias independentes por card</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Crie até três instâncias WhatsApp, conecte cada canal por card e mantenha o Telegram em um bloco fixo separado.</p>
            </div>
          </div>
          <div className="grid w-full gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/85 lg:w-[26rem]">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              <span className="mb-1.5 block">Nova instância WhatsApp</span>
              <input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                maxLength={80}
                placeholder="Ex.: Vendas, Suporte, Operação"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {hasCapacity ? `Ainda há ${3 - instances.length} slot${3 - instances.length === 1 ? "" : "s"} livre${3 - instances.length === 1 ? "" : "s"}.` : "Limite de 3 instâncias atingido."}
              </p>
              <Button onClick={() => void handleCreateInstance()} disabled={!createName.trim() || !hasCapacity || creating} loading={creating} className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Criar instância
              </Button>
            </div>
          </div>
        </div>
      </Toolbar>

      <Section title="WhatsApp" description="Cada instância tem conexão, QR e IA próprios.">
        <div className="grid gap-5 xl:grid-cols-3">
          {instances.map((instance) => {
            const busy = busyInstanceId === instance.id;
            const isConnected = instance.status === "CONNECTED";

            return (
              <Panel key={instance.id} className="overflow-hidden">
                <div className="border-b border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/35">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                          Slot {instance.slot}
                        </span>
                        <StatusPill tone={statusTone(instance.status)} pulse={isConnected} label={statusText(instance.status)} />
                        <StatusPill tone={availabilityTone(instance)} label={availabilityLabel(instance)} pulse={instance.available} />
                      </div>
                      <h2 className="mt-3 truncate text-lg font-semibold text-slate-950 dark:text-slate-50">{instance.name}</h2>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{availabilityDetail(instance)}</p>
                      <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">ID {instance.id}</p>
                    </div>
                    <div className="rounded-xl bg-white p-2 text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800">
                      <MessageCircle size={18} aria-hidden="true" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-4">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/45">
                    <div>
                      <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">IA do WhatsApp</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {instance.aiWhatsappEnabled ? "Ativa nesta instância" : "Desativada nesta instância"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={instance.aiWhatsappEnabled ? "danger" : "secondary"}
                      onClick={() => void handleInstanceAiToggle(instance)}
                      disabled={busy}
                      className="min-w-0 px-3"
                    >
                      <Bot className="mr-2 h-4 w-4" aria-hidden="true" />
                      <span className="hidden sm:inline">{instance.aiWhatsappEnabled ? "Desativar" : "Ativar"}</span>
                      <span className="sm:hidden">IA</span>
                    </Button>
                  </div>

                  <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/30">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">Runtime de IA</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Provider atual: {instance.chatProvider ? instance.chatProvider : "fallback automático"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleSaveRuntime(instance)}
                        disabled={busy || !runtimeDrafts[instance.id]}
                        loading={busy}
                        className="min-w-0 px-3"
                      >
                        <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                        Salvar
                      </Button>
                    </div>

                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      <span className="mb-1.5 block">Provedor de IA</span>
                      <select
                        value={runtimeDrafts[instance.id]?.chatProvider ?? ""}
                        onChange={(event) => updateDraft(instance.id, { chatProvider: event.target.value as InstanceRuntimeDraft["chatProvider"] })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        <option value="">Fallback automático</option>
                        {(runtimeOptions?.providers ?? []).map((provider) => (
                          <option key={provider.id} value={provider.id}>{provider.label}</option>
                        ))}
                      </select>
                    </label>

                    {runtimeDrafts[instance.id]?.chatProvider === "openrouter" && (
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        <span className="mb-1.5 block">Modelo OpenRouter</span>
                        <input
                          value={runtimeDrafts[instance.id]?.openrouterModel ?? ""}
                          onChange={(event) => updateDraft(instance.id, { openrouterModel: event.target.value })}
                          placeholder="meta-llama/llama-3-8b-instruct:free"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </label>
                    )}

                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      <span className="mb-1.5 block">Memória recente</span>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={runtimeDrafts[instance.id]?.memoryLimit ?? runtimeOptions?.defaults.memoryLimit ?? 5}
                        onChange={(event) => updateDraft(instance.id, { memoryLimit: Number(event.target.value) })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>

                    <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                      <p>Quantidade de mensagens recentes de usuário e assistente enviadas ao provider em ordem cronológica.</p>
                      {instance.providerFallbackLabel ? (
                        <InlineAlert tone="info" icon={<RefreshCw size={14} aria-hidden="true" />}>
                          {instance.providerFallbackLabel}
                        </InlineAlert>
                      ) : null}
                      {instance.modelFallbackLabel ? (
                        <InlineAlert tone="info" icon={<RefreshCw size={14} aria-hidden="true" />}>
                          {instance.modelFallbackLabel}
                        </InlineAlert>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/30">
                    {isConnected ? (
                      <EmptyState
                        icon={<Smartphone size={22} aria-hidden="true" />}
                        title="Instância conectada"
                        description="Pareamento ativo e pronto para receber mensagens."
                        className="border-emerald-200 bg-emerald-50 dark:border-emerald-900/70 dark:bg-emerald-950/25"
                      />
                    ) : instance.qr ? (
                      <div className="space-y-4 text-center">
                        <div className="mx-auto flex max-w-[15rem] justify-center rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800">
                          <QRCodeSVG value={instance.qr} level="M" includeMargin size={188} bgColor="#ffffff" fgColor="#000000" />
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Abra o WhatsApp, entre em <span className="font-medium text-slate-900 dark:text-slate-100">Aparelhos conectados</span> e escaneie o QR.
                        </p>
                      </div>
                    ) : (
                      <EmptyState
                        icon={<QrCode size={22} aria-hidden="true" />}
                        title="Aguardando pareamento"
                        description="Use Conectar para gerar um QR Code desta instância."
                      />
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={() => void handleInstanceToggle(instance)}
                      disabled={busy}
                      loading={busy}
                      variant={isConnected ? "danger" : "primary"}
                      className="w-full sm:w-auto"
                    >
                      {isConnected ? <Square className="mr-2 h-4 w-4" aria-hidden="true" /> : <Power className="mr-2 h-4 w-4" aria-hidden="true" />}
                      {isConnected ? "Desconectar" : "Conectar"}
                    </Button>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      </Section>

      <Section title="Telegram" description="Canal único, fixo e separado do limite de instâncias WhatsApp.">
        <Panel className="overflow-hidden">
          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white dark:bg-blue-500 dark:text-slate-950">
                      Telegram Fixo
                    </span>
                    <StatusPill tone={telegramOnline ? "info" : telegramConfigured ? "danger" : "neutral"} pulse={telegramOnline} label={telegramConfigured ? (telegramOnline ? "Online" : "Offline") : "Sem token"} />
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-slate-950 dark:text-slate-50">Canal Telegram</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {telegramConfigured ? telegramStatus?.label || "Bot configurado" : "Configure o token apenas quando decidir ativar o canal."}
                  </p>
                </div>
                <div className="rounded-xl bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/35 dark:text-blue-300">
                  <Send size={18} aria-hidden="true" />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/45">
                <div>
                  <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">IA do Telegram</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {primaryAgent.aiTelegramEnabled ? "Ativa no canal Telegram" : "Desativada no canal Telegram"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={primaryAgent.aiTelegramEnabled ? "danger" : "secondary"}
                  onClick={() => void handleTelegramAiToggle()}
                  disabled={telegramBusy || !telegramConfigured}
                  className="min-w-0 px-3"
                >
                  <Bot className="mr-2 h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{primaryAgent.aiTelegramEnabled ? "Desativar" : "Ativar"}</span>
                  <span className="sm:hidden">IA</span>
                </Button>
              </div>

              {showTelegramToken && !telegramConfigured ? (
                <TelegramTokenField
                  token={token}
                  savingToken={savingToken}
                  onChange={setToken}
                  onSave={() => void handleSaveToken()}
                />
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              {telegramConfigured ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/35 dark:text-blue-300">
                      <Check size={18} aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">Token configurado</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">O bot está vinculado ao canal Telegram fixo.</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant="secondary" onClick={() => setShowTelegramToken((value) => !value)}>
                      <Power className="mr-2 h-4 w-4" aria-hidden="true" />
                      {showTelegramToken ? "Ocultar token" : "Atualizar token"}
                    </Button>
                    <Button variant="danger" onClick={() => void handleRemoveToken()} disabled={telegramBusy}>
                      <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                      Remover token
                    </Button>
                  </div>
                  {showTelegramToken ? (
                    <TelegramTokenField
                      token={token}
                      savingToken={savingToken}
                      onChange={setToken}
                      onSave={() => void handleSaveToken()}
                    />
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                  <EmptyState
                    icon={<Send size={22} aria-hidden="true" />}
                    title="Telegram ainda não configurado"
                    description="O campo de token só aparece quando você iniciar a configuração do canal."
                  />
                  <Button variant="primary" onClick={() => setShowTelegramToken((value) => !value)}>
                    <Power className="mr-2 h-4 w-4" aria-hidden="true" />
                    {showTelegramToken ? "Ocultar configuração" : "Conectar Telegram"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Panel>
      </Section>
    </div>
  );
}
