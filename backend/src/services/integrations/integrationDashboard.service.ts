import type { IntegrationCredentialStatus, IntegrationDispatchStatus, IntegrationIngressStatus } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { integrationEventCatalogService } from "./integrationEventCatalog.service";

export const INTEGRATION_DASHBOARD_DOC_PATH = "/integracoes/documentacao";
export const INTEGRATION_DASHBOARD_RECENT_ACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RECENT_LOG_LIMIT = 120;
const DEFAULT_RECENT_ITEMS_PER_INSTANCE = 3;

export type IntegrationDashboardInstanceRecord = {
  id: string;
  name: string;
  slot: number;
  status: string;
};

export type IntegrationDashboardCredentialRecord = {
  id: string;
  instanceId: string;
  status: IntegrationCredentialStatus;
  tokenPreview: string;
  replayWindowMs: number;
  dedupWindowMs: number;
  lastUsedAt: Date | null;
  updatedAt: Date;
};

export type IntegrationDashboardIngressRecord = {
  id: string;
  instanceId: string | null;
  eventSlug: string | null;
  dedupKey: string | null;
  status: IntegrationIngressStatus;
  failureCode: string | null;
  requestTimestamp: Date | null;
  receivedAt: Date;
  processedAt: Date | null;
};

export type IntegrationDashboardDispatchRecord = {
  id: string;
  instanceId: string | null;
  eventSlug: string | null;
  messageType: string | null;
  dispatchStatus: IntegrationDispatchStatus;
  failureCode: string | null;
  providerMessageId: string | null;
  createdAt: Date;
  processedAt: Date | null;
};

export type IntegrationDashboardOperationalStatus =
  | "ACTIVE_RECENT_ACTIVITY"
  | "ACTIVE_IDLE"
  | "INACTIVE"
  | "MISSING_CREDENTIAL"
  | "INGRESS_ERROR"
  | "DISPATCH_FAILED";

export type IntegrationDashboardOverview = {
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
  integrations: Array<{
    instanceId: string;
    instanceName: string;
    instanceSlot: number | null;
    instanceStatus: string;
    credentialStatus: IntegrationCredentialStatus | "MISSING";
    tokenPreview: string | null;
    replayWindowMs: number | null;
    dedupWindowMs: number | null;
    lastCredentialUsedAt: string | null;
    operationalStatus: IntegrationDashboardOperationalStatus;
    lastIngress: {
      id: string;
      eventSlug: string | null;
      dedupKey: string | null;
      status: string;
      failureCode: string | null;
      requestTimestamp: string | null;
      receivedAt: string;
      processedAt: string | null;
    } | null;
    lastDispatch: {
      id: string;
      eventSlug: string | null;
      messageType: string | null;
      dispatchStatus: string;
      failureCode: string | null;
      providerMessageId: string | null;
      createdAt: string;
      processedAt: string | null;
    } | null;
    recentIngresses: Array<{
      id: string;
      eventSlug: string | null;
      dedupKey: string | null;
      status: string;
      failureCode: string | null;
      requestTimestamp: string | null;
      receivedAt: string;
      processedAt: string | null;
    }>;
    recentDispatches: Array<{
      id: string;
      eventSlug: string | null;
      messageType: string | null;
      dispatchStatus: string;
      failureCode: string | null;
      providerMessageId: string | null;
      createdAt: string;
      processedAt: string | null;
    }>;
  }>;
  auditLogs: Array<{
    identifier: string;
    entryType: "ingress" | "dispatch";
    instanceId: string;
    instanceName: string;
    eventSlug: string | null;
    status: string;
    timestamp: string;
    failureCode: string | null;
    providerMessageId: string | null;
  }>;
};

export interface IntegrationDashboardStore {
  listCredentials(): Promise<IntegrationDashboardCredentialRecord[]>;
  listRecentIngressLogs(limit: number): Promise<IntegrationDashboardIngressRecord[]>;
  listRecentDispatchLogs(limit: number): Promise<IntegrationDashboardDispatchRecord[]>;
  listInstancesByIds(instanceIds: string[]): Promise<IntegrationDashboardInstanceRecord[]>;
}

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function isIngressFailure(status: IntegrationIngressStatus): boolean {
  return status !== "ACCEPTED";
}

function isDispatchFailure(status: IntegrationDispatchStatus): boolean {
  return status !== "SENT" && status !== "PENDING_RUNTIME";
}

function latestIso(values: Array<Date | null | undefined>): string | null {
  let latest: Date | null = null;
  for (const value of values) {
    if (!value) continue;
    if (!latest || value.getTime() > latest.getTime()) {
      latest = value;
    }
  }
  return latest ? latest.toISOString() : null;
}

function fallbackInstanceName(instanceId: string): string {
  return `Instância ${instanceId.slice(0, 8)}`;
}

function pushLimited<T>(items: T[], item: T, max: number) {
  if (items.length < max) {
    items.push(item);
  }
}

export function createPrismaIntegrationDashboardStore(): IntegrationDashboardStore {
  return {
    async listCredentials() {
      return prisma.integrationCredential.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          instanceId: true,
          status: true,
          tokenPreview: true,
          replayWindowMs: true,
          dedupWindowMs: true,
          lastUsedAt: true,
          updatedAt: true,
        },
      });
    },
    async listRecentIngressLogs(limit) {
      return prisma.integrationIngressLog.findMany({
        where: { instanceId: { not: null } },
        orderBy: { receivedAt: "desc" },
        take: limit,
        select: {
          id: true,
          instanceId: true,
          eventSlug: true,
          dedupKey: true,
          status: true,
          failureCode: true,
          requestTimestamp: true,
          receivedAt: true,
          processedAt: true,
        },
      });
    },
    async listRecentDispatchLogs(limit) {
      return prisma.integrationDispatchLog.findMany({
        where: { instanceId: { not: null } },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          instanceId: true,
          eventSlug: true,
          messageType: true,
          dispatchStatus: true,
          failureCode: true,
          providerMessageId: true,
          createdAt: true,
          processedAt: true,
        },
      });
    },
    async listInstancesByIds(instanceIds) {
      if (instanceIds.length === 0) return [];
      return prisma.instance.findMany({
        where: { id: { in: instanceIds } },
        select: {
          id: true,
          name: true,
          slot: true,
          status: true,
        },
      });
    },
  };
}

export function createInMemoryIntegrationDashboardStore(seed?: {
  credentials?: IntegrationDashboardCredentialRecord[];
  ingressLogs?: IntegrationDashboardIngressRecord[];
  dispatchLogs?: IntegrationDashboardDispatchRecord[];
  instances?: IntegrationDashboardInstanceRecord[];
}): IntegrationDashboardStore {
  const credentials = [...(seed?.credentials ?? [])];
  const ingressLogs = [...(seed?.ingressLogs ?? [])];
  const dispatchLogs = [...(seed?.dispatchLogs ?? [])];
  const instances = [...(seed?.instances ?? [])];

  return {
    async listCredentials() {
      return [...credentials].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    },
    async listRecentIngressLogs(limit) {
      return [...ingressLogs]
        .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())
        .slice(0, limit);
    },
    async listRecentDispatchLogs(limit) {
      return [...dispatchLogs]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit);
    },
    async listInstancesByIds(instanceIds) {
      const ids = new Set(instanceIds);
      return instances.filter((instance) => ids.has(instance.id));
    },
  };
}

export function createIntegrationDashboardService(store: IntegrationDashboardStore) {
  return {
    async getOverview(input?: {
      endpointUrl?: string | null;
      endpointPath?: string;
      documentationPath?: string;
      recentActivityWindowMs?: number;
      recentLogLimit?: number;
      recentItemsPerInstance?: number;
    }): Promise<IntegrationDashboardOverview> {
      const endpointPath = input?.endpointPath ?? "/api/integrations/events";
      const documentationPath = input?.documentationPath ?? INTEGRATION_DASHBOARD_DOC_PATH;
      const recentActivityWindowMs = input?.recentActivityWindowMs ?? INTEGRATION_DASHBOARD_RECENT_ACTIVITY_WINDOW_MS;
      const recentLogLimit = input?.recentLogLimit ?? DEFAULT_RECENT_LOG_LIMIT;
      const recentItemsPerInstance = input?.recentItemsPerInstance ?? DEFAULT_RECENT_ITEMS_PER_INSTANCE;

      const [credentials, ingressLogs, dispatchLogs] = await Promise.all([
        store.listCredentials(),
        store.listRecentIngressLogs(recentLogLimit),
        store.listRecentDispatchLogs(recentLogLimit),
      ]);

      const latestCredentialByInstance = new Map<string, IntegrationDashboardCredentialRecord>();
      for (const credential of credentials) {
        if (!latestCredentialByInstance.has(credential.instanceId)) {
          latestCredentialByInstance.set(credential.instanceId, credential);
        }
      }

      const instanceIds = new Set<string>();
      for (const credential of latestCredentialByInstance.values()) {
        instanceIds.add(credential.instanceId);
      }

      const recentIngressByInstance = new Map<string, IntegrationDashboardIngressRecord[]>();
      for (const log of ingressLogs) {
        if (!log.instanceId) continue;
        instanceIds.add(log.instanceId);
        const rows = recentIngressByInstance.get(log.instanceId) ?? [];
        pushLimited(rows, log, recentItemsPerInstance);
        recentIngressByInstance.set(log.instanceId, rows);
      }

      const recentDispatchByInstance = new Map<string, IntegrationDashboardDispatchRecord[]>();
      for (const log of dispatchLogs) {
        if (!log.instanceId) continue;
        instanceIds.add(log.instanceId);
        const rows = recentDispatchByInstance.get(log.instanceId) ?? [];
        pushLimited(rows, log, recentItemsPerInstance);
        recentDispatchByInstance.set(log.instanceId, rows);
      }

      const instances = await store.listInstancesByIds([...instanceIds]);
      const instanceById = new Map(instances.map((instance) => [instance.id, instance]));
      const recentThresholdMs = Date.now() - recentActivityWindowMs;

      const integrations = [...instanceIds].map((instanceId) => {
        const credential = latestCredentialByInstance.get(instanceId) ?? null;
        const instance = instanceById.get(instanceId) ?? null;
        const recentIngresses = recentIngressByInstance.get(instanceId) ?? [];
        const recentDispatches = recentDispatchByInstance.get(instanceId) ?? [];
        const credentialStatus: IntegrationCredentialStatus | "MISSING" = credential?.status ?? "MISSING";
        const lastIngress = recentIngresses[0] ?? null;
        const lastDispatch = recentDispatches[0] ?? null;
        const lastActivityIso = latestIso([
          credential?.lastUsedAt,
          lastIngress?.receivedAt,
          lastDispatch?.createdAt,
        ]);
        const lastActivityMs = lastActivityIso ? new Date(lastActivityIso).getTime() : null;
        const hasRecentActivity = typeof lastActivityMs === "number" && lastActivityMs >= recentThresholdMs;

        let operationalStatus: IntegrationDashboardOperationalStatus;
        if (lastDispatch && isDispatchFailure(lastDispatch.dispatchStatus)) {
          operationalStatus = "DISPATCH_FAILED";
        } else if (lastIngress && isIngressFailure(lastIngress.status)) {
          operationalStatus = "INGRESS_ERROR";
        } else if (credential?.status === "ACTIVE") {
          operationalStatus = hasRecentActivity ? "ACTIVE_RECENT_ACTIVITY" : "ACTIVE_IDLE";
        } else if (credentialStatus === "DISABLED" || credentialStatus === "REVOKED") {
          operationalStatus = "INACTIVE";
        } else {
          operationalStatus = "MISSING_CREDENTIAL";
        }

        return {
          instanceId,
          instanceName: instance?.name ?? fallbackInstanceName(instanceId),
          instanceSlot: instance?.slot ?? null,
          instanceStatus: instance?.status ?? "UNKNOWN",
          credentialStatus,
          tokenPreview: credential?.tokenPreview ?? null,
          replayWindowMs: credential?.replayWindowMs ?? null,
          dedupWindowMs: credential?.dedupWindowMs ?? null,
          lastCredentialUsedAt: toIso(credential?.lastUsedAt),
          operationalStatus,
          lastIngress: lastIngress ? {
            id: lastIngress.id,
            eventSlug: lastIngress.eventSlug,
            dedupKey: lastIngress.dedupKey,
            status: lastIngress.status,
            failureCode: lastIngress.failureCode,
            requestTimestamp: toIso(lastIngress.requestTimestamp),
            receivedAt: lastIngress.receivedAt.toISOString(),
            processedAt: toIso(lastIngress.processedAt),
          } : null,
          lastDispatch: lastDispatch ? {
            id: lastDispatch.id,
            eventSlug: lastDispatch.eventSlug,
            messageType: lastDispatch.messageType,
            dispatchStatus: lastDispatch.dispatchStatus,
            failureCode: lastDispatch.failureCode,
            providerMessageId: lastDispatch.providerMessageId,
            createdAt: lastDispatch.createdAt.toISOString(),
            processedAt: toIso(lastDispatch.processedAt),
          } : null,
          recentIngresses: recentIngresses.map((log) => ({
            id: log.id,
            eventSlug: log.eventSlug,
            dedupKey: log.dedupKey,
            status: log.status,
            failureCode: log.failureCode,
            requestTimestamp: toIso(log.requestTimestamp),
            receivedAt: log.receivedAt.toISOString(),
            processedAt: toIso(log.processedAt),
          })),
          recentDispatches: recentDispatches.map((log) => ({
            id: log.id,
            eventSlug: log.eventSlug,
            messageType: log.messageType,
            dispatchStatus: log.dispatchStatus,
            failureCode: log.failureCode,
            providerMessageId: log.providerMessageId,
            createdAt: log.createdAt.toISOString(),
            processedAt: toIso(log.processedAt),
          })),
        };
      }).sort((a, b) => {
        const left = latestIso([
          a.lastCredentialUsedAt ? new Date(a.lastCredentialUsedAt) : null,
          a.lastIngress ? new Date(a.lastIngress.receivedAt) : null,
          a.lastDispatch ? new Date(a.lastDispatch.createdAt) : null,
        ]);
        const right = latestIso([
          b.lastCredentialUsedAt ? new Date(b.lastCredentialUsedAt) : null,
          b.lastIngress ? new Date(b.lastIngress.receivedAt) : null,
          b.lastDispatch ? new Date(b.lastDispatch.createdAt) : null,
        ]);
        return (right ?? "").localeCompare(left ?? "") || a.instanceName.localeCompare(b.instanceName);
      });

      const auditLogs = [
        ...ingressLogs.filter((log) => log.instanceId).map((log) => {
          const instanceId = log.instanceId!;
          const instance = instanceById.get(instanceId);
          return {
            identifier: log.id,
            entryType: "ingress" as const,
            instanceId,
            instanceName: instance?.name ?? fallbackInstanceName(instanceId),
            eventSlug: log.eventSlug,
            status: log.status,
            timestamp: log.receivedAt.toISOString(),
            failureCode: log.failureCode,
            providerMessageId: null,
          };
        }),
        ...dispatchLogs.filter((log) => log.instanceId).map((log) => {
          const instanceId = log.instanceId!;
          const instance = instanceById.get(instanceId);
          return {
            identifier: log.id,
            entryType: "dispatch" as const,
            instanceId,
            instanceName: instance?.name ?? fallbackInstanceName(instanceId),
            eventSlug: log.eventSlug,
            status: log.dispatchStatus,
            timestamp: log.createdAt.toISOString(),
            failureCode: log.failureCode,
            providerMessageId: log.providerMessageId,
          };
        }),
      ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      const summary = integrations.reduce((acc, item) => {
        acc.trackedInstances += 1;
        if (item.credentialStatus === "ACTIVE") acc.activeConnections += 1;
        if (item.operationalStatus === "ACTIVE_RECENT_ACTIVITY") acc.activeWithRecentActivity += 1;
        if (item.operationalStatus === "ACTIVE_IDLE") acc.activeWithoutRecentActivity += 1;
        if (item.operationalStatus === "DISPATCH_FAILED" || item.operationalStatus === "INGRESS_ERROR") acc.recentFailures += 1;
        if (item.operationalStatus === "INACTIVE") acc.inactiveConnections += 1;
        if (item.credentialStatus === "MISSING") acc.missingCredential += 1;
        return acc;
      }, {
        trackedInstances: 0,
        activeConnections: 0,
        activeWithRecentActivity: 0,
        activeWithoutRecentActivity: 0,
        recentFailures: 0,
        inactiveConnections: 0,
        missingCredential: 0,
      });

      return {
        summary,
        documentation: {
          path: documentationPath,
          endpointPath,
          endpointUrl: input?.endpointUrl ?? null,
          supportedEvents: [...integrationEventCatalogService.supportedEventSlugs],
          supportedMessageTypes: ["text", "link", "document"],
        },
        integrations,
        auditLogs,
      };
    },
  };
}

export const integrationDashboardService = createIntegrationDashboardService(createPrismaIntegrationDashboardStore());
