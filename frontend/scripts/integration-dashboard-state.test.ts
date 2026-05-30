import test from "node:test";
import assert from "node:assert/strict";
import {
  formatIntegrationCredentialStatus,
  formatIntegrationOperationalStatus,
  formatWindowMinutes,
  integrationOperationalTone,
  summarizeIntegrationCards,
  type IntegrationDashboardItem,
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

test("integration summary counts active, idle and failures for compact operator metrics", () => {
  const summary = summarizeIntegrationCards([
    createItem({ operationalStatus: "ACTIVE_RECENT_ACTIVITY", credentialStatus: "ACTIVE" }),
    createItem({ instanceId: "instance-2", operationalStatus: "ACTIVE_IDLE", credentialStatus: "ACTIVE" }),
    createItem({ instanceId: "instance-3", operationalStatus: "DISPATCH_FAILED", credentialStatus: "ACTIVE" }),
    createItem({ instanceId: "instance-4", operationalStatus: "MISSING_CREDENTIAL", credentialStatus: "MISSING" }),
  ]);

  assert.deepEqual(summary, {
    activeConnections: 3,
    recentActivity: 1,
    idle: 1,
    failures: 1,
  });
});
