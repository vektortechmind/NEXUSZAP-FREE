export type IntegrationCredentialStatus = "ACTIVE" | "DISABLED" | "REVOKED" | "MISSING";

export type IntegrationOperationalStatus =
  | "ACTIVE_RECENT_ACTIVITY"
  | "ACTIVE_IDLE"
  | "INACTIVE"
  | "MISSING_CREDENTIAL"
  | "INGRESS_ERROR"
  | "DISPATCH_FAILED";

export type IntegrationLogSnapshot = {
  id: string;
  eventSlug: string | null;
  failureCode: string | null;
};

export type IntegrationIngressSnapshot = IntegrationLogSnapshot & {
  dedupKey: string | null;
  status: string;
  requestTimestamp: string | null;
  receivedAt: string;
  processedAt: string | null;
};

export type IntegrationDispatchSnapshot = IntegrationLogSnapshot & {
  messageType: string | null;
  dispatchStatus: string;
  providerMessageId: string | null;
  createdAt: string;
  processedAt: string | null;
};

export type IntegrationDashboardItem = {
  instanceId: string;
  instanceName: string;
  instanceSlot: number | null;
  instanceStatus: string;
  credentialStatus: IntegrationCredentialStatus;
  tokenPreview: string | null;
  replayWindowMs: number | null;
  dedupWindowMs: number | null;
  lastCredentialUsedAt: string | null;
  operationalStatus: IntegrationOperationalStatus;
  lastIngress: IntegrationIngressSnapshot | null;
  lastDispatch: IntegrationDispatchSnapshot | null;
  recentIngresses: IntegrationIngressSnapshot[];
  recentDispatches: IntegrationDispatchSnapshot[];
};

export type IntegrationDashboardResponse = {
  summary: {
    trackedInstances: number;
    activeConnections: number;
    activeWithRecentActivity: number;
    activeWithoutRecentActivity: number;
    recentFailures: number;
    inactiveConnections: number;
    missingCredential: number;
  };
  documentation: {
    path: string;
    endpointPath: string;
    endpointUrl: string | null;
    supportedEvents: string[];
    supportedMessageTypes: string[];
  };
  integrations: IntegrationDashboardItem[];
};

export function formatIntegrationOperationalStatus(status: IntegrationOperationalStatus): string {
  switch (status) {
    case "ACTIVE_RECENT_ACTIVITY":
      return "Ativa com atividade recente";
    case "ACTIVE_IDLE":
      return "Ativa sem atividade recente";
    case "INACTIVE":
      return "Integração inativa";
    case "MISSING_CREDENTIAL":
      return "Sem credencial ativa";
    case "INGRESS_ERROR":
      return "Erro recente no ingresso";
    case "DISPATCH_FAILED":
      return "Falha recente no disparo";
  }
}

export function integrationOperationalTone(status: IntegrationOperationalStatus): "success" | "warning" | "danger" | "info" | "neutral" {
  switch (status) {
    case "ACTIVE_RECENT_ACTIVITY":
      return "success";
    case "ACTIVE_IDLE":
      return "info";
    case "INACTIVE":
      return "warning";
    case "MISSING_CREDENTIAL":
      return "neutral";
    case "INGRESS_ERROR":
    case "DISPATCH_FAILED":
      return "danger";
  }
}

export function formatIntegrationCredentialStatus(status: IntegrationCredentialStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Ativa";
    case "DISABLED":
      return "Desativada";
    case "REVOKED":
      return "Revogada";
    case "MISSING":
      return "Ausente";
  }
}

export function formatWindowMinutes(windowMs: number | null): string {
  if (!windowMs || windowMs <= 0) return "N/D";
  if (windowMs % 60000 === 0) {
    const minutes = windowMs / 60000;
    return `${minutes} min`;
  }
  return `${Math.round(windowMs / 1000)} s`;
}

export function summarizeIntegrationCards(items: IntegrationDashboardItem[]) {
  return items.reduce((acc, item) => {
    if (item.credentialStatus === "ACTIVE") acc.activeConnections += 1;
    if (item.operationalStatus === "ACTIVE_RECENT_ACTIVITY") acc.recentActivity += 1;
    if (item.operationalStatus === "ACTIVE_IDLE") acc.idle += 1;
    if (item.operationalStatus === "INGRESS_ERROR" || item.operationalStatus === "DISPATCH_FAILED") acc.failures += 1;
    if (item.credentialStatus === "MISSING") acc.missingCredential += 1;
    return acc;
  }, {
    activeConnections: 0,
    recentActivity: 0,
    idle: 0,
    failures: 0,
    missingCredential: 0,
  });
}
