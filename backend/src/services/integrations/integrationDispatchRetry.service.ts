import { prisma } from "../../database/prisma";
import {
  DEFAULT_INTEGRATION_DISPATCH_RETRY_MAX_ATTEMPTS,
  type IntegrationDispatchLogRecord,
  type IntegrationDispatchRuntimeError,
  integrationDispatchRuntimeService,
} from "./integrationDispatchRuntime.service";

export type IntegrationDispatchRetryResult = {
  scanned: number;
  claimed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  exhausted: number;
  errors: Array<{ dispatchId: string; code: string; message: string }>;
};

type IntegrationRetryDb = {
  integrationDispatchLog: {
    findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
    updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  };
  integrationIngressLog: {
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  };
};

type IntegrationRetryRuntime = Pick<typeof integrationDispatchRuntimeService, "retryDispatch">;

export type IntegrationDispatchRetryWorkerDeps = {
  db?: IntegrationRetryDb;
  runtimeService?: IntegrationRetryRuntime;
  now?: () => Date;
  staleLockMs?: number;
  maxAttempts?: number;
};

export type ProcessIntegrationDispatchRetryOptions = {
  limit?: number;
};

function toDispatchLogRecord(record: Record<string, unknown>): IntegrationDispatchLogRecord {
  return {
    id: String(record.id),
    ingressLogId: typeof record.ingressLogId === "string" ? record.ingressLogId : null,
    credentialId: typeof record.credentialId === "string" ? record.credentialId : null,
    instanceId: typeof record.instanceId === "string" ? record.instanceId : null,
    eventSlug: typeof record.eventSlug === "string" ? record.eventSlug : null,
    dedupKey: typeof record.dedupKey === "string" ? record.dedupKey : null,
    recipientJid: typeof record.recipientJid === "string" ? record.recipientJid : null,
    messageType: typeof record.messageType === "string" ? record.messageType : null,
    dispatchStatus: record.dispatchStatus as IntegrationDispatchLogRecord["dispatchStatus"],
    failureCode: typeof record.failureCode === "string" ? record.failureCode : null,
    providerMessageId: typeof record.providerMessageId === "string" ? record.providerMessageId : null,
    payloadSummaryJson: typeof record.payloadSummaryJson === "string" ? record.payloadSummaryJson : null,
    retryable: Boolean(record.retryable),
    retryAttemptCount: typeof record.retryAttemptCount === "number" ? record.retryAttemptCount : 0,
    nextRetryAt: record.nextRetryAt instanceof Date ? record.nextRetryAt : null,
    lastRetryError: typeof record.lastRetryError === "string" ? record.lastRetryError : null,
    retryLockedAt: record.retryLockedAt instanceof Date ? record.retryLockedAt : null,
    retryExhaustedAt: record.retryExhaustedAt instanceof Date ? record.retryExhaustedAt : null,
    createdAt: record.createdAt instanceof Date ? record.createdAt : new Date(0),
    processedAt: record.processedAt instanceof Date ? record.processedAt : null,
  };
}

function parseIngressPayload(record: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!record || typeof record.payloadJson !== "string" || !record.payloadJson.trim()) return null;
  try {
    const parsed = JSON.parse(record.payloadJson) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function errorCode(error: unknown): string {
  const maybeRuntimeError = error as Partial<IntegrationDispatchRuntimeError>;
  if (typeof maybeRuntimeError.code === "string" && maybeRuntimeError.code) return maybeRuntimeError.code;
  return "INTEGRATION_DISPATCH_RETRY_ERROR";
}

export function createIntegrationDispatchRetryWorker(deps: IntegrationDispatchRetryWorkerDeps = {}) {
  const db = deps.db ?? prisma as unknown as IntegrationRetryDb;
  const runtimeService = deps.runtimeService ?? integrationDispatchRuntimeService;
  const now = deps.now ?? (() => new Date());
  const staleLockMs = deps.staleLockMs ?? 5 * 60_000;
  const maxAttempts = deps.maxAttempts ?? DEFAULT_INTEGRATION_DISPATCH_RETRY_MAX_ATTEMPTS;

  return {
    async processDue(options: ProcessIntegrationDispatchRetryOptions = {}): Promise<IntegrationDispatchRetryResult> {
      const current = now();
      const staleBefore = new Date(current.getTime() - staleLockMs);
      const limit = Math.max(1, Math.min(options.limit ?? 25, 100));
      const dueRecords = await db.integrationDispatchLog.findMany({
        where: {
          retryable: true,
          retryExhaustedAt: null,
          retryAttemptCount: { lt: maxAttempts },
          nextRetryAt: { lte: current },
          OR: [
            { retryLockedAt: null },
            { retryLockedAt: { lt: staleBefore } },
          ],
        },
        orderBy: [{ nextRetryAt: "asc" }, { createdAt: "asc" }],
        take: limit,
      });

      const result: IntegrationDispatchRetryResult = {
        scanned: dueRecords.length,
        claimed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        exhausted: 0,
        errors: [],
      };

      for (const dueRecord of dueRecords) {
        const dispatch = toDispatchLogRecord(dueRecord);
        // react-doctor-disable-next-line react-doctor/async-await-in-loop -- Retry records are claimed one at a time to preserve idempotent locking and avoid duplicate external dispatch.
        const claim = await db.integrationDispatchLog.updateMany({
          where: {
            id: dispatch.id,
            retryable: true,
            retryExhaustedAt: null,
            retryAttemptCount: { lt: maxAttempts },
            nextRetryAt: { lte: current },
            OR: [
              { retryLockedAt: null },
              { retryLockedAt: { lt: staleBefore } },
            ],
          },
          data: { retryLockedAt: current },
        });

        if (claim.count !== 1) {
          result.skipped += 1;
          continue;
        }

        result.claimed += 1;
        const claimedRecord = await db.integrationDispatchLog.findUnique({ where: { id: dispatch.id } });
        const claimedDispatch = claimedRecord ? toDispatchLogRecord(claimedRecord) : dispatch;
        const ingressRecord = claimedDispatch.ingressLogId
          ? await db.integrationIngressLog.findUnique({ where: { id: claimedDispatch.ingressLogId } })
          : null;
        const payload = parseIngressPayload(ingressRecord);

        if (!payload) {
          await db.integrationDispatchLog.updateMany({
            where: { id: dispatch.id },
            data: {
              retryable: false,
              nextRetryAt: null,
              lastRetryError: "INTEGRATION_DISPATCH_RETRY_PAYLOAD_MISSING",
              retryLockedAt: null,
              retryExhaustedAt: current,
            },
          });
          result.exhausted += 1;
          result.errors.push({
            dispatchId: dispatch.id,
            code: "INTEGRATION_DISPATCH_RETRY_PAYLOAD_MISSING",
            message: "Payload original do ingress nao esta disponivel para retry.",
          });
          continue;
        }

        try {
          await runtimeService.retryDispatch({ dispatchLog: claimedDispatch, payload });
          result.succeeded += 1;
        } catch (error) {
          const refreshed = await db.integrationDispatchLog.findUnique({ where: { id: dispatch.id } });
          const refreshedDispatch = refreshed ? toDispatchLogRecord(refreshed) : null;
          result.failed += 1;
          if (refreshedDispatch?.retryExhaustedAt) result.exhausted += 1;
          result.errors.push({
            dispatchId: dispatch.id,
            code: errorCode(error),
            message: error instanceof Error ? error.message : "Falha ao processar retry de dispatch.",
          });
        }
      }

      return result;
    },
  };
}

export const integrationDispatchRetryWorker = createIntegrationDispatchRetryWorker();
