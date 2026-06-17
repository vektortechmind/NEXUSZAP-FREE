import { type ScheduledDispatch, type ScheduledDispatchContentType, type ScheduledDispatchStatus, type ScheduledDispatchTargetType } from "@prisma/client";
import { prisma } from "../database/prisma";

export type ScheduledDispatchRecord = ScheduledDispatch;
export type ScheduledDispatchUrlButton = {
  text: string;
  url: string;
};
export type ScheduledDispatchViewRecord = Omit<ScheduledDispatchRecord, "buttonsJson"> & {
  buttons: ScheduledDispatchUrlButton[];
};

export type ScheduledDispatchGroupTarget = {
  instanceId: string;
  jid: string;
  name: string | null;
  lastMessageAt: Date;
  updatedAt: Date;
};

type ScheduledDispatchCreateInput = {
  instanceId: string;
  targetType: "number" | "group";
  phone?: string | null;
  groupJid?: string | null;
  contentType: "text" | "image" | "video";
  body?: string | null;
  mediaUrl?: string | null;
  buttons?: ScheduledDispatchUrlButton[] | null;
  deliveryMode: "immediate" | "scheduled";
  scheduledAt?: Date | null;
};

type ScheduledDispatchListInput = {
  instanceId?: string;
};

type ScheduledDispatchTransitionInput = {
  id: string;
  from: ScheduledDispatchStatus | ScheduledDispatchStatus[];
  to: ScheduledDispatchStatus;
  providerMessageId?: string | null;
  failureCode?: string | null;
  providerError?: string | null;
  processedAt?: Date | null;
};

export type ScheduledDispatchStore = {
  findInstance(instanceId: string): Promise<{ id: string } | null>;
  listGroupTargets(input: { instanceId: string; search?: string }): Promise<ScheduledDispatchGroupTarget[]>;
  findGroupTarget(input: { instanceId: string; jid: string }): Promise<ScheduledDispatchGroupTarget | null>;
  createDispatch(input: {
    instanceId: string;
    targetType: ScheduledDispatchTargetType;
    recipientPhone?: string | null;
    recipientJid?: string | null;
    contentType: ScheduledDispatchContentType;
    body?: string | null;
    mediaUrl?: string | null;
    buttonsJson?: string | null;
    scheduledAt: Date;
    status: ScheduledDispatchStatus;
  }): Promise<ScheduledDispatchRecord>;
  listDispatches(input: ScheduledDispatchListInput): Promise<ScheduledDispatchRecord[]>;
  listDueDispatches(input: { now: Date; limit: number }): Promise<ScheduledDispatchRecord[]>;
  findDispatchById(id: string): Promise<ScheduledDispatchRecord | null>;
  transitionDispatch(input: ScheduledDispatchTransitionInput): Promise<ScheduledDispatchRecord | null>;
};

export class ScheduledDispatchValidationError extends Error {
  code = "SCHEDULED_DISPATCH_VALIDATION_ERROR";

  constructor(message: string, public statusCode = 400) {
    super(message);
  }
}

export class ScheduledDispatchInstanceNotFoundError extends Error {
  code = "SCHEDULED_DISPATCH_INSTANCE_NOT_FOUND";

  constructor(instanceId: string) {
    super(`Instancia ${instanceId} nao encontrada.`);
  }
}

export class ScheduledDispatchNotFoundError extends Error {
  code = "SCHEDULED_DISPATCH_NOT_FOUND";

  constructor(dispatchId: string) {
    super(`Disparo agendado ${dispatchId} nao encontrado.`);
  }
}

export class ScheduledDispatchConflictError extends Error {
  code = "SCHEDULED_DISPATCH_CONFLICT";

  constructor(message: string, public statusCode = 409) {
    super(message);
  }
}

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) {
    throw new ScheduledDispatchValidationError("Telefone invalido.");
  }
  return digits;
}

function normalizeGroupJid(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized.endsWith("@g.us") || normalized.length > 191) {
    throw new ScheduledDispatchValidationError("Group JID invalido.");
  }
  return normalized;
}

function normalizeOptionalText(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

const MAX_SCHEDULED_DISPATCH_BUTTONS = 3;
const MAX_SCHEDULED_DISPATCH_BUTTON_TEXT_LENGTH = 60;

function normalizeMediaUrl(value?: string | null): string | null {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return null;

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new ScheduledDispatchValidationError("Media URL invalida.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ScheduledDispatchValidationError("Media URL deve usar http ou https.");
  }

  return parsed.toString();
}

function normalizeUrl(value: string, field: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new ScheduledDispatchValidationError(`${field} invalida.`);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ScheduledDispatchValidationError(`${field} deve usar http ou https.`);
  }

  return parsed.toString();
}

function normalizeScheduledDispatchButtons(buttons?: ScheduledDispatchUrlButton[] | null): ScheduledDispatchUrlButton[] {
  if (!buttons?.length) return [];
  if (buttons.length > MAX_SCHEDULED_DISPATCH_BUTTONS) {
    throw new ScheduledDispatchValidationError(`Disparo aceita no maximo ${MAX_SCHEDULED_DISPATCH_BUTTONS} botoes URL.`);
  }

  return buttons.map((button, index) => {
    const text = normalizeOptionalText(button.text);
    if (!text) {
      throw new ScheduledDispatchValidationError(`buttons.${index}.text e obrigatorio.`);
    }
    if (text.length > MAX_SCHEDULED_DISPATCH_BUTTON_TEXT_LENGTH) {
      throw new ScheduledDispatchValidationError(`buttons.${index}.text excede ${MAX_SCHEDULED_DISPATCH_BUTTON_TEXT_LENGTH} caracteres.`);
    }

    const url = normalizeOptionalText(button.url);
    if (!url) {
      throw new ScheduledDispatchValidationError(`buttons.${index}.url e obrigatoria.`);
    }

    return {
      text,
      url: normalizeUrl(url, `buttons.${index}.url`),
    };
  });
}

function serializeScheduledDispatchButtons(buttons: ScheduledDispatchUrlButton[]): string | null {
  return buttons.length ? JSON.stringify(buttons) : null;
}

export function parseScheduledDispatchButtons(buttonsJson: string | null): ScheduledDispatchUrlButton[] {
  if (!buttonsJson) return [];
  try {
    const parsed = JSON.parse(buttonsJson) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const text = normalizeOptionalText((item as { text?: string }).text);
      const url = normalizeOptionalText((item as { url?: string }).url);
      if (!text || !url) return [];
      return [{ text, url }];
    });
  } catch {
    return [];
  }
}

function toScheduledDispatchView(record: ScheduledDispatchRecord): ScheduledDispatchViewRecord {
  const { buttonsJson, ...rest } = record;
  return {
    ...rest,
    buttons: parseScheduledDispatchButtons(buttonsJson),
  };
}

function mapTargetType(value: ScheduledDispatchCreateInput["targetType"]): ScheduledDispatchTargetType {
  return value === "number" ? "NUMBER" : "GROUP";
}

function mapContentType(value: ScheduledDispatchCreateInput["contentType"]): ScheduledDispatchContentType {
  if (value === "image") return "IMAGE";
  if (value === "video") return "VIDEO";
  return "TEXT";
}

function byDispatchHistoryOrder(left: ScheduledDispatchRecord, right: ScheduledDispatchRecord) {
  const weight = (status: ScheduledDispatchStatus) => {
    if (status === "PROCESSING") return 0;
    if (status === "SCHEDULED") return 1;
    if (status === "FAILED") return 2;
    if (status === "SENT") return 3;
    if (status === "CANCELLED") return 4;
    return 5;
  };

  const statusDiff = weight(left.status) - weight(right.status);
  if (statusDiff !== 0) return statusDiff;

  const scheduledDiff = right.scheduledAt.getTime() - left.scheduledAt.getTime();
  if (scheduledDiff !== 0) return scheduledDiff;

  return right.createdAt.getTime() - left.createdAt.getTime();
}

async function transitionDispatchWithPrisma(input: ScheduledDispatchTransitionInput) {
  return prisma.$transaction(async (tx) => {
    const allowedStatuses = Array.isArray(input.from) ? input.from : [input.from];
    const result = await tx.scheduledDispatch.updateMany({
      where: {
        id: input.id,
        status: { in: allowedStatuses },
      },
      data: {
        status: input.to,
        providerMessageId: input.providerMessageId === undefined ? undefined : input.providerMessageId,
        failureCode: input.failureCode === undefined ? undefined : input.failureCode,
        providerError: input.providerError === undefined ? undefined : input.providerError,
        processedAt: input.processedAt === undefined ? undefined : input.processedAt,
      },
    });

    if (result.count !== 1) return null;

    const updated = await tx.scheduledDispatch.findUnique({ where: { id: input.id } });
    if (!updated) return null;

    return updated;
  });
}

export const prismaScheduledDispatchStore: ScheduledDispatchStore = {
  async findInstance(instanceId) {
    return prisma.instance.findUnique({ where: { id: instanceId }, select: { id: true } });
  },

  async listGroupTargets(input) {
    const search = normalizeOptionalText(input.search);
    return prisma.conversation.findMany({
      where: {
        instanceId: input.instanceId,
        isGroup: true,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { jid: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        instanceId: true,
        jid: true,
        name: true,
        lastMessageAt: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: "desc" }, { lastMessageAt: "desc" }, { name: "asc" }],
    });
  },

  async findGroupTarget(input) {
    return prisma.conversation.findFirst({
      where: {
        instanceId: input.instanceId,
        jid: input.jid,
        isGroup: true,
      },
      select: {
        instanceId: true,
        jid: true,
        name: true,
        lastMessageAt: true,
        updatedAt: true,
      },
    });
  },

  async createDispatch(input) {
    return prisma.scheduledDispatch.create({
      data: {
        instanceId: input.instanceId,
        targetType: input.targetType,
        recipientPhone: input.recipientPhone ?? null,
        recipientJid: input.recipientJid ?? null,
        contentType: input.contentType,
        body: input.body ?? null,
        mediaUrl: input.mediaUrl ?? null,
        buttonsJson: input.buttonsJson ?? null,
        scheduledAt: input.scheduledAt,
        status: input.status,
      },
    });
  },

  async listDispatches(input) {
    return prisma.scheduledDispatch.findMany({
      where: input.instanceId ? { instanceId: input.instanceId } : undefined,
      orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
    });
  },

  async listDueDispatches(input) {
    return prisma.scheduledDispatch.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { lte: input.now },
      },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
      take: input.limit,
    });
  },

  async findDispatchById(id) {
    return prisma.scheduledDispatch.findUnique({ where: { id } });
  },

  async transitionDispatch(input) {
    return transitionDispatchWithPrisma(input);
  },
};

export function createInMemoryScheduledDispatchStore(seed: {
  instances?: Array<{ id: string }>;
  groups?: Array<{ instanceId: string; jid: string; name?: string | null; lastMessageAt?: Date; updatedAt?: Date }>;
} = {}): ScheduledDispatchStore & {
  dispatches: Map<string, ScheduledDispatchRecord>;
} {
  const instances = new Map((seed.instances ?? []).map((instance) => [instance.id, instance]));
  const dispatches = new Map<string, ScheduledDispatchRecord>();
  const groups = new Map<string, ScheduledDispatchGroupTarget>(
    (seed.groups ?? []).map((group) => {
      const lastMessageAt = group.lastMessageAt ?? new Date();
      const updatedAt = group.updatedAt ?? lastMessageAt;
      const jid = normalizeGroupJid(group.jid);
      return [`${group.instanceId}:${jid}`, {
        instanceId: group.instanceId,
        jid,
        name: normalizeOptionalText(group.name) ?? null,
        lastMessageAt,
        updatedAt,
      }];
    })
  );

  return {
    dispatches,
    async findInstance(instanceId) {
      return instances.get(instanceId) ?? null;
    },
    async listGroupTargets(input) {
      const query = normalizeOptionalText(input.search)?.toLowerCase() ?? null;
      return Array.from(groups.values())
        .filter((group) => {
          if (group.instanceId !== input.instanceId) return false;
          if (!query) return true;
          return [group.name ?? "", group.jid].some((value) => value.toLowerCase().includes(query));
        })
        .sort((left, right) => {
          const updatedDiff = right.updatedAt.getTime() - left.updatedAt.getTime();
          if (updatedDiff !== 0) return updatedDiff;
          return right.lastMessageAt.getTime() - left.lastMessageAt.getTime();
        });
    },
    async findGroupTarget(input) {
      return groups.get(`${input.instanceId}:${normalizeGroupJid(input.jid)}`) ?? null;
    },
    async createDispatch(input) {
      const now = new Date();
      const record: ScheduledDispatchRecord = {
        id: newId("scheduled-dispatch"),
        instanceId: input.instanceId,
        targetType: input.targetType,
        recipientPhone: input.recipientPhone ?? null,
        recipientJid: input.recipientJid ?? null,
        contentType: input.contentType,
        body: input.body ?? null,
        mediaUrl: input.mediaUrl ?? null,
        buttonsJson: input.buttonsJson ?? null,
        scheduledAt: input.scheduledAt,
        status: input.status,
        providerMessageId: null,
        failureCode: null,
        providerError: null,
        processedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      dispatches.set(record.id, record);
      return record;
    },
    async listDispatches(input) {
      return Array.from(dispatches.values())
        .filter((dispatch) => !input.instanceId || dispatch.instanceId === input.instanceId)
        .sort(byDispatchHistoryOrder);
    },
    async listDueDispatches(input) {
      return Array.from(dispatches.values())
        .filter((dispatch) => dispatch.status === "SCHEDULED" && dispatch.scheduledAt.getTime() <= input.now.getTime())
        .sort((left, right) => {
          const scheduledDiff = left.scheduledAt.getTime() - right.scheduledAt.getTime();
          if (scheduledDiff !== 0) return scheduledDiff;
          return left.createdAt.getTime() - right.createdAt.getTime();
        })
        .slice(0, input.limit);
    },
    async findDispatchById(id) {
      return dispatches.get(id) ?? null;
    },
    async transitionDispatch(input) {
      const current = dispatches.get(input.id);
      if (!current) return null;
      const allowedStatuses = Array.isArray(input.from) ? input.from : [input.from];
      if (!allowedStatuses.includes(current.status)) return null;

      const updated: ScheduledDispatchRecord = {
        ...current,
        status: input.to,
        providerMessageId: input.providerMessageId === undefined ? current.providerMessageId : input.providerMessageId,
        failureCode: input.failureCode === undefined ? current.failureCode : input.failureCode,
        providerError: input.providerError === undefined ? current.providerError : input.providerError,
        processedAt: input.processedAt === undefined ? current.processedAt : input.processedAt,
        updatedAt: new Date(),
      };
      dispatches.set(updated.id, updated);
      return updated;
    },
  };
}

export function createScheduledDispatchService(deps: { store?: ScheduledDispatchStore } = {}) {
  const store = deps.store ?? prismaScheduledDispatchStore;

  async function ensureInstance(instanceId: string) {
    const instance = await store.findInstance(instanceId);
    if (!instance) throw new ScheduledDispatchInstanceNotFoundError(instanceId);
  }

  return {
    async createDispatch(input: ScheduledDispatchCreateInput) {
      await ensureInstance(input.instanceId);

      const targetType = mapTargetType(input.targetType);
      const contentType = mapContentType(input.contentType);
      const body = normalizeOptionalText(input.body);
      const mediaUrl = normalizeMediaUrl(input.mediaUrl);
      const buttons = normalizeScheduledDispatchButtons(input.buttons);

      const scheduledAt = input.deliveryMode === "immediate"
        ? new Date()
        : input.scheduledAt instanceof Date
          ? input.scheduledAt
          : new Date(Number.NaN);

      if (Number.isNaN(scheduledAt.getTime())) {
        throw new ScheduledDispatchValidationError("Data de agendamento invalida.");
      }

      const recipientPhone = input.targetType === "number"
        ? normalizePhone(input.phone ?? "")
        : null;
      const recipientJid = input.targetType === "group"
        ? normalizeGroupJid(input.groupJid ?? "")
        : null;

      if (recipientJid) {
        const target = await store.findGroupTarget({ instanceId: input.instanceId, jid: recipientJid });
        if (!target) {
          throw new ScheduledDispatchValidationError("Grupo selecionado nao pertence a instancia informada.", 422);
        }
      }

      if (input.targetType === "number" && normalizeOptionalText(input.groupJid)) {
        throw new ScheduledDispatchValidationError("Disparo para numero nao aceita groupJid.");
      }

      if (input.targetType === "group" && normalizeOptionalText(input.phone)) {
        throw new ScheduledDispatchValidationError("Disparo para grupo nao aceita phone.");
      }

      if (contentType === "TEXT") {
        if (!body) throw new ScheduledDispatchValidationError("Disparo de texto exige body.");
        if (mediaUrl) throw new ScheduledDispatchValidationError("Disparo de texto nao aceita mediaUrl.");
      }

      if ((contentType === "IMAGE" || contentType === "VIDEO") && !mediaUrl) {
        throw new ScheduledDispatchValidationError("Disparo com midia exige mediaUrl.");
      }

      if (contentType === "VIDEO" && buttons.length > 0) {
        throw new ScheduledDispatchValidationError("Disparo de video nao suporta botoes URL nesta etapa.");
      }

      return toScheduledDispatchView(await store.createDispatch({
        instanceId: input.instanceId,
        targetType,
        recipientPhone,
        recipientJid,
        contentType,
        body,
        mediaUrl,
        buttonsJson: serializeScheduledDispatchButtons(buttons),
        scheduledAt,
        status: "SCHEDULED",
      }));
    },

    async listDispatches(input: ScheduledDispatchListInput) {
      if (input.instanceId) await ensureInstance(input.instanceId);
      const dispatches = await store.listDispatches(input);
      return dispatches.sort(byDispatchHistoryOrder).map(toScheduledDispatchView);
    },

    async getDispatch(dispatchId: string) {
      const dispatch = await store.findDispatchById(dispatchId);
      if (!dispatch) throw new ScheduledDispatchNotFoundError(dispatchId);
      return toScheduledDispatchView(dispatch);
    },

    async listGroupTargets(input: { instanceId: string; search?: string }) {
      await ensureInstance(input.instanceId);
      return store.listGroupTargets(input);
    },

    async claimDueDispatches(input: { now?: Date; limit?: number } = {}) {
      const dueDispatches = await store.listDueDispatches({
        now: input.now ?? new Date(),
        limit: Math.min(Math.max(input.limit ?? 10, 1), 100),
      });
      const claimed: ScheduledDispatchViewRecord[] = [];

      for (const dispatch of dueDispatches) {
        const record = await store.transitionDispatch({
          id: dispatch.id,
          from: "SCHEDULED",
          to: "PROCESSING",
          providerMessageId: null,
          failureCode: null,
          providerError: null,
          processedAt: null,
        });
        if (record) claimed.push(toScheduledDispatchView(record));
      }

      return claimed;
    },

    async markDispatchSent(input: { id: string; providerMessageId?: string | null; processedAt?: Date }) {
      const record = await store.transitionDispatch({
        id: input.id,
        from: "PROCESSING",
        to: "SENT",
        providerMessageId: input.providerMessageId ?? null,
        failureCode: null,
        providerError: null,
        processedAt: input.processedAt ?? new Date(),
      });
      if (!record) throw new ScheduledDispatchConflictError("Disparo nao esta em processamento para concluir envio.");
      return toScheduledDispatchView(record);
    },

    async markDispatchFailed(input: { id: string; failureCode: string; providerError?: string | null; processedAt?: Date }) {
      const record = await store.transitionDispatch({
        id: input.id,
        from: "PROCESSING",
        to: "FAILED",
        failureCode: input.failureCode,
        providerError: normalizeOptionalText(input.providerError) ?? null,
        processedAt: input.processedAt ?? new Date(),
      });
      if (!record) throw new ScheduledDispatchConflictError("Disparo nao esta em processamento para marcar falha.");
      return toScheduledDispatchView(record);
    },

    async cancelDispatch(dispatchId: string) {
      const existing = await store.findDispatchById(dispatchId);
      if (!existing) throw new ScheduledDispatchNotFoundError(dispatchId);
      const record = await store.transitionDispatch({
        id: dispatchId,
        from: "SCHEDULED",
        to: "CANCELLED",
        processedAt: new Date(),
      });
      if (!record) {
        throw new ScheduledDispatchConflictError("Somente disparos pendentes podem ser cancelados.");
      }
      return toScheduledDispatchView(record);
    },
  };
}

export const scheduledDispatchService = createScheduledDispatchService();
