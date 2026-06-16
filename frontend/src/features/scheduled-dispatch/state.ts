export type ScheduledDispatchTargetType = "number" | "group";

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
  body: string;
  scheduledAt: string;
};

export type ScheduledDispatchDraftValidation = {
  phone?: string;
  groupJid?: string;
  body?: string;
  scheduledAt?: string;
  instanceId?: string;
  canSubmit: boolean;
};

export function createInitialScheduledDispatchDraft(now = new Date()): ScheduledDispatchDraft {
  const nextSlot = new Date(now.getTime() + 15 * 60 * 1000);
  nextSlot.setSeconds(0, 0);
  return {
    instanceId: "",
    targetType: "group",
    phone: "",
    groupJid: "",
    body: "",
    scheduledAt: formatDateTimeLocal(nextSlot),
  };
}

export function formatDateTimeLocal(value: Date) {
  const offsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
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

export function validateScheduledDispatchDraft(draft: ScheduledDispatchDraft): ScheduledDispatchDraftValidation {
  const result: ScheduledDispatchDraftValidation = { canSubmit: true };

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

  if (!draft.body.trim()) {
    result.body = "Escreva a mensagem do disparo.";
    result.canSubmit = false;
  }

  const scheduledAt = draft.scheduledAt.trim();
  if (!scheduledAt || Number.isNaN(new Date(scheduledAt).getTime())) {
    result.scheduledAt = "Informe uma data e hora validas.";
    result.canSubmit = false;
  }

  return result;
}
