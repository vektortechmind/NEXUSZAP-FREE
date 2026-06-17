export type ScheduledDispatchTargetType = "number" | "group";
export type ScheduledDispatchContentType = "text" | "image" | "video";
export type ScheduledDispatchDeliveryMode = "immediate" | "scheduled";
export type ScheduledDispatchUrlButton = {
  text: string;
  url: string;
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
  phone: string;
  groupJid: string;
  contentType: ScheduledDispatchContentType;
  body: string;
  mediaUrl: string;
  buttons: ScheduledDispatchUrlButton[];
  deliveryMode: ScheduledDispatchDeliveryMode;
  scheduledAt: string;
};

export type ScheduledDispatchDraftValidation = {
  phone?: string;
  groupJid?: string;
  body?: string;
  mediaUrl?: string;
  buttons?: string;
  scheduledAt?: string;
  instanceId?: string;
  canSubmit: boolean;
};

export const MAX_SCHEDULED_DISPATCH_BUTTONS = 3;
export const MAX_SCHEDULED_DISPATCH_BUTTON_TEXT_LENGTH = 60;

export function createEmptyScheduledDispatchButton(): ScheduledDispatchUrlButton {
  return { text: "", url: "" };
}

export function createInitialScheduledDispatchDraft(now = new Date()): ScheduledDispatchDraft {
  const nextSlot = new Date(now.getTime() + 15 * 60 * 1000);
  nextSlot.setSeconds(0, 0);
  return {
    instanceId: "",
    targetType: "group",
    phone: "",
    groupJid: "",
    contentType: "text",
    body: "",
    mediaUrl: "",
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
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function normalizeScheduledDispatchButtons(buttons: ScheduledDispatchUrlButton[]) {
  return buttons
    .map((button) => ({ text: button.text.trim(), url: button.url.trim() }))
    .filter((button) => button.text || button.url);
}

export function applyInstanceToDraft(draft: ScheduledDispatchDraft, instanceId: string): ScheduledDispatchDraft {
  if (draft.instanceId === instanceId) return draft;
  return {
    ...draft,
    instanceId,
    groupJid: "",
  };
}

export function filterScheduledDispatchGroups(groups: ScheduledDispatchGroup[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return groups;
  return groups.filter((group) => [group.name ?? "", group.jid].some((value) => value.toLowerCase().includes(query)));
}

export function resolveScheduledDispatchIso(draft: ScheduledDispatchDraft, now = new Date()) {
  if (draft.deliveryMode === "immediate") return now.toISOString();
  return new Date(draft.scheduledAt).toISOString();
}

export function validateScheduledDispatchDraft(draft: ScheduledDispatchDraft): ScheduledDispatchDraftValidation {
  const result: ScheduledDispatchDraftValidation = { canSubmit: true };
  const buttons = normalizeScheduledDispatchButtons(draft.buttons);

  if (!draft.instanceId.trim()) {
    result.instanceId = "Selecione uma instancia.";
    result.canSubmit = false;
  }

  if (draft.targetType === "number") {
    const digits = draft.phone.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) {
      result.phone = "Informe um numero valido.";
      result.canSubmit = false;
    }
  }

  if (draft.targetType === "group" && !draft.groupJid.trim()) {
    result.groupJid = "Selecione um grupo valido.";
    result.canSubmit = false;
  }

  if (draft.contentType === "text") {
    if (!draft.body.trim()) {
      result.body = "Escreva a mensagem do disparo.";
      result.canSubmit = false;
    }
    if (draft.mediaUrl.trim()) {
      result.mediaUrl = "Disparo de texto nao aceita media URL.";
      result.canSubmit = false;
    }
  }

  if ((draft.contentType === "image" || draft.contentType === "video") && !isSafeMediaUrl(draft.mediaUrl)) {
    result.mediaUrl = "Informe uma media URL valida com http ou https.";
    result.canSubmit = false;
  }

  if (buttons.length > MAX_SCHEDULED_DISPATCH_BUTTONS) {
    result.buttons = `Adicione no maximo ${MAX_SCHEDULED_DISPATCH_BUTTONS} botoes URL.`;
    result.canSubmit = false;
  } else if (draft.contentType === "video" && buttons.length > 0) {
    result.buttons = "Video nao suporta botoes URL nesta etapa.";
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
      if (!isSafeMediaUrl(button.url)) {
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
