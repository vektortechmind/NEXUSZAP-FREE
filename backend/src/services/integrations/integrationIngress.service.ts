import { randomUUID } from "crypto";
import { prisma } from "../../database/prisma";
import { redactSensitiveText } from "../../utils/redaction";

export const INTEGRATION_INGRESS_STATUS = {
  ACCEPTED: "ACCEPTED",
  REJECTED_AUTH: "REJECTED_AUTH",
  REJECTED_CONTRACT: "REJECTED_CONTRACT",
  REJECTED_REPLAY: "REJECTED_REPLAY",
  REJECTED_DUPLICATE: "REJECTED_DUPLICATE",
  ERROR: "ERROR",
} as const;

export type IntegrationIngressStatus = typeof INTEGRATION_INGRESS_STATUS[keyof typeof INTEGRATION_INGRESS_STATUS];

export type IntegrationIngressLogRecord = {
  id: string;
  credentialId: string | null;
  instanceId: string | null;
  eventSlug: string | null;
  dedupKey: string | null;
  requestTimestamp: Date | null;
  status: IntegrationIngressStatus;
  failureCode: string | null;
  payloadJson: string | null;
  receivedAt: Date;
  processedAt: Date | null;
};

export type PersistIntegrationIngressLogInput = {
  credentialId?: string | null;
  instanceId?: string | null;
  eventSlug?: string | null;
  dedupKey?: string | null;
  requestTimestamp?: Date | null;
  status: IntegrationIngressStatus;
  failureCode?: string | null;
  payload?: unknown;
  processedAt?: Date | null;
};

export interface IntegrationIngressStore {
  createLog(input: {
    credentialId?: string | null;
    instanceId?: string | null;
    eventSlug?: string | null;
    dedupKey?: string | null;
    requestTimestamp?: Date | null;
    status: IntegrationIngressStatus;
    failureCode?: string | null;
    payloadJson?: string | null;
    processedAt?: Date | null;
  }): Promise<IntegrationIngressLogRecord>;
  updateLog(id: string, input: {
    status?: IntegrationIngressStatus;
    failureCode?: string | null;
    processedAt?: Date | null;
  }): Promise<IntegrationIngressLogRecord>;
}

function serializePayload(payload: unknown): string | null {
  if (payload === undefined) return null;
  try {
    return redactSensitiveText(JSON.stringify(payload), 4000);
  } catch {
    return redactSensitiveText(String(payload), 4000);
  }
}

export function parseOptionalDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function createPrismaIntegrationIngressStore(db: typeof prisma): IntegrationIngressStore {
  return {
    async createLog(input) {
      const record = await db.integrationIngressLog.create({
        data: {
          credentialId: input.credentialId ?? null,
          instanceId: input.instanceId ?? null,
          eventSlug: input.eventSlug ?? null,
          dedupKey: input.dedupKey ?? null,
          requestTimestamp: input.requestTimestamp ?? null,
          status: input.status,
          failureCode: input.failureCode ?? null,
          payloadJson: input.payloadJson ?? null,
          processedAt: input.processedAt ?? null,
        },
      });

      return {
        ...record,
        requestTimestamp: record.requestTimestamp ?? null,
        processedAt: record.processedAt ?? null,
      };
    },
    async updateLog(id, input) {
      const record = await db.integrationIngressLog.update({
        where: { id },
        data: {
          status: input.status,
          failureCode: input.failureCode,
          processedAt: input.processedAt ?? new Date(),
        },
      });

      return {
        ...record,
        requestTimestamp: record.requestTimestamp ?? null,
        processedAt: record.processedAt ?? null,
      };
    },
  };
}

export function createIntegrationIngressService(store: IntegrationIngressStore) {
  return {
    async persistLog(input: PersistIntegrationIngressLogInput) {
      return store.createLog({
        credentialId: input.credentialId ?? null,
        instanceId: input.instanceId ?? null,
        eventSlug: input.eventSlug ?? null,
        dedupKey: input.dedupKey ?? null,
        requestTimestamp: input.requestTimestamp ?? null,
        status: input.status,
        failureCode: input.failureCode ?? null,
        payloadJson: serializePayload(input.payload),
        processedAt: input.processedAt ?? new Date(),
      });
    },
    async updateLog(id: string, input: { status?: IntegrationIngressStatus; failureCode?: string | null; processedAt?: Date | null }) {
      return store.updateLog(id, {
        status: input.status,
        failureCode: input.failureCode,
        processedAt: input.processedAt ?? new Date(),
      });
    },
  };
}

export const prismaIntegrationIngressStore = createPrismaIntegrationIngressStore(prisma);
export const integrationIngressService = createIntegrationIngressService(prismaIntegrationIngressStore);

export function createInMemoryIntegrationIngressStore(seed?: { logs?: IntegrationIngressLogRecord[] }): IntegrationIngressStore & { logs: Map<string, IntegrationIngressLogRecord> } {
  const logs = new Map<string, IntegrationIngressLogRecord>((seed?.logs ?? []).map((entry) => [entry.id, entry]));

  return {
    logs,
    async createLog(input) {
      const now = new Date();
      const record: IntegrationIngressLogRecord = {
        id: randomUUID(),
        credentialId: input.credentialId ?? null,
        instanceId: input.instanceId ?? null,
        eventSlug: input.eventSlug ?? null,
        dedupKey: input.dedupKey ?? null,
        requestTimestamp: input.requestTimestamp ?? null,
        status: input.status,
        failureCode: input.failureCode ?? null,
        payloadJson: input.payloadJson ?? null,
        receivedAt: now,
        processedAt: input.processedAt ?? now,
      };
      logs.set(record.id, record);
      return { ...record };
    },
    async updateLog(id, input) {
      const current = logs.get(id);
      if (!current) {
        throw new Error(`Integration ingress log not found: ${id}`);
      }

      const record: IntegrationIngressLogRecord = {
        ...current,
        status: input.status ?? current.status,
        failureCode: input.failureCode === undefined ? current.failureCode : input.failureCode,
        processedAt: input.processedAt ?? new Date(),
      };
      logs.set(id, record);
      return { ...record };
    },
  };
}
