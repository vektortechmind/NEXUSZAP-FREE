import { IntegrationCredentialStatus, type PrismaClient } from "@prisma/client";
import { prisma } from "../../database/prisma";
import {
  type IssuedIntegrationCredential,
  type integrationAuthService,
} from "./integrationAuth.service";
import { IntegrationCredentialNotFoundError as IntegrationCredentialNotFound, integrationAuthService as defaultIntegrationAuthService } from "./integrationAuth.service";
import { TELEGRAM_INSTANCE_SLOT } from "../instances/instance.service";

export type IntegrationCredentialsSurfaceStatus = IntegrationCredentialStatus | "MISSING";

export type IntegrationCredentialsSurfaceInstanceRecord = {
  id: string;
  name: string;
  slot: number;
  status: string;
};

export type IntegrationCredentialsSurfaceCredentialRecord = {
  id: string;
  instanceId: string;
  status: IntegrationCredentialStatus;
  tokenPreview: string | null;
  replayWindowMs: number;
  dedupWindowMs: number;
  issuedAt: Date;
  lastUsedAt: Date | null;
  rotatedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

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

export type IntegrationCredentialsDetail = {
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
  issuedAt: Date | null;
  lastUsedAt: Date | null;
  rotatedAt: Date | null;
  revokedAt: Date | null;
};

type IntegrationCredentialsSurfaceAuthService = Pick<typeof integrationAuthService, "issueCredential" | "rotateCredential" | "revealCredentialSecret">;

export interface IntegrationCredentialsSurfaceStore {
  listInstances(): Promise<IntegrationCredentialsSurfaceInstanceRecord[]>;
  findInstanceById(instanceId: string): Promise<IntegrationCredentialsSurfaceInstanceRecord | null>;
  findLatestCredentialByInstanceId(instanceId: string): Promise<IntegrationCredentialsSurfaceCredentialRecord | null>;
}

function mapStatus(credential: IntegrationCredentialsSurfaceCredentialRecord | null): IntegrationCredentialsSurfaceStatus {
  return credential?.status ?? "MISSING";
}

function mapWorkspaceInstance(
  instance: IntegrationCredentialsSurfaceInstanceRecord,
  credential: IntegrationCredentialsSurfaceCredentialRecord | null,
): IntegrationCredentialsWorkspaceInstance {
  return {
    instanceId: instance.id,
    instanceName: instance.name,
    instanceSlot: instance.slot,
    instanceStatus: instance.status,
    credentialStatus: mapStatus(credential),
    tokenPreview: credential?.tokenPreview ?? null,
  };
}

function mapDetail(input: {
  instance: IntegrationCredentialsSurfaceInstanceRecord;
  credential: IntegrationCredentialsSurfaceCredentialRecord | null;
  endpointUrl: string | null;
  secretToken: string | null;
}): IntegrationCredentialsDetail {
  const { instance, credential } = input;

  return {
    instanceId: instance.id,
    instanceName: instance.name,
    instanceSlot: instance.slot,
    instanceStatus: instance.status,
    endpointUrl: input.endpointUrl,
    credentialStatus: mapStatus(credential),
    tokenPreview: credential?.tokenPreview ?? null,
    secretToken: input.secretToken,
    replayWindowMs: credential?.replayWindowMs ?? null,
    dedupWindowMs: credential?.dedupWindowMs ?? null,
    issuedAt: credential?.issuedAt ?? null,
    lastUsedAt: credential?.lastUsedAt ?? null,
    rotatedAt: credential?.rotatedAt ?? null,
    revokedAt: credential?.revokedAt ?? null,
  };
}

function mapIssuedDetail(input: {
  instance: IntegrationCredentialsSurfaceInstanceRecord;
  endpointUrl: string | null;
  issued: IssuedIntegrationCredential;
}): IntegrationCredentialsDetail {
  const { instance, issued } = input;
  return {
    instanceId: instance.id,
    instanceName: instance.name,
    instanceSlot: instance.slot,
    instanceStatus: instance.status,
    endpointUrl: input.endpointUrl,
    credentialStatus: issued.credential.status,
    tokenPreview: issued.credential.tokenPreview,
    secretToken: issued.secretToken,
    replayWindowMs: issued.credential.replayWindowMs,
    dedupWindowMs: issued.credential.dedupWindowMs,
    issuedAt: issued.credential.issuedAt,
    lastUsedAt: issued.credential.lastUsedAt,
    rotatedAt: issued.credential.rotatedAt,
    revokedAt: issued.credential.revokedAt,
  };
}

export function createPrismaIntegrationCredentialsSurfaceStore(db: PrismaClient = prisma): IntegrationCredentialsSurfaceStore {
  return {
    async listInstances() {
      return db.instance.findMany({
        where: { slot: { gt: TELEGRAM_INSTANCE_SLOT } },
        orderBy: { slot: "asc" },
        select: {
          id: true,
          name: true,
          slot: true,
          status: true,
        },
      });
    },

    async findInstanceById(instanceId) {
      return db.instance.findUnique({
        where: { id: instanceId },
        select: {
          id: true,
          name: true,
          slot: true,
          status: true,
        },
      });
    },

    async findLatestCredentialByInstanceId(instanceId) {
      return db.integrationCredential.findFirst({
        where: { instanceId },
        orderBy: [
          { createdAt: "desc" },
        ],
        select: {
          id: true,
          instanceId: true,
          status: true,
          tokenPreview: true,
          replayWindowMs: true,
          dedupWindowMs: true,
          issuedAt: true,
          lastUsedAt: true,
          rotatedAt: true,
          revokedAt: true,
          createdAt: true,
        },
      });
    },
  };
}

export function createIntegrationCredentialsSurfaceService(
  store: IntegrationCredentialsSurfaceStore,
  authService: IntegrationCredentialsSurfaceAuthService = defaultIntegrationAuthService,
) {
  async function ensureInstance(instanceId: string) {
    const instance = await store.findInstanceById(instanceId);
    if (!instance) {
      throw new IntegrationCredentialNotFound("Instância não encontrada para gestão de credenciais de integração.");
    }
    return instance;
  }

  async function buildDetail(instanceId: string, endpointUrl: string | null) {
    const [instance, credential] = await Promise.all([
      ensureInstance(instanceId),
      store.findLatestCredentialByInstanceId(instanceId),
    ]);
    return mapDetail({ instance, credential, endpointUrl, secretToken: null });
  }

  return {
    async getWorkspace(input?: { endpointUrl?: string | null }): Promise<IntegrationCredentialsWorkspace> {
      const instances = await store.listInstances();
      const rows = await Promise.all(instances.map(async (instance) => {
        const credential = await store.findLatestCredentialByInstanceId(instance.id);
        return mapWorkspaceInstance(instance, credential);
      }));

      return {
        endpointUrl: input?.endpointUrl ?? null,
        instances: rows,
      };
    },

    async getInstanceDetail(input: { instanceId: string; endpointUrl?: string | null }) {
      return buildDetail(input.instanceId, input.endpointUrl ?? null);
    },

    async issueInstanceCredential(input: { instanceId: string; endpointUrl?: string | null; now?: Date }) {
      const [instance, issued] = await Promise.all([
        ensureInstance(input.instanceId),
        authService.issueCredential({ instanceId: input.instanceId, now: input.now }),
      ]);
      return mapIssuedDetail({ instance, endpointUrl: input.endpointUrl ?? null, issued });
    },

    async rotateInstanceCredential(input: { instanceId: string; endpointUrl?: string | null; now?: Date }) {
      const [instance, issued] = await Promise.all([
        ensureInstance(input.instanceId),
        authService.rotateCredential({ instanceId: input.instanceId, now: input.now }),
      ]);
      return mapIssuedDetail({ instance, endpointUrl: input.endpointUrl ?? null, issued });
    },
  };
}

export const integrationCredentialsSurfaceStore = createPrismaIntegrationCredentialsSurfaceStore(prisma);
export const integrationCredentialsSurfaceService = createIntegrationCredentialsSurfaceService(integrationCredentialsSurfaceStore, defaultIntegrationAuthService);

export function createInMemoryIntegrationCredentialsSurfaceStore(seed?: {
  instances?: IntegrationCredentialsSurfaceInstanceRecord[];
  credentials?: IntegrationCredentialsSurfaceCredentialRecord[];
}): IntegrationCredentialsSurfaceStore {
  const instances = new Map((seed?.instances ?? []).map((instance) => [instance.id, { ...instance }]));
  const credentials = [...(seed?.credentials ?? [])].map((credential) => ({ ...credential }));

  function cloneCredential(record: IntegrationCredentialsSurfaceCredentialRecord): IntegrationCredentialsSurfaceCredentialRecord {
    return {
      ...record,
      createdAt: new Date(record.createdAt),
      issuedAt: new Date(record.issuedAt),
      lastUsedAt: record.lastUsedAt ? new Date(record.lastUsedAt) : null,
      rotatedAt: record.rotatedAt ? new Date(record.rotatedAt) : null,
      revokedAt: record.revokedAt ? new Date(record.revokedAt) : null,
    };
  }

  return {
    async listInstances() {
      return Array.from(instances.values()).sort((left, right) => left.slot - right.slot).map((instance) => ({ ...instance }));
    },

    async findInstanceById(instanceId) {
      const instance = instances.get(instanceId);
      return instance ? { ...instance } : null;
    },

    async findLatestCredentialByInstanceId(instanceId) {
      let credential: IntegrationCredentialsSurfaceCredentialRecord | null = null;
      for (const item of credentials) {
        if (item.instanceId !== instanceId) continue;
        if (!credential || item.createdAt > credential.createdAt) credential = item;
      }
      return credential ? cloneCredential(credential) : null;
    },
  };
}
