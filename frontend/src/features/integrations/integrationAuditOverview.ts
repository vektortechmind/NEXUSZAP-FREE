import type { IntegrationAuditEntry } from "../dashboard/integrationDashboard";

export const INTEGRATION_AUDIT_VISIBLE_LIMIT = 100;
export const INTEGRATION_AUDIT_SCROLL_CONTAINER_CLASSNAME = "max-h-[34rem] overflow-y-auto pr-1";

export function getVisibleAuditLogs(auditLogs: IntegrationAuditEntry[]): IntegrationAuditEntry[] {
  return auditLogs.slice(0, INTEGRATION_AUDIT_VISIBLE_LIMIT);
}

export function formatAuditMeta(entry: IntegrationAuditEntry): string {
  if (entry.entryType === "dispatch" && entry.recipientJid) return `Destino: ${entry.recipientJid}`;
  if (entry.providerMessageId) return `Provider aceitou: ${entry.providerMessageId}`;
  if (entry.failureCode) return entry.failureCode;
  return entry.instanceName;
}

export function formatAuditStatus(entry: IntegrationAuditEntry): string {
  if (entry.entryType === "dispatch" && entry.status === "SENT") return "Submetido ao provider";
  return entry.status;
}

export function formatDispatchDeliveryPath(value: string | null | undefined): string {
  switch (value) {
    case "image_clean":
      return "Imagem limpa";
    case "text_fallback_image":
      return "Texto por fallback de imagem";
    case "text_fallback_document":
      return "Texto por fallback de documento";
    case "interactive_cta_url":
      return "Botão CTA URL experimental";
    case "text_fallback_interactive_cta_url":
      return "Texto por fallback de botão CTA";
    case "interactive_native":
      return "Botões interativos";
    case "text_fallback_interactive_native":
      return "Texto por fallback de botões";
    case "document":
      return "Documento";
    case "link":
      return "Link textual";
    case "text":
      return "Texto";
    default:
      return "N/D";
  }
}

export function formatSecondaryDispatchStatus(value: string | null | undefined): string {
  switch (value) {
    case "sent":
      return "Segunda mensagem enviada ao provider";
    case "failed_send":
      return "Falha na segunda mensagem";
    case "skipped_missing_pix_code":
      return "Pulada por ausência do Pix copia e cola";
    case "skipped_interactive_button":
      return "Substituída por botão interativo";
    case "not_applicable":
      return "Não aplicável";
    default:
      return "N/D";
  }
}

export function formatAuditEntryType(type: IntegrationAuditEntry["entryType"]): string {
  return type === "ingress" ? "Ingress" : "Dispatch";
}
