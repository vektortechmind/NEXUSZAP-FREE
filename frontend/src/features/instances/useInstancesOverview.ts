import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/axios";
import type { ChannelCard, CreateChannel, CreateModalState, InstanceStatus, TelegramStatus, WhatsappCard } from "./types";
import { initialCreateModalState, MAX_WHATSAPP_INSTANCES } from "./types";

export function useInstancesOverview(addToast: (message: string, tone?: "success" | "error" | "warning" | "info") => void) {
  const [instances, setInstances] = useState<InstanceStatus[]>([]);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"connect" | "disconnect" | "delete" | "token" | "remove-token" | "ai-toggle" | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [showTelegramToken, setShowTelegramToken] = useState(false);
  const [createModal, setCreateModal] = useState<CreateModalState>(initialCreateModalState);
  const pairingIntentIdsRef = useRef<string[]>([]);

  const markPairingIntent = useCallback((instanceId: string) => {
    if (!pairingIntentIdsRef.current.includes(instanceId)) {
      pairingIntentIdsRef.current = [...pairingIntentIdsRef.current, instanceId];
    }
  }, []);

  const clearPairingIntent = useCallback((instanceId: string) => {
    pairingIntentIdsRef.current = pairingIntentIdsRef.current.filter((id) => id !== instanceId);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [instancesRes, telegramRes] = await Promise.all([
        api.get<InstanceStatus[]>("/agent/instances"),
        api.get<TelegramStatus>("/agent/telegram/status").catch(() => ({
          data: {
            configured: false,
            online: false,
            label: null,
            instanceId: undefined,
            instanceName: null,
            channel: "TELEGRAM" as const,
          },
        })),
      ]);
      setInstances(instancesRes.data);
      pairingIntentIdsRef.current = pairingIntentIdsRef.current.filter((id) => {
        const instance = instancesRes.data.find((item) => item.id === id);
        return Boolean(instance && !instance.connected);
      });
      setTelegramStatus(telegramRes.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar as instâncias.");
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

  const cards = useMemo<ChannelCard[]>(() => {
    const whatsappCards = instances.map<WhatsappCard>((instance) => ({
      key: instance.id,
      id: instance.id,
      channel: "WHATSAPP",
      name: instance.name,
      status: instance.status,
      connected: instance.connected,
      details: instance.occupied && instance.agent
        ? `Vinculada ao agente ${instance.agent.name}.`
        : instance.connected
          ? "Conectada e pronta para uso operacional."
          : instance.status === "RECONNECTING"
            ? "Tentando restaurar a conexão do canal."
            : "Instância criada, sem pareamento ativo no momento.",
      qr: instance.qr,
      slot: instance.slot,
      occupied: instance.occupied,
      available: instance.available,
      aiWhatsappEnabled: instance.aiWhatsappEnabled,
      agent: instance.agent,
    }));

    if (!telegramStatus?.instanceId) return whatsappCards;

    return [
      ...whatsappCards,
      {
        key: "telegram-singleton",
        id: telegramStatus.instanceId || "telegram",
        channel: "TELEGRAM",
        name: telegramStatus.label?.trim() || "Telegram",
        status: telegramStatus.online ? "CONNECTED" : telegramStatus.configured ? "DISCONNECTED" : "NOT_CONFIGURED",
        connected: telegramStatus.online,
        details: telegramStatus.online
          ? "Bot online e pronto para receber mensagens."
          : telegramStatus.configured
            ? "Token salvo, mas o bot está offline no momento."
            : "Conecte o canal para informar o token do bot.",
        configured: telegramStatus.configured,
        label: telegramStatus.label,
        instanceName: telegramStatus.instanceName || null,
      },
    ];
  }, [instances, telegramStatus]);

  const selectedCard = useMemo(() => cards.find((card) => card.key === selectedKey) ?? null, [cards, selectedKey]);
  const connectedWhatsApp = useMemo(() => instances.filter((instance) => instance.status === "CONNECTED").length, [instances]);
  const availableWhatsApp = useMemo(() => instances.filter((instance) => instance.available).length, [instances]);
  const hasCapacity = instances.length < MAX_WHATSAPP_INSTANCES;
  const telegramUnavailable = Boolean(telegramStatus?.instanceId);
  const createdWhatsappCard = useMemo(
    () => createModal.createdInstanceId
      ? cards.find((card) => card.channel === "WHATSAPP" && card.id === createModal.createdInstanceId) as WhatsappCard | undefined
      : undefined,
    [cards, createModal.createdInstanceId],
  );

  const cancelWhatsappPairing = useCallback(async (instanceId: string) => {
    try {
      await api.post(`/agent/instances/${instanceId}/stop`);
    } catch (err) {
      console.error(err);
    } finally {
      clearPairingIntent(instanceId);
    }
  }, [clearPairingIntent]);

  const openDetails = useCallback((card: ChannelCard, showTokenField = false) => {
    setSelectedKey(card.key);
    setShowTelegramToken(showTokenField);
  }, []);

  const closeDetails = useCallback(async () => {
    if (selectedCard?.channel === "WHATSAPP" && pairingIntentIdsRef.current.includes(selectedCard.id) && !selectedCard.connected) {
      await cancelWhatsappPairing(selectedCard.id);
      await loadData();
    }
    setSelectedKey(null);
    setShowTelegramToken(false);
    setToken("");
  }, [cancelWhatsappPairing, loadData, selectedCard]);

  const openCreateModal = useCallback(() => {
    setCreateModal({ ...initialCreateModalState, open: true });
  }, []);

  const closeCreateModal = useCallback(async () => {
    if (createModal.channel === "WHATSAPP" && createModal.createdInstanceId) {
      const createdInstance = instances.find((instance) => instance.id === createModal.createdInstanceId);
      if (!createdInstance?.connected) {
        await cancelWhatsappPairing(createModal.createdInstanceId);
        await loadData();
      }
    }
    setCreateModal(initialCreateModalState);
  }, [cancelWhatsappPairing, createModal.channel, createModal.createdInstanceId, instances, loadData]);

  const handleCreateChannelChange = useCallback((channel: CreateChannel) => {
    if (channel === "TELEGRAM" && telegramUnavailable) return;
    setCreateModal((current) => ({
      ...current,
      channel,
      error: null,
      qr: null,
      createdInstanceId: null,
      createdInstanceName: null,
    }));
  }, [telegramUnavailable]);

  const startWhatsappPairing = useCallback(async (instanceId: string, instanceName: string, createdNow?: boolean) => {
    markPairingIntent(instanceId);
    setCreateModal((current) => ({ ...current, creating: true, error: null }));
    try {
      const startRes = await api.post<{ success: boolean; qr: string }>(`/agent/instances/${instanceId}/start`);
      setCreateModal((current) => ({
        ...current,
        creating: false,
        createdInstanceId: instanceId,
        createdInstanceName: instanceName,
        qr: startRes.data.qr || null,
      }));
      addToast(createdNow ? `Instância ${instanceName} criada` : `Conectando ${instanceName}...`, "success");
      await loadData();
    } catch (err: unknown) {
      clearPairingIntent(instanceId);
      const errorObj = err as { response?: { data?: { error?: string } } };
      setCreateModal((current) => ({
        ...current,
        creating: false,
        createdInstanceId: instanceId,
        createdInstanceName: instanceName,
        error: errorObj?.response?.data?.error || "Erro ao iniciar pareamento do WhatsApp.",
      }));
      addToast(errorObj?.response?.data?.error || "Erro ao iniciar pareamento", "error");
    }
  }, [addToast, clearPairingIntent, loadData, markPairingIntent]);

  const handleCreateWhatsappFlow = useCallback(async () => {
    const name = createModal.name.trim();
    if (!name) {
      setCreateModal((current) => ({ ...current, error: "Defina um nome para a instância WhatsApp." }));
      return;
    }
    setCreateModal((current) => ({ ...current, creating: true, error: null }));
    try {
      const createRes = await api.post<InstanceStatus>("/agent/instances", { name });
      const instance = createRes.data;
      await startWhatsappPairing(instance.id, instance.name, true);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      setCreateModal((current) => ({
        ...current,
        creating: false,
        error: errorObj?.response?.data?.error || "Erro ao criar instância WhatsApp.",
      }));
      addToast(errorObj?.response?.data?.error || "Erro ao criar instância", "error");
    }
  }, [addToast, createModal.name, startWhatsappPairing]);

  const handleSaveTelegramFromModal = useCallback(async () => {
    const nextToken = createModal.token.trim();
    if (!nextToken) {
      setCreateModal((current) => ({ ...current, error: "Informe o token do bot Telegram." }));
      return;
    }
    setCreateModal((current) => ({ ...current, creating: true, error: null }));
    try {
      const res = await api.post<{ success: boolean }>("/agent/telegram/save-token", { token: nextToken });
      if (res.data.success) {
        addToast("Telegram configurado com sucesso", "success");
        await loadData();
        void closeCreateModal();
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      setCreateModal((current) => ({
        ...current,
        creating: false,
        error: errorObj?.response?.data?.error || "Erro ao salvar token do Telegram.",
      }));
      addToast(errorObj?.response?.data?.error || "Erro ao salvar token", "error");
    }
  }, [addToast, closeCreateModal, createModal.token, loadData]);

  const handleWhatsappToggle = useCallback(async (card: WhatsappCard) => {
    setBusyKey(card.key);
    setBusyAction(card.connected ? "disconnect" : "connect");
    try {
      if (card.connected) {
        await api.post(`/agent/instances/${card.id}/stop`);
        clearPairingIntent(card.id);
        addToast(`Instância ${card.name} desconectada`, "success");
      } else {
        markPairingIntent(card.id);
        openDetails(card);
        await api.post(`/agent/instances/${card.id}/start`);
        addToast(`Conectando ${card.name}...`, "info");
      }
      await loadData();
    } catch {
      clearPairingIntent(card.id);
      addToast("Erro ao alterar o estado da instância", "error");
    } finally {
      setBusyKey(null);
      setBusyAction(null);
    }
  }, [addToast, clearPairingIntent, loadData, markPairingIntent, openDetails]);

  const handleWhatsappAiToggle = useCallback(async (card: WhatsappCard) => {
    const nextEnabled = !card.aiWhatsappEnabled;
    setBusyKey(card.key);
    setBusyAction("ai-toggle");
    try {
      await api.put(`/agent/instances/${card.id}/config`, { aiWhatsappEnabled: nextEnabled });
      addToast(`IA da instância ${card.name} ${nextEnabled ? "habilitada" : "desabilitada"}`, "success");
      await loadData();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      addToast(errorObj?.response?.data?.error || "Erro ao alterar a IA da instância", "error");
    } finally {
      setBusyKey(null);
      setBusyAction(null);
    }
  }, [addToast, loadData]);

  const handleDeleteInstance = useCallback(async (card: ChannelCard) => {
    const linkedAgentMessage = card.channel === "WHATSAPP" && card.agent
      ? `\n\nO agente vinculado ${card.agent.name} também será excluído.`
      : "";
    if (!window.confirm(`Excluir a instância ${card.name}?\n\nEsta ação remove a instância, suas sessões locais e vínculos operacionais.${linkedAgentMessage}`)) return;
    setBusyKey(card.key);
    setBusyAction("delete");
    try {
      await api.delete(`/agent/instances/${card.id}`);
      if (selectedKey === card.key) void closeDetails();
      addToast(`Instância ${card.name} excluída`, "success");
      await loadData();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      addToast(errorObj?.response?.data?.error || "Erro ao excluir instância", "error");
    } finally {
      setBusyKey(null);
      setBusyAction(null);
    }
  }, [addToast, closeDetails, loadData, selectedKey]);

  const handleSaveTelegramToken = useCallback(async () => {
    if (!token.trim()) return;
    setBusyKey("telegram-singleton");
    setBusyAction("token");
    try {
      const res = await api.post<{ success: boolean }>("/agent/telegram/save-token", { token: token.trim() });
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
      setBusyKey(null);
      setBusyAction(null);
    }
  }, [addToast, loadData, token]);

  const handleStartTelegram = useCallback(async () => {
    setBusyKey("telegram-singleton");
    setBusyAction("connect");
    try {
      await api.post("/agent/telegram/start");
      addToast("Telegram conectado", "success");
      await loadData();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      addToast(errorObj?.response?.data?.error || "Erro ao conectar Telegram", "error");
    } finally {
      setBusyKey(null);
      setBusyAction(null);
    }
  }, [addToast, loadData]);

  const handleStopTelegram = useCallback(async () => {
    setBusyKey("telegram-singleton");
    setBusyAction("disconnect");
    try {
      await api.post("/agent/telegram/stop");
      addToast("Telegram desconectado", "success");
      await loadData();
    } catch {
      addToast("Erro ao desconectar Telegram", "error");
    } finally {
      setBusyKey(null);
      setBusyAction(null);
    }
  }, [addToast, loadData]);

  const handleRemoveTelegramToken = useCallback(async () => {
    if (!window.confirm("Remover o token do canal Telegram?")) return;
    setBusyKey("telegram-singleton");
    setBusyAction("remove-token");
    try {
      await api.delete("/agent/telegram/token");
      if (selectedKey === "telegram-singleton") setShowTelegramToken(false);
      addToast("Token removido", "success");
      await loadData();
    } catch {
      addToast("Erro ao remover token", "error");
    } finally {
      setBusyKey(null);
      setBusyAction(null);
    }
  }, [addToast, loadData, selectedKey]);

  return {
    instances,
    telegramStatus,
    loading,
    error,
    busyKey,
    busyAction,
    selectedKey,
    token,
    showTelegramToken,
    createModal,
    cards,
    selectedCard,
    connectedWhatsApp,
    availableWhatsApp,
    hasCapacity,
    telegramUnavailable,
    createdWhatsappCard,
    setCreateModal,
    setToken,
    setShowTelegramToken,
    loadData,
    openDetails,
    closeDetails,
    openCreateModal,
    closeCreateModal,
    handleCreateChannelChange,
    startWhatsappPairing,
    handleCreateWhatsappFlow,
    handleSaveTelegramFromModal,
    handleWhatsappToggle,
    handleWhatsappAiToggle,
    handleDeleteInstance,
    handleSaveTelegramToken,
    handleStartTelegram,
    handleStopTelegram,
    handleRemoveTelegramToken,
  };
}
