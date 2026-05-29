import type { IntegrationDashboardResponse } from "../dashboard/integrationDashboard";

export type IntegrationWorkspaceSection = {
  id: "credenciais" | "operacao" | "documentacao";
  label: string;
  description: string;
};

export const INTEGRATION_WORKSPACE_SECTIONS: IntegrationWorkspaceSection[] = [
  {
    id: "credenciais",
    label: "Credenciais",
    description: "Seleção da instância, leitura de instanceId e emissão do secretToken ficarão centralizadas aqui.",
  },
  {
    id: "operacao",
    label: "Operação",
    description: "Visão operacional de credenciais, últimos ingressos, últimos dispatches e falhas recentes.",
  },
  {
    id: "documentacao",
    label: "Documentação",
    description: "Fluxo dedicado para abrir a documentação técnica sem depender de caminho local do repositório.",
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
    path: "docs/integrations/nexuszap-plugin-api.md",
    endpointPath: "/api/integrations/events",
    endpointUrl: null,
    supportedEvents: [],
    supportedMessageTypes: ["text", "link", "document"],
  },
  integrations: [],
};
