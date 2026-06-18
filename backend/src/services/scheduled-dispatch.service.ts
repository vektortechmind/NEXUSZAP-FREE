import { type ScheduledDispatch, type ScheduledDispatchCampaign, type ScheduledDispatchContentType, type ScheduledDispatchStatus, type ScheduledDispatchTargetType } from "@prisma/client";
import { prisma } from "../database/prisma";
import { normalizeOperationalPhoneDigits } from "../utils/phoneNormalization";

export type ScheduledDispatchCampaignRecord = ScheduledDispatchCampaign;
export type ScheduledDispatchRecord = ScheduledDispatch & { campaign?: ScheduledDispatchCampaignRecord | null };
export type ScheduledDispatchInstanceRecord = { id: string; status: string };
export type ScheduledDispatchUrlButton = {
  text: string;
  url: string;
};
export type ScheduledDispatchViewRecord = Omit<ScheduledDispatchRecord, "buttonsJson"> & {
  buttons: ScheduledDispatchUrlButton[];
  campaign: ScheduledDispatchCampaignRecord | null;
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
  campaignId?: string | null;
  targetType: "number" | "group";
  phone?: string | null;
  groupJid?: string | null;
  phones?: string[] | null;
  groupJids?: string[] | null;
  contentType: "text" | "image" | "video";
  body?: string | null;
  mediaUrl?: string | null;
  buttons?: ScheduledDispatchUrlButton[] | null;
  deliveryMode: "immediate" | "scheduled";
  scheduledAt?: Date | null;
  numberDelaySeconds?: number | null;
  numberDelayMinSeconds?: number | null;
  numberDelayMaxSeconds?: number | null;
  groupDelaySeconds?: number | null;
  groupDelayMinSeconds?: number | null;
  groupDelayMaxSeconds?: number | null;
  pauseEveryCount?: number | null;
  pauseDurationSeconds?: number | null;
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

export type ScheduledDispatchCampaignCancelSummary = {
  campaignId: string;
  cancelledCount: number;
  scheduledRemainingCount: number;
  processingCount: number;
  sentCount: number;
  failedCount: number;
  alreadyCancelledCount: number;
};

export type ScheduledDispatchStore = {
  findInstance(instanceId: string): Promise<ScheduledDispatchInstanceRecord | null>;
  listGroupTargets(input: { instanceId: string; search?: string }): Promise<ScheduledDispatchGroupTarget[]>;
  findGroupTarget(input: { instanceId: string; jid: string }): Promise<ScheduledDispatchGroupTarget | null>;
  createCampaign(input: {
    instanceId: string;
    targetType: ScheduledDispatchTargetType;
    totalDestinations: number;
    baseScheduledAt: Date;
    delaySeconds: number;
    pauseEveryCount: number;
    pauseDurationSeconds: number;
  }): Promise<ScheduledDispatchCampaignRecord>;
  createDispatch(input: {
    instanceId: string;
    campaignId?: string | null;
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
  cancelScheduledDispatchesByCampaign(input: { campaignId: string; processedAt: Date }): Promise<ScheduledDispatchCampaignCancelSummary | null>;
  clearDispatchHistory(input: { instanceId: string; statuses: ScheduledDispatchStatus[] }): Promise<number>;
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

export class ScheduledDispatchInstanceNotConnectedError extends Error {
  code = "SCHEDULED_DISPATCH_INSTANCE_NOT_CONNECTED";
  statusCode = 409;

  constructor(instanceId: string, status: string) {
    super(`Instancia ${instanceId} nao esta conectada para criar disparos. Status atual: ${status}.`);
  }
}

export class ScheduledDispatchCampaignNotFoundError extends Error {
  code = "SCHEDULED_DISPATCH_CAMPAIGN_NOT_FOUND";

  constructor(campaignId: string) {
    super(`Campanha ${campaignId} nao encontrada.`);
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
  const normalized = normalizeOperationalPhoneDigits(value);
  if (!normalized) {
    throw new ScheduledDispatchValidationError("Telefone invalido.");
  }
  return normalized;
}

function dedupeValues(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function normalizePhoneList(values?: string[] | null) {
  return dedupeValues((values ?? []).map((value) => normalizePhone(value)));
}

function normalizeGroupJidList(values?: string[] | null) {
  return dedupeValues((values ?? []).map((value) => normalizeGroupJid(value)));
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

function normalizeDelaySeconds(value?: number | null, field = "delaySeconds") {
  if (value == null) return 0;
  if (!Number.isInteger(value) || value < 0 || value > 86_400) {
    throw new ScheduledDispatchValidationError(`${field} deve ser um inteiro entre 0 e 86400.`);
  }
  return value;
}

function normalizeDelayRange(input: {
  fixed?: number | null;
  min?: number | null;
  max?: number | null;
  fixedField: string;
  minField: string;
  maxField: string;
}) {
  const fixed = normalizeDelaySeconds(input.fixed, input.fixedField);
  const hasRange = input.min != null || input.max != null;
  if (!hasRange) return { minSeconds: fixed, maxSeconds: fixed };

  const minSeconds = normalizeDelaySeconds(input.min ?? fixed, input.minField);
  const maxSeconds = normalizeDelaySeconds(input.max ?? minSeconds, input.maxField);
  if (maxSeconds < minSeconds) {
    throw new ScheduledDispatchValidationError(`${input.maxField} deve ser maior ou igual a ${input.minField}.`);
  }

  return { minSeconds, maxSeconds };
}

function normalizePauseEveryCount(value?: number | null) {
  if (value == null) return 0;
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new ScheduledDispatchValidationError("pauseEveryCount deve ser um inteiro entre 0 e 10000.");
  }
  return value;
}

function normalizePauseDurationSeconds(value?: number | null) {
  return normalizeDelaySeconds(value, "pauseDurationSeconds");
}

export function calculateScheduledDispatchAt(input: {
  baseScheduledAt: Date;
  index: number;
  delaySeconds: number;
  pauseEveryCount?: number | null;
  pauseDurationSeconds?: number | null;
}) {
  const pauseEveryCount = input.pauseEveryCount && input.pauseEveryCount > 0 ? input.pauseEveryCount : 0;
  const pauseDurationSeconds = input.pauseDurationSeconds && input.pauseDurationSeconds > 0 ? input.pauseDurationSeconds : 0;
  const pauseBlocks = pauseEveryCount > 0 && pauseDurationSeconds > 0
    ? Math.floor(input.index / pauseEveryCount)
    : 0;
  const offsetSeconds = (input.index * input.delaySeconds) + (pauseBlocks * pauseDurationSeconds);
  return new Date(input.baseScheduledAt.getTime() + (offsetSeconds * 1000));
}

function randomIntInclusive(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function calculateScheduledDispatchSchedule(input: {
  baseScheduledAt: Date;
  totalDestinations: number;
  delayMinSeconds: number;
  delayMaxSeconds: number;
  pauseEveryCount?: number | null;
  pauseDurationSeconds?: number | null;
  randomInt?: (min: number, max: number) => number;
}) {
  const totalDestinations = Math.max(0, input.totalDestinations);
  const pauseEveryCount = input.pauseEveryCount && input.pauseEveryCount > 0 ? input.pauseEveryCount : 0;
  const pauseDurationSeconds = input.pauseDurationSeconds && input.pauseDurationSeconds > 0 ? input.pauseDurationSeconds : 0;
  const randomInt = input.randomInt ?? randomIntInclusive;
  const scheduledAt: Date[] = [];
  let offsetSeconds = 0;

  for (let index = 0; index < totalDestinations; index += 1) {
    if (index > 0) {
      const delaySeconds = randomInt(input.delayMinSeconds, input.delayMaxSeconds);
      if (!Number.isInteger(delaySeconds) || delaySeconds < input.delayMinSeconds || delaySeconds > input.delayMaxSeconds) {
        throw new ScheduledDispatchValidationError("Delay sorteado fora da faixa configurada.");
      }
      offsetSeconds += delaySeconds;
      if (pauseEveryCount > 0 && pauseDurationSeconds > 0 && index % pauseEveryCount === 0) {
        offsetSeconds += pauseDurationSeconds;
      }
    }
    scheduledAt.push(new Date(input.baseScheduledAt.getTime() + (offsetSeconds * 1000)));
  }

  return scheduledAt;
}

const MAX_SCHEDULED_DISPATCH_BUTTONS = 3;
const MAX_SCHEDULED_DISPATCH_BUTTON_TEXT_LENGTH = 60;

function normalizeMediaUrl(value?: string | null): string | null {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return null;

  if (normalized.startsWith("/api/scheduled-dispatches/media/") || normalized.startsWith("/api/scheduled-dispatch-templates/media/")) {
    return normalized;
  }

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
  const { buttonsJson, campaign, ...rest } = record;
  return {
    ...rest,
    campaign: campaign ?? null,
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

    const updated = await tx.scheduledDispatch.findUnique({ where: { id: input.id }, include: { campaign: true } });
    if (!updated) return null;

    return updated;
  });
}

export const prismaScheduledDispatchStore: ScheduledDispatchStore = {
  async findInstance(instanceId) {
    return prisma.instance.findUnique({ where: { id: instanceId }, select: { id: true, status: true } });
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

  async createCampaign(input) {
    return prisma.scheduledDispatchCampaign.create({
      data: {
        instanceId: input.instanceId,
        targetType: input.targetType,
        totalDestinations: input.totalDestinations,
        baseScheduledAt: input.baseScheduledAt,
        delaySeconds: input.delaySeconds,
        pauseEveryCount: input.pauseEveryCount,
        pauseDurationSeconds: input.pauseDurationSeconds,
      },
    });
  },

  async createDispatch(input) {
    return prisma.scheduledDispatch.create({
      data: {
        instanceId: input.instanceId,
        campaignId: input.campaignId ?? null,
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
      include: { campaign: true },
    });
  },

  async listDispatches(input) {
    return prisma.scheduledDispatch.findMany({
      where: input.instanceId ? { instanceId: input.instanceId } : undefined,
      orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
      include: { campaign: true },
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
      include: { campaign: true },
    });
  },

  async findDispatchById(id) {
    return prisma.scheduledDispatch.findUnique({ where: { id }, include: { campaign: true } });
  },

  async transitionDispatch(input) {
    return transitionDispatchWithPrisma(input);
  },

  async cancelScheduledDispatchesByCampaign(input) {
    return prisma.$transaction(async (tx) => {
      const campaign = await tx.scheduledDispatchCampaign.findUnique({ where: { id: input.campaignId }, select: { id: true } });
      if (!campaign) return null;

      const updated = await tx.scheduledDispatch.updateMany({
        where: {
          campaignId: input.campaignId,
          status: "SCHEDULED",
        },
        data: {
          status: "CANCELLED",
          processedAt: input.processedAt,
          updatedAt: input.processedAt,
          failureCode: "CAMPAIGN_CANCELLED",
          providerError: "Campanha cancelada pelo operador.",
        },
      });

      const counts = await tx.scheduledDispatch.groupBy({
        by: ["status"],
        where: { campaignId: input.campaignId },
        _count: { _all: true },
      });
      const byStatus = new Map(counts.map((entry) => [entry.status, entry._count._all]));

      return {
        campaignId: input.campaignId,
        cancelledCount: updated.count,
        scheduledRemainingCount: byStatus.get("SCHEDULED") ?? 0,
        processingCount: byStatus.get("PROCESSING") ?? 0,
        sentCount: byStatus.get("SENT") ?? 0,
        failedCount: byStatus.get("FAILED") ?? 0,
        alreadyCancelledCount: Math.max((byStatus.get("CANCELLED") ?? 0) - updated.count, 0),
      };
    });
  },

  async clearDispatchHistory(input) {
    const result = await prisma.scheduledDispatch.deleteMany({
      where: {
        instanceId: input.instanceId,
        status: { in: input.statuses },
      },
    });
    return result.count;
  },
};

export function createInMemoryScheduledDispatchStore(seed: {
  instances?: Array<{ id: string; status?: string }>;
  groups?: Array<{ instanceId: string; jid: string; name?: string | null; lastMessageAt?: Date; updatedAt?: Date }>;
} = {}): ScheduledDispatchStore & {
  dispatches: Map<string, ScheduledDispatchRecord>;
  campaigns: Map<string, ScheduledDispatchCampaignRecord>;
} {
  const instances = new Map((seed.instances ?? []).map((instance) => [instance.id, { id: instance.id, status: instance.status ?? "CONNECTED" }]));
  const dispatches = new Map<string, ScheduledDispatchRecord>();
  const campaigns = new Map<string, ScheduledDispatchCampaignRecord>();
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
    campaigns,
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
    async createCampaign(input) {
      const now = new Date();
      const campaign: ScheduledDispatchCampaignRecord = {
        id: newId("scheduled-dispatch-campaign"),
        instanceId: input.instanceId,
        targetType: input.targetType,
        totalDestinations: input.totalDestinations,
        baseScheduledAt: input.baseScheduledAt,
        delaySeconds: input.delaySeconds,
        pauseEveryCount: input.pauseEveryCount,
        pauseDurationSeconds: input.pauseDurationSeconds,
        createdAt: now,
        updatedAt: now,
      };
      campaigns.set(campaign.id, campaign);
      return campaign;
    },
    async createDispatch(input) {
      const now = new Date();
      const campaign = input.campaignId ? campaigns.get(input.campaignId) ?? null : null;
      const record: ScheduledDispatchRecord = {
        id: newId("scheduled-dispatch"),
        instanceId: input.instanceId,
        campaignId: input.campaignId ?? null,
        campaign,
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

    async cancelScheduledDispatchesByCampaign(input) {
      if (!campaigns.has(input.campaignId)) return null;

      let cancelledCount = 0;
      const statusCounts = new Map<ScheduledDispatchStatus, number>();
      for (const [id, dispatch] of dispatches.entries()) {
        if (dispatch.campaignId !== input.campaignId) continue;

        let next = dispatch;
        if (dispatch.status === "SCHEDULED") {
          next = {
            ...dispatch,
            status: "CANCELLED",
            processedAt: input.processedAt,
            failureCode: "CAMPAIGN_CANCELLED",
            providerError: "Campanha cancelada pelo operador.",
            updatedAt: input.processedAt,
          };
          dispatches.set(id, next);
          cancelledCount += 1;
        }
        statusCounts.set(next.status, (statusCounts.get(next.status) ?? 0) + 1);
      }

      return {
        campaignId: input.campaignId,
        cancelledCount,
        scheduledRemainingCount: statusCounts.get("SCHEDULED") ?? 0,
        processingCount: statusCounts.get("PROCESSING") ?? 0,
        sentCount: statusCounts.get("SENT") ?? 0,
        failedCount: statusCounts.get("FAILED") ?? 0,
        alreadyCancelledCount: Math.max((statusCounts.get("CANCELLED") ?? 0) - cancelledCount, 0),
      };
    },

    async clearDispatchHistory(input) {
      let deleted = 0;
      for (const [id, dispatch] of dispatches.entries()) {
        if (dispatch.instanceId !== input.instanceId) continue;
        if (!input.statuses.includes(dispatch.status)) continue;
        dispatches.delete(id);
        deleted += 1;
      }
      return deleted;
    },
  };
}

export function createScheduledDispatchService(deps: { store?: ScheduledDispatchStore; randomInt?: (min: number, max: number) => number } = {}) {
  const store = deps.store ?? prismaScheduledDispatchStore;
  const randomInt = deps.randomInt ?? randomIntInclusive;

  async function ensureInstance(instanceId: string) {
    const instance = await store.findInstance(instanceId);
    if (!instance) throw new ScheduledDispatchInstanceNotFoundError(instanceId);
    return instance;
  }

  async function ensureConnectedInstance(instanceId: string) {
    const instance = await ensureInstance(instanceId);
    if (instance.status !== "CONNECTED") {
      throw new ScheduledDispatchInstanceNotConnectedError(instanceId, instance.status);
    }
    return instance;
  }

  function resolveScheduledAt(input: ScheduledDispatchCreateInput) {
    if (input.scheduledAt instanceof Date) return input.scheduledAt;
    if (input.deliveryMode === "immediate") return new Date();
    return new Date(Number.NaN);
  }

  return {
    async assertInstance(instanceId: string) {
      await ensureInstance(instanceId);
    },

    async createDispatch(input: ScheduledDispatchCreateInput) {
      await ensureConnectedInstance(input.instanceId);

      const targetType = mapTargetType(input.targetType);
      const contentType = mapContentType(input.contentType);
      const body = normalizeOptionalText(input.body);
      const mediaUrl = normalizeMediaUrl(input.mediaUrl);
      const buttons = normalizeScheduledDispatchButtons(input.buttons);

      const scheduledAt = resolveScheduledAt(input);

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

      return toScheduledDispatchView(await store.createDispatch({
        instanceId: input.instanceId,
        campaignId: input.campaignId ?? null,
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

    async createDispatches(input: ScheduledDispatchCreateInput) {
      await ensureConnectedInstance(input.instanceId);

      const phones = normalizePhoneList(input.phones ?? (input.phone ? [input.phone] : []));
      const groupJids = normalizeGroupJidList(input.groupJids ?? (input.groupJid ? [input.groupJid] : []));
      const baseScheduledAt = resolveScheduledAt(input);
      const pauseEveryCount = normalizePauseEveryCount(input.pauseEveryCount);
      const pauseDurationSeconds = normalizePauseDurationSeconds(input.pauseDurationSeconds);

      if (Number.isNaN(baseScheduledAt.getTime())) {
        throw new ScheduledDispatchValidationError("Data de agendamento invalida.");
      }

      if (input.targetType === "number") {
        const numberDelayRange = normalizeDelayRange({
          fixed: input.numberDelaySeconds,
          min: input.numberDelayMinSeconds,
          max: input.numberDelayMaxSeconds,
          fixedField: "numberDelaySeconds",
          minField: "numberDelayMinSeconds",
          maxField: "numberDelayMaxSeconds",
        });
        if (groupJids.length > 0) {
          throw new ScheduledDispatchValidationError("Disparo para numero nao aceita groupJids.");
        }
        if (phones.length === 0) {
          throw new ScheduledDispatchValidationError("Informe ao menos um numero valido.");
        }

        const campaign = await store.createCampaign({
          instanceId: input.instanceId,
          targetType: "NUMBER",
          totalDestinations: phones.length,
          baseScheduledAt,
          delaySeconds: numberDelayRange.minSeconds,
          pauseEveryCount,
          pauseDurationSeconds,
        });

        const schedule = calculateScheduledDispatchSchedule({
          baseScheduledAt,
          totalDestinations: phones.length,
          delayMinSeconds: numberDelayRange.minSeconds,
          delayMaxSeconds: numberDelayRange.maxSeconds,
          pauseEveryCount,
          pauseDurationSeconds,
          randomInt,
        });

        const dispatches: ScheduledDispatchViewRecord[] = [];
        for (const [index, phone] of phones.entries()) {
          dispatches.push(await this.createDispatch({
            ...input,
            campaignId: campaign.id,
            deliveryMode: "scheduled",
            phone,
            groupJid: null,
            phones: null,
            groupJids: null,
            scheduledAt: schedule[index],
          }));
        }
        return dispatches;
      }

      const groupDelayRange = normalizeDelayRange({
        fixed: input.groupDelaySeconds,
        min: input.groupDelayMinSeconds,
        max: input.groupDelayMaxSeconds,
        fixedField: "groupDelaySeconds",
        minField: "groupDelayMinSeconds",
        maxField: "groupDelayMaxSeconds",
      });
      if (phones.length > 0) {
        throw new ScheduledDispatchValidationError("Disparo para grupo nao aceita phones.");
      }
      if (groupJids.length === 0) {
        throw new ScheduledDispatchValidationError("Selecione ao menos um grupo valido.");
      }

      const campaign = await store.createCampaign({
        instanceId: input.instanceId,
        targetType: "GROUP",
        totalDestinations: groupJids.length,
        baseScheduledAt,
        delaySeconds: groupDelayRange.minSeconds,
        pauseEveryCount,
        pauseDurationSeconds,
      });

      const schedule = calculateScheduledDispatchSchedule({
        baseScheduledAt,
        totalDestinations: groupJids.length,
        delayMinSeconds: groupDelayRange.minSeconds,
        delayMaxSeconds: groupDelayRange.maxSeconds,
        pauseEveryCount,
        pauseDurationSeconds,
        randomInt,
      });

      const dispatches: ScheduledDispatchViewRecord[] = [];
      for (const [index, groupJid] of groupJids.entries()) {
        dispatches.push(await this.createDispatch({
          ...input,
          campaignId: campaign.id,
          deliveryMode: "scheduled",
          phone: null,
          groupJid,
          phones: null,
          groupJids: null,
          scheduledAt: schedule[index],
        }));
      }
      return dispatches;
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

    async cancelCampaign(input: { campaignId: string }) {
      const summary = await store.cancelScheduledDispatchesByCampaign({
        campaignId: input.campaignId,
        processedAt: new Date(),
      });
      if (!summary) throw new ScheduledDispatchCampaignNotFoundError(input.campaignId);
      return summary;
    },

    async clearHistory(instanceId: string) {
      await ensureInstance(instanceId);
      return store.clearDispatchHistory({
        instanceId,
        statuses: ["SENT", "FAILED", "CANCELLED"],
      });
    },
  };
}

export const scheduledDispatchService = createScheduledDispatchService();
