import test from "node:test";
import assert from "node:assert/strict";
import {
  formatAuditEntryType,
  formatAuditMeta,
  getVisibleAuditLogs,
  INTEGRATION_AUDIT_SCROLL_CONTAINER_CLASSNAME,
  INTEGRATION_AUDIT_VISIBLE_LIMIT,
} from "../src/features/integrations/integrationAuditOverview.ts";
import type { IntegrationAuditEntry } from "../src/features/dashboard/integrationDashboard.ts";

function createEntry(index: number, overrides: Partial<IntegrationAuditEntry> = {}): IntegrationAuditEntry {
  return {
    identifier: `log-${index}`,
    entryType: index % 2 === 0 ? "dispatch" : "ingress",
    instanceId: `instance-${index}`,
    instanceName: `Instancia ${index}`,
    eventSlug: "pedido_pago",
    status: index % 2 === 0 ? "SENT" : "ACCEPTED",
    timestamp: new Date(Date.UTC(2026, 4, 30, 12, index % 60, 0)).toISOString(),
    failureCode: null,
    providerMessageId: null,
    ...overrides,
  };
}

test("audit overview limits panel data to the latest 100 records", () => {
  const entries = Array.from({ length: 135 }, (_, index) => createEntry(index));

  const visible = getVisibleAuditLogs(entries);

  assert.equal(visible.length, INTEGRATION_AUDIT_VISIBLE_LIMIT);
  assert.equal(visible[0]?.identifier, "log-0");
  assert.equal(visible.at(-1)?.identifier, "log-99");
});

test("audit meta prefers provider id, then failure code, then instance name", () => {
  assert.equal(formatAuditMeta(createEntry(1, { providerMessageId: "wamid.123", failureCode: "FAIL_CODE" })), "Provider aceitou: wamid.123");
  assert.equal(formatAuditMeta(createEntry(2, { providerMessageId: null, failureCode: "FAIL_CODE" })), "FAIL_CODE");
  assert.equal(formatAuditMeta(createEntry(3, { providerMessageId: null, failureCode: null, instanceName: "Operacao" })), "Operacao");
});

test("audit overview keeps compact UI contract stable", () => {
  assert.equal(formatAuditEntryType("ingress"), "Ingress");
  assert.equal(formatAuditEntryType("dispatch"), "Dispatch");
  assert.match(INTEGRATION_AUDIT_SCROLL_CONTAINER_CLASSNAME, /overflow-y-auto/);
  assert.match(INTEGRATION_AUDIT_SCROLL_CONTAINER_CLASSNAME, /max-h-\[/);
});
