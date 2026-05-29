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
const {
  createInMemoryIntegrationDispatchStore,
  createIntegrationDispatchLogService,
  createIntegrationDispatchRuntimeService,
  INTEGRATION_DISPATCH_STATUS,
  IntegrationDispatchInstanceNotFoundError,
  IntegrationDispatchInstanceOfflineError,
  IntegrationDispatchRecipientMissingError,
  IntegrationDispatchSendFailedError,
} = require("../src/services/integrations/integrationDispatchRuntime.service.ts");

function createBasePayload() {
  return {
    customer: { name: "Maria", phone: "(11) 99876-5432" },
    order: { product: { name: "Curso Premium" } },
    checkout_link: "https://checkout.example.com/c/123",
    boleto: {
      pdf_url: "https://checkout.example.com/boleto.pdf",
      amount: "149.90",
      expire_at: "2026-06-15",
      barcode: "123456",
    },
    access: {
      url: "https://members.example.com/aula-1",
      login: "maria@example.com",
      password: "temporary-pass",
    },
  };
}

function createDispatchService(options = {}) {
  const store = createInMemoryIntegrationDispatchStore();
  const logService = createIntegrationDispatchLogService(store);
  const sentPayloads = [];
  const sock = options.sock ?? {
    async sendMessage(jid, content) {
      sentPayloads.push({ jid, content });
      return { key: { id: "wamid.123" } };
    },
  };

  const service = createIntegrationDispatchRuntimeService({
    logService,
    instanceLookup: options.instanceLookup ?? (async (instanceId) => ({ id: instanceId, status: "CONNECTED" })),
    socketLookup: options.socketLookup ?? (() => sock),
  });

  return { service, store, sentPayloads, sock };
}

(async () => {
  {
    const { service, store, sentPayloads } = createDispatchService();
    const result = await service.dispatchEvent({
      ingressLogId: "ingress-1",
      credentialId: "cred-1",
      instanceId: "instance-a",
      eventSlug: "pedido_pago",
      dedupKey: "evt-1",
      payload: createBasePayload(),
    });
    assert.equal(sentPayloads[0].jid, "5511998765432@s.whatsapp.net");
    assert.deepEqual(sentPayloads[0].content, { text: result.template.body });
    assert.equal(result.dispatchLog.dispatchStatus, INTEGRATION_DISPATCH_STATUS.SENT);
    assert.equal(result.dispatchLog.providerMessageId, "wamid.123");
    assert.equal(Array.from(store.logs.values())[0].dispatchStatus, INTEGRATION_DISPATCH_STATUS.SENT);
  }

  {
    const { service, sentPayloads } = createDispatchService();
    await service.dispatchEvent({
      instanceId: "instance-a",
      eventSlug: "pedido_pendente",
      dedupKey: "evt-link",
      payload: createBasePayload(),
    });
    assert.equal(sentPayloads[0].content.text.includes("https://checkout.example.com/c/123"), true);
  }

  {
    const { service, sentPayloads } = createDispatchService();
    await service.dispatchEvent({
      instanceId: "instance-a",
      eventSlug: "boleto_gerado",
      dedupKey: "evt-doc",
      payload: createBasePayload(),
    });
    assert.deepEqual(sentPayloads[0].content, {
      document: { url: "https://checkout.example.com/boleto.pdf" },
      mimetype: "application/pdf",
      fileName: "boleto.pdf",
      caption: sentPayloads[0].content.caption,
    });
  }

  {
    const { service, store } = createDispatchService({
      instanceLookup: async () => null,
      socketLookup: () => null,
    });
    await assert.rejects(
      () => service.dispatchEvent({
        instanceId: "missing-instance",
        eventSlug: "pedido_pago",
        payload: createBasePayload(),
      }),
      (error) => error instanceof IntegrationDispatchInstanceNotFoundError,
    );
    assert.equal(Array.from(store.logs.values())[0].dispatchStatus, INTEGRATION_DISPATCH_STATUS.FAILED_INSTANCE_NOT_FOUND);
  }

  {
    const { service, store } = createDispatchService({
      instanceLookup: async (instanceId) => ({ id: instanceId, status: "DISCONNECTED" }),
      socketLookup: () => null,
    });
    await assert.rejects(
      () => service.dispatchEvent({
        instanceId: "offline-instance",
        eventSlug: "pedido_pago",
        payload: createBasePayload(),
      }),
      (error) => error instanceof IntegrationDispatchInstanceOfflineError,
    );
    assert.equal(Array.from(store.logs.values())[0].dispatchStatus, INTEGRATION_DISPATCH_STATUS.FAILED_INSTANCE_OFFLINE);
  }

  {
    const payload = createBasePayload();
    delete payload.customer.phone;
    delete payload.order;
    const { service, store } = createDispatchService();
    await assert.rejects(
      () => service.dispatchEvent({
        instanceId: "instance-a",
        eventSlug: "pedido_pago",
        payload,
      }),
      (error) => error instanceof IntegrationDispatchRecipientMissingError,
    );
    assert.equal(Array.from(store.logs.values())[0].dispatchStatus, INTEGRATION_DISPATCH_STATUS.FAILED_RECIPIENT_MISSING);
  }

  {
    const { service, store } = createDispatchService({
      sock: {
        async sendMessage() {
          throw new Error("send failed");
        },
      },
    });
    await assert.rejects(
      () => service.dispatchEvent({
        instanceId: "instance-a",
        eventSlug: "pedido_pago",
        payload: createBasePayload(),
      }),
      (error) => error instanceof IntegrationDispatchSendFailedError,
    );
    assert.equal(Array.from(store.logs.values())[0].dispatchStatus, INTEGRATION_DISPATCH_STATUS.FAILED_SEND);
  }

  console.log("integration-dispatch-runtime-api: OK");
})().catch((error) => {
  console.error("integration-dispatch-runtime-api:", error);
  process.exit(1);
});
