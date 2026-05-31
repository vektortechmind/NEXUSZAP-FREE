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
const Fastify = require("fastify");
const {
  DuplicateIntegrationRequestError,
  InactiveIntegrationCredentialError,
  IntegrationInstanceMismatchError,
  IntegrationReplayWindowError,
  InvalidIntegrationTokenError,
} = require("../src/services/integrations/integrationAuth.service.ts");
const {
  INTEGRATION_INGRESS_STATUS,
  createInMemoryIntegrationIngressStore,
  createIntegrationIngressService,
} = require("../src/services/integrations/integrationIngress.service.ts");
const {
  IntegrationDispatchInstanceOfflineError,
  IntegrationDispatchRecipientMissingError,
} = require("../src/services/integrations/integrationDispatchRuntime.service.ts");
const { integrationEventCatalogService } = require("../src/services/integrations/integrationEventCatalog.service.ts");
const { createIntegrationRoutes } = require("../src/routes/integration.routes.ts");

function createApp(authBehavior, dispatchBehavior = async () => ({
  dispatchLog: { id: "dispatch-1" },
  providerMessageId: "wamid.123",
}), eventCatalogBehavior = integrationEventCatalogService.normalizeEventContext) {
  const app = Fastify();
  const logStore = createInMemoryIntegrationIngressStore();
  const ingressService = createIntegrationIngressService(logStore);

  app.register(createIntegrationRoutes({
    authService: {
      authorizeRequest: authBehavior,
    },
    ingressService,
    eventCatalogService: {
      normalizeEventContext: eventCatalogBehavior,
    },
    dispatchRuntimeService: {
      dispatchEvent: dispatchBehavior,
    },
  }), { prefix: "/api/integrations" });

  return { app, logStore };
}

function validPayload(overrides = {}) {
  return {
    event: "pedido_pago",
    payload: {
      customer: { name: "Maria", phone: "(11) 99876-5432" },
      order: { product: { name: "Curso" } },
      checkout_link: "https://checkout.example.com/c/123",
    },
    instanceId: "instance-a",
    timestamp: "2026-05-29T14:00:00.000Z",
    dedupKey: "evt-001",
    ...overrides,
  };
}

(async () => {
  {
    const { app, logStore } = createApp(async () => ({
      credential: { id: "cred-1" },
      requestTimestamp: new Date("2026-05-29T14:00:00.000Z"),
    }));
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/api/integrations/events",
      payload: validPayload(),
    });
    assert.equal(response.statusCode, 400, response.body);
    assert.equal(JSON.parse(response.body).error.code, "INTEGRATION_CONTRACT_INVALID");
    assert.equal(Array.from(logStore.logs.values())[0].status, INTEGRATION_INGRESS_STATUS.REJECTED_CONTRACT);
    await app.close();
  }

  {
    let catalogCalled = false;
    const { app, logStore } = createApp(async () => {
      throw new InvalidIntegrationTokenError();
    }, undefined, () => {
      catalogCalled = true;
      throw new Error("catalog should not run before auth");
    });
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/api/integrations/events",
      headers: { authorization: "Bearer invalid-token" },
      payload: validPayload(),
    });
    assert.equal(response.statusCode, 401, response.body);
    assert.equal(JSON.parse(response.body).error.code, "INVALID_INTEGRATION_TOKEN");
    const stored = Array.from(logStore.logs.values())[0];
    assert.equal(stored.status, INTEGRATION_INGRESS_STATUS.REJECTED_AUTH);
    assert.equal(stored.payloadJson, null);
    assert.equal(catalogCalled, false);
    await app.close();
  }

  {
    let catalogCalled = false;
    const { app, logStore } = createApp(async () => {
      throw new InactiveIntegrationCredentialError();
    }, undefined, () => {
      catalogCalled = true;
      throw new Error("catalog should not run before auth");
    });
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/api/integrations/events",
      headers: { authorization: "Bearer inactive-token" },
      payload: validPayload({ dedupKey: "evt-inactive" }),
    });
    assert.equal(response.statusCode, 403, response.body);
    assert.equal(JSON.parse(response.body).error.code, "INACTIVE_INTEGRATION_CREDENTIAL");
    const stored = Array.from(logStore.logs.values())[0];
    assert.equal(stored.status, INTEGRATION_INGRESS_STATUS.REJECTED_AUTH);
    assert.equal(stored.payloadJson, null);
    assert.equal(catalogCalled, false);
    await app.close();
  }

  {
    let catalogCalled = false;
    const { app, logStore } = createApp(async () => {
      throw new InvalidIntegrationTokenError();
    }, undefined, () => {
      catalogCalled = true;
      throw new Error("catalog should not run before auth");
    });
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/api/integrations/events",
      headers: { authorization: "Bearer invalid-token" },
      payload: validPayload({ event: "webhook.test" }),
    });
    assert.equal(response.statusCode, 401, response.body);
    assert.equal(JSON.parse(response.body).error.code, "INVALID_INTEGRATION_TOKEN");
    const stored = Array.from(logStore.logs.values())[0];
    assert.equal(stored.status, INTEGRATION_INGRESS_STATUS.REJECTED_AUTH);
    assert.equal(stored.payloadJson, null);
    assert.equal(catalogCalled, false);
    await app.close();
  }

  {
    const { app, logStore } = createApp(async () => ({
      credential: { id: "cred-1" },
      requestTimestamp: new Date("2026-05-29T14:00:00.000Z"),
    }));
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/api/integrations/events",
      headers: { authorization: "Bearer valid-token" },
      payload: { instanceId: "instance-a", timestamp: "2026-05-29T14:00:00.000Z", dedupKey: "evt-001" },
    });
    assert.equal(response.statusCode, 400, response.body);
    assert.equal(JSON.parse(response.body).error.code, "INTEGRATION_CONTRACT_INVALID");
    assert.equal(Array.from(logStore.logs.values())[0].status, INTEGRATION_INGRESS_STATUS.REJECTED_CONTRACT);
    await app.close();
  }

  {
    let catalogCalled = false;
    const { app, logStore } = createApp(async () => {
      throw new IntegrationInstanceMismatchError();
    }, undefined, () => {
      catalogCalled = true;
      throw new Error("catalog should not run before auth");
    });
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/api/integrations/events",
      headers: { authorization: "Bearer valid-token" },
      payload: validPayload({ instanceId: "wrong-instance" }),
    });
    assert.equal(response.statusCode, 403, response.body);
    assert.equal(JSON.parse(response.body).error.code, "INTEGRATION_INSTANCE_MISMATCH");
    const stored = Array.from(logStore.logs.values())[0];
    assert.equal(stored.status, INTEGRATION_INGRESS_STATUS.REJECTED_AUTH);
    assert.equal(stored.payloadJson, null);
    assert.equal(catalogCalled, false);
    await app.close();
  }

  {
    const { app, logStore } = createApp(async () => {
      throw new IntegrationReplayWindowError();
    });
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/api/integrations/events",
      headers: { authorization: "Bearer valid-token" },
      payload: validPayload({ timestamp: "2026-05-29T13:00:00.000Z" }),
    });
    assert.equal(response.statusCode, 409, response.body);
    assert.equal(JSON.parse(response.body).error.code, "INTEGRATION_REPLAY_WINDOW_VIOLATION");
    assert.equal(Array.from(logStore.logs.values())[0].status, INTEGRATION_INGRESS_STATUS.REJECTED_REPLAY);
    await app.close();
  }

  {
    const { app, logStore } = createApp(async () => {
      throw new DuplicateIntegrationRequestError();
    });
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/api/integrations/events",
      headers: { authorization: "Bearer valid-token" },
      payload: validPayload({ dedupKey: "evt-duplicate" }),
    });
    assert.equal(response.statusCode, 409, response.body);
    assert.equal(JSON.parse(response.body).error.code, "DUPLICATE_INTEGRATION_REQUEST");
    assert.equal(Array.from(logStore.logs.values())[0].status, INTEGRATION_INGRESS_STATUS.REJECTED_DUPLICATE);
    await app.close();
  }

  {
    let authCalled = false;
    const { app, logStore } = createApp(async () => {
      authCalled = true;
      return {
        credential: { id: "cred-unsupported" },
        requestTimestamp: new Date("2026-05-29T14:00:00.000Z"),
      };
    });
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/api/integrations/events",
      headers: { authorization: "Bearer valid-token" },
      payload: validPayload({ event: "webhook.test" }),
    });
    assert.equal(response.statusCode, 400, response.body);
    assert.equal(JSON.parse(response.body).error.code, "UNSUPPORTED_INTEGRATION_EVENT");
    assert.equal(authCalled, true);
    const stored = Array.from(logStore.logs.values())[0];
    assert.equal(stored.status, INTEGRATION_INGRESS_STATUS.REJECTED_CONTRACT);
    assert.equal(stored.credentialId, "cred-unsupported");
    await app.close();
  }

  {
    const { app, logStore } = createApp(async () => ({
      credential: { id: "cred-accepted" },
      requestTimestamp: new Date("2026-05-29T14:00:00.000Z"),
    }));
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/api/integrations/events",
      headers: { authorization: "Bearer valid-token" },
      payload: validPayload({ dedupKey: "evt-success" }),
    });
    assert.equal(response.statusCode, 202, response.body);
    const parsed = JSON.parse(response.body);
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.status, "accepted");
    assert.equal(parsed.data.dispatchId, "dispatch-1");
    assert.equal(parsed.data.providerMessageId, "wamid.123");
    const stored = Array.from(logStore.logs.values())[0];
    assert.equal(stored.status, INTEGRATION_INGRESS_STATUS.ACCEPTED);
    assert.equal(stored.credentialId, "cred-accepted");
    await app.close();
  }

  {
    const { app, logStore } = createApp(async () => ({
      credential: { id: "cred-dispatch-fail" },
      requestTimestamp: new Date("2026-05-29T14:00:00.000Z"),
    }), async () => {
      throw new IntegrationDispatchRecipientMissingError("pedido_pago");
    });
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/api/integrations/events",
      headers: { authorization: "Bearer valid-token" },
      payload: validPayload({ dedupKey: "evt-dispatch-fail" }),
    });
    assert.equal(response.statusCode, 422, response.body);
    assert.equal(JSON.parse(response.body).error.code, "INTEGRATION_DISPATCH_RECIPIENT_MISSING");
    const stored = Array.from(logStore.logs.values())[0];
    assert.equal(stored.status, INTEGRATION_INGRESS_STATUS.ERROR);
    assert.equal(stored.failureCode, "INTEGRATION_DISPATCH_RECIPIENT_MISSING");
    await app.close();
  }

  {
    const { app, logStore } = createApp(async () => ({
      credential: { id: "cred-dispatch-retry" },
      requestTimestamp: new Date("2026-05-29T14:00:00.000Z"),
    }), async () => {
      const error = new IntegrationDispatchInstanceOfflineError("instance-a");
      error.dispatchLogId = "dispatch-retry-1";
      throw error;
    });
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/api/integrations/events",
      headers: { authorization: "Bearer valid-token" },
      payload: validPayload({ dedupKey: "evt-dispatch-retry" }),
    });
    assert.equal(response.statusCode, 202, response.body);
    const parsed = JSON.parse(response.body);
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.dispatchId, "dispatch-retry-1");
    assert.equal(parsed.data.retryQueued, true);
    assert.equal(parsed.data.dispatchStatus, "FAILED_INSTANCE_OFFLINE");
    const stored = Array.from(logStore.logs.values())[0];
    assert.equal(stored.status, INTEGRATION_INGRESS_STATUS.ACCEPTED);
    assert.equal(stored.failureCode, null);
    await app.close();
  }

  console.log("integration-events-api: OK");
})().catch((error) => {
  console.error("integration-events-api:", error);
  process.exit(1);
});
