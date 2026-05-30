import test from "node:test";
import assert from "node:assert/strict";
import {
  formatIntegrationCredentialStatus,
  formatIntegrationOperationalStatus,
  formatWindowMinutes,
  integrationOperationalTone,
  summarizeIntegrationCards,
  type IntegrationDashboardItem,
  type IntegrationDashboardResponse,
} from "../src/features/dashboard/integrationDashboard.ts";

function createItem(overrides: Partial<IntegrationDashboardItem>): IntegrationDashboardItem {
  return {
    instanceId: "instance-1",
    instanceName: "Vendas",
    instanceSlot: 1,
    instanceStatus: "CONNECTED",
    credentialStatus: "ACTIVE",
    tokenPreview: "nz_live_abc***",
    replayWindowMs: 300000,
    dedupWindowMs: 300000,
    lastCredentialUsedAt: "2026-05-29T12:00:00.000Z",
    operationalStatus: "ACTIVE_RECENT_ACTIVITY",
    lastIngress: null,
    lastDispatch: null,
    recentIngresses: [],
    recentDispatches: [],
    ...overrides,
  };
}

function createSummaryResponse(overrides?: Partial<IntegrationDashboardResponse["summary"]>): IntegrationDashboardResponse["summary"] {
  return {
    trackedInstances: 4,
    activeConnections: 3,
    activeWithRecentActivity: 1,
    activeWithoutRecentActivity: 1,
    recentFailures: 1,
    inactiveConnections: 1,
    missingCredential: 1,
    ...overrides,
  };
}

test("status labels and tones stay stable for operator rendering", () => {
  assert.equal(formatIntegrationOperationalStatus("ACTIVE_IDLE"), "Ativa sem atividade recente");
  assert.equal(formatIntegrationOperationalStatus("DISPATCH_FAILED"), "Falha recente no disparo");
  assert.equal(integrationOperationalTone("ACTIVE_RECENT_ACTIVITY"), "success");
  assert.equal(integrationOperationalTone("INGRESS_ERROR"), "danger");
  assert.equal(formatIntegrationCredentialStatus("REVOKED"), "Revogada");
});

test("window formatting keeps operator-facing values compact", () => {
  assert.equal(formatWindowMinutes(300000), "5 min");
  assert.equal(formatWindowMinutes(45000), "45 s");
  assert.equal(formatWindowMinutes(null), "N/D");
});

test("integration summary maps backend summary values for global audit metrics", () => {
  const summary = summarizeIntegrationCards(createSummaryResponse());

  assert.deepEqual(summary, {
    activeConnections: 3,
    recentActivity: 1,
    idle: 1,
    failures: 1,
  });
});

test("integration dashboard item fixture remains compatible with instance-level credential data", () => {
  const item = createItem({ operationalStatus: "DISPATCH_FAILED", credentialStatus: "ACTIVE" });
  assert.equal(item.instanceName, "Vendas");
  assert.equal(item.operationalStatus, "DISPATCH_FAILED");
});
