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
const { WAMessageStatus } = require("@whiskeysockets/baileys");
const {
  buildDeliveryReceiptSummary,
  createInMemoryIntegrationDispatchReceiptStore,
  createIntegrationDispatchReceiptService,
  normalizeBaileysMessageStatus,
} = require("../src/services/integrations/integrationDispatchReceipt.service.ts");

function createUpdate(id, status, remoteJid = "5511999999999@s.whatsapp.net") {
  return {
    key: { id, remoteJid, fromMe: true },
    update: { status },
  };
}

(async () => {
  {
    assert.equal(normalizeBaileysMessageStatus(WAMessageStatus.SERVER_ACK), "SUBMITTED");
    assert.equal(normalizeBaileysMessageStatus(WAMessageStatus.DELIVERY_ACK), "DELIVERED");
    assert.equal(normalizeBaileysMessageStatus(WAMessageStatus.READ), "READ");
    assert.equal(normalizeBaileysMessageStatus(WAMessageStatus.PLAYED), "PLAYED");
    assert.equal(normalizeBaileysMessageStatus(WAMessageStatus.ERROR), "FAILED_AFTER_SUBMIT");
    assert.equal(normalizeBaileysMessageStatus(999), null);
  }

  {
    const store = createInMemoryIntegrationDispatchReceiptStore([
      {
        id: "dispatch-a",
        providerMessageId: "wamid.a",
        payloadSummaryJson: JSON.stringify({ eventSlug: "pedido_pago", deliveryPath: "text" }),
      },
    ]);
    const service = createIntegrationDispatchReceiptService(store);
    const outcome = await service.recordBaileysMessageUpdate(createUpdate("wamid.a", WAMessageStatus.DELIVERY_ACK), {
      observedAt: new Date("2026-05-31T15:00:00.000Z"),
    });
    const updated = JSON.parse(store.records.get("dispatch-a").payloadSummaryJson);
    assert.equal(outcome, "updated");
    assert.equal(updated.eventSlug, "pedido_pago");
    assert.equal(updated.deliveryReceiptStatus, "DELIVERED");
    assert.equal(updated.deliveryReceiptObservedAt, "2026-05-31T15:00:00.000Z");
    assert.equal(updated.deliveryReceiptSource, "baileys.messages.update");
    assert.equal(updated.deliveryReceiptProviderMessageId, "wamid.a");
    assert.equal(updated.deliveryReceiptProviderStatus, "DELIVERY_ACK");
    assert.equal(updated.deliveryReceiptRemoteJid, "5511999999999@s.whatsapp.net");
  }

  {
    const store = createInMemoryIntegrationDispatchReceiptStore([
      {
        id: "dispatch-read",
        providerMessageId: "wamid.read",
        payloadSummaryJson: JSON.stringify({ deliveryReceiptStatus: "READ", deliveryReceiptObservedAt: "2026-05-31T15:10:00.000Z" }),
      },
    ]);
    const service = createIntegrationDispatchReceiptService(store);
    const outcome = await service.recordBaileysMessageUpdate(createUpdate("wamid.read", WAMessageStatus.DELIVERY_ACK), {
      observedAt: new Date("2026-05-31T15:11:00.000Z"),
    });
    const unchanged = JSON.parse(store.records.get("dispatch-read").payloadSummaryJson);
    assert.equal(outcome, "ignored_stale");
    assert.equal(unchanged.deliveryReceiptStatus, "READ");
    assert.equal(unchanged.deliveryReceiptObservedAt, "2026-05-31T15:10:00.000Z");
  }

  {
    const store = createInMemoryIntegrationDispatchReceiptStore([
      {
        id: "dispatch-dup",
        providerMessageId: "wamid.dup",
        payloadSummaryJson: JSON.stringify({ deliveryReceiptStatus: "DELIVERED" }),
      },
    ]);
    const service = createIntegrationDispatchReceiptService(store);
    const outcome = await service.recordBaileysMessageUpdate(createUpdate("wamid.dup", WAMessageStatus.DELIVERY_ACK), {
      observedAt: new Date("2026-05-31T15:20:00.000Z"),
    });
    const updated = JSON.parse(store.records.get("dispatch-dup").payloadSummaryJson);
    assert.equal(outcome, "updated");
    assert.equal(updated.deliveryReceiptStatus, "DELIVERED");
    assert.equal(updated.deliveryReceiptObservedAt, "2026-05-31T15:20:00.000Z");
  }

  {
    const store = createInMemoryIntegrationDispatchReceiptStore([]);
    const service = createIntegrationDispatchReceiptService(store);
    assert.equal(await service.recordBaileysMessageUpdate(createUpdate("wamid.missing", WAMessageStatus.READ)), "ignored_not_found");
    assert.equal(await service.recordBaileysMessageUpdate(createUpdate("wamid.unknown", 999)), "ignored_unknown_status");
    assert.equal(await service.recordBaileysMessageUpdate({ key: {}, update: { status: WAMessageStatus.READ } }), "ignored_missing_provider_id");
  }

  {
    const result = buildDeliveryReceiptSummary({
      currentPayloadSummaryJson: "not-json",
      providerMessageId: "wamid.invalid-json",
      receiptStatus: "FAILED_AFTER_SUBMIT",
      baileysStatus: WAMessageStatus.ERROR,
      remoteJid: null,
      observedAt: new Date("2026-05-31T15:30:00.000Z"),
    });
    const parsed = JSON.parse(result.payloadSummaryJson);
    assert.equal(result.applied, true);
    assert.equal(parsed.deliveryReceiptStatus, "FAILED_AFTER_SUBMIT");
    assert.equal(parsed.deliveryReceiptProviderStatus, "ERROR");
  }

  console.log("integration-dispatch-receipt-api: OK");
})().catch((error) => {
  console.error("integration-dispatch-receipt-api:", error);
  process.exit(1);
});
