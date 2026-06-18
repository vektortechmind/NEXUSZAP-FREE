export type ScheduledDispatchTargetType = "number" | "group";
export type ScheduledDispatchContentType = "text" | "image" | "video";
export type ScheduledDispatchDeliveryMode = "immediate" | "scheduled";
export type ScheduledDispatchUrlButton = {
  text: string;
  url: string;
};

export type ScheduledDispatchStatus = "SCHEDULED" | "PROCESSING" | "SENT" | "FAILED" | "CANCELLED";

export type ScheduledDispatchHistoryItem = {
  id: string;
  instanceId: string;
  targetType: "NUMBER" | "GROUP";
  recipientPhone: string | null;
  recipientJid: string | null;
  contentType: "TEXT" | "IMAGE" | "VIDEO";
  body: string | null;
  mediaUrl: string | null;
  buttons: ScheduledDispatchUrlButton[];
  campaignId: string | null;
  campaign: ScheduledDispatchCampaignSummary | null;
  scheduledAt: string;
  status: ScheduledDispatchStatus;
  providerMessageId: string | null;
  failureCode: string | null;
  providerError: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ScheduledDispatchCampaignSummary = {
  id: string;
  instanceId: string;
  targetType: "NUMBER" | "GROUP";
  totalDestinations: number;
  baseScheduledAt: string;
  delaySeconds: number;
  pauseEveryCount: number;
  pauseDurationSeconds: number;
  createdAt: string;
  updatedAt: string;
};

export type ScheduledDispatchGroup = {
  instanceId: string;
  jid: string;
  name: string | null;
  lastMessageAt: string;
  updatedAt: string;
};

export type ScheduledDispatchDraft = {
  instanceId: string;
  targetType: ScheduledDispatchTargetType;
  phonesText: string;
  groupJids: string[];
  numberDelaySeconds: string;
  groupDelaySeconds: string;
  pauseEveryCount: string;
  pauseDurationSeconds: string;
  contentType: ScheduledDispatchContentType;
  body: string;
  mediaUrl: string;
  mediaFileName: string;
  buttons: ScheduledDispatchUrlButton[];
  deliveryMode: ScheduledDispatchDeliveryMode;
  scheduledAt: string;
};

export type ScheduledDispatchDraftValidation = {
  phonesText?: string;
  groupJids?: string;
  body?: string;
  mediaUrl?: string;
  buttons?: string;
  scheduledAt?: string;
  instanceId?: string;
  numberDelaySeconds?: string;
  groupDelaySeconds?: string;
  pauseEveryCount?: string;
  pauseDurationSeconds?: string;
  canSubmit: boolean;
};

export const MAX_SCHEDULED_DISPATCH_BUTTONS = 3;
export const MAX_SCHEDULED_DISPATCH_BUTTON_TEXT_LENGTH = 60;

export const SCHEDULED_DISPATCH_STATUS_LABELS: Record<ScheduledDispatchStatus, string> = {
  SCHEDULED: "Agendado",
  PROCESSING: "Processando",
  SENT: "Enviado",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
};

export function createEmptyScheduledDispatchButton() {
  return { text: "", url: "" };
}

export function createInitialScheduledDispatchDraft(now = new Date()): ScheduledDispatchDraft {
  const nextSlot = new Date(now.getTime() + 15 * 60 * 1000);
  nextSlot.setSeconds(0, 0);
  return {
    instanceId: "",
    targetType: "group",
    phonesText: "",
    groupJids: [],
    numberDelaySeconds: "0",
    groupDelaySeconds: "0",
    pauseEveryCount: "0",
    pauseDurationSeconds: "0",
    contentType: "text",
    body: "",
    mediaUrl: "",
    mediaFileName: "",
    buttons: [],
    deliveryMode: "scheduled",
    scheduledAt: formatDateTimeLocal(nextSlot),
  };
}

export function formatDateTimeLocal(value: Date) {
  const offsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function isSafeMediaUrl(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith("/api/scheduled-dispatches/media/");
}

export function normalizeScheduledDispatchButtons(buttons: ScheduledDispatchUrlButton[]) {
  return buttons
    .map((button) => ({ text: button.text.trim(), url: button.url.trim() }))
    .filter((button) => button.text || button.url);
}

function normalizeBrazilPhoneDigits(digits: string) {
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
    return `55${digits}`;
  }

  return digits;
}

export function normalizeScheduledDispatchPhones(phonesText: string) {
  const unique = new Set<string>();
  return phonesText
    .split(/[\n,;]+/)
    .map((entry) => normalizeBrazilPhoneDigits(entry.replace(/\D/g, "")))
    .filter((entry) => entry.length > 0)
    .filter((entry) => {
      if (unique.has(entry)) return false;
      unique.add(entry);
      return true;
    });
}

export function applyInstanceToDraft(draft: ScheduledDispatchDraft, instanceId: string): ScheduledDispatchDraft {
  if (draft.instanceId === instanceId) return draft;
  return {
    ...draft,
    instanceId,
    groupJids: [],
    mediaUrl: "",
    mediaFileName: "",
  };
}

export function filterScheduledDispatchGroups(groups: ScheduledDispatchGroup[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return groups;
  return groups.filter((group) => [group.name ?? "", group.jid].some((value) => value.toLowerCase().includes(query)));
}

export function normalizeScheduledDispatchDelay(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

export function normalizeScheduledDispatchPauseEveryCount(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

export function calculateScheduledDispatchPreview(input: {
  totalDestinations: number;
  baseScheduledAt: Date;
  delaySeconds: number;
  pauseEveryCount: number;
  pauseDurationSeconds: number;
}) {
  const pauseEnabled = input.pauseEveryCount > 0 && input.pauseDurationSeconds > 0;
  const estimatedPauseCount = pauseEnabled && input.totalDestinations > 0
    ? Math.floor((input.totalDestinations - 1) / input.pauseEveryCount)
    : 0;
  const lastIndex = Math.max(0, input.totalDestinations - 1);
  const offsetSeconds = (lastIndex * input.delaySeconds) + (estimatedPauseCount * input.pauseDurationSeconds);
  return {
    totalDestinations: input.totalDestinations,
    delaySeconds: input.delaySeconds,
    pauseEveryCount: input.pauseEveryCount,
    pauseDurationSeconds: input.pauseDurationSeconds,
    estimatedPauseCount,
    estimatedFinishAt: new Date(input.baseScheduledAt.getTime() + (offsetSeconds * 1000)),
  };
}

export function resolveScheduledDispatchIso(draft: ScheduledDispatchDraft, now = new Date()) {
  if (draft.deliveryMode === "immediate") return now.toISOString();
  return new Date(draft.scheduledAt).toISOString();
}

function isSafeButtonUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function validateScheduledDispatchDraft(draft: ScheduledDispatchDraft): ScheduledDispatchDraftValidation {
  const result: ScheduledDispatchDraftValidation = { canSubmit: true };
  const buttons = normalizeScheduledDispatchButtons(draft.buttons);

  if (!draft.instanceId.trim()) {
    result.instanceId = "Selecione uma instancia.";
    result.canSubmit = false;
  }

  if (draft.targetType === "number") {
    const phones = normalizeScheduledDispatchPhones(draft.phonesText);
    if (phones.length === 0 || phones.some((phone) => phone.length < 8 || phone.length > 15)) {
      result.phonesText = "Informe ao menos um numero valido.";
      result.canSubmit = false;
    }

    const numberDelaySeconds = normalizeScheduledDispatchDelay(draft.numberDelaySeconds);
    if (Number.isNaN(numberDelaySeconds) || numberDelaySeconds > 86_400) {
      result.numberDelaySeconds = "Informe um atraso entre 0 e 86400 segundos.";
      result.canSubmit = false;
    }
  }

  if (draft.targetType === "group" && draft.groupJids.length === 0) {
    result.groupJids = "Selecione ao menos um grupo valido.";
    result.canSubmit = false;
  }

  if (draft.targetType === "group") {
    const groupDelaySeconds = normalizeScheduledDispatchDelay(draft.groupDelaySeconds);
    if (Number.isNaN(groupDelaySeconds) || groupDelaySeconds > 86_400) {
      result.groupDelaySeconds = "Informe um atraso entre 0 e 86400 segundos.";
      result.canSubmit = false;
    }
  }

  const pauseEveryCount = normalizeScheduledDispatchPauseEveryCount(draft.pauseEveryCount);
  if (Number.isNaN(pauseEveryCount) || pauseEveryCount > 10_000) {
    result.pauseEveryCount = "Informe uma pausa a cada entre 0 e 10000 envios.";
    result.canSubmit = false;
  }

  const pauseDurationSeconds = normalizeScheduledDispatchDelay(draft.pauseDurationSeconds);
  if (Number.isNaN(pauseDurationSeconds) || pauseDurationSeconds > 86_400) {
    result.pauseDurationSeconds = "Informe uma duracao de pausa entre 0 e 86400 segundos.";
    result.canSubmit = false;
  }

  if (draft.contentType === "text") {
    if (!draft.body.trim()) {
      result.body = "Escreva a mensagem do disparo.";
      result.canSubmit = false;
    }
    if (draft.mediaUrl.trim()) {
      result.mediaUrl = "Disparo de texto nao aceita midia.";
      result.canSubmit = false;
    }
  }

  if ((draft.contentType === "image" || draft.contentType === "video") && !isSafeMediaUrl(draft.mediaUrl)) {
    result.mediaUrl = draft.contentType === "image"
      ? "Envie uma imagem local para o disparo."
      : "Envie um video local para o disparo.";
    result.canSubmit = false;
  }

  if (buttons.length > MAX_SCHEDULED_DISPATCH_BUTTONS) {
    result.buttons = `Adicione no maximo ${MAX_SCHEDULED_DISPATCH_BUTTONS} botoes URL.`;
    result.canSubmit = false;
  } else {
    for (const [index, button] of buttons.entries()) {
      if (!button.text) {
        result.buttons = `Preencha o texto do botao ${index + 1}.`;
        result.canSubmit = false;
        break;
      }
      if (button.text.length > MAX_SCHEDULED_DISPATCH_BUTTON_TEXT_LENGTH) {
        result.buttons = `O texto do botao ${index + 1} excede ${MAX_SCHEDULED_DISPATCH_BUTTON_TEXT_LENGTH} caracteres.`;
        result.canSubmit = false;
        break;
      }
      if (!isSafeButtonUrl(button.url)) {
        result.buttons = `Informe uma URL http/https valida no botao ${index + 1}.`;
        result.canSubmit = false;
        break;
      }
    }
  }

  if (draft.deliveryMode === "scheduled") {
    const scheduledAt = draft.scheduledAt.trim();
    if (!scheduledAt || Number.isNaN(new Date(scheduledAt).getTime())) {
      result.scheduledAt = "Informe uma data e hora validas.";
      result.canSubmit = false;
    }
  }

  return result;
}

export function canCancelScheduledDispatch(status: ScheduledDispatchStatus) {
  return status === "SCHEDULED";
}

export function resolveScheduledDispatchTargetLabel(item: ScheduledDispatchHistoryItem) {
  if (item.targetType === "GROUP") return item.recipientJid || "Grupo";
  return item.recipientPhone || "Numero";
}
