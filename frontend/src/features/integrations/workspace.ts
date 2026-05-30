import type { IntegrationDashboardResponse } from "../dashboard/integrationDashboard";
import { INTEGRATION_DOCUMENTATION_ROUTE } from "./integrationDocumentationContent";

export type IntegrationWorkspaceSection = {
  id: "credenciais" | "operacao";
  label: string;
};

export const INTEGRATION_WORKSPACE_SECTIONS: IntegrationWorkspaceSection[] = [
  {
    id: "credenciais",
    label: "Credenciais",
  },
  {
    id: "operacao",
    label: "Operação",
  },
];

export const EMPTY_INTEGRATIONS: IntegrationDashboardResponse = {
  summary: {
    trackedInstances: 0,
    activeConnections: 0,
    activeWithRecentActivity: 0,
    activeWithoutRecentActivity: 0,
    recentFailures: 0,
    inactiveConnections: 0,
    missingCredential: 0,
  },
  documentation: {
    path: INTEGRATION_DOCUMENTATION_ROUTE,
    endpointPath: "/api/integrations/events",
    endpointUrl: null,
    supportedEvents: [],
    supportedMessageTypes: ["text", "link", "document"],
  },
  integrations: [],
  auditLogs: [],
};
