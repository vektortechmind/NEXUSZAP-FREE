import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../lib/axios";
import type {
  AgentEditor,
  AgentSummary,
  AgentWorkspace,
  CreateModalState,
  EligibleInstance,
  KnowledgeFile,
  RuntimeOptionsResponse,
  TelegramAgentConfig,
  TelegramStatus,
  WorkspaceTab,
} from "./types";
import { initialCreateModalState } from "./types";

export function useAgentWorkspace(addToast: (message: string, tone?: "success" | "error" | "warning" | "info") => void) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedAgentId = searchParams.get("agentId");

  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [eligibleInstances, setEligibleInstances] = useState<EligibleInstance[]>([]);
  const [runtimeOptions, setRuntimeOptions] = useState<RuntimeOptionsResponse | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [editor, setEditor] = useState<AgentEditor | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("agent");
  const [createModal, setCreateModal] = useState<CreateModalState>(initialCreateModalState);
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesRefreshing, setFilesRefreshing] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [telegramConfig, setTelegramConfig] = useState<TelegramAgentConfig | null>(null);
  const [telegramFiles, setTelegramFiles] = useState<KnowledgeFile[]>([]);
  const [telegramFilesLoading, setTelegramFilesLoading] = useState(false);
  const [telegramFilesRefreshing, setTelegramFilesRefreshing] = useState(false);
  const [telegramFilesError, setTelegramFilesError] = useState<string | null>(null);
  const [telegramUploading, setTelegramUploading] = useState(false);

  const accept = useMemo(() => ".pdf,.png,.jpg,.jpeg,.webp,.txt,.docx,.json", []);
  const telegramAvailable = Boolean(telegramStatus?.online && telegramStatus?.instanceId);
  const telegramInstanceId = telegramStatus?.instanceId ?? null;
  const telegramBlockingReason = telegramConfig?.blockingReason ?? null;
  const telegramWorkspaceId = telegramConfig?.agentWorkspaceId ?? null;
  const telegramAgent = useMemo(
    () => agents.find((item) => item.instanceId === telegramStatus?.instanceId) ?? null,
    [agents, telegramStatus?.instanceId],
  );
  const selectedIsTelegramWorkspace = Boolean(editor && telegramStatus?.instanceId && editor.instanceId === telegramStatus.instanceId);
  const telegramWorkspaceEditable = Boolean(selectedIsTelegramWorkspace && editor && telegramConfig?.canEdit && telegramConfig.agentWorkspaceId === editor.id);
  const runtimeDefaultMemory = runtimeOptions?.defaults.memoryLimit ?? 5;
  const promptValue = editor?.systemPrompt ?? "";
  const promptStats = useMemo(() => {
    const trimmed = promptValue.trim();
    return { chars: promptValue.length, words: trimmed ? trimmed.split(/\s+/).length : 0 };
  }, [promptValue]);
  const telegramPromptStats = useMemo(() => {
    const value = editor?.telegramPrompt ?? "";
    const trimmed = value.trim();
    return { chars: value.length, words: trimmed ? trimmed.split(/\s+/).length : 0 };
  }, [editor?.telegramPrompt]);

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
      setFilesError("Não foi possível carregar os arquivos do agente.");
    } finally {
      setFilesLoading(false);
      setFilesRefreshing(false);
    }
  }, []);

  const refreshTelegramFiles = useCallback(async (agentId: string, soft?: boolean) => {
    if (soft) setTelegramFilesRefreshing(true);
    else setTelegramFilesLoading(true);
    setTelegramFilesError(null);
    try {
      const fls = await api.get<KnowledgeFile[]>(`/telegram-files/agent/${agentId}`);
      setTelegramFiles(fls.data);
    } catch (err) {
      console.error(err);
      setTelegramFiles([]);
      setTelegramFilesError("Não foi possível carregar os arquivos do Telegram.");
    } finally {
      setTelegramFilesLoading(false);
      setTelegramFilesRefreshing(false);
    }
  }, []);

  const loadOverview = useCallback(async () => {
    setError(null);
    try {
      const [agentsRes, eligibleRes, telegramRes, runtimeOptionsRes] = await Promise.all([
        api.get<AgentSummary[]>("/agent/agents"),
        api.get<EligibleInstance[]>("/agent/agents/eligible-instances"),
        api.get<TelegramStatus>("/agent/telegram/status").catch(() => ({
          data: { configured: false, online: false, label: null, instanceId: undefined, instanceName: null } as TelegramStatus,
        })),
        api.get<RuntimeOptionsResponse>("/agent/instances/runtime-options"),
      ]);
      setAgents(agentsRes.data);
      setEligibleInstances(eligibleRes.data);
      setTelegramStatus(telegramRes.data);
      setRuntimeOptions(runtimeOptionsRes.data);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar os agentes.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSelectedWorkspace = useCallback(async () => {
    if (!selectedAgentId) {
      setEditor(null);
      setTelegramConfig(null);
      setWorkspaceError(null);
      setFiles([]);
      setTelegramFiles([]);
      return;
    }
    setWorkspaceLoading(true);
    setWorkspaceError(null);
    try {
      const agentRes = await api.get<AgentWorkspace>(`/agent/agents/${selectedAgentId}`);
      let telegramPrompt = "";
      if (telegramInstanceId && agentRes.data.instanceId === telegramInstanceId) {
        const telegramRes = await api.get<TelegramAgentConfig>("/agent/telegram/config");
        setTelegramConfig(telegramRes.data);
        if (telegramRes.data.canEdit && telegramRes.data.agentWorkspaceId === agentRes.data.id) {
          telegramPrompt = telegramRes.data.telegramSystemPrompt ?? "";
          void refreshTelegramFiles(agentRes.data.id);
        } else {
          setTelegramFiles([]);
        }
      } else {
        setTelegramConfig(null);
        setTelegramFiles([]);
      }
      setEditor({
        id: agentRes.data.id,
        name: agentRes.data.name,
        systemPrompt: agentRes.data.systemPrompt ?? "",
        audioTranscriptionEnabled: agentRes.data.audioTranscriptionEnabled,
        instanceId: agentRes.data.instanceId,
        instanceName: agentRes.data.instanceName,
        instanceSlot: agentRes.data.instanceSlot,
        instanceStatus: agentRes.data.instanceStatus,
        runtime: {
          chatProvider: agentRes.data.chatProvider ?? "",
          openrouterModel: agentRes.data.openrouterModel ?? "",
          memoryLimit: agentRes.data.memoryLimit ?? runtimeDefaultMemory,
          providerFallback: false,
          providerFallbackLabel: null,
          modelFallback: false,
          modelFallbackLabel: null,
        },
        telegramPrompt,
      });
      void refreshFiles(agentRes.data.id);
    } catch (err) {
      console.error(err);
      setEditor(null);
      setTelegramConfig(null);
      setWorkspaceError("Não foi possível abrir o workspace do agente selecionado.");
    } finally {
      setWorkspaceLoading(false);
    }
  }, [refreshFiles, refreshTelegramFiles, runtimeDefaultMemory, selectedAgentId, telegramInstanceId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOverview();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOverview]);

  useEffect(() => {
    if (loading) return;
    const timer = window.setTimeout(() => {
      void loadSelectedWorkspace();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSelectedWorkspace, loading]);

  const tabs = useMemo(
    () => ([
      { value: "agent", label: "Agente" },
      { value: "ai", label: "IA" },
      { value: "files", label: "Arquivos" },
      { value: "integrations", label: "Integrações" },
    ]),
    [],
  );

  const openCreateModal = useCallback(() => {
    setCreateModal({ ...initialCreateModalState, open: true, channel: eligibleInstances.length > 0 ? "WHATSAPP" : "TELEGRAM" });
  }, [eligibleInstances.length]);

  const closeCreateModal = useCallback(() => {
    setCreateModal(initialCreateModalState);
  }, []);

  const createAgent = useCallback(async () => {
    if (createModal.channel === "WHATSAPP" && (!createModal.name.trim() || !createModal.instanceId)) {
      setCreateModal((current) => ({ ...current, error: "Defina o nome e selecione uma instância WhatsApp." }));
      return;
    }
    if (createModal.channel === "TELEGRAM" && !telegramAvailable) {
      setCreateModal((current) => ({ ...current, error: "Telegram indisponível enquanto não houver instância conectada." }));
      return;
    }
    setCreateModal((current) => ({ ...current, submitting: true, error: null }));
    try {
      if (createModal.channel === "TELEGRAM" && telegramAgent) {
        addToast(`Abrindo o agente ${telegramAgent.name} já vinculado ao Telegram`, "info");
        closeCreateModal();
        navigate(`/agente?agentId=${telegramAgent.id}`);
        return;
      }
      const instanceId = createModal.channel === "TELEGRAM" ? (telegramStatus?.instanceId ?? "") : createModal.instanceId;
      const res = await api.post<AgentWorkspace>("/agent/agents", { name: createModal.name.trim(), instanceId });
      addToast("Agente criado com sucesso", "success");
      closeCreateModal();
      await loadOverview();
      navigate(`/agente?agentId=${res.data.id}`);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      setCreateModal((current) => ({
        ...current,
        submitting: false,
        error: errorObj?.response?.data?.error || "Erro ao criar agente.",
      }));
      addToast(errorObj?.response?.data?.error || "Erro ao criar agente", "error");
    }
  }, [addToast, closeCreateModal, createModal.channel, createModal.instanceId, createModal.name, loadOverview, navigate, telegramAgent, telegramAvailable, telegramStatus]);

  const saveWorkspace = useCallback(async () => {
    if (!editor) return;
    setSaving(true);
    try {
      await api.put(`/agent/agents/${editor.id}`, {
        name: editor.name.trim(),
        systemPrompt: editor.systemPrompt,
        chatProvider: editor.runtime.chatProvider || null,
        openrouterModel: editor.runtime.chatProvider === "openrouter" ? editor.runtime.openrouterModel || null : null,
        memoryLimit: editor.runtime.memoryLimit,
        audioTranscriptionEnabled: editor.audioTranscriptionEnabled,
      });
      if (selectedIsTelegramWorkspace) {
        if (!telegramWorkspaceEditable) {
          addToast(telegramBlockingReason || "Vincule um agente ao Telegram antes de editar o prompt.", "error");
          return;
        }
        await api.put("/agent/telegram/config", { telegramSystemPrompt: editor.telegramPrompt });
      }
      addToast("Configurações do agente salvas com sucesso", "success");
      await loadOverview();
      await loadSelectedWorkspace();
    } catch (err) {
      console.error(err);
      addToast("Erro ao salvar as configurações do agente", "error");
    } finally {
      setSaving(false);
    }
  }, [addToast, editor, loadOverview, loadSelectedWorkspace, selectedIsTelegramWorkspace, telegramBlockingReason, telegramWorkspaceEditable]);

  const deleteSelectedAgent = useCallback(async () => {
    if (!editor) return;
    if (!window.confirm(`Excluir o agente ${editor.name}?\n\nA instância permanecerá no sistema.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/agent/agents/${editor.id}`);
      addToast("Agente excluído", "success");
      navigate("/agente", { replace: true });
      setEditor(null);
      setFiles([]);
      setTelegramFiles([]);
      await loadOverview();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      addToast(errorObj?.response?.data?.error || "Erro ao excluir agente", "error");
    } finally {
      setDeleting(false);
    }
  }, [addToast, editor, loadOverview, navigate]);

  const uploadFile = useCallback(async (file: File) => {
    if (!editor) return;
    setUploading(true);
    setFilesError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/files/agent/${editor.id}/upload`, fd);
      await refreshFiles(editor.id, true);
      addToast("Arquivo enviado com sucesso", "success");
    } catch (err) {
      console.error(err);
      setFilesError("Falha ao enviar arquivo. Tente novamente.");
      addToast("Erro ao enviar arquivo", "error");
    } finally {
      setUploading(false);
    }
  }, [addToast, editor, refreshFiles]);

  const removeFile = useCallback(async (fileId: string) => {
    if (!editor || !window.confirm("Excluir este arquivo da base de conhecimento?")) return;
    try {
      await api.delete(`/files/${fileId}`);
      await refreshFiles(editor.id, true);
      addToast("Arquivo removido", "success");
    } catch (err) {
      console.error(err);
      setFilesError("Não foi possível remover o arquivo.");
      addToast("Erro ao remover arquivo", "error");
    }
  }, [addToast, editor, refreshFiles]);

  const uploadTelegramFile = useCallback(async (file: File) => {
    if (!editor) return;
    if (!telegramWorkspaceEditable || !telegramWorkspaceId) {
      addToast(telegramBlockingReason || "Vincule um agente ao Telegram antes de enviar arquivos.", "error");
      return;
    }
    setTelegramUploading(true);
    setTelegramFilesError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/telegram-files/agent/${telegramWorkspaceId}/upload`, fd);
      await refreshTelegramFiles(telegramWorkspaceId, true);
      addToast("Arquivo do Telegram enviado com sucesso", "success");
    } catch (err) {
      console.error(err);
      setTelegramFilesError("Falha ao enviar arquivo do Telegram.");
      addToast("Erro ao enviar arquivo do Telegram", "error");
    } finally {
      setTelegramUploading(false);
    }
  }, [addToast, editor, refreshTelegramFiles, telegramBlockingReason, telegramWorkspaceEditable, telegramWorkspaceId]);

  const removeTelegramFile = useCallback(async (fileId: string) => {
    if (!editor) return;
    if (!telegramWorkspaceEditable || !telegramWorkspaceId) {
      addToast(telegramBlockingReason || "Vincule um agente ao Telegram antes de remover arquivos.", "error");
      return;
    }
    if (!window.confirm("Excluir este arquivo da base de conhecimento do Telegram?")) return;
    try {
      await api.delete(`/telegram-files/${fileId}`);
      await refreshTelegramFiles(telegramWorkspaceId, true);
      addToast("Arquivo do Telegram removido", "success");
    } catch (err) {
      console.error(err);
      setTelegramFilesError("Não foi possível remover o arquivo do Telegram.");
      addToast("Erro ao remover arquivo do Telegram", "error");
    }
  }, [addToast, editor, refreshTelegramFiles, telegramBlockingReason, telegramWorkspaceEditable, telegramWorkspaceId]);

  return {
    navigate,
    selectedAgentId,
    agents,
    eligibleInstances,
    runtimeOptions,
    telegramStatus,
    editor,
    loading,
    workspaceLoading,
    error,
    workspaceError,
    saving,
    deleting,
    activeTab,
    createModal,
    files,
    filesLoading,
    filesRefreshing,
    filesError,
    uploading,
    telegramConfig,
    telegramFiles,
    telegramFilesLoading,
    telegramFilesRefreshing,
    telegramFilesError,
    telegramUploading,
    accept,
    telegramAvailable,
    telegramAgent,
    selectedIsTelegramWorkspace,
    telegramWorkspaceEditable,
    promptStats,
    telegramPromptStats,
    tabs,
    setEditor,
    setActiveTab,
    setCreateModal,
    loadOverview,
    loadSelectedWorkspace,
    refreshFiles,
    refreshTelegramFiles,
    openCreateModal,
    closeCreateModal,
    createAgent,
    saveWorkspace,
    deleteSelectedAgent,
    uploadFile,
    removeFile,
    uploadTelegramFile,
    removeTelegramFile,
  };
}
