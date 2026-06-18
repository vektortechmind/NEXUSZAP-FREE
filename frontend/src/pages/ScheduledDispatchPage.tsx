import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { useToast } from "../contexts/ToastContext";
import { Button } from "../components/ui/Button";
import { InlineAlert } from "../components/ui/InlineAlert";
import { Input } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel } from "../components/ui/Panel";
import { api } from "../lib/axios";
import type { InstanceStatus } from "../features/instances/types";
import {
  applyInstanceToDraft,
  applyTemplateToDraft,
  buildScheduledDispatchTemplatePayload,
  calculateScheduledDispatchPreview,
  canCancelScheduledDispatch,
  createEmptyScheduledDispatchButton,
  createInitialScheduledDispatchDraft,
  filterScheduledDispatchGroups,
  isSafeMediaUrl,
  isTemplateMediaUrl,
  MAX_SCHEDULED_DISPATCH_BUTTONS,
  normalizeScheduledDispatchDelay,
  normalizeScheduledDispatchPauseEveryCount,
  normalizeScheduledDispatchButtons,
  normalizeScheduledDispatchPhones,
  resolveScheduledDispatchIso,
  resolveScheduledDispatchTargetLabel,
  SCHEDULED_DISPATCH_STATUS_LABELS,
  type ScheduledDispatchContentType,
  type ScheduledDispatchDeliveryMode,
  type ScheduledDispatchDraft,
  type ScheduledDispatchGroup,
  type ScheduledDispatchHistoryItem,
  type ScheduledDispatchStatus,
  type ScheduledDispatchTemplate,
  validateScheduledDispatchDraft,
} from "../features/scheduled-dispatch/state";

type GroupListResponse = { groups: ScheduledDispatchGroup[] };
type GroupSyncResponse = { synced: number; groups: ScheduledDispatchGroup[] };
type DispatchListResponse = { dispatches: ScheduledDispatchHistoryItem[] };
type DispatchMutationResponse = { dispatch: ScheduledDispatchHistoryItem | null; dispatches: ScheduledDispatchHistoryItem[] };
type UploadMediaResponse = { mediaId: string; fileName: string; mimeType: string; mediaUrl: string };
type ClearHistoryResponse = { deleted: number };
type TemplateListResponse = { templates: ScheduledDispatchTemplate[] };
type TemplateMutationResponse = { template: ScheduledDispatchTemplate };

function resolveScheduledDispatchSubmitError(error: unknown) {
  if (!isAxiosError(error)) return "Nao foi possivel salvar o disparo.";
  const data = error.response?.data as { error?: string; message?: string } | undefined;
  return data?.error ?? data?.message ?? "Nao foi possivel salvar o disparo.";
}

type CampaignHistorySummary = {
  campaignId: string;
  total: number;
  sent: number;
  scheduled: number;
  processing: number;
  failed: number;
  cancelled: number;
  firstScheduledAt: string;
  lastScheduledAt: string;
  campaign: NonNullable<ScheduledDispatchHistoryItem["campaign"]>;
};

const selectClassName = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-colors duration-200 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/25";
const textareaClassName = `${selectClassName} min-h-32 resize-y`;
const HISTORY_PAGE_SIZE = 100;

type InstanceOption = { id: string; name: string };

const contentTypeLabels: Record<ScheduledDispatchContentType, string> = {
  text: "Texto",
  image: "Imagem",
  video: "Video",
};

const historyContentTypeLabels: Record<ScheduledDispatchHistoryItem["contentType"], string> = {
  TEXT: "Texto",
  IMAGE: "Imagem",
  VIDEO: "Video",
};

const deliveryModeLabels: Record<ScheduledDispatchDeliveryMode, string> = {
  immediate: "Enviar agora",
  scheduled: "Agendar",
};

const statusToneClassName: Record<ScheduledDispatchStatus, string> = {
  SCHEDULED: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  PROCESSING: "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  SENT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  CANCELLED: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

function resolveUploadContentType(file: File): ScheduledDispatchContentType | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function sortDispatchHistory(dispatches: ScheduledDispatchHistoryItem[]) {
  const weight = (status: ScheduledDispatchStatus) => {
    if (status === "PROCESSING") return 0;
    if (status === "SCHEDULED") return 1;
    if (status === "FAILED") return 2;
    if (status === "SENT") return 3;
    return 4;
  };

  return [...dispatches].sort((left, right) => {
    const statusDiff = weight(left.status) - weight(right.status);
    if (statusDiff !== 0) return statusDiff;
    const scheduledDiff = new Date(right.scheduledAt).getTime() - new Date(left.scheduledAt).getTime();
    if (scheduledDiff !== 0) return scheduledDiff;
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

function pruneSelectedGroupJids(groups: ScheduledDispatchGroup[], groupJids: string[]) {
  if (groupJids.length === 0) return groupJids;
  const known = new Set(groups.map((group) => group.jid));
  return groupJids.filter((jid) => known.has(jid));
}

function buildCampaignSummaries(dispatches: ScheduledDispatchHistoryItem[]): CampaignHistorySummary[] {
  const byCampaign = new Map<string, CampaignHistorySummary>();
  for (const dispatch of dispatches) {
    if (!dispatch.campaignId || !dispatch.campaign) continue;
    const current = byCampaign.get(dispatch.campaignId) ?? {
      campaignId: dispatch.campaignId,
      total: 0,
      sent: 0,
      scheduled: 0,
      processing: 0,
      failed: 0,
      cancelled: 0,
      firstScheduledAt: dispatch.scheduledAt,
      lastScheduledAt: dispatch.scheduledAt,
      campaign: dispatch.campaign,
    };
    current.total += 1;
    if (dispatch.status === "SENT") current.sent += 1;
    if (dispatch.status === "SCHEDULED") current.scheduled += 1;
    if (dispatch.status === "PROCESSING") current.processing += 1;
    if (dispatch.status === "FAILED") current.failed += 1;
    if (dispatch.status === "CANCELLED") current.cancelled += 1;
    if (new Date(dispatch.scheduledAt).getTime() < new Date(current.firstScheduledAt).getTime()) current.firstScheduledAt = dispatch.scheduledAt;
    if (new Date(dispatch.scheduledAt).getTime() > new Date(current.lastScheduledAt).getTime()) current.lastScheduledAt = dispatch.scheduledAt;
    byCampaign.set(dispatch.campaignId, current);
  }
  return Array.from(byCampaign.values()).sort((left, right) => new Date(right.campaign.createdAt).getTime() - new Date(left.campaign.createdAt).getTime());
}

export function ScheduledDispatchPage() {
  const { addToast } = useToast();
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const templateMediaInputRef = useRef<HTMLInputElement | null>(null);
  const [activeView, setActiveView] = useState<"composer" | "history">("composer");
  const [historyPage, setHistoryPage] = useState(1);
  const [instances, setInstances] = useState<InstanceOption[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(true);
  const [instancesError, setInstancesError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ScheduledDispatchDraft>(() => createInitialScheduledDispatchDraft());
  const [groupSearch, setGroupSearch] = useState("");
  const deferredGroupSearch = useDeferredValue(groupSearch);
  const [groups, setGroups] = useState<ScheduledDispatchGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [syncingGroups, setSyncingGroups] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [lastCreatedIds, setLastCreatedIds] = useState<string[]>([]);
  const [history, setHistory] = useState<ScheduledDispatchHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [templates, setTemplates] = useState<ScheduledDispatchTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const [uploadingTemplateMedia, setUploadingTemplateMedia] = useState(false);

  const validation = useMemo(() => validateScheduledDispatchDraft(draft), [draft]);
  const visibleGroups = useMemo(() => filterScheduledDispatchGroups(groups, deferredGroupSearch), [deferredGroupSearch, groups]);
  const selectedGroups = useMemo(() => groups.filter((group) => draft.groupJids.includes(group.jid)), [draft.groupJids, groups]);
  const parsedPhones = useMemo(() => normalizeScheduledDispatchPhones(draft.phonesText), [draft.phonesText]);
  const destinationCount = draft.targetType === "number" ? parsedPhones.length : draft.groupJids.length;
  const activeDelaySeconds = draft.targetType === "number" ? normalizeScheduledDispatchDelay(draft.numberDelaySeconds) : normalizeScheduledDispatchDelay(draft.groupDelaySeconds);
  const pauseEveryCount = normalizeScheduledDispatchPauseEveryCount(draft.pauseEveryCount);
  const pauseDurationSeconds = normalizeScheduledDispatchDelay(draft.pauseDurationSeconds);
  const rhythmPreview = useMemo(() => calculateScheduledDispatchPreview({
    totalDestinations: destinationCount,
    baseScheduledAt: draft.deliveryMode === "scheduled" && !Number.isNaN(new Date(draft.scheduledAt).getTime()) ? new Date(draft.scheduledAt) : new Date(),
    delaySeconds: Number.isNaN(activeDelaySeconds) ? 0 : activeDelaySeconds,
    pauseEveryCount: Number.isNaN(pauseEveryCount) ? 0 : pauseEveryCount,
    pauseDurationSeconds: Number.isNaN(pauseDurationSeconds) ? 0 : pauseDurationSeconds,
  }), [activeDelaySeconds, destinationCount, draft.deliveryMode, draft.scheduledAt, pauseDurationSeconds, pauseEveryCount]);
  const mediaPreviewEnabled = draft.contentType !== "text" && isSafeMediaUrl(draft.mediaUrl);
  const hasUploadedMedia = draft.contentType !== "text" && Boolean(draft.mediaUrl.trim());
  const selectedTemplate = useMemo(() => templates.find((template) => template.id === selectedTemplateId) ?? null, [selectedTemplateId, templates]);
  const visibleHistory = useMemo(() => sortDispatchHistory(history), [history]);
  const campaignSummaries = useMemo(() => buildCampaignSummaries(visibleHistory), [visibleHistory]);
  const historyTotalPages = Math.max(1, Math.ceil(visibleHistory.length / HISTORY_PAGE_SIZE));
  const currentHistoryPage = Math.min(historyPage, historyTotalPages);
  const pagedHistory = useMemo(() => {
    const start = (currentHistoryPage - 1) * HISTORY_PAGE_SIZE;
    return visibleHistory.slice(start, start + HISTORY_PAGE_SIZE);
  }, [currentHistoryPage, visibleHistory]);

  useEffect(() => {
    let ignore = false;

    async function loadInstances() {
      setLoadingInstances(true);
      try {
        const res = await api.get<InstanceStatus[]>("/agent/instances");
        if (ignore) return;
        const nextInstances = res.data.map((instance) => ({ id: instance.id, name: instance.name }));
        setInstances(nextInstances);
        setInstancesError(null);
        setDraft((current) => {
          if (current.instanceId || nextInstances.length === 0) return current;
          return applyInstanceToDraft(current, nextInstances[0].id);
        });
      } catch (err) {
        console.error(err);
        if (ignore) return;
        setInstancesError("Nao foi possivel carregar as instancias.");
      } finally {
        if (!ignore) setLoadingInstances(false);
      }
    }

    void loadInstances();
    return () => {
      ignore = true;
    };
  }, []);

  async function loadTemplates() {
    setLoadingTemplates(true);
    try {
      const res = await api.get<TemplateListResponse>("/scheduled-dispatch-templates");
      setTemplates(res.data.templates);
      setSelectedTemplateId((current) => current && res.data.templates.some((template) => template.id === current) ? current : "");
    } catch (err) {
      console.error(err);
      addToast("Nao foi possivel carregar os templates.", "error");
    } finally {
      setLoadingTemplates(false);
    }
  }

  useEffect(() => {
    let ignore = false;

    async function syncTemplates() {
      await Promise.resolve();
      if (!ignore) setLoadingTemplates(true);
      try {
        const res = await api.get<TemplateListResponse>("/scheduled-dispatch-templates");
        if (ignore) return;
        setTemplates(res.data.templates);
        setSelectedTemplateId((current) => current && res.data.templates.some((template) => template.id === current) ? current : "");
      } catch (err) {
        console.error(err);
        if (!ignore) setTemplates([]);
      } finally {
        if (!ignore) setLoadingTemplates(false);
      }
    }

    void syncTemplates();
    return () => {
      ignore = true;
    };
  }, []);

  async function loadHistory(instanceId: string) {
    if (!instanceId) {
      setHistory([]);
      setHistoryError(null);
      return;
    }

    setLoadingHistory(true);
    try {
      const res = await api.get<DispatchListResponse>("/scheduled-dispatches", { params: { instanceId } });
      setHistory(res.data.dispatches);
      setHistoryError(null);
    } catch (err) {
      console.error(err);
      setHistory([]);
      setHistoryError("Nao foi possivel carregar o historico de disparos.");
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    let ignore = false;

    async function syncHistory() {
      await Promise.resolve();

      if (!draft.instanceId) {
        if (ignore) return;
        setHistory([]);
        setHistoryError(null);
        setLoadingHistory(false);
        return;
      }

      if (!ignore) setLoadingHistory(true);
      try {
        const res = await api.get<DispatchListResponse>("/scheduled-dispatches", { params: { instanceId: draft.instanceId } });
        if (ignore) return;
        setHistory(res.data.dispatches);
        setHistoryError(null);
      } catch (err) {
        console.error(err);
        if (ignore) return;
        setHistory([]);
        setHistoryError("Nao foi possivel carregar o historico de disparos.");
      } finally {
        if (!ignore) setLoadingHistory(false);
      }
    }

    void syncHistory();
    return () => {
      ignore = true;
    };
  }, [draft.instanceId]);

  useEffect(() => {
    let ignore = false;

    async function loadGroups() {
      await Promise.resolve();

      if (draft.targetType !== "group" || !draft.instanceId) {
        if (ignore) return;
        setGroups([]);
        setGroupsError(null);
        setLoadingGroups(false);
        return;
      }

      if (!ignore) setLoadingGroups(true);
      try {
        const res = await api.get<GroupListResponse>("/scheduled-dispatches/groups", { params: { instanceId: draft.instanceId } });
        if (ignore) return;
        setGroups(res.data.groups);
        setGroupsError(null);
        setDraft((current) => ({ ...current, groupJids: pruneSelectedGroupJids(res.data.groups, current.groupJids) }));
      } catch (err) {
        console.error(err);
        if (ignore) return;
        setGroups([]);
        setGroupsError("Nao foi possivel carregar os grupos desta instancia.");
      } finally {
        if (!ignore) setLoadingGroups(false);
      }
    }

    void loadGroups();
    return () => {
      ignore = true;
    };
  }, [draft.instanceId, draft.targetType]);

  async function handleSyncGroups() {
    if (!draft.instanceId) {
      addToast("Selecione uma instancia antes de sincronizar grupos.", "error");
      return;
    }

    setSyncingGroups(true);
    try {
      const res = await api.post<GroupSyncResponse>("/scheduled-dispatches/groups/sync", { instanceId: draft.instanceId });
      setGroups(res.data.groups);
      setGroupsError(null);
      setDraft((current) => ({ ...current, groupJids: pruneSelectedGroupJids(res.data.groups, current.groupJids) }));
      addToast(res.data.synced > 0 ? `${res.data.synced} grupo(s) sincronizado(s).` : "Nenhum grupo encontrado para esta instancia.", "success");
    } catch (err) {
      console.error(err);
      setGroupsError("Nao foi possivel sincronizar os grupos desta instancia.");
      addToast("Falha ao sincronizar grupos.", "error");
    } finally {
      setSyncingGroups(false);
    }
  }

  async function handleUploadMedia(file: File) {
    if (!draft.instanceId) {
      addToast("Selecione uma instancia antes de enviar a midia.", "error");
      return;
    }

    const uploadContentType = resolveUploadContentType(file);
    if (!uploadContentType) {
      addToast("Selecione uma imagem ou video valido.", "error");
      return;
    }

    setUploadingMedia(true);
    try {
      const form = new FormData();
      form.append("instanceId", draft.instanceId);
      form.append("contentType", uploadContentType);
      form.append("file", file);
      const res = await api.post<UploadMediaResponse>("/scheduled-dispatches/media", form);
      setDraft((current) => ({
        ...current,
        contentType: uploadContentType,
        mediaUrl: res.data.mediaUrl,
        mediaFileName: res.data.fileName,
      }));
      addToast("Midia enviada com sucesso.", "success");
    } catch (err) {
      console.error(err);
      addToast("Nao foi possivel enviar a midia.", "error");
    } finally {
      setUploadingMedia(false);
    }
  }

  async function handleUploadTemplateMedia(file: File) {
    const uploadContentType = resolveUploadContentType(file);
    if (!uploadContentType) {
      addToast("Selecione uma imagem ou video valido.", "error");
      return;
    }

    setUploadingTemplateMedia(true);
    try {
      const form = new FormData();
      form.append("contentType", uploadContentType);
      form.append("file", file);
      const res = await api.post<UploadMediaResponse>("/scheduled-dispatch-templates/media", form);
      setDraft((current) => ({
        ...current,
        contentType: uploadContentType,
        mediaUrl: res.data.mediaUrl,
        mediaFileName: res.data.fileName,
      }));
      addToast("Midia de template enviada com sucesso.", "success");
    } catch (err) {
      console.error(err);
      addToast("Nao foi possivel enviar a midia do template.", "error");
    } finally {
      setUploadingTemplateMedia(false);
    }
  }

  function handleClearMedia() {
    setDraft((current) => ({
      ...current,
      contentType: "text",
      mediaUrl: "",
      mediaFileName: "",
    }));
  }

  function handleApplyTemplate() {
    if (!selectedTemplate) {
      addToast("Selecione um template para aplicar.", "error");
      return;
    }
    setDraft((current) => applyTemplateToDraft(current, selectedTemplate));
    setTemplateName(selectedTemplate.name);
    addToast("Template aplicado ao conteudo do disparo.", "success");
  }

  async function handleSaveTemplate(mode: "create" | "update") {
    const name = templateName.trim();
    if (!name) {
      addToast("Informe um nome para o template.", "error");
      return;
    }
    if (draft.contentType !== "text" && !isTemplateMediaUrl(draft.mediaUrl)) {
      addToast("Para salvar template com midia, envie a midia pela area de templates.", "error");
      return;
    }

    setSavingTemplate(true);
    try {
      const payload = buildScheduledDispatchTemplatePayload(draft, name);
      const res = mode === "update" && selectedTemplateId
        ? await api.patch<TemplateMutationResponse>(`/scheduled-dispatch-templates/${selectedTemplateId}`, payload)
        : await api.post<TemplateMutationResponse>("/scheduled-dispatch-templates", payload);
      await loadTemplates();
      setSelectedTemplateId(res.data.template.id);
      setTemplateName(res.data.template.name);
      addToast(mode === "update" ? "Template atualizado." : "Template salvo.", "success");
    } catch (err) {
      console.error(err);
      const data = isAxiosError(err) ? err.response?.data as { error?: string } | undefined : undefined;
      addToast(data?.error ?? "Nao foi possivel salvar o template.", "error");
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleDeleteTemplate() {
    if (!selectedTemplateId) {
      addToast("Selecione um template para excluir.", "error");
      return;
    }
    if (!window.confirm("Excluir este template? Disparos ja criados nao serao alterados.")) return;

    setDeletingTemplate(true);
    try {
      await api.delete(`/scheduled-dispatch-templates/${selectedTemplateId}`);
      setSelectedTemplateId("");
      setTemplateName("");
      await loadTemplates();
      addToast("Template excluido.", "success");
    } catch (err) {
      console.error(err);
      addToast("Nao foi possivel excluir o template.", "error");
    } finally {
      setDeletingTemplate(false);
    }
  }

  async function handleSubmit() {
    const currentValidation = validateScheduledDispatchDraft(draft);
    if (!currentValidation.canSubmit) {
      addToast("Revise os campos obrigatorios antes de salvar.", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await api.post<DispatchMutationResponse>("/scheduled-dispatches", {
        instanceId: draft.instanceId,
        targetType: draft.targetType,
        phones: draft.targetType === "number" ? normalizeScheduledDispatchPhones(draft.phonesText) : null,
        groupJids: draft.targetType === "group" ? draft.groupJids : null,
        numberDelaySeconds: draft.targetType === "number" ? normalizeScheduledDispatchDelay(draft.numberDelaySeconds) : null,
        groupDelaySeconds: draft.targetType === "group" ? normalizeScheduledDispatchDelay(draft.groupDelaySeconds) : null,
        pauseEveryCount: normalizeScheduledDispatchPauseEveryCount(draft.pauseEveryCount),
        pauseDurationSeconds: normalizeScheduledDispatchDelay(draft.pauseDurationSeconds),
        contentType: draft.contentType,
        body: draft.body.trim() || null,
        mediaUrl: draft.contentType === "text" ? null : draft.mediaUrl.trim(),
        buttons: normalizeScheduledDispatchButtons(draft.buttons),
        deliveryMode: draft.deliveryMode,
        scheduledAt: draft.deliveryMode === "scheduled" ? resolveScheduledDispatchIso(draft) : null,
      });
      setLastCreatedIds(res.data.dispatches.map((dispatch) => dispatch.id));
      setDraft((current) => ({
        ...current,
        phonesText: current.targetType === "number" ? "" : current.phonesText,
        contentType: "text",
        body: "",
        mediaUrl: "",
        mediaFileName: "",
        buttons: [],
        scheduledAt: createInitialScheduledDispatchDraft().scheduledAt,
      }));
      setHistoryPage(1);
      try {
        await loadHistory(draft.instanceId);
      } catch (historyError) {
        console.error(historyError);
        addToast("Disparo salvo, mas nao foi possivel atualizar o historico agora.", "error");
      }
      addToast(
        draft.deliveryMode === "immediate"
          ? `${res.data.dispatches.length} envio(s) imediato(s) colocado(s) na fila.`
          : `${res.data.dispatches.length} disparo(s) agendado(s) salvo(s) com sucesso.`,
        "success"
      );
    } catch (err) {
      console.error(err);
      addToast(resolveScheduledDispatchSubmitError(err), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(dispatchId: string) {
    setCancellingId(dispatchId);
    try {
      await api.post<DispatchMutationResponse>(`/scheduled-dispatches/${dispatchId}/cancel`);
      setHistoryPage(1);
      await loadHistory(draft.instanceId);
      addToast("Disparo cancelado.", "success");
    } catch (err) {
      console.error(err);
      addToast("Nao foi possivel cancelar o disparo.", "error");
    } finally {
      setCancellingId(null);
    }
  }

  async function handleClearHistory() {
    if (!draft.instanceId) {
      addToast("Selecione uma instancia antes de limpar o historico.", "error");
      return;
    }

    if (!window.confirm("Remover do historico apenas envios finalizados, com falha ou cancelados?")) {
      return;
    }

    setClearingHistory(true);
    try {
      const res = await api.delete<ClearHistoryResponse>("/scheduled-dispatches/history", { params: { instanceId: draft.instanceId } });
      setHistoryPage(1);
      await loadHistory(draft.instanceId);
      addToast(res.data.deleted > 0 ? `${res.data.deleted} item(ns) removido(s) do historico.` : "Nenhum item terminal para remover.", "success");
    } catch (err) {
      console.error(err);
      addToast("Nao foi possivel limpar o historico.", "error");
    } finally {
      setClearingHistory(false);
    }
  }

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="Operacao"
        title="Disparos agendados"
        description="Dispare para numeros ou grupos, com midia local e envio agora ou agendado."
        actions={(
          <Button variant="secondary" onClick={() => void handleSyncGroups()} disabled={draft.targetType !== "group" || !draft.instanceId} loading={syncingGroups}>
            Sincronizar grupos
          </Button>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:max-w-md">
        <Button variant={activeView === "composer" ? "primary" : "secondary"} onClick={() => setActiveView("composer")}>
          Envios
        </Button>
        <Button variant={activeView === "history" ? "primary" : "secondary"} onClick={() => setActiveView("history")}>
          Historico
        </Button>
      </div>

      {activeView === "composer" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <Panel className="p-4 sm:p-5">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Destino</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Escolha a instancia e os destinos do disparo.</p>
            </div>

            {instancesError ? <InlineAlert tone="danger">{instancesError}</InlineAlert> : null}

            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Instancia
              <select
                className={`${selectClassName} mt-2`}
                value={draft.instanceId}
                onChange={(event) => {
                  setHistoryPage(1);
                  setDraft((current) => applyInstanceToDraft(current, event.target.value));
                }}
                disabled={loadingInstances || instances.length === 0}
              >
                <option value="">Selecione uma instancia</option>
                {instances.map((instance) => (
                  <option key={instance.id} value={instance.id}>{instance.name}</option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                variant={draft.targetType === "group" ? "primary" : "secondary"}
                onClick={() => setDraft((current) => ({ ...current, targetType: "group", phonesText: "" }))}
              >
                Grupos
              </Button>
              <Button
                variant={draft.targetType === "number" ? "primary" : "secondary"}
                onClick={() => setDraft((current) => ({ ...current, targetType: "number", groupJids: [] }))}
              >
                Numeros
              </Button>
            </div>

            {draft.targetType === "number" ? (
              <div className="space-y-3">
                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="scheduled-dispatch-phones">
                  Numeros
                </label>
                <textarea
                  id="scheduled-dispatch-phones"
                  className={textareaClassName}
                  placeholder="5511999991234&#10;5511988887777"
                  value={draft.phonesText}
                  onChange={(event) => setDraft((current) => ({ ...current, phonesText: event.target.value }))}
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Use uma linha por numero ou separe por virgula. Repetidos sao removidos automaticamente.</p>
                {validation.phonesText ? <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{validation.phonesText}</p> : null}
                {parsedPhones.length > 0 ? <InlineAlert tone="info" className="mt-3">{parsedPhones.length} numero(s) pronto(s) para o disparo.</InlineAlert> : null}
              </div>
            ) : (
              <div className="space-y-4">
                <Input
                  label="Buscar grupo"
                  placeholder="Nome do grupo ou JID"
                  value={groupSearch}
                  onChange={(event) => setGroupSearch(event.target.value)}
                />

                {validation.groupJids ? <InlineAlert tone="warning">{validation.groupJids}</InlineAlert> : null}
                {groupsError ? <InlineAlert tone="danger">{groupsError}</InlineAlert> : null}
                {loadingGroups ? <InlineAlert tone="info">Carregando grupos da instancia selecionada...</InlineAlert> : null}
                {!loadingGroups && draft.instanceId && groups.length === 0 && !groupsError ? (
                  <InlineAlert tone="warning">
                    Nenhum grupo sincronizado para esta instancia. Use o botao de sincronizacao antes de salvar.
                  </InlineAlert>
                ) : null}

                <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  {visibleGroups.length > 0 ? (
                    <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                      {visibleGroups.map((group) => {
                        const checked = draft.groupJids.includes(group.jid);
                        return (
                          <li key={`${group.instanceId}:${group.jid}`}>
                            <label className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors ${checked ? "bg-emerald-50 dark:bg-emerald-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-900"}`}>
                              <input
                                type="checkbox"
                                className="mt-1"
                                checked={checked}
                                onChange={() => setDraft((current) => ({
                                  ...current,
                                  groupJids: checked
                                    ? current.groupJids.filter((jid) => jid !== group.jid)
                                    : [...current.groupJids, group.jid],
                                }))}
                              />
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{group.name?.trim() || group.jid.split("@")[0] || "Grupo sem nome"}</span>
                                <span className="mt-1 block break-all font-mono text-xs text-slate-500 dark:text-slate-400">{group.jid}</span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="px-4 py-6 text-sm text-slate-600 dark:text-slate-400">
                      {groupSearch.trim() ? "Nenhum grupo encontrado para a busca informada." : "Nenhum grupo disponivel para selecao."}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Panel>

        <Panel className="p-4 sm:p-5">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Envios</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Defina conteudo, midia e quando enviar.</p>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 bg-white/90 p-3 dark:border-slate-800 dark:bg-slate-950/50">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Templates globais</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Reutilize conteudo em qualquer instancia sem alterar destinos ou agenda.</p>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Template
                  <select
                    className={`${selectClassName} mt-2`}
                    value={selectedTemplateId}
                    onChange={(event) => {
                      const template = templates.find((item) => item.id === event.target.value) ?? null;
                      setSelectedTemplateId(event.target.value);
                      setTemplateName(template?.name ?? "");
                    }}
                    disabled={loadingTemplates || templates.length === 0}
                  >
                    <option value="">{templates.length === 0 ? "Nenhum template salvo" : "Selecione um template"}</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                </label>
                <Input
                  label="Nome do template"
                  placeholder="Ex.: Oferta principal"
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => void loadTemplates()} loading={loadingTemplates}>
                  Atualizar templates
                </Button>
                <Button size="sm" variant="secondary" onClick={handleApplyTemplate} disabled={!selectedTemplate}>
                  Aplicar template
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void handleSaveTemplate("create")} loading={savingTemplate}>
                  Salvar como template
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void handleSaveTemplate("update")} disabled={!selectedTemplateId} loading={savingTemplate}>
                  Atualizar template
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void handleDeleteTemplate()} disabled={!selectedTemplateId} loading={deletingTemplate}>
                  Excluir template
                </Button>
              </div>

              <div className="flex flex-col gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400">Para salvar template com imagem ou video, envie a midia global aqui.</p>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={templateMediaInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,video/*"
                    disabled={uploadingTemplateMedia}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void handleUploadTemplateMedia(file);
                        event.target.value = "";
                      }
                    }}
                  />
                  <Button size="sm" variant="secondary" onClick={() => templateMediaInputRef.current?.click()} loading={uploadingTemplateMedia}>
                    Midia de template
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/30">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Midia opcional</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Upload local unico para imagem ou video.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={mediaInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,video/*"
                    disabled={!draft.instanceId || uploadingMedia}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void handleUploadMedia(file);
                        event.target.value = "";
                      }
                    }}
                  />
                  <Button size="sm" variant="secondary" onClick={() => mediaInputRef.current?.click()} disabled={!draft.instanceId || uploadingMedia} loading={uploadingMedia}>
                    Adicionar midia
                  </Button>
                  {hasUploadedMedia ? (
                    <Button size="sm" variant="secondary" onClick={handleClearMedia} disabled={uploadingMedia}>
                      Remover midia
                    </Button>
                  ) : null}
                </div>
              </div>
              {draft.mediaFileName ? <p className="text-xs text-slate-500 dark:text-slate-400">Arquivo atual: <span className="font-medium text-slate-700 dark:text-slate-200">{draft.mediaFileName}</span></p> : null}
              {validation.mediaUrl ? <p className="text-sm text-red-600 dark:text-red-400">{validation.mediaUrl}</p> : null}
            </div>

            {mediaPreviewEnabled && draft.contentType === "image" ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40">
                <img src={draft.mediaUrl} alt="Preview da imagem do disparo" className="max-h-56 w-full object-contain" />
              </div>
            ) : null}

            {mediaPreviewEnabled && draft.contentType === "video" ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950/40">
                <video src={draft.mediaUrl} className="max-h-56 w-full rounded-lg" controls />
              </div>
            ) : null}

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="scheduled-dispatch-body">
                {hasUploadedMedia ? "Legenda (opcional)" : "Mensagem"}
              </label>
              <textarea
                id="scheduled-dispatch-body"
                className={textareaClassName}
                value={draft.body}
                onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
                placeholder={hasUploadedMedia ? "Adicione uma legenda opcional para a midia" : "Escreva a mensagem do disparo"}
              />
              {validation.body ? <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{validation.body}</p> : null}
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/30">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Botoes URL</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Ate {MAX_SCHEDULED_DISPATCH_BUTTONS} links por envio.</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setDraft((current) => current.buttons.length >= MAX_SCHEDULED_DISPATCH_BUTTONS ? current : ({ ...current, buttons: [...current.buttons, createEmptyScheduledDispatchButton()] }))}
                  disabled={draft.buttons.length >= MAX_SCHEDULED_DISPATCH_BUTTONS}
                >
                  Adicionar botao
                </Button>
              </div>

              {draft.buttons.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Sem botoes.</p>
              ) : null}

              {draft.buttons.map((button, index) => (
                <div key={`scheduled-dispatch-button-${index}`} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Botao {index + 1}</span>
                    <Button
                      variant="ghost"
                      onClick={() => setDraft((current) => ({ ...current, buttons: current.buttons.filter((_, currentIndex) => currentIndex !== index) }))}
                    >
                      Remover
                    </Button>
                  </div>
                  <Input
                    label="Texto do botao"
                    placeholder="Ex.: Abrir oferta"
                    value={button.text}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      buttons: current.buttons.map((entry, currentIndex) => currentIndex === index ? { ...entry, text: event.target.value } : entry),
                    }))}
                  />
                  <Input
                    label="URL do botao"
                    placeholder="https://example.com/oferta"
                    value={button.url}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      buttons: current.buttons.map((entry, currentIndex) => currentIndex === index ? { ...entry, url: event.target.value } : entry),
                    }))}
                  />
                </div>
              ))}

              {validation.buttons ? <p className="text-sm text-red-600 dark:text-red-400">{validation.buttons}</p> : null}
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 bg-white/90 p-3 dark:border-slate-800 dark:bg-slate-950/50">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ritmo de envio</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Configure intervalo entre destinos e pausas automaticas por bloco.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  label={draft.targetType === "number" ? "Delay por numero (s)" : "Delay por grupo (s)"}
                  placeholder="0"
                  inputMode="numeric"
                  value={draft.targetType === "number" ? draft.numberDelaySeconds : draft.groupDelaySeconds}
                  onChange={(event) => setDraft((current) => draft.targetType === "number"
                    ? { ...current, numberDelaySeconds: event.target.value }
                    : { ...current, groupDelaySeconds: event.target.value })}
                />
                <Input
                  label="Pausar a cada"
                  placeholder="0"
                  inputMode="numeric"
                  value={draft.pauseEveryCount}
                  onChange={(event) => setDraft((current) => ({ ...current, pauseEveryCount: event.target.value }))}
                />
                <Input
                  label="Pausar por (s)"
                  placeholder="0"
                  inputMode="numeric"
                  value={draft.pauseDurationSeconds}
                  onChange={(event) => setDraft((current) => ({ ...current, pauseDurationSeconds: event.target.value }))}
                />
              </div>
              {validation.numberDelaySeconds ? <p className="text-sm text-red-600 dark:text-red-400">{validation.numberDelaySeconds}</p> : null}
              {validation.groupDelaySeconds ? <p className="text-sm text-red-600 dark:text-red-400">{validation.groupDelaySeconds}</p> : null}
              {validation.pauseEveryCount ? <p className="text-sm text-red-600 dark:text-red-400">{validation.pauseEveryCount}</p> : null}
              {validation.pauseDurationSeconds ? <p className="text-sm text-red-600 dark:text-red-400">{validation.pauseDurationSeconds}</p> : null}
              <div className="grid gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400 sm:grid-cols-2 xl:grid-cols-4">
                <span>Total: <strong className="text-slate-900 dark:text-slate-100">{rhythmPreview.totalDestinations}</strong></span>
                <span>Delay: <strong className="text-slate-900 dark:text-slate-100">{rhythmPreview.delaySeconds}s</strong></span>
                <span>Pausas: <strong className="text-slate-900 dark:text-slate-100">{rhythmPreview.estimatedPauseCount}</strong></span>
                <span>Termino estimado: <strong className="text-slate-900 dark:text-slate-100">{formatDateTime(rhythmPreview.estimatedFinishAt.toISOString())}</strong></span>
              </div>
            </div>

            {selectedGroups.length > 0 ? (
              <InlineAlert tone="success" title="Grupos selecionados">
                {selectedGroups.length} grupo(s) vinculado(s) ao disparo atual.
              </InlineAlert>
            ) : null}

            {lastCreatedIds.length > 0 ? (
              <InlineAlert tone="info" title="Ultimos jobs criados">
                <span className="font-mono text-xs">{lastCreatedIds.join(", ")}</span>
              </InlineAlert>
            ) : null}

            <div className="space-y-3 rounded-xl border border-slate-200 bg-white/90 p-3 dark:border-slate-800 dark:bg-slate-950/50">
              <div className="grid gap-2 sm:grid-cols-2">
                {(["immediate", "scheduled"] as ScheduledDispatchDeliveryMode[]).map((deliveryMode) => (
                  <Button
                    key={deliveryMode}
                    size="sm"
                    variant={draft.deliveryMode === deliveryMode ? "primary" : "secondary"}
                    onClick={() => setDraft((current) => ({ ...current, deliveryMode }))}
                  >
                    {deliveryModeLabels[deliveryMode]}
                  </Button>
                ))}
              </div>

              {draft.deliveryMode === "immediate" ? (
                <InlineAlert tone="info">O job sera criado com timestamp atual para processamento imediato pelo worker.</InlineAlert>
              ) : (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="scheduled-dispatch-date">
                    Agendar para
                  </label>
                  <input
                    id="scheduled-dispatch-date"
                    type="datetime-local"
                    className={selectClassName}
                    value={draft.scheduledAt}
                    onChange={(event) => setDraft((current) => ({ ...current, scheduledAt: event.target.value }))}
                  />
                  {validation.scheduledAt ? <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{validation.scheduledAt}</p> : null}
                </div>
              )}

              <div className="rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
                Conteudo atual: <span className="font-semibold text-slate-900 dark:text-slate-100">{draft.contentType === "text" ? "Sem midia" : contentTypeLabels[draft.contentType]}</span>
                {" · "}
                Modo: <span className="font-semibold text-slate-900 dark:text-slate-100">{deliveryModeLabels[draft.deliveryMode]}</span>
                {" · "}
                Destinos: <span className="font-semibold text-slate-900 dark:text-slate-100">{destinationCount}</span>
                {" · "}
                Atraso: <span className="font-semibold text-slate-900 dark:text-slate-100">{Number.isNaN(activeDelaySeconds) ? 0 : activeDelaySeconds}s</span>
                {" · "}
                Pausas: <span className="font-semibold text-slate-900 dark:text-slate-100">{rhythmPreview.estimatedPauseCount}</span>
              </div>

              <Button onClick={() => void handleSubmit()} loading={saving} disabled={!validation.canSubmit || uploadingMedia} className="w-full">
                {draft.deliveryMode === "immediate" ? "Criar envio imediato" : "Salvar disparo agendado"}
              </Button>
            </div>
          </div>
        </Panel>
      </div>

      ) : null}

      {activeView === "history" ? (
      <Panel className="p-4 sm:p-5">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Historico operacional</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Consulte status e cancele jobs pendentes.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => { setHistoryPage(1); void loadHistory(draft.instanceId); }} disabled={!draft.instanceId} loading={loadingHistory}>
                Atualizar historico
              </Button>
              <Button variant="secondary" onClick={() => void handleClearHistory()} disabled={!draft.instanceId} loading={clearingHistory}>
                Limpar historico
              </Button>
            </div>
          </div>

          {historyError ? <InlineAlert tone="danger">{historyError}</InlineAlert> : null}
          {loadingHistory ? <InlineAlert tone="info">Carregando historico dos disparos...</InlineAlert> : null}
          {!loadingHistory && !historyError && visibleHistory.length === 0 ? (
            <InlineAlert tone="info">Nenhum disparo encontrado para a instancia selecionada.</InlineAlert>
          ) : null}

          {campaignSummaries.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {campaignSummaries.slice(0, 6).map((summary) => (
                <div key={summary.campaignId} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/35">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Campanha {summary.campaignId.slice(0, 8)}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{summary.campaign.targetType === "NUMBER" ? "Numeros" : "Grupos"} · delay {summary.campaign.delaySeconds}s · pausa a cada {summary.campaign.pauseEveryCount || "-"}</p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">{summary.total}/{summary.campaign.totalDestinations}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400 sm:grid-cols-5">
                    <span>Enviados <strong className="block text-slate-900 dark:text-slate-100">{summary.sent}</strong></span>
                    <span>Pendentes <strong className="block text-slate-900 dark:text-slate-100">{summary.scheduled}</strong></span>
                    <span>Falhos <strong className="block text-slate-900 dark:text-slate-100">{summary.failed}</strong></span>
                    <span>Cancelados <strong className="block text-slate-900 dark:text-slate-100">{summary.cancelled}</strong></span>
                    <span>Processando <strong className="block text-slate-900 dark:text-slate-100">{summary.processing}</strong></span>
                  </div>
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Janela: {formatDateTime(summary.firstScheduledAt)} ate {formatDateTime(summary.lastScheduledAt)}</p>
                </div>
              ))}
            </div>
          ) : null}

          {pagedHistory.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {pagedHistory.map((dispatch) => (
                  <li key={dispatch.id} className="bg-white px-3 py-3 dark:bg-slate-950/40">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusToneClassName[dispatch.status]}`}>{SCHEDULED_DISPATCH_STATUS_LABELS[dispatch.status]}</span>
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{historyContentTypeLabels[dispatch.contentType]}</span>
                          {dispatch.campaignId ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-300">Campanha {dispatch.campaignId.slice(0, 8)}</span> : null}
                          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{dispatch.id}</span>
                        </div>

                        <div className="grid gap-2 text-xs text-slate-600 dark:text-slate-400 sm:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">Destino</span>
                            <span className="block break-all font-mono">{resolveScheduledDispatchTargetLabel(dispatch)}</span>
                          </div>
                          <div>
                            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">Agendado</span>
                            <span className="block">{formatDateTime(dispatch.scheduledAt)}</span>
                          </div>
                          <div>
                            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">Processado</span>
                            <span className="block">{formatDateTime(dispatch.processedAt)}</span>
                          </div>
                          <div>
                            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">Provider ID</span>
                            <span className="block break-all font-mono">{dispatch.providerMessageId || "-"}</span>
                          </div>
                        </div>

                        {dispatch.body ? (
                          <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-300">{dispatch.body}</p>
                        ) : null}

                        {dispatch.buttons.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {dispatch.buttons.map((button, index) => (
                              <a key={`${dispatch.id}-button-${index}`} href={button.url} target="_blank" rel="noreferrer" className="inline-flex rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-emerald-500 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-emerald-400 dark:hover:text-emerald-300">
                                {button.text}
                              </a>
                            ))}
                          </div>
                        ) : null}

                        {dispatch.failureCode || dispatch.providerError ? (
                          <InlineAlert tone="danger" title={dispatch.failureCode || "Falha"}>
                            {dispatch.providerError || "O worker registrou falha sem detalhe adicional."}
                          </InlineAlert>
                        ) : null}

                        {dispatch.status === "FAILED" ? (
                          <p className="text-xs text-slate-500 dark:text-slate-500">Falhas permanecem visiveis no historico. Retry automatico fica fora do MVP desta rodada.</p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-start gap-2 self-start">
                        {canCancelScheduledDispatch(dispatch.status) ? (
                          <Button
                            variant="secondary"
                            onClick={() => void handleCancel(dispatch.id)}
                            loading={cancellingId === dispatch.id}
                            disabled={cancellingId !== null && cancellingId !== dispatch.id}
                          >
                            Cancelar job
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {visibleHistory.length > HISTORY_PAGE_SIZE ? (
            <div className="flex flex-col gap-3 border-t border-slate-200 pt-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <span>Pagina {currentHistoryPage} de {historyTotalPages} · {visibleHistory.length} itens</span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setHistoryPage((current) => Math.max(1, current - 1))} disabled={currentHistoryPage === 1}>
                  Anterior
                </Button>
                <Button variant="secondary" onClick={() => setHistoryPage((current) => Math.min(historyTotalPages, current + 1))} disabled={currentHistoryPage === historyTotalPages}>
                  Proxima
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Panel>
      ) : null}
    </section>
  );
}
