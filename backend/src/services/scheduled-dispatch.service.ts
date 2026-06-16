import { type ScheduledDispatch, type ScheduledDispatchContentType, type ScheduledDispatchStatus, type ScheduledDispatchTargetType } from "@prisma/client";
import { prisma } from "../database/prisma";

export type ScheduledDispatchRecord = ScheduledDispatch;

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
  scheduledAt: Date;
};

type ScheduledDispatchListInput = {
  instanceId?: string;
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
    scheduledAt: Date;
    status: ScheduledDispatchStatus;
  }): Promise<ScheduledDispatchRecord>;
  listDispatches(input: ScheduledDispatchListInput): Promise<ScheduledDispatchRecord[]>;
  findDispatchById(id: string): Promise<ScheduledDispatchRecord | null>;
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

function mapTargetType(value: ScheduledDispatchCreateInput["targetType"]): ScheduledDispatchTargetType {
  return value === "number" ? "NUMBER" : "GROUP";
}

function mapContentType(value: ScheduledDispatchCreateInput["contentType"]): ScheduledDispatchContentType {
  if (value === "image") return "IMAGE";
  if (value === "video") return "VIDEO";
  return "TEXT";
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
        scheduledAt: input.scheduledAt,
        status: input.status,
      },
    });
  },

  async listDispatches(input) {
    return prisma.scheduledDispatch.findMany({
      where: input.instanceId ? { instanceId: input.instanceId } : undefined,
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
    });
  },

  async findDispatchById(id) {
    return prisma.scheduledDispatch.findUnique({ where: { id } });
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
        .sort((left, right) => {
          const scheduledDiff = left.scheduledAt.getTime() - right.scheduledAt.getTime();
          if (scheduledDiff !== 0) return scheduledDiff;
          return right.createdAt.getTime() - left.createdAt.getTime();
        });
    },
    async findDispatchById(id) {
      return dispatches.get(id) ?? null;
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
      const mediaUrl = normalizeOptionalText(input.mediaUrl);

      if (Number.isNaN(input.scheduledAt.getTime())) {
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

      return store.createDispatch({
        instanceId: input.instanceId,
        targetType,
        recipientPhone,
        recipientJid,
        contentType,
        body,
        mediaUrl,
        scheduledAt: input.scheduledAt,
        status: "SCHEDULED",
      });
    },

    async listDispatches(input: ScheduledDispatchListInput) {
      if (input.instanceId) await ensureInstance(input.instanceId);
      return store.listDispatches(input);
    },

    async getDispatch(dispatchId: string) {
      const dispatch = await store.findDispatchById(dispatchId);
      if (!dispatch) throw new ScheduledDispatchNotFoundError(dispatchId);
      return dispatch;
    },

    async listGroupTargets(input: { instanceId: string; search?: string }) {
      await ensureInstance(input.instanceId);
      return store.listGroupTargets(input);
    },
  };
}

export const scheduledDispatchService = createScheduledDispatchService();
