import { useDeferredValue, useEffect, useMemo, useState } from "react";
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
  createEmptyScheduledDispatchButton,
  createInitialScheduledDispatchDraft,
  filterScheduledDispatchGroups,
  isSafeMediaUrl,
  MAX_SCHEDULED_DISPATCH_BUTTONS,
  normalizeScheduledDispatchButtons,
  resolveScheduledDispatchIso,
  type ScheduledDispatchContentType,
  type ScheduledDispatchDeliveryMode,
  type ScheduledDispatchDraft,
  type ScheduledDispatchGroup,
  type ScheduledDispatchUrlButton,
  validateScheduledDispatchDraft,
} from "../features/scheduled-dispatch/state";

type GroupListResponse = { groups: ScheduledDispatchGroup[] };
type GroupSyncResponse = { synced: number; groups: ScheduledDispatchGroup[] };
type DispatchCreateResponse = {
  dispatch: {
    id: string;
    instanceId: string;
    targetType: "NUMBER" | "GROUP";
    recipientPhone: string | null;
    recipientJid: string | null;
    contentType: "TEXT" | "IMAGE" | "VIDEO";
    body: string | null;
    mediaUrl: string | null;
    buttons: Array<{ text: string; url: string }>;
    scheduledAt: string;
    status: string;
  };
};

const selectClassName = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-colors duration-200 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/25";
const textareaClassName = `${selectClassName} min-h-32 resize-y`;

type InstanceOption = { id: string; name: string };

const contentTypeLabels: Record<ScheduledDispatchContentType, string> = {
  text: "Texto",
  image: "Imagem",
  video: "Video",
};

const deliveryModeLabels: Record<ScheduledDispatchDeliveryMode, string> = {
  immediate: "Enviar agora",
  scheduled: "Agendar",
};

function clearButtonsForVideo(buttons: ScheduledDispatchUrlButton[]) {
  return buttons.length > 0 ? [] : buttons;
}

export function ScheduledDispatchPage() {
  const { addToast } = useToast();
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
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);

  const validation = useMemo(() => validateScheduledDispatchDraft(draft), [draft]);
  const visibleGroups = useMemo(() => filterScheduledDispatchGroups(groups, deferredGroupSearch), [deferredGroupSearch, groups]);
  const selectedGroup = useMemo(() => groups.find((group) => group.jid === draft.groupJid) ?? null, [draft.groupJid, groups]);
  const mediaPreviewEnabled = draft.contentType !== "text" && isSafeMediaUrl(draft.mediaUrl);

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

  useEffect(() => {
    if (draft.targetType !== "group" || !draft.instanceId) {
      setGroups([]);
      setGroupsError(null);
      return;
    }

    let ignore = false;

    async function loadGroups() {
      setLoadingGroups(true);
      try {
        const res = await api.get<GroupListResponse>("/scheduled-dispatches/groups", { params: { instanceId: draft.instanceId } });
        if (ignore) return;
        setGroups(res.data.groups);
        setGroupsError(null);
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

  useEffect(() => {
    if (draft.targetType !== "group" || !draft.groupJid) return;
    if (groups.some((group) => group.jid === draft.groupJid)) return;
    setDraft((current) => ({ ...current, groupJid: "" }));
  }, [draft.groupJid, draft.targetType, groups]);

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
      addToast(res.data.synced > 0 ? `${res.data.synced} grupo(s) sincronizado(s).` : "Nenhum grupo encontrado para esta instancia.", "success");
    } catch (err) {
      console.error(err);
      setGroupsError("Nao foi possivel sincronizar os grupos desta instancia.");
      addToast("Falha ao sincronizar grupos.", "error");
    } finally {
      setSyncingGroups(false);
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
      const res = await api.post<DispatchCreateResponse>("/scheduled-dispatches", {
        instanceId: draft.instanceId,
        targetType: draft.targetType,
        phone: draft.targetType === "number" ? draft.phone : null,
        groupJid: draft.targetType === "group" ? draft.groupJid : null,
        contentType: draft.contentType,
        body: draft.body.trim() || null,
        mediaUrl: draft.contentType === "text" ? null : draft.mediaUrl.trim(),
        buttons: draft.contentType === "video" ? [] : normalizeScheduledDispatchButtons(draft.buttons),
        deliveryMode: draft.deliveryMode,
        scheduledAt: draft.deliveryMode === "scheduled" ? resolveScheduledDispatchIso(draft) : null,
      });
      setLastCreatedId(res.data.dispatch.id);
      setDraft((current) => ({
        ...current,
        phone: current.targetType === "number" ? "" : current.phone,
        body: "",
        mediaUrl: "",
        buttons: [],
        scheduledAt: createInitialScheduledDispatchDraft().scheduledAt,
      }));
      addToast(
        draft.deliveryMode === "immediate"
          ? "Disparo imediato colocado na fila com sucesso."
          : "Disparo agendado salvo com sucesso.",
        "success"
      );
    } catch (err) {
      console.error(err);
      addToast("Nao foi possivel salvar o disparo.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Operacao"
        title="Disparos agendados"
        description="Monte disparos sem template com texto, imagem ou video, escolhendo envio imediato ou agendado no mesmo fluxo."
        actions={(
          <Button variant="secondary" onClick={() => void handleSyncGroups()} disabled={draft.targetType !== "group" || !draft.instanceId} loading={syncingGroups}>
            Sincronizar grupos
          </Button>
        )}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <Panel className="p-5 sm:p-6">
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Destino</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Selecione a instancia e o alvo do disparo. Para grupos, a escolha continua restrita ao inventario sincronizado da instancia.</p>
            </div>

            {instancesError ? <InlineAlert tone="danger">{instancesError}</InlineAlert> : null}

            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Instancia
              <select
                className={`${selectClassName} mt-2`}
                value={draft.instanceId}
                onChange={(event) => setDraft((current) => applyInstanceToDraft(current, event.target.value))}
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
                onClick={() => setDraft((current) => ({ ...current, targetType: "group", phone: "" }))}
              >
                Grupo
              </Button>
              <Button
                variant={draft.targetType === "number" ? "primary" : "secondary"}
                onClick={() => setDraft((current) => ({ ...current, targetType: "number", groupJid: "" }))}
              >
                Numero
              </Button>
            </div>

            {draft.targetType === "number" ? (
              <Input
                label="Telefone"
                placeholder="5511999991234"
                value={draft.phone}
                onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
                error={validation.phone}
              />
            ) : (
              <div className="space-y-4">
                <Input
                  label="Buscar grupo"
                  placeholder="Nome do grupo ou JID"
                  value={groupSearch}
                  onChange={(event) => setGroupSearch(event.target.value)}
                />

                {validation.groupJid ? <InlineAlert tone="warning">{validation.groupJid}</InlineAlert> : null}
                {groupsError ? <InlineAlert tone="danger">{groupsError}</InlineAlert> : null}
                {loadingGroups ? <InlineAlert tone="info">Carregando grupos da instancia selecionada...</InlineAlert> : null}
                {!loadingGroups && draft.instanceId && groups.length === 0 && !groupsError ? (
                  <InlineAlert tone="warning">
                    Nenhum grupo sincronizado para esta instancia. Use o botao de sincronizacao antes de salvar.
                  </InlineAlert>
                ) : null}

                <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  {visibleGroups.length > 0 ? (
                    <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                      {visibleGroups.map((group) => {
                        const checked = draft.groupJid === group.jid;
                        return (
                          <li key={`${group.instanceId}:${group.jid}`}>
                            <label className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors ${checked ? "bg-emerald-50 dark:bg-emerald-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-900"}`}>
                              <input
                                type="radio"
                                name="scheduled-dispatch-group"
                                className="mt-1"
                                checked={checked}
                                onChange={() => setDraft((current) => ({ ...current, groupJid: group.jid }))}
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

        <Panel className="p-5 sm:p-6">
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Composer</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Escolha o tipo de conteudo, informe a referencia da midia quando necessario e defina se o job entra para envio imediato ou agendado.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {(["text", "image", "video"] as ScheduledDispatchContentType[]).map((contentType) => (
                <Button
                  key={contentType}
                  variant={draft.contentType === contentType ? "primary" : "secondary"}
                  onClick={() => setDraft((current) => ({
                    ...current,
                    contentType,
                    mediaUrl: contentType === "text" ? "" : current.mediaUrl,
                    buttons: contentType === "video" ? clearButtonsForVideo(current.buttons) : current.buttons,
                  }))}
                >
                  {contentTypeLabels[contentType]}
                </Button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(["immediate", "scheduled"] as ScheduledDispatchDeliveryMode[]).map((deliveryMode) => (
                <Button
                  key={deliveryMode}
                  variant={draft.deliveryMode === deliveryMode ? "primary" : "secondary"}
                  onClick={() => setDraft((current) => ({ ...current, deliveryMode }))}
                >
                  {deliveryModeLabels[deliveryMode]}
                </Button>
              ))}
            </div>

            {draft.deliveryMode === "immediate" ? (
              <InlineAlert tone="info">O job sera criado com timestamp atual para processamento imediato pelo worker quando essa etapa for entregue.</InlineAlert>
            ) : null}

            {draft.deliveryMode === "scheduled" ? (
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
            ) : null}

            {draft.contentType !== "text" ? (
              <div className="space-y-3">
                <Input
                  label="Media URL"
                  placeholder={draft.contentType === "image" ? "https://cdn.example.com/banner.png" : "https://cdn.example.com/video.mp4"}
                  value={draft.mediaUrl}
                  onChange={(event) => setDraft((current) => ({ ...current, mediaUrl: event.target.value }))}
                  error={validation.mediaUrl}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">Use uma URL absoluta http/https para a midia que sera consumida pelo job.</p>
              </div>
            ) : null}

            {mediaPreviewEnabled && draft.contentType === "image" ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40">
                <img src={draft.mediaUrl.trim()} alt="Preview da imagem do disparo" className="max-h-72 w-full object-contain" />
              </div>
            ) : null}

            {mediaPreviewEnabled && draft.contentType === "video" ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950/40">
                <video src={draft.mediaUrl.trim()} className="max-h-72 w-full rounded-lg" controls />
              </div>
            ) : null}

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="scheduled-dispatch-body">
                {draft.contentType === "text" ? "Mensagem" : "Legenda (opcional)"}
              </label>
              <textarea
                id="scheduled-dispatch-body"
                className={textareaClassName}
                value={draft.body}
                onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
                placeholder={draft.contentType === "text" ? "Escreva a mensagem do disparo" : "Adicione uma legenda opcional para a midia"}
              />
              {validation.body ? <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{validation.body}</p> : null}
            </div>

            {draft.contentType === "video" ? (
              <InlineAlert tone="warning">Video com botoes URL fica fora do MVP desta etapa. Troque para texto ou imagem para habilitar acoes clicaveis.</InlineAlert>
            ) : (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Botoes opcionais</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Adicione ate {MAX_SCHEDULED_DISPATCH_BUTTONS} URLs controladas pelo painel. O payload cru de provider continua fora de escopo.</p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => setDraft((current) => current.buttons.length >= MAX_SCHEDULED_DISPATCH_BUTTONS ? current : ({ ...current, buttons: [...current.buttons, createEmptyScheduledDispatchButton()] }))}
                    disabled={draft.buttons.length >= MAX_SCHEDULED_DISPATCH_BUTTONS}
                  >
                    Adicionar botao
                  </Button>
                </div>

                {draft.buttons.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum botao configurado. O disparo continua valido sem acoes adicionais.</p>
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
            )}

            {selectedGroup ? (
              <InlineAlert tone="success" title="Grupo selecionado">
                <span className="font-medium">{selectedGroup.name?.trim() || "Grupo sem nome"}</span>
                <span className="mt-1 block font-mono text-xs">{selectedGroup.jid}</span>
              </InlineAlert>
            ) : null}

            {lastCreatedId ? (
              <InlineAlert tone="info" title="Ultimo job criado">
                <span className="font-mono text-xs">{lastCreatedId}</span>
              </InlineAlert>
            ) : null}

            <div className="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
              Conteudo atual: <span className="font-semibold text-slate-900 dark:text-slate-100">{contentTypeLabels[draft.contentType]}</span>
              {" · "}
              Modo: <span className="font-semibold text-slate-900 dark:text-slate-100">{deliveryModeLabels[draft.deliveryMode]}</span>
              {" · "}
              Botoes: <span className="font-semibold text-slate-900 dark:text-slate-100">{normalizeScheduledDispatchButtons(draft.buttons).length}</span>
            </div>

            <Button onClick={() => void handleSubmit()} loading={saving} disabled={!validation.canSubmit} className="w-full sm:w-auto">
              {draft.deliveryMode === "immediate" ? "Criar envio imediato" : "Salvar disparo agendado"}
            </Button>
          </div>
        </Panel>
      </div>
    </section>
  );
}
