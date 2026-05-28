import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Cog, MessageCircle, Plus, Power, QrCode, RefreshCw, Send, Smartphone, Square, Trash2, X } from "lucide-react";
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

type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";
type CreateChannel = "WHATSAPP" | "TELEGRAM";
type InstanceStatus = { id: string; channel: "WHATSAPP"; slot: number; name: string; status: string; qr: string | null; active: boolean; connected: boolean; available: boolean; occupied: boolean; agent: { id: string; name: string } | null };
type TelegramStatus = { configured: boolean; online: boolean; label: string | null; instanceId?: string; instanceName?: string | null; channel?: "TELEGRAM" };
type WhatsappCard = { key: string; id: string; channel: "WHATSAPP"; name: string; status: string; connected: boolean; details: string; qr: string | null; slot: number; occupied: boolean; available: boolean; agent: { id: string; name: string } | null };
type TelegramCard = { key: string; id: string; channel: "TELEGRAM"; name: string; status: string; connected: boolean; details: string; configured: boolean; label: string | null; instanceName: string | null };
type ChannelCard = WhatsappCard | TelegramCard;
type CreateModalState = { open: boolean; channel: CreateChannel; name: string; token: string; creating: boolean; createdInstanceId: string | null; createdInstanceName: string | null; qr: string | null; error: string | null };

const initialCreateModalState: CreateModalState = { open: false, channel: "WHATSAPP", name: "", token: "", creating: false, createdInstanceId: null, createdInstanceName: null, qr: null, error: null };

function statusText(status: string) {
  switch (status) {
    case "CONNECTED": return "Conectado";
    case "DISCONNECTED": return "Desconectado";
    case "RECONNECTING": return "Reconectando";
    case "NOT_CONFIGURED": return "Sem token";
    default: return status || "Indefinido";
  }
}

function statusTone(status: string): StatusTone {
  switch (status) {
    case "CONNECTED": return "success";
    case "RECONNECTING": return "warning";
    case "DISCONNECTED": return "danger";
    case "NOT_CONFIGURED": return "neutral";
    default: return "neutral";
  }
}

function StatusPill({ tone, label, pulse }: { tone: StatusTone; label: string; pulse?: boolean }) {
  return <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"><StatusDot tone={tone} pulse={pulse} />{label}</span>;
}

function InstanceSkeleton() {
  return <div className="space-y-6" aria-busy="true"><Skeleton className="h-24" /><div className="grid gap-5 xl:grid-cols-3"><Skeleton className="h-64" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div></div>;
}

function ChannelIcon({ channel }: { channel: ChannelCard["channel"] | CreateChannel }) {
  return channel === "TELEGRAM" ? <div className="rounded-xl bg-sky-50 p-2 text-sky-700 dark:bg-sky-950/35 dark:text-sky-300"><Send size={18} aria-hidden="true" /></div> : <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300"><MessageCircle size={18} aria-hidden="true" /></div>;
}

export function Instancia() {
  const [instances, setInstances] = useState<InstanceStatus[]>([]);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"connect" | "disconnect" | "delete" | "token" | "remove-token" | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [showTelegramToken, setShowTelegramToken] = useState(false);
  const [createModal, setCreateModal] = useState<CreateModalState>(initialCreateModalState);
  const { addToast } = useToast();

  const loadData = useCallback(async () => {
    try {
      const [instancesRes, telegramRes] = await Promise.all([
        api.get<InstanceStatus[]>("/agent/instances"),
        api.get<TelegramStatus>("/agent/telegram/status").catch(() => ({ data: { configured: false, online: false, label: null, instanceId: undefined, instanceName: null, channel: "TELEGRAM" as const } })),
      ]);
      setInstances(instancesRes.data); setTelegramStatus(telegramRes.data); setError(null);
    } catch (err) { console.error(err); setError("Não foi possível carregar as instâncias."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { loadData().catch(() => {}); }, 0);
    const interval = window.setInterval(() => { loadData().catch(() => {}); }, 2500);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(interval); };
  }, [loadData]);

  const cards = useMemo<ChannelCard[]>(() => {
    const whatsappCards: WhatsappCard[] = instances.map((instance) => ({ key: instance.id, id: instance.id, channel: "WHATSAPP", name: instance.name, status: instance.status, connected: instance.connected, details: instance.occupied && instance.agent ? `Vinculada ao agente ${instance.agent.name}.` : instance.connected ? "Conectada e pronta para uso operacional." : instance.status === "RECONNECTING" ? "Tentando restaurar a conexão do canal." : "Aguardando conexão desta instância.", qr: instance.qr, slot: instance.slot, occupied: instance.occupied, available: instance.available, agent: instance.agent }));
    if (!telegramStatus) return whatsappCards;
    return [...whatsappCards, { key: "telegram-singleton", id: telegramStatus.instanceId || "telegram", channel: "TELEGRAM", name: telegramStatus.label?.trim() || "Telegram", status: telegramStatus.online ? "CONNECTED" : telegramStatus.configured ? "DISCONNECTED" : "NOT_CONFIGURED", connected: telegramStatus.online, details: telegramStatus.online ? "Bot online e pronto para receber mensagens." : telegramStatus.configured ? "Token salvo, mas o bot está offline no momento." : "Conecte o canal para informar o token do bot.", configured: telegramStatus.configured, label: telegramStatus.label, instanceName: telegramStatus.instanceName || null }];
  }, [instances, telegramStatus]);

  const selectedCard = useMemo(() => cards.find((card) => card.key === selectedKey) ?? null, [cards, selectedKey]);
  const connectedWhatsApp = useMemo(() => instances.filter((instance) => instance.status === "CONNECTED").length, [instances]);
  const availableWhatsApp = useMemo(() => instances.filter((instance) => instance.available).length, [instances]);
  const hasCapacity = instances.length < 3;
  const telegramUnavailable = Boolean(telegramStatus?.configured || telegramStatus?.online);
  const createdWhatsappCard = useMemo(() => createModal.createdInstanceId ? cards.find((card) => card.channel === "WHATSAPP" && card.id === createModal.createdInstanceId) as WhatsappCard | undefined : undefined, [cards, createModal.createdInstanceId]);

  const openDetails = (card: ChannelCard, showTokenField = false) => { setSelectedKey(card.key); setShowTelegramToken(showTokenField); };
  const closeDetails = () => { setSelectedKey(null); setShowTelegramToken(false); setToken(""); };
  const openCreateModal = () => setCreateModal({ ...initialCreateModalState, open: true });
  const closeCreateModal = () => setCreateModal(initialCreateModalState);
  const handleCreateChannelChange = (channel: CreateChannel) => {
    if (channel === "TELEGRAM" && telegramUnavailable) return;
    setCreateModal((current) => ({ ...current, channel, error: null, qr: null, createdInstanceId: null, createdInstanceName: null }));
  };

  const startWhatsappPairing = async (instanceId: string, instanceName: string, createdNow?: boolean) => {
    setCreateModal((current) => ({ ...current, creating: true, error: null }));
    try {
      const startRes = await api.post<{ success: boolean; qr: string }>(`/agent/instances/${instanceId}/start`);
      setCreateModal((current) => ({ ...current, creating: false, createdInstanceId: instanceId, createdInstanceName: instanceName, qr: startRes.data.qr || null }));
      addToast(createdNow ? `Instância ${instanceName} criada` : `Conectando ${instanceName}...`, "success");
      await loadData();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      setCreateModal((current) => ({ ...current, creating: false, createdInstanceId: instanceId, createdInstanceName: instanceName, error: errorObj?.response?.data?.error || "Erro ao iniciar pareamento do WhatsApp." }));
      addToast(errorObj?.response?.data?.error || "Erro ao iniciar pareamento", "error");
    }
  };

  const handleCreateWhatsappFlow = async () => {
    const name = createModal.name.trim();
    if (!name) return setCreateModal((current) => ({ ...current, error: "Defina um nome para a instância WhatsApp." }));
    setCreateModal((current) => ({ ...current, creating: true, error: null }));
    try {
      const createRes = await api.post<InstanceStatus>("/agent/instances", { name });
      const instance = createRes.data;
      await startWhatsappPairing(instance.id, instance.name, true);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      setCreateModal((current) => ({ ...current, creating: false, error: errorObj?.response?.data?.error || "Erro ao criar instância WhatsApp." }));
      addToast(errorObj?.response?.data?.error || "Erro ao criar instância", "error");
    }
  };

  const handleSaveTelegramFromModal = async () => {
    const nextToken = createModal.token.trim();
    if (!nextToken) return setCreateModal((current) => ({ ...current, error: "Informe o token do bot Telegram." }));
    setCreateModal((current) => ({ ...current, creating: true, error: null }));
    try {
      const res = await api.post("/agent/telegram/save-token", { token: nextToken });
      if (res.data.success) {
        addToast("Telegram configurado com sucesso", "success");
        await loadData();
        closeCreateModal();
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      setCreateModal((current) => ({ ...current, creating: false, error: errorObj?.response?.data?.error || "Erro ao salvar token do Telegram." }));
      addToast(errorObj?.response?.data?.error || "Erro ao salvar token", "error");
    }
  };

  const handleWhatsappToggle = async (card: WhatsappCard) => {
    setBusyKey(card.key); setBusyAction(card.connected ? "disconnect" : "connect");
    try {
      if (card.connected) { await api.post(`/agent/instances/${card.id}/stop`); addToast(`Instância ${card.name} desconectada`, "success"); }
      else { openDetails(card); await api.post(`/agent/instances/${card.id}/start`); addToast(`Conectando ${card.name}...`, "info"); }
      await loadData();
    } catch { addToast("Erro ao alterar o estado da instância", "error"); }
    finally { setBusyKey(null); setBusyAction(null); }
  };

  const handleDeleteInstance = async (card: WhatsappCard) => {
    const deleteMessage = card.agent ? `Excluir a instância ${card.name} e desvincular o agente ${card.agent.name}?` : `Excluir a instância ${card.name}?`;
    if (!window.confirm(`${deleteMessage}\n\nEsta ação remove a instância e suas sessões locais.`)) return;
    setBusyKey(card.key); setBusyAction("delete");
    try {
      await api.delete(`/agent/instances/${card.id}`);
      if (selectedKey === card.key) closeDetails();
      addToast(`Instância ${card.name} excluída`, "success");
      await loadData();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      addToast(errorObj?.response?.data?.error || "Erro ao excluir instância", "error");
    } finally { setBusyKey(null); setBusyAction(null); }
  };

  const handleSaveTelegramToken = async () => {
    if (!token.trim()) return;
    setBusyKey("telegram-singleton"); setBusyAction("token");
    try {
      const res = await api.post("/agent/telegram/save-token", { token: token.trim() });
      if (res.data.success) { setToken(""); setShowTelegramToken(false); addToast("Token salvo e bot iniciado", "success"); await loadData(); }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      addToast(errorObj?.response?.data?.error || "Erro ao salvar token", "error");
    } finally { setBusyKey(null); setBusyAction(null); }
  };

  const handleStartTelegram = async () => {
    setBusyKey("telegram-singleton"); setBusyAction("connect");
    try { await api.post("/agent/telegram/start"); addToast("Telegram conectado", "success"); await loadData(); }
    catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      addToast(errorObj?.response?.data?.error || "Erro ao conectar Telegram", "error");
    } finally { setBusyKey(null); setBusyAction(null); }
  };

  const handleStopTelegram = async () => {
    setBusyKey("telegram-singleton"); setBusyAction("disconnect");
    try { await api.post("/agent/telegram/stop"); addToast("Telegram desconectado", "success"); await loadData(); }
    catch { addToast("Erro ao desconectar Telegram", "error"); }
    finally { setBusyKey(null); setBusyAction(null); }
  };

  const handleRemoveTelegramToken = async () => {
    if (!window.confirm("Remover o token do canal Telegram?")) return;
    setBusyKey("telegram-singleton"); setBusyAction("remove-token");
    try {
      await api.delete("/agent/telegram/token");
      if (selectedKey === "telegram-singleton") setShowTelegramToken(false);
      addToast("Token removido", "success");
      await loadData();
    } catch { addToast("Erro ao remover token", "error"); }
    finally { setBusyKey(null); setBusyAction(null); }
  };

  if (loading && cards.length === 0) return <InstanceSkeleton />;
  if (error && cards.length === 0) return <InlineAlert tone="danger" icon={<AlertCircle size={18} aria-hidden="true" />} title="Erro ao carregar instâncias"><div className="space-y-3"><p>{error}</p><Button variant="secondary" size="sm" onClick={() => void loadData()}>Tente novamente</Button></div></InlineAlert>;

  return <>
    <div className="space-y-6">
      <Toolbar aria-label="Resumo das instâncias"><div className="flex w-full flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div className="space-y-3"><div className="flex flex-wrap items-center gap-2"><StatusPill tone="info" label={`${instances.length}/3 instâncias WhatsApp`} /><StatusPill tone={connectedWhatsApp > 0 ? "success" : "neutral"} pulse={connectedWhatsApp > 0} label={`${connectedWhatsApp} conectadas`} /><StatusPill tone={availableWhatsApp > 0 ? "info" : "neutral"} label={`${availableWhatsApp} disponíveis`} /><StatusPill tone={telegramStatus?.online ? "success" : telegramStatus?.configured ? "danger" : "neutral"} pulse={telegramStatus?.online} label={telegramStatus?.configured ? `Telegram ${telegramStatus.online ? "online" : "offline"}` : "Telegram sem token"} /></div><div><p className="text-sm font-semibold text-slate-950 dark:text-slate-50">Cards operacionais por canal</p><p className="text-sm text-slate-600 dark:text-slate-400">A criação de novas instâncias agora acontece por um fluxo guiado, sem bloco fixo acima da grade.</p></div></div><div className="flex w-full justify-start lg:w-auto lg:justify-end"><Button onClick={openCreateModal} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" aria-hidden="true" />Criar instância</Button></div></div></Toolbar>
      {error ? <InlineAlert tone="warning" icon={<AlertCircle size={16} aria-hidden="true" />}>{error}</InlineAlert> : null}
      <Section title="Canais" description="Cards padronizados para conexão e manutenção operacional das instâncias.">{cards.length === 0 ? <EmptyState icon={<MessageCircle size={22} aria-hidden="true" />} title="Nenhuma instância cadastrada" description="Use o fluxo de criação para iniciar o pareamento operacional." /> : <div className="grid gap-5 xl:grid-cols-3">{cards.map((card) => {
        const busy = busyKey === card.key; const connectBusy = busy && busyAction === "connect"; const disconnectBusy = busy && busyAction === "disconnect"; const deleteBusy = busy && busyAction === "delete"; const tokenBusy = busy && (busyAction === "token" || busyAction === "remove-token");
        return <Panel key={card.key} className="overflow-hidden"><div className="border-b border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/35"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${card.channel === "TELEGRAM" ? "bg-sky-600 text-white dark:bg-sky-500 dark:text-slate-950" : "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950"}`}>{card.channel === "TELEGRAM" ? "Telegram" : `WhatsApp ${card.slot}`}</span><StatusPill tone={statusTone(card.status)} pulse={card.connected} label={statusText(card.status)} />{card.channel === "WHATSAPP" ? <StatusPill tone={card.occupied ? "warning" : card.available ? "info" : "neutral"} label={card.occupied ? "Ocupada" : card.available ? "Disponível" : "Inativa"} pulse={card.available} /> : null}</div><h2 className="mt-3 truncate text-lg font-semibold text-slate-950 dark:text-slate-50">{card.name}</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{card.details}</p><p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">ID {card.id}</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => openDetails(card, card.channel === "TELEGRAM" && !card.configured)} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800" aria-label={`Abrir detalhes de ${card.name}`}><Cog size={18} aria-hidden="true" /></button><ChannelIcon channel={card.channel} /></div></div></div><div className="space-y-4 p-4">{card.channel === "WHATSAPP" && card.agent ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-200">Agente vinculado: {card.agent.name}</div> : null}<div className="flex flex-wrap gap-2">{card.connected ? <Button variant="danger" onClick={() => card.channel === "WHATSAPP" ? void handleWhatsappToggle(card) : void handleStopTelegram()} disabled={disconnectBusy || tokenBusy} loading={disconnectBusy} className="flex-1"><Square className="mr-2 h-4 w-4" aria-hidden="true" />Desconectar</Button> : <Button variant="primary" onClick={() => card.channel === "WHATSAPP" ? void handleWhatsappToggle(card) : card.configured ? void handleStartTelegram() : openDetails(card, true)} disabled={connectBusy} loading={connectBusy} className="flex-1"><Power className="mr-2 h-4 w-4" aria-hidden="true" />Conectar</Button>}{card.channel === "WHATSAPP" ? <Button variant="ghost" onClick={() => void handleDeleteInstance(card)} disabled={deleteBusy} loading={deleteBusy} className="px-3 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/25"><Trash2 className="h-4 w-4" aria-hidden="true" /></Button> : null}</div></div></Panel>;
      })}</div>}</Section>
    </div>

    {createModal.open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"><Panel className="max-h-[90vh] w-full max-w-3xl overflow-hidden"><div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/35"><div><h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Criar instância</h3><p className="text-sm text-slate-600 dark:text-slate-400">Escolha o canal e conclua a configuração ou o pareamento no mesmo fluxo.</p></div><button type="button" onClick={closeCreateModal} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800" aria-label="Fechar criação"><X size={18} aria-hidden="true" /></button></div><div className="space-y-5 overflow-y-auto p-5"><div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]"><div className="space-y-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Canal</p><button type="button" onClick={() => handleCreateChannelChange("WHATSAPP")} className={`w-full rounded-2xl border p-4 text-left transition ${createModal.channel === "WHATSAPP" ? "border-emerald-500 bg-emerald-50/80 shadow-sm dark:border-emerald-500 dark:bg-emerald-950/25" : "border-slate-200 bg-white hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-900"}`}><div className="flex items-start justify-between gap-3"><ChannelIcon channel="WHATSAPP" />{createModal.channel === "WHATSAPP" ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" /> : null}</div><p className="mt-3 text-sm font-semibold text-slate-950 dark:text-slate-50">WhatsApp</p><p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Cria instância independente e já abre o pareamento com QR.</p></button><button type="button" onClick={() => handleCreateChannelChange("TELEGRAM")} disabled={telegramUnavailable} className={`w-full rounded-2xl border p-4 text-left transition ${createModal.channel === "TELEGRAM" ? "border-sky-500 bg-sky-50/80 shadow-sm dark:border-sky-500 dark:bg-sky-950/25" : "border-slate-200 bg-white hover:border-sky-300 dark:border-slate-800 dark:bg-slate-900"} ${telegramUnavailable ? "cursor-not-allowed opacity-60" : ""}`}><div className="flex items-start justify-between gap-3"><ChannelIcon channel="TELEGRAM" />{createModal.channel === "TELEGRAM" ? <CheckCircle2 className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden="true" /> : null}</div><p className="mt-3 text-sm font-semibold text-slate-950 dark:text-slate-50">Telegram</p><p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{telegramUnavailable ? "Indisponível enquanto já existir um Telegram configurado ou ativo." : "Configura o token do bot no próprio modal."}</p></button></div><Panel tone="muted" className="p-4">{createModal.error ? <InlineAlert tone="warning" icon={<AlertCircle size={16} aria-hidden="true" />}>{createModal.error}</InlineAlert> : null}{createModal.channel === "WHATSAPP" ? <div className="space-y-4"><label className="block text-sm font-medium text-slate-700 dark:text-slate-300"><span className="mb-1.5 block">Nome da instância</span><input value={createModal.name} onChange={(e) => setCreateModal((current) => ({ ...current, name: e.target.value, error: null }))} maxLength={80} placeholder="Ex.: Vendas, Suporte, Operação" disabled={Boolean(createModal.createdInstanceId)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" /></label><div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">{createdWhatsappCard?.connected ? <EmptyState icon={<Smartphone size={22} aria-hidden="true" />} title="Instância conectada" description="O pareamento foi concluído e o card principal já foi atualizado." className="border-emerald-200 bg-emerald-50 dark:border-emerald-900/70 dark:bg-emerald-950/25" /> : createModal.qr ? <div className="space-y-4 text-center"><div className="mx-auto flex max-w-[15rem] justify-center rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800"><QRCodeSVG value={createModal.qr} level="M" includeMargin size={188} bgColor="#ffffff" fgColor="#000000" /></div><p className="text-sm text-slate-600 dark:text-slate-400">Abra o WhatsApp, entre em <span className="font-medium text-slate-900 dark:text-slate-100">Aparelhos conectados</span> e escaneie o QR.</p></div> : createModal.creating ? <EmptyState icon={<RefreshCw size={22} aria-hidden="true" />} title="Criando e conectando" description="Aguarde enquanto a instância é criada e o QR é preparado." /> : <EmptyState icon={<QrCode size={22} aria-hidden="true" />} title="Pareamento guiado" description="Clique em Criar e conectar para abrir o QR deste WhatsApp no próprio modal." />}</div><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-slate-500 dark:text-slate-400">{hasCapacity ? `Restam ${3 - instances.length} slot${3 - instances.length === 1 ? "" : "s"} de WhatsApp.` : "Limite de 3 instâncias WhatsApp atingido."}</p><div className="flex flex-col gap-2 sm:flex-row"><Button variant="secondary" onClick={closeCreateModal}>Fechar</Button>{createdWhatsappCard?.connected ? <Button onClick={closeCreateModal}>Concluir</Button> : createModal.createdInstanceId && createModal.createdInstanceName ? <Button onClick={() => void startWhatsappPairing(createModal.createdInstanceId!, createModal.createdInstanceName!)} disabled={createModal.creating} loading={createModal.creating}><RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />Gerar QR novamente</Button> : <Button onClick={() => void handleCreateWhatsappFlow()} disabled={!createModal.name.trim() || !hasCapacity || createModal.creating} loading={createModal.creating}><Power className="mr-2 h-4 w-4" aria-hidden="true" />Criar e conectar</Button>}</div></div></div> : <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Canal</p><p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">Telegram</p></div><div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Disponibilidade</p><p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">{telegramUnavailable ? "Indisponível" : "Pronto para configurar"}</p></div></div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300"><span className="mb-1.5 block">Token do bot</span><input type="password" value={createModal.token} onChange={(e) => setCreateModal((current) => ({ ...current, token: e.target.value, error: null }))} placeholder="123456789:ABCdef..." className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" /></label><div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">O token é validado e salvo no mesmo fluxo. Ao concluir, o card Telegram passa a ser a origem das ações operacionais.</div><div className="flex flex-col gap-2 sm:flex-row sm:justify-end"><Button variant="secondary" onClick={closeCreateModal}>Fechar</Button><Button onClick={() => void handleSaveTelegramFromModal()} disabled={!createModal.token.trim() || createModal.creating} loading={createModal.creating}><Power className="mr-2 h-4 w-4" aria-hidden="true" />Salvar e conectar</Button></div></div>}</Panel></div></div></Panel></div> : null}

    {selectedCard ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"><Panel className="max-h-[90vh] w-full max-w-2xl overflow-hidden"><div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/35"><div className="flex items-start gap-3"><ChannelIcon channel={selectedCard.channel} /><div><h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">{selectedCard.name}</h3><p className="text-sm text-slate-600 dark:text-slate-400">Detalhes operacionais e ações locais desta instância.</p></div></div><button type="button" onClick={closeDetails} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800" aria-label="Fechar detalhes"><X size={18} aria-hidden="true" /></button></div><div className="space-y-5 overflow-y-auto p-5"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/45"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Canal</p><p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">{selectedCard.channel === "TELEGRAM" ? "Telegram" : "WhatsApp"}</p></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/45"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</p><div className="mt-1"><StatusPill tone={statusTone(selectedCard.status)} pulse={selectedCard.connected} label={statusText(selectedCard.status)} /></div></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/45"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">ID</p><p className="mt-1 break-all font-mono text-sm text-slate-950 dark:text-slate-50">{selectedCard.id}</p></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/45"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Resumo</p><p className="mt-1 text-sm text-slate-950 dark:text-slate-50">{selectedCard.details}</p></div></div>{selectedCard.channel === "WHATSAPP" ? <Panel tone="muted" className="p-4">{selectedCard.connected ? <EmptyState icon={<Smartphone size={22} aria-hidden="true" />} title="Instância conectada" description="Pareamento ativo e pronto para receber mensagens." className="border-emerald-200 bg-emerald-50 dark:border-emerald-900/70 dark:bg-emerald-950/25" /> : selectedCard.qr ? <div className="space-y-4 text-center"><div className="mx-auto flex max-w-[15rem] justify-center rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800"><QRCodeSVG value={selectedCard.qr} level="M" includeMargin size={188} bgColor="#ffffff" fgColor="#000000" /></div><p className="text-sm text-slate-600 dark:text-slate-400">Abra o WhatsApp, entre em <span className="font-medium text-slate-900 dark:text-slate-100">Aparelhos conectados</span> e escaneie o QR.</p></div> : busyKey === selectedCard.key && busyAction === "connect" ? <EmptyState icon={<RefreshCw size={22} aria-hidden="true" />} title="Gerando QR Code" description="Aguarde alguns instantes enquanto a conexão é iniciada." /> : <EmptyState icon={<QrCode size={22} aria-hidden="true" />} title="QR ainda não disponível" description="Use Conectar para iniciar o pareamento desta instância." />}</Panel> : <Panel tone="muted" className="space-y-4 p-4"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Instância base</p><p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">{selectedCard.instanceName || "Primária"}</p></div><div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Token</p><p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">{selectedCard.configured ? "Configurado" : "Não configurado"}</p></div></div>{showTelegramToken || !selectedCard.configured ? <div className="grid gap-3 border-t border-slate-200 pt-4 dark:border-slate-800"><label className="block text-sm font-medium text-slate-700 dark:text-slate-300"><span className="mb-1.5 block">Token do bot</span><input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456789:ABCdef..." className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" /></label><div className="flex justify-end"><Button onClick={() => void handleSaveTelegramToken()} disabled={!token.trim() || busyKey === "telegram-singleton"} loading={busyKey === "telegram-singleton" && busyAction === "token"} className="w-full sm:w-auto"><Power className="mr-2 h-4 w-4" aria-hidden="true" />Salvar token</Button></div></div> : <div className="flex flex-col gap-2 sm:flex-row sm:justify-end"><Button variant="secondary" onClick={() => setShowTelegramToken(true)}>Atualizar token</Button><Button variant="danger" onClick={() => void handleRemoveTelegramToken()} disabled={busyKey === "telegram-singleton" && busyAction === "remove-token"} loading={busyKey === "telegram-singleton" && busyAction === "remove-token"}><Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />Remover token</Button></div>}</Panel>}</div></Panel></div> : null}
  </>;
}
