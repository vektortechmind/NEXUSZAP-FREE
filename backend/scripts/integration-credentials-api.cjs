"use strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-with-more-than-32-characters";
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "local-test-password";
process.env.PORT = process.env.PORT || "0";
process.env.APP_URL = process.env.APP_URL || "https://painel.exemplo.com";

require("ts-node/register/transpile-only");

const assert = require("assert");
const Fastify = require("fastify");
const {
  IntegrationCredentialNotFoundError,
  ActiveIntegrationCredentialExistsError,
} = require("../src/services/integrations/integrationAuth.service.ts");
const {
  createDashboardRoutes,
} = require("../src/routes/dashboard.routes.ts");
const {
  createInMemoryIntegrationCredentialsSurfaceStore,
  createIntegrationCredentialsSurfaceService,
} = require("../src/services/integrations/integrationCredentialsSurface.service.ts");

function createCredentialsService() {
  const store = createInMemoryIntegrationCredentialsSurfaceStore({
    instances: [
      { id: "instance-a", name: "Vendas", slot: 1, status: "CONNECTED" },
      { id: "instance-b", name: "Suporte", slot: 2, status: "DISCONNECTED" },
    ],
    credentials: [
      {
        id: "cred-a",
        instanceId: "instance-a",
        status: "ACTIVE",
        tokenPreview: "nz_live_abc***",
        replayWindowMs: 300000,
        dedupWindowMs: 300000,
        issuedAt: new Date("2026-05-29T11:00:00.000Z"),
        lastUsedAt: new Date("2026-05-29T11:30:00.000Z"),
        rotatedAt: null,
        revokedAt: null,
        createdAt: new Date("2026-05-29T11:00:00.000Z"),
      },
      {
        id: "cred-b",
        instanceId: "instance-b",
        status: "DISABLED",
        tokenPreview: "nz_live_old***",
        replayWindowMs: 300000,
        dedupWindowMs: 300000,
        issuedAt: new Date("2026-05-28T11:00:00.000Z"),
        lastUsedAt: null,
        rotatedAt: null,
        revokedAt: new Date("2026-05-28T12:00:00.000Z"),
        createdAt: new Date("2026-05-28T11:00:00.000Z"),
      },
    ],
  });

  return createIntegrationCredentialsSurfaceService(store, {
    async revealCredentialSecret(instanceId) {
      if (instanceId !== "instance-a") throw new IntegrationCredentialNotFoundError();
      return "nz_live_secret_instance_a";
    },
    async issueCredential({ instanceId, now = new Date("2026-05-29T12:00:00.000Z") }) {
      if (instanceId === "instance-a") {
        throw new ActiveIntegrationCredentialExistsError();
      }

      return {
        secretToken: "nz_live_new_instance_b",
        credential: {
          id: "issued-cred-b",
          instanceId,
          status: "ACTIVE",
          tokenHash: "hash",
          encryptedToken: "enc",
          tokenPreview: "nz_live_new***",
          replayWindowMs: 300000,
          dedupWindowMs: 300000,
          issuedAt: now,
          lastUsedAt: null,
          rotatedAt: null,
          revokedAt: null,
          createdAt: now,
          updatedAt: now,
        },
      };
    },
    async rotateCredential({ instanceId, now = new Date("2026-05-29T12:05:00.000Z") }) {
      return {
        secretToken: `nz_live_rotated_${instanceId}`,
        credential: {
          id: "rotated-cred",
          instanceId,
          status: "ACTIVE",
          tokenHash: "hash",
          encryptedToken: "enc",
          tokenPreview: "nz_live_rot***",
          replayWindowMs: 300000,
          dedupWindowMs: 300000,
          issuedAt: now,
          lastUsedAt: null,
          rotatedAt: null,
          revokedAt: null,
          createdAt: now,
          updatedAt: now,
        },
      };
    },
  });
}

(async () => {
  {
    const service = createCredentialsService();
    const workspace = await service.getWorkspace({ endpointUrl: "https://painel.exemplo.com/api/integrations/events" });
    assert.equal(workspace.instances.length, 2);
    assert.equal(workspace.instances[0].instanceId, "instance-a");
    assert.equal(workspace.instances[0].credentialStatus, "ACTIVE");
    assert.equal(workspace.instances[1].credentialStatus, "DISABLED");

    const detail = await service.getInstanceDetail({ instanceId: "instance-a", endpointUrl: workspace.endpointUrl });
    assert.equal(detail.instanceId, "instance-a");
    assert.equal(detail.secretToken, null);
    assert.equal(detail.endpointUrl, "https://painel.exemplo.com/api/integrations/events");

    const disabled = await service.getInstanceDetail({ instanceId: "instance-b", endpointUrl: workspace.endpointUrl });
    assert.equal(disabled.credentialStatus, "DISABLED");
    assert.equal(disabled.secretToken, null);

    const issued = await service.issueInstanceCredential({ instanceId: "instance-b", endpointUrl: workspace.endpointUrl });
    assert.equal(issued.credentialStatus, "ACTIVE");
    assert.equal(issued.secretToken, "nz_live_new_instance_b");

    const rotated = await service.rotateInstanceCredential({ instanceId: "instance-a", endpointUrl: workspace.endpointUrl });
    assert.equal(rotated.secretToken, "nz_live_rotated_instance-a");
  }

  {
    const app = Fastify();
    const credentialsService = createCredentialsService();
    await app.register(createDashboardRoutes({
      preValidationHook: async () => {},
      integrationCredentialsService: credentialsService,
      integrationOverviewService: { getOverview: async () => ({ summary: {}, documentation: {}, integrations: [] }) },
      statsService: { getDashboardStats: async () => ({ messages: [], summary: {} }) },
    }), { prefix: "/api/dashboard" });
    await app.ready();

    const workspaceResponse = await app.inject({ method: "GET", url: "/api/dashboard/integrations/credentials" });
    assert.equal(workspaceResponse.statusCode, 200, workspaceResponse.body);
    const workspacePayload = JSON.parse(workspaceResponse.body);
    assert.equal(workspacePayload.instances[0].instanceId, "instance-a");
    assert.equal(workspacePayload.endpointUrl, "https://painel.exemplo.com/api/integrations/events");

    const detailResponse = await app.inject({ method: "GET", url: "/api/dashboard/integrations/credentials/instance-a" });
    assert.equal(detailResponse.statusCode, 200, detailResponse.body);
    const detailPayload = JSON.parse(detailResponse.body);
    assert.equal(detailPayload.secretToken, null);

    const issueResponse = await app.inject({ method: "POST", url: "/api/dashboard/integrations/credentials/instance-b/issue" });
    assert.equal(issueResponse.statusCode, 201, issueResponse.body);
    const issuedPayload = JSON.parse(issueResponse.body);
    assert.equal(issuedPayload.secretToken, "nz_live_new_instance_b");

    const rotateResponse = await app.inject({ method: "POST", url: "/api/dashboard/integrations/credentials/instance-a/rotate" });
    assert.equal(rotateResponse.statusCode, 200, rotateResponse.body);
    const rotatedPayload = JSON.parse(rotateResponse.body);
    assert.equal(rotatedPayload.secretToken, "nz_live_rotated_instance-a");

    await app.close();
  }


  {
    assert.equal(
      resolvePublicEndpointUrl({ appUrl: "https://painel.exemplo.com", requestProtocol: "https", requestHost: "painel.exemplo.com" }),
      "https://painel.exemplo.com/api/integrations/events",
    );
    assert.equal(
      resolvePublicEndpointUrl({ appUrl: null, requestProtocol: "http", requestHost: "localhost:3000" }),
      "http://localhost:3000/api/integrations/events",
    );
    assert.equal(
      resolvePublicEndpointUrl({ appUrl: null, requestProtocol: "https", requestHost: "painel.exemplo.com" }),
      null,
    );
  }
  console.log("integration-credentials-api: OK");
})().catch((error) => {
  console.error("integration-credentials-api:", error);
  process.exit(1);
});



