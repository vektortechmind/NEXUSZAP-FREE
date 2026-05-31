import { WAMessageStatus, type WAMessageUpdate } from "@whiskeysockets/baileys";
import { prisma } from "../../database/prisma";
import { redactSensitiveText } from "../../utils/redaction";

export const INTEGRATION_DELIVERY_RECEIPT_SOURCE = "baileys.messages.update";

export type IntegrationDeliveryReceiptStatus =
  | "SUBMITTED"
  | "DELIVERED"
  | "READ"
  | "PLAYED"
  | "FAILED_AFTER_SUBMIT"
  | "UNKNOWN";

export type IntegrationDispatchReceiptRecord = {
  id: string;
  providerMessageId: string | null;
  payloadSummaryJson: string | null;
};

export type IntegrationDispatchReceiptUpdateInput = {
  payloadSummaryJson: string;
};

export interface IntegrationDispatchReceiptStore {
  findByProviderMessageId(providerMessageId: string): Promise<IntegrationDispatchReceiptRecord | null>;
  updateDispatchReceipt(id: string, input: IntegrationDispatchReceiptUpdateInput): Promise<IntegrationDispatchReceiptRecord>;
}

export type IntegrationDispatchReceiptOutcome =
  | "updated"
  | "ignored_missing_provider_id"
  | "ignored_unknown_status"
  | "ignored_not_found"
  | "ignored_stale";

const DELIVERY_RECEIPT_RANK: Record<IntegrationDeliveryReceiptStatus, number> = {
  UNKNOWN: 0,
  FAILED_AFTER_SUBMIT: 1,
  SUBMITTED: 2,
  DELIVERED: 3,
  READ: 4,
  PLAYED: 5,
};

export function normalizeBaileysMessageStatus(status: unknown): IntegrationDeliveryReceiptStatus | null {
  if (status === WAMessageStatus.ERROR) return "FAILED_AFTER_SUBMIT";
  if (status === WAMessageStatus.PENDING || status === WAMessageStatus.SERVER_ACK) return "SUBMITTED";
  if (status === WAMessageStatus.DELIVERY_ACK) return "DELIVERED";
  if (status === WAMessageStatus.READ) return "READ";
  if (status === WAMessageStatus.PLAYED) return "PLAYED";
  return null;
}

function statusNameFromBaileysStatus(status: unknown): string | null {
  if (typeof status !== "number") return null;
  return Object.entries(WAMessageStatus).find(([, value]) => value === status)?.[0] ?? String(status);
}

function parsePayloadSummary(payloadSummaryJson: string | null): Record<string, unknown> {
  if (!payloadSummaryJson) return {};
  try {
    const parsed = JSON.parse(payloadSummaryJson);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function stringifyPayloadSummary(summary: Record<string, unknown>): string {
  return redactSensitiveText(JSON.stringify(summary), 2000);
}

function currentReceiptStatus(summary: Record<string, unknown>): IntegrationDeliveryReceiptStatus | null {
  const value = summary.deliveryReceiptStatus;
  return typeof value === "string" && value in DELIVERY_RECEIPT_RANK
    ? value as IntegrationDeliveryReceiptStatus
    : null;
}

function shouldApplyReceipt(current: IntegrationDeliveryReceiptStatus | null, next: IntegrationDeliveryReceiptStatus): boolean {
  if (!current) return true;
  return DELIVERY_RECEIPT_RANK[next] >= DELIVERY_RECEIPT_RANK[current];
}

export function buildDeliveryReceiptSummary(input: {
  currentPayloadSummaryJson: string | null;
  providerMessageId: string;
  receiptStatus: IntegrationDeliveryReceiptStatus;
  baileysStatus: unknown;
  remoteJid: string | null;
  observedAt: Date;
}) {
  const summary = parsePayloadSummary(input.currentPayloadSummaryJson);
  const previousStatus = currentReceiptStatus(summary);

  if (!shouldApplyReceipt(previousStatus, input.receiptStatus)) {
    return { applied: false as const, payloadSummaryJson: stringifyPayloadSummary(summary) };
  }

  return {
    applied: true as const,
    payloadSummaryJson: stringifyPayloadSummary({
      ...summary,
      deliveryReceiptStatus: input.receiptStatus,
      deliveryReceiptObservedAt: input.observedAt.toISOString(),
      deliveryReceiptSource: INTEGRATION_DELIVERY_RECEIPT_SOURCE,
      deliveryReceiptProviderMessageId: input.providerMessageId,
      deliveryReceiptProviderStatus: statusNameFromBaileysStatus(input.baileysStatus),
      deliveryReceiptRemoteJid: input.remoteJid,
    }),
  };
}

export function createPrismaIntegrationDispatchReceiptStore(db: typeof prisma = prisma): IntegrationDispatchReceiptStore {
  return {
    async findByProviderMessageId(providerMessageId) {
      return db.integrationDispatchLog.findFirst({
        where: { providerMessageId },
        select: { id: true, providerMessageId: true, payloadSummaryJson: true },
      });
    },
    async updateDispatchReceipt(id, input) {
      return db.integrationDispatchLog.update({
        where: { id },
        data: { payloadSummaryJson: input.payloadSummaryJson },
        select: { id: true, providerMessageId: true, payloadSummaryJson: true },
      });
    },
  };
}

export function createInMemoryIntegrationDispatchReceiptStore(seed: IntegrationDispatchReceiptRecord[] = []): IntegrationDispatchReceiptStore & { records: Map<string, IntegrationDispatchReceiptRecord> } {
  const records = new Map(seed.map((record) => [record.id, { ...record }]));
  return {
    records,
    async findByProviderMessageId(providerMessageId) {
      const record = [...records.values()].find((entry) => entry.providerMessageId === providerMessageId);
      return record ? { ...record } : null;
    },
    async updateDispatchReceipt(id, input) {
      const current = records.get(id);
      if (!current) throw new Error(`Integration dispatch receipt not found: ${id}`);
      const updated = { ...current, payloadSummaryJson: input.payloadSummaryJson };
      records.set(id, updated);
      return { ...updated };
    },
  };
}

export function createIntegrationDispatchReceiptService(store: IntegrationDispatchReceiptStore = createPrismaIntegrationDispatchReceiptStore()) {
  return {
    async recordBaileysMessageUpdate(update: WAMessageUpdate, options: { observedAt?: Date } = {}): Promise<IntegrationDispatchReceiptOutcome> {
      const providerMessageId = typeof update.key?.id === "string" && update.key.id.trim() ? update.key.id : null;
      if (!providerMessageId) return "ignored_missing_provider_id";

      const receiptStatus = normalizeBaileysMessageStatus(update.update?.status);
      if (!receiptStatus) return "ignored_unknown_status";

      const record = await store.findByProviderMessageId(providerMessageId);
      if (!record) return "ignored_not_found";

      const nextSummary = buildDeliveryReceiptSummary({
        currentPayloadSummaryJson: record.payloadSummaryJson,
        providerMessageId,
        receiptStatus,
        baileysStatus: update.update?.status,
        remoteJid: typeof update.key?.remoteJid === "string" && update.key.remoteJid.trim() ? update.key.remoteJid : null,
        observedAt: options.observedAt ?? new Date(),
      });

      if (!nextSummary.applied) return "ignored_stale";

      await store.updateDispatchReceipt(record.id, { payloadSummaryJson: nextSummary.payloadSummaryJson });
      return "updated";
    },
  };
}

export const integrationDispatchReceiptService = createIntegrationDispatchReceiptService();
