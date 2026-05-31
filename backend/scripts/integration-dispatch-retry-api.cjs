"use strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-with-more-than-32-characters";
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "local-test-password";
process.env.PORT = process.env.PORT || "0";
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || Buffer.alloc(32, 9).toString("base64");

require("ts-node/register");

const assert = require("assert");
const { createIntegrationDispatchRetryWorker } = require("../src/services/integrations/integrationDispatchRetry.service.ts");
const { INTEGRATION_DISPATCH_STATUS } = require("../src/services/integrations/integrationDispatchRuntime.service.ts");

function createLog(overrides = {}) {
  return {
    id: overrides.id ?? "dispatch-1",
    ingressLogId: overrides.ingressLogId ?? "ingress-1",
    credentialId: overrides.credentialId ?? "credential-1",
    instanceId: overrides.instanceId ?? "instance-1",
    eventSlug: overrides.eventSlug ?? "pedido_pago",
    dedupKey: overrides.dedupKey ?? "dedup-1",
    recipientJid: overrides.recipientJid ?? "5511999999999@s.whatsapp.net",
    messageType: overrides.messageType ?? "text",
    dispatchStatus: overrides.dispatchStatus ?? INTEGRATION_DISPATCH_STATUS.FAILED_INSTANCE_OFFLINE,
    failureCode: overrides.failureCode ?? "INTEGRATION_DISPATCH_INSTANCE_OFFLINE",
    providerMessageId: overrides.providerMessageId ?? null,
    payloadSummaryJson: overrides.payloadSummaryJson ?? null,
    retryable: overrides.retryable ?? true,
    retryAttemptCount: overrides.retryAttemptCount ?? 1,
    nextRetryAt: overrides.nextRetryAt ?? new Date(0),
    lastRetryError: overrides.lastRetryError ?? "INTEGRATION_DISPATCH_INSTANCE_OFFLINE",
    retryLockedAt: overrides.retryLockedAt ?? null,
    retryExhaustedAt: overrides.retryExhaustedAt ?? null,
    createdAt: overrides.createdAt ?? new Date(0),
    processedAt: overrides.processedAt ?? new Date(0),
  };
}

function createDb(logs, ingressPayloads, options = {}) {
  return {
    integrationDispatchLog: {
      async findMany() {
        return logs.filter((log) => log.retryable && !log.retryExhaustedAt && log.nextRetryAt <= new Date("2026-05-31T00:00:00.000Z"));
      },
      async updateMany(args) {
        const id = args.where.id;
        const log = logs.find((entry) => entry.id === id);
        if (!log) return { count: 0 };
        if (options.skipClaim) return { count: 0 };
        if (args.where.retryable === true && !log.retryable) return { count: 0 };
        if (args.where.nextRetryAt?.lte && log.nextRetryAt > args.where.nextRetryAt.lte) return { count: 0 };
        Object.assign(log, args.data);
        return { count: 1 };
      },
      async findUnique(args) {
        return logs.find((entry) => entry.id === args.where.id) ?? null;
      },
    },
    integrationIngressLog: {
      async findUnique(args) {
        const payload = ingressPayloads.get(args.where.id);
        return payload === undefined ? null : { id: args.where.id, payloadJson: payload };
      },
    },
  };
}

(async () => {
  {
    const log = createLog();
    const calls = [];
    const db = createDb([log], new Map([["ingress-1", JSON.stringify({ customer: { phone: "11999999999" } })]]));
    const worker = createIntegrationDispatchRetryWorker({
      db,
      now: () => new Date("2026-05-31T00:00:00.000Z"),
      runtimeService: {
        async retryDispatch(input) {
          calls.push(input);
          log.dispatchStatus = INTEGRATION_DISPATCH_STATUS.SENT;
          log.retryable = false;
        },
      },
    });
    const result = await worker.processDue({ limit: 10 });
    assert.equal(result.scanned, 1);
    assert.equal(result.claimed, 1);
    assert.equal(result.succeeded, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].dispatchLog.id, "dispatch-1");
    assert.deepEqual(calls[0].payload, { customer: { phone: "11999999999" } });
  }

  {
    const log = createLog({ id: "dispatch-missing-payload" });
    const db = createDb([log], new Map());
    const worker = createIntegrationDispatchRetryWorker({
      db,
      now: () => new Date("2026-05-31T00:00:00.000Z"),
      runtimeService: {
        async retryDispatch() {
          throw new Error("should not retry without payload");
        },
      },
    });
    const result = await worker.processDue();
    assert.equal(result.exhausted, 1);
    assert.equal(log.retryable, false);
    assert.equal(log.lastRetryError, "INTEGRATION_DISPATCH_RETRY_PAYLOAD_MISSING");
  }

  {
    const log = createLog({ id: "dispatch-claimed" });
    const db = createDb([log], new Map([["ingress-1", "{}"]]), { skipClaim: true });
    const worker = createIntegrationDispatchRetryWorker({
      db,
      now: () => new Date("2026-05-31T00:00:00.000Z"),
      runtimeService: {
        async retryDispatch() {
          throw new Error("should not process unclaimed dispatch");
        },
      },
    });
    const result = await worker.processDue();
    assert.equal(result.scanned, 1);
    assert.equal(result.claimed, 0);
    assert.equal(result.skipped, 1);
  }

  {
    const log = createLog({ id: "dispatch-replanned" });
    const db = createDb([log], new Map([["ingress-1", "{}"]]));
    const originalUpdateMany = db.integrationDispatchLog.updateMany;
    db.integrationDispatchLog.updateMany = async (args) => {
      if (args.where.id === "dispatch-replanned" && args.where.nextRetryAt?.lte) {
        log.nextRetryAt = new Date("2026-05-31T00:05:00.000Z");
      }
      return originalUpdateMany(args);
    };
    const worker = createIntegrationDispatchRetryWorker({
      db,
      now: () => new Date("2026-05-31T00:00:00.000Z"),
      runtimeService: {
        async retryDispatch() {
          throw new Error("should not process replanned dispatch");
        },
      },
    });
    const result = await worker.processDue();
    assert.equal(result.scanned, 1);
    assert.equal(result.claimed, 0);
    assert.equal(result.skipped, 1);
  }

  console.log("integration-dispatch-retry-api: OK");
})().catch((error) => {
  console.error("integration-dispatch-retry-api:", error);
  process.exit(1);
});
