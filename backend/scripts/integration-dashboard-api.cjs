"use strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-with-more-than-32-characters";
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "local-test-password";
process.env.PORT = process.env.PORT || "0";
process.env.APP_URL = process.env.APP_URL || "https://painel.exemplo.com";

require("ts-node/register");

const assert = require("assert");
const Fastify = require("fastify");
const {
  createInMemoryIntegrationDashboardStore,
  createIntegrationDashboardService,
} = require("../src/services/integrations/integrationDashboard.service.ts");

function createOverviewService() {
  const store = createInMemoryIntegrationDashboardStore({
    instances: [
      { id: "instance-a", name: "Vendas", slot: 1, status: "CONNECTED" },
      { id: "instance-b", name: "Suporte", slot: 2, status: "DISCONNECTED" },
      { id: "instance-c", name: "Operacao", slot: 3, status: "CONNECTED" },
    ],
    credentials: [
      {
        id: "cred-a",
        instanceId: "instance-a",
        status: "ACTIVE",
        tokenPreview: "nz_live_abc***",
        replayWindowMs: 300000,
        dedupWindowMs: 300000,
        lastUsedAt: new Date("2026-05-29T11:59:00.000Z"),
        updatedAt: new Date("2026-05-29T12:00:00.000Z"),
      },
      {
        id: "cred-b",
        instanceId: "instance-b",
        status: "DISABLED",
        tokenPreview: "nz_live_xyz***",
        replayWindowMs: 300000,
        dedupWindowMs: 300000,
        lastUsedAt: null,
        updatedAt: new Date("2026-05-28T12:00:00.000Z"),
      },
    ],
    ingressLogs: [
      {
        id: "ingress-a-1",
        instanceId: "instance-a",
        eventSlug: "pedido_pago",
        dedupKey: "evt-a-1",
        status: "ACCEPTED",
        failureCode: null,
        requestTimestamp: new Date("2026-05-29T11:58:00.000Z"),
        receivedAt: new Date("2026-05-29T11:58:01.000Z"),
        processedAt: new Date("2026-05-29T11:58:02.000Z"),
      },
      {
        id: "ingress-c-1",
        instanceId: "instance-c",
        eventSlug: "pedido_pago",
        dedupKey: "evt-c-1",
        status: "ERROR",
        failureCode: "INTEGRATION_DISPATCH_INSTANCE_OFFLINE",
        requestTimestamp: new Date("2026-05-29T10:00:00.000Z"),
        receivedAt: new Date("2026-05-29T10:00:01.000Z"),
        processedAt: new Date("2026-05-29T10:00:02.000Z"),
      },
    ],
    dispatchLogs: [
      {
        id: "dispatch-a-1",
        instanceId: "instance-a",
        eventSlug: "pedido_pago",
        messageType: "text",
        dispatchStatus: "SENT",
        failureCode: null,
        providerMessageId: "wamid.123",
        createdAt: new Date("2026-05-29T11:58:03.000Z"),
        processedAt: new Date("2026-05-29T11:58:04.000Z"),
      },
      {
        id: "dispatch-c-1",
        instanceId: "instance-c",
        eventSlug: "boleto_gerado",
        messageType: "document",
        dispatchStatus: "FAILED_INSTANCE_OFFLINE",
        failureCode: "INTEGRATION_DISPATCH_INSTANCE_OFFLINE",
        providerMessageId: null,
        createdAt: new Date("2026-05-29T10:00:03.000Z"),
        processedAt: new Date("2026-05-29T10:00:04.000Z"),
      },
    ],
  });

  return createIntegrationDashboardService(store);
}

(async () => {
  {
    const service = createOverviewService();
    const overview = await service.getOverview({
      endpointUrl: "https://painel.exemplo.com/api/integrations/events",
      recentActivityWindowMs: 10 * 365 * 24 * 60 * 60 * 1000,
    });
    assert.equal(overview.summary.trackedInstances, 3);
    assert.equal(overview.summary.activeConnections, 1);
    assert.equal(overview.summary.activeWithRecentActivity, 1);
    assert.equal(overview.summary.inactiveConnections, 1);
    assert.equal(overview.summary.recentFailures, 1);
    assert.equal(overview.summary.missingCredential, 1);
    assert.equal(overview.documentation.endpointUrl, "https://painel.exemplo.com/api/integrations/events");
    assert.deepEqual(overview.documentation.supportedMessageTypes, ["text", "link", "document"]);
    assert.equal(overview.integrations[0].instanceId, "instance-a");
    assert.equal(overview.integrations[0].operationalStatus, "ACTIVE_RECENT_ACTIVITY");
    assert.equal(overview.integrations[1].instanceId, "instance-c");
    assert.equal(overview.integrations[1].operationalStatus, "DISPATCH_FAILED");
    assert.equal(overview.integrations[2].instanceId, "instance-b");
    assert.equal(overview.integrations[2].credentialStatus, "DISABLED");
    assert.ok(!("secretToken" in overview.integrations[0]));
  }

  {
    const app = Fastify();
    const service = createOverviewService();
    app.get("/api/dashboard/integrations", async () => service.getOverview({
      endpointUrl: "https://painel.exemplo.com/api/integrations/events",
      recentActivityWindowMs: 10 * 365 * 24 * 60 * 60 * 1000,
    }));
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/api/dashboard/integrations" });
    assert.equal(response.statusCode, 200, response.body);
    const payload = JSON.parse(response.body);
    assert.equal(payload.documentation.path, "/integracoes/documentacao");
    assert.equal(payload.documentation.endpointUrl, "https://painel.exemplo.com/api/integrations/events");
    assert.equal(payload.integrations[0].recentDispatches[0].providerMessageId, "wamid.123");
    assert.equal(payload.integrations[1].lastDispatch.failureCode, "INTEGRATION_DISPATCH_INSTANCE_OFFLINE");
    assert.equal(payload.integrations[2].tokenPreview, "nz_live_xyz***");
    assert.equal(payload.integrations.some((item) => Object.prototype.hasOwnProperty.call(item, "encryptedToken")), false);

    await app.close();
  }

  console.log("integration-dashboard-api: OK");
})().catch((error) => {
  console.error("integration-dashboard-api:", error);
  process.exit(1);
});
