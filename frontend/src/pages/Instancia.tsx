import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/axios";
import { AlertCircle, Bot, Check, MessageCircle, Play, QrCode, Save, Send, Smartphone, Square, Trash2 } from "lucide-react";
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

type Status = {
  id: string;
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

type ChannelView = {
  key: "whatsapp" | "telegram";
  icon: React.ReactNode;
  name: string;
  status: string;
  tone: StatusTone;
  detail: string;
  aiEnabled: boolean;
  disabled: boolean;
};

function statusText(status: string) {
  switch (status) {
    case "CONNECTED": return "Conectado";
    case "DISCONNECTED": return "Desconectado";
    case "RECONNECTING": return "Reconectando";
    default: return status || "Indefinido";
  }
}

function statusTone(status: string): StatusTone {
  switch (status) {
    case "CONNECTED": return "success";
    case "RECONNECTING": return "warning";
    case "DISCONNECTED": return "danger";
    default: return "neutral";
  }
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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}

export function Instancia() {
  const [data, setData] = useState<Status | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [token, setToken] = useState("");
  const [savingToken, setSavingToken] = useState(false);
  const { addToast } = useToast();

  const loadStatus = useCallback(async () => {
    try {
      const [statusRes, telegramRes] = await Promise.all([
        api.get<Status>("/agent/status"),
        api.get<TelegramStatus>("/agent/telegram/status").catch(() => ({
          data: { configured: false, online: false, label: null } as TelegramStatus,
        })),
      ]);
      setData(statusRes.data);
      setTelegramStatus(telegramRes.data);
      setError(null);
    } catch (err) {
      setError("Não foi possível carregar o status da instância");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const fetchStatus = async () => {
      await loadStatus();
      if (!active) return;
    };
    void fetchStatus();
    const interval = window.setInterval(() => {
      loadStatus().catch(() => {});
    }, 2500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [loadStatus]);

  const handleToggle = async () => {
    if (!data) return;
    setWorking(true);
    try {
      if (data.status === "CONNECTED") {
        await api.post("/agent/stop");
        addToast("Conexão encerrada", "success");
      } else {
        await api.post("/agent/start");
        addToast("Iniciando conexão...", "info");
      }
      await loadStatus();
    } catch {
      addToast("Erro ao alterar status", "error");
    } finally {
      setWorking(false);
    }
  };

  const handleAiToggle = async (channel: "whatsapp" | "telegram") => {
    if (!data) return;
    setWorking(true);
    try {
      const key = channel === "whatsapp" ? "aiWhatsappEnabled" : "aiTelegramEnabled";
      const nextValue = !data[key];
      await api.put("/agent/config", { [key]: nextValue });
      addToast(
        nextValue
          ? `${channel === "whatsapp" ? "WhatsApp" : "Telegram"}: IA ativada`
          : `${channel === "whatsapp" ? "WhatsApp" : "Telegram"}: IA desativada`,
        "success"
      );
      await loadStatus();
    } catch {
      addToast("Erro ao alterar atendimento com IA", "error");
    } finally {
      setWorking(false);
    }
  };

  const handleSaveToken = async () => {
    if (!token.trim()) return;
    setSavingToken(true);
    try {
      const res = await api.post("/agent/telegram/save-token", { token: token.trim() });
      if (res.data.success) {
        addToast("Token salvo e bot iniciado", "success");
        setToken("");
        await loadStatus();
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
    try {
      await api.delete("/agent/telegram/token");
      addToast("Token removido", "success");
      await loadStatus();
    } catch {
      addToast("Erro ao remover token", "error");
    }
  };

  const isOnline = data?.status === "CONNECTED";
  const telegramConfigured = Boolean(telegramStatus?.configured);
  const telegramOnline = Boolean(telegramStatus?.online);
  const channels = useMemo<ChannelView[]>(() => {
    if (!data) return [];
    return [
      {
        key: "whatsapp" as const,
        icon: <MessageCircle size={18} aria-hidden="true" />,
        name: "WhatsApp",
        status: statusText(data.status),
        tone: statusTone(data.status),
        detail: isOnline ? "Canal pronto para atendimento" : "Conecte pelo QR Code",
        aiEnabled: data.aiWhatsappEnabled,
        disabled: working,
      },
      {
        key: "telegram" as const,
        icon: <Send size={18} aria-hidden="true" />,
        name: "Telegram",
        status: telegramConfigured ? (telegramOnline ? "Online" : "Offline") : "Sem token",
        tone: telegramConfigured ? (telegramOnline ? "info" : "danger") : "neutral",
        detail: telegramConfigured ? telegramStatus?.label || "Bot configurado" : "Salve um token para ativar",
        aiEnabled: data.aiTelegramEnabled,
        disabled: working || !telegramConfigured,
      },
    ];
  }, [data, isOnline, telegramConfigured, telegramOnline, telegramStatus?.label, working]);

  if (loading && !data) {
    return <InstanceSkeleton />;
  }

  if (error || !data) {
    return (
      <InlineAlert tone="danger" icon={<AlertCircle size={18} aria-hidden="true" />} title="Erro ao carregar status">
        <div className="space-y-3">
          <p>{error || "Dados não disponíveis"}</p>
          <Button variant="secondary" size="sm" onClick={() => void loadStatus()}>Tente novamente</Button>
        </div>
      </InlineAlert>
    );
  }

  return (
    <div className="space-y-6">
      <Toolbar aria-label="Ações da instância">
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={statusTone(data.status)} pulse={isOnline} label={`WhatsApp ${statusText(data.status)}`} />
              <StatusPill tone={telegramOnline ? "info" : telegramConfigured ? "danger" : "neutral"} pulse={telegramOnline} label={telegramConfigured ? `Telegram ${telegramOnline ? "online" : "offline"}` : "Telegram sem token"} />
            </div>
            <p className="mt-2 truncate text-sm text-slate-600 dark:text-slate-400">Instância {data.name} · ID {data.id}</p>
          </div>
          <Button onClick={() => void handleToggle()} disabled={working} loading={working} variant={isOnline ? "danger" : "primary"} className="w-full sm:w-auto">
            {isOnline ? <Square className="mr-2 h-4 w-4" aria-hidden="true" /> : <Play className="mr-2 h-4 w-4" aria-hidden="true" />}
            {isOnline ? "Desconectar WhatsApp" : "Conectar WhatsApp"}
          </Button>
        </div>
      </Toolbar>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Section title="Canais e IA" description="Operação por canal com status, token e atendimento automatizado.">
            <div className="grid gap-4 lg:grid-cols-2">
              {channels.map((channel) => (
                <Panel key={channel.key} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="rounded-lg bg-slate-100 p-2 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{channel.icon}</div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">{channel.name}</h2>
                          <StatusPill tone={channel.tone} pulse={channel.tone === "success" || channel.tone === "info"} label={channel.status} />
                        </div>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{channel.detail}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/45 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">Atendimento com IA</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{channel.aiEnabled ? "Ativo para este canal" : "Desativado"}</p>
                    </div>
                    <Button size="sm" variant={channel.aiEnabled ? "danger" : "secondary"} onClick={() => void handleAiToggle(channel.key)} disabled={channel.disabled} className="w-full sm:w-auto">
                      <Bot className="mr-2 h-4 w-4" aria-hidden="true" />
                      {channel.aiEnabled ? "Desativar IA" : "Ativar IA"}
                    </Button>
                  </div>
                </Panel>
              ))}
            </div>
          </Section>

          <Section title="Token Telegram" description="Configure o bot sem sair do workspace de canais.">
            <Panel className="p-4">
              {telegramConfigured ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-lg bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/35 dark:text-blue-300">
                      <Check size={18} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{telegramStatus?.label || "Bot Telegram configurado"}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">Token salvo para esta instância</p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => void handleRemoveToken()} className="w-full sm:w-auto">
                    <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    Remover token
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    <span className="mb-1.5 block">Token do bot</span>
                    <input
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="123456789:ABCdef..."
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </label>
                  <Button onClick={() => void handleSaveToken()} disabled={!token.trim() || savingToken} loading={savingToken} className="w-full lg:w-auto">
                    <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                    Salvar token
                  </Button>
                </div>
              )}
            </Panel>
          </Section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Panel className="p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">Pareamento WhatsApp</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">QR Code e estado atual.</p>
              </div>
              <QrCode className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            </div>
            {isOnline ? (
              <EmptyState
                icon={<Smartphone size={22} aria-hidden="true" />}
                title="WhatsApp conectado"
                description="A instância já está pareada e pronta para receber mensagens."
                className="border-emerald-200 bg-emerald-50 dark:border-emerald-900/70 dark:bg-emerald-950/25"
              />
            ) : data.qr ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex max-w-[17rem] justify-center rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800">
                  <QRCodeSVG value={data.qr} level="M" includeMargin size={220} bgColor="#ffffff" fgColor="#000000" />
                </div>
                <InlineAlert tone="info" title="Como conectar">
                  Abra WhatsApp, acesse Aparelhos conectados, escolha Conectar aparelho e escaneie o QR Code.
                </InlineAlert>
              </div>
            ) : (
              <EmptyState
                icon={<QrCode size={22} aria-hidden="true" />}
                title="QR Code indisponível"
                description="Use Conectar WhatsApp para solicitar um novo código de pareamento."
              />
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
