export type IntegrationCredentialsSurfaceStatus = "ACTIVE" | "DISABLED" | "REVOKED" | "MISSING";

export type IntegrationCredentialsWorkspaceInstance = {
  instanceId: string;
  instanceName: string;
  instanceSlot: number;
  instanceStatus: string;
  credentialStatus: IntegrationCredentialsSurfaceStatus;
  tokenPreview: string | null;
};

export type IntegrationCredentialsWorkspace = {
  endpointUrl: string | null;
  instances: IntegrationCredentialsWorkspaceInstance[];
};

export type IntegrationCredentialDetail = {
  instanceId: string;
  instanceName: string;
  instanceSlot: number;
  instanceStatus: string;
  endpointUrl: string | null;
  credentialStatus: IntegrationCredentialsSurfaceStatus;
  tokenPreview: string | null;
  secretToken: string | null;
  replayWindowMs: number | null;
  dedupWindowMs: number | null;
  issuedAt: string | null;
  lastUsedAt: string | null;
  rotatedAt: string | null;
  revokedAt: string | null;
};

const CREDENTIAL_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export type IntegrationCredentialAction = {
  kind: "issue" | "rotate";
  label: string;
  helper: string;
};

export type IntegrationCredentialFieldSummary = {
  label: string;
  value: string;
};

export const EMPTY_INTEGRATION_CREDENTIALS_WORKSPACE: IntegrationCredentialsWorkspace = {
  endpointUrl: null,
  instances: [],
};

export function formatCredentialSurfaceStatus(status: IntegrationCredentialsSurfaceStatus) {
  switch (status) {
    case "ACTIVE":
      return "Ativa";
    case "DISABLED":
      return "Desativada";
    case "REVOKED":
      return "Revogada";
    default:
      return "Ausente";
  }
}

export function credentialSurfaceTone(status: IntegrationCredentialsSurfaceStatus): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "DISABLED":
      return "warning";
    case "REVOKED":
      return "danger";
    default:
      return "neutral";
  }
}

export function getCredentialPrimaryAction(status: IntegrationCredentialsSurfaceStatus): IntegrationCredentialAction {
  if (status === "ACTIVE") {
    return {
      kind: "rotate",
      label: "Rotacionar secretToken",
      helper: "A rotação invalida imediatamente o token anterior desta instância.",
    };
  }

  return {
    kind: "issue",
    label: "Gerar secretToken",
    helper: "A emissão cria uma credencial ativa nova para a instância selecionada.",
  };
}

export function getIssuableCredentialInstances(workspace: IntegrationCredentialsWorkspace) {
  return workspace.instances.filter((instance) => instance.credentialStatus !== "ACTIVE");
}

export function formatCredentialTimestamp(value: string | null): string {
  if (!value) return "Sem registro";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return CREDENTIAL_TIMESTAMP_FORMATTER.format(date);
}

export function formatCredentialWindow(windowMs: number | null): string {
  if (!windowMs) return "N/D";
  return `${Math.round(windowMs / 60000)} min`;
}

export function getCredentialSecretLabel(detail: IntegrationCredentialDetail | null): string {
  if (!detail) return "Carregue o card para operar a credencial.";
  if (detail.secretToken) return detail.secretToken;
  if (detail.credentialStatus === "ACTIVE") return "Disponível somente após emissão ou rotação.";
  return "Emita uma credencial para liberar o secretToken.";
}

export function getCredentialOperationalSummary(detail: IntegrationCredentialDetail): IntegrationCredentialFieldSummary[] {
  return [
    { label: "Emissão", value: formatCredentialTimestamp(detail.issuedAt) },
    { label: "Último uso", value: formatCredentialTimestamp(detail.lastUsedAt) },
    { label: "Replay window", value: formatCredentialWindow(detail.replayWindowMs) },
    { label: "Dedup window", value: formatCredentialWindow(detail.dedupWindowMs) },
  ];
}
