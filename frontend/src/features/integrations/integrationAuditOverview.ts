import type { IntegrationAuditEntry } from "../dashboard/integrationDashboard";

export const INTEGRATION_AUDIT_VISIBLE_LIMIT = 100;
export const INTEGRATION_AUDIT_SCROLL_CONTAINER_CLASSNAME = "max-h-[34rem] overflow-y-auto pr-1";

export function getVisibleAuditLogs(auditLogs: IntegrationAuditEntry[]): IntegrationAuditEntry[] {
  return auditLogs.slice(0, INTEGRATION_AUDIT_VISIBLE_LIMIT);
}

export function formatAuditMeta(entry: IntegrationAuditEntry): string {
  if (entry.providerMessageId) return entry.providerMessageId;
  if (entry.failureCode) return entry.failureCode;
  return entry.instanceName;
}

export function formatAuditEntryType(type: IntegrationAuditEntry["entryType"]): string {
  return type === "ingress" ? "Ingress" : "Dispatch";
}
