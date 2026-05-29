import { createHash, randomBytes, randomUUID } from "crypto";
import {
  IntegrationCredentialStatus,
  Prisma,
  type IntegrationCredential,
  type IntegrationReplayKey,
  type Instance,
  type PrismaClient,
} from "@prisma/client";
import { prisma } from "../../database/prisma";
import { decryptSecret, encryptSecret, maskSecret } from "../crypto.service";

export const DEFAULT_INTEGRATION_REPLAY_WINDOW_MS = 5 * 60 * 1000;
export const DEFAULT_INTEGRATION_DEDUP_WINDOW_MS = DEFAULT_INTEGRATION_REPLAY_WINDOW_MS;
export const MAX_INTEGRATION_FUTURE_SKEW_MS = 30 * 1000;

export type IntegrationCredentialRecord = IntegrationCredential;
export type IntegrationReplayKeyRecord = IntegrationReplayKey;

type IntegrationInstanceRef = Pick<Instance, "id">;

type IssueCredentialInput = {
  instanceId: string;
  now?: Date;
  replayWindowMs?: number;
  dedupWindowMs?: number;
};

type AuthorizeRequestInput = {
  token: string;
  instanceId: string;
  timestamp: string | number | Date;
  dedupKey: string;
  now?: Date;
};

type RegisterReplayKeyInput = {
  credentialId: string;
  dedupKey: string;
  requestTimestamp: Date;
  dedupWindowMs: number;
  now?: Date;
};

export type AuthorizedIntegrationRequest = {
  credential: IntegrationCredentialRecord;
  replayKey: IntegrationReplayKeyRecord;
  requestTimestamp: Date;
};

export type IssuedIntegrationCredential = {
  credential: IntegrationCredentialRecord;
  secretToken: string;
};

export interface IntegrationAuthStore {
  findInstanceById(instanceId: string): Promise<IntegrationInstanceRef | null>;
  findCredentialByTokenHash(tokenHash: string): Promise<IntegrationCredentialRecord | null>;
  findActiveCredentialByInstanceId(instanceId: string): Promise<IntegrationCredentialRecord | null>;
  createCredential(input: {
    instanceId: string;
    tokenHash: string;
    encryptedToken: string;
    tokenPreview: string;
    replayWindowMs: number;
    dedupWindowMs: number;
    issuedAt: Date;
  }): Promise<IntegrationCredentialRecord>;
  revokeActiveCredentials(instanceId: string, now: Date): Promise<number>;
  updateCredentialStatus(input: {
    credentialId: string;
    status: IntegrationCredentialStatus;
    now: Date;
  }): Promise<IntegrationCredentialRecord | null>;
  touchCredentialLastUsed(credentialId: string, usedAt: Date): Promise<void>;
  createReplayKey(input: {
    credentialId: string;
    dedupKey: string;
    requestTimestamp: Date;
    expiresAt: Date;
  }): Promise<IntegrationReplayKeyRecord | null>;
}

export class IntegrationCredentialNotFoundError extends Error {
  statusCode = 404;
  code = "INTEGRATION_CREDENTIAL_NOT_FOUND";

  constructor(message = "Credencial de integração não encontrada para a instância informada.") {
    super(message);
    this.name = "INTEGRATION_CREDENTIAL_NOT_FOUND";
  }
}

export class InvalidIntegrationTokenError extends Error {
  statusCode = 401;
  code = "INVALID_INTEGRATION_TOKEN";

  constructor(message = "Token de integração inválido.") {
    super(message);
    this.name = "INVALID_INTEGRATION_TOKEN";
  }
}

export class InactiveIntegrationCredentialError extends Error {
  statusCode = 403;
  code = "INACTIVE_INTEGRATION_CREDENTIAL";

  constructor(message = "A credencial de integração está inativa.") {
    super(message);
    this.name = "INACTIVE_INTEGRATION_CREDENTIAL";
  }
}

export class ActiveIntegrationCredentialExistsError extends Error {
  statusCode = 409;
  code = "ACTIVE_INTEGRATION_CREDENTIAL_EXISTS";

  constructor(message = "A instância já possui uma credencial de integração ativa.") {
    super(message);
    this.name = "ACTIVE_INTEGRATION_CREDENTIAL_EXISTS";
  }
}

export class IntegrationInstanceMismatchError extends Error {
  statusCode = 403;
  code = "INTEGRATION_INSTANCE_MISMATCH";

  constructor(message = "O token autenticado não autoriza a instância informada.") {
    super(message);
    this.name = "INTEGRATION_INSTANCE_MISMATCH";
  }
}

export class IntegrationReplayWindowError extends Error {
  statusCode = 409;
  code = "INTEGRATION_REPLAY_WINDOW_VIOLATION";

  constructor(message = "O timestamp da integração está fora da replay window permitida.") {
    super(message);
    this.name = "INTEGRATION_REPLAY_WINDOW_VIOLATION";
  }
}

export class DuplicateIntegrationRequestError extends Error {
  statusCode = 409;
  code = "DUPLICATE_INTEGRATION_REQUEST";

  constructor(message = "A chave de deduplicação já foi processada para esta credencial.") {
    super(message);
    this.name = "DUPLICATE_INTEGRATION_REQUEST";
  }
}

function normalizePositiveWindow(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("Replay/dedup window deve ser um inteiro positivo em milissegundos.");
  }
  return value;
}

function normalizeDedupKey(dedupKey: string): string {
  const normalized = dedupKey.trim();
  if (!normalized) {
    throw new DuplicateIntegrationRequestError("A chave de deduplicação é obrigatória.");
  }
  if (normalized.length > 180) {
    throw new DuplicateIntegrationRequestError("A chave de deduplicação excede o tamanho máximo permitido.");
  }
  return normalized;
}

export function hashIntegrationToken(token: string): string {
  return createHash("sha256").update(token.trim(), "utf8").digest("hex");
}

export function generateIntegrationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function parseIntegrationTimestamp(timestamp: string | number | Date): Date {
  if (timestamp instanceof Date) {
    if (Number.isNaN(timestamp.getTime())) {
      throw new IntegrationReplayWindowError("Timestamp da integração é inválido.");
    }
    return timestamp;
  }

  if (typeof timestamp === "number") {
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) {
      throw new IntegrationReplayWindowError("Timestamp numérico da integração é inválido.");
    }
    return parsed;
  }

  const trimmed = String(timestamp).trim();
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new IntegrationReplayWindowError("Timestamp textual da integração é inválido.");
  }
  return parsed;
}

export function assertReplayWindow(params: {
  requestTimestamp: Date;
  replayWindowMs: number;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const requestMs = params.requestTimestamp.getTime();
  const nowMs = now.getTime();

  if (requestMs > nowMs + MAX_INTEGRATION_FUTURE_SKEW_MS) {
    throw new IntegrationReplayWindowError("Timestamp da integração excede a tolerância futura permitida.");
  }

  if (nowMs - requestMs > params.replayWindowMs) {
    throw new IntegrationReplayWindowError("Timestamp da integração expirou para a replay window configurada.");
  }
}

function buildPreview(token: string): string {
  return maskSecret(token);
}

function mapCredentialCreateError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new ActiveIntegrationCredentialExistsError();
  }
  throw error;
}

export function createPrismaIntegrationAuthStore(db: PrismaClient | Prisma.TransactionClient): IntegrationAuthStore {
  return {
    async findInstanceById(instanceId) {
      return db.instance.findUnique({
        where: { id: instanceId },
        select: { id: true },
      });
    },

    async findCredentialByTokenHash(tokenHash) {
      return db.integrationCredential.findUnique({
        where: { tokenHash },
      });
    },

    async findActiveCredentialByInstanceId(instanceId) {
      return db.integrationCredential.findFirst({
        where: {
          instanceId,
          status: IntegrationCredentialStatus.ACTIVE,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    },

    async createCredential(input) {
      try {
        return await db.integrationCredential.create({
          data: {
            instanceId: input.instanceId,
            tokenHash: input.tokenHash,
            encryptedToken: input.encryptedToken,
            tokenPreview: input.tokenPreview,
            replayWindowMs: input.replayWindowMs,
            dedupWindowMs: input.dedupWindowMs,
            issuedAt: input.issuedAt,
          },
        });
      } catch (error) {
        mapCredentialCreateError(error);
      }
    },

    async revokeActiveCredentials(instanceId, now) {
      const result = await db.integrationCredential.updateMany({
        where: {
          instanceId,
          status: IntegrationCredentialStatus.ACTIVE,
        },
        data: {
          status: IntegrationCredentialStatus.REVOKED,
          revokedAt: now,
          rotatedAt: now,
        },
      });
      return result.count;
    },

    async updateCredentialStatus(input) {
      try {
        return await db.integrationCredential.update({
          where: { id: input.credentialId },
          data: {
            status: input.status,
            revokedAt: input.status === IntegrationCredentialStatus.ACTIVE ? null : input.now,
            rotatedAt: input.status === IntegrationCredentialStatus.REVOKED ? input.now : null,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
          return null;
        }
        throw error;
      }
    },

    async touchCredentialLastUsed(credentialId, usedAt) {
      await db.integrationCredential.update({
        where: { id: credentialId },
        data: { lastUsedAt: usedAt },
      });
    },

    async createReplayKey(input) {
      try {
        return await db.integrationReplayKey.create({
          data: input,
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return null;
        }
        throw error;
      }
    },
  };
}

async function ensureInstanceExists(store: IntegrationAuthStore, instanceId: string, message: string) {
  const instance = await store.findInstanceById(instanceId);
  if (!instance) {
    throw new IntegrationCredentialNotFoundError(message);
  }
}

async function ensureNoActiveCredential(store: IntegrationAuthStore, instanceId: string) {
  const activeCredential = await store.findActiveCredentialByInstanceId(instanceId);
  if (activeCredential) {
    throw new ActiveIntegrationCredentialExistsError();
  }
}

function buildCredentialSeed(input: {
  instanceId: string;
  replayWindowMs: number;
  dedupWindowMs: number;
  issuedAt: Date;
}) {
  const secretToken = generateIntegrationToken();
  return {
    secretToken,
    data: {
      instanceId: input.instanceId,
      tokenHash: hashIntegrationToken(secretToken),
      encryptedToken: encryptSecret(secretToken),
      tokenPreview: buildPreview(secretToken),
      replayWindowMs: input.replayWindowMs,
      dedupWindowMs: input.dedupWindowMs,
      issuedAt: input.issuedAt,
    },
  };
}

export function createIntegrationAuthService(store: IntegrationAuthStore) {
  return {
    getReplayPolicy() {
      return {
        defaultReplayWindowMs: DEFAULT_INTEGRATION_REPLAY_WINDOW_MS,
        defaultDedupWindowMs: DEFAULT_INTEGRATION_DEDUP_WINDOW_MS,
        maxFutureSkewMs: MAX_INTEGRATION_FUTURE_SKEW_MS,
      };
    },

    async issueCredential(input: IssueCredentialInput): Promise<IssuedIntegrationCredential> {
      const now = input.now ?? new Date();
      const replayWindowMs = normalizePositiveWindow(input.replayWindowMs, DEFAULT_INTEGRATION_REPLAY_WINDOW_MS);
      const dedupWindowMs = normalizePositiveWindow(input.dedupWindowMs, DEFAULT_INTEGRATION_DEDUP_WINDOW_MS);
      await ensureInstanceExists(store, input.instanceId, "Instância não encontrada para emissão da credencial de integração.");
      await ensureNoActiveCredential(store, input.instanceId);

      const nextCredential = buildCredentialSeed({
        instanceId: input.instanceId,
        replayWindowMs,
        dedupWindowMs,
        issuedAt: now,
      });
      const credential = await store.createCredential(nextCredential.data);

      return { credential, secretToken: nextCredential.secretToken };
    },

    async rotateCredential(input: IssueCredentialInput): Promise<IssuedIntegrationCredential> {
      const now = input.now ?? new Date();
      const replayWindowMs = normalizePositiveWindow(input.replayWindowMs, DEFAULT_INTEGRATION_REPLAY_WINDOW_MS);
      const dedupWindowMs = normalizePositiveWindow(input.dedupWindowMs, DEFAULT_INTEGRATION_DEDUP_WINDOW_MS);
      await ensureInstanceExists(store, input.instanceId, "Instância não encontrada para rotação da credencial de integração.");

      await store.revokeActiveCredentials(input.instanceId, now);
      const nextCredential = buildCredentialSeed({
        instanceId: input.instanceId,
        replayWindowMs,
        dedupWindowMs,
        issuedAt: now,
      });
      const credential = await store.createCredential(nextCredential.data);

      return { credential, secretToken: nextCredential.secretToken };
    },

    async disableCredential(instanceId: string, now = new Date()) {
      const active = await store.findActiveCredentialByInstanceId(instanceId);
      if (!active) {
        return null;
      }
      return store.updateCredentialStatus({
        credentialId: active.id,
        status: IntegrationCredentialStatus.DISABLED,
        now,
      });
    },

    async getActiveCredential(instanceId: string) {
      return store.findActiveCredentialByInstanceId(instanceId);
    },

    async revealCredentialSecret(instanceId: string) {
      const credential = await store.findActiveCredentialByInstanceId(instanceId);
      if (!credential) {
        throw new IntegrationCredentialNotFoundError();
      }
      return decryptSecret(credential.encryptedToken);
    },

    async resolveCredentialByToken(token: string) {
      const credential = await store.findCredentialByTokenHash(hashIntegrationToken(token));
      if (!credential) {
        throw new InvalidIntegrationTokenError();
      }
      return credential;
    },

    async registerReplayKey(input: RegisterReplayKeyInput) {
      const dedupKey = normalizeDedupKey(input.dedupKey);
      const now = input.now ?? new Date();
      const replayKey = await store.createReplayKey({
        credentialId: input.credentialId,
        dedupKey,
        requestTimestamp: input.requestTimestamp,
        expiresAt: new Date(now.getTime() + input.dedupWindowMs),
      });
      if (!replayKey) {
        throw new DuplicateIntegrationRequestError();
      }
      return replayKey;
    },

    async authorizeRequest(input: AuthorizeRequestInput): Promise<AuthorizedIntegrationRequest> {
      const now = input.now ?? new Date();
      const credential = await this.resolveCredentialByToken(input.token);
      if (credential.status !== IntegrationCredentialStatus.ACTIVE) {
        throw new InactiveIntegrationCredentialError();
      }
      if (credential.instanceId !== input.instanceId) {
        throw new IntegrationInstanceMismatchError();
      }

      const requestTimestamp = parseIntegrationTimestamp(input.timestamp);
      assertReplayWindow({
        requestTimestamp,
        replayWindowMs: credential.replayWindowMs,
        now,
      });

      const replayKey = await this.registerReplayKey({
        credentialId: credential.id,
        dedupKey: input.dedupKey,
        requestTimestamp,
        dedupWindowMs: credential.dedupWindowMs,
        now,
      });

      await store.touchCredentialLastUsed(credential.id, now);

      return {
        credential,
        replayKey,
        requestTimestamp,
      };
    },
  };
}

export function createPrismaIntegrationAuthService(db: PrismaClient = prisma) {
  const baseService = createIntegrationAuthService(createPrismaIntegrationAuthStore(db));

  return {
    ...baseService,

    async issueCredential(input: IssueCredentialInput): Promise<IssuedIntegrationCredential> {
      try {
        return await db.$transaction(async (tx) => {
          const transactionalService = createIntegrationAuthService(createPrismaIntegrationAuthStore(tx));
          return transactionalService.issueCredential(input);
        });
      } catch (error) {
        mapCredentialCreateError(error);
      }
    },

    async rotateCredential(input: IssueCredentialInput): Promise<IssuedIntegrationCredential> {
      try {
        return await db.$transaction(async (tx) => {
          const transactionalService = createIntegrationAuthService(createPrismaIntegrationAuthStore(tx));
          return transactionalService.rotateCredential(input);
        });
      } catch (error) {
        mapCredentialCreateError(error);
      }
    },
  };
}

export const prismaIntegrationAuthStore = createPrismaIntegrationAuthStore(prisma);
export const integrationAuthService = createPrismaIntegrationAuthService(prisma);

export function createInMemoryIntegrationAuthStore(seed?: {
  instances?: IntegrationInstanceRef[];
  credentials?: IntegrationCredentialRecord[];
  replayKeys?: IntegrationReplayKeyRecord[];
}): IntegrationAuthStore {
  const instances = new Map<string, IntegrationInstanceRef>((seed?.instances ?? []).map((instance) => [instance.id, instance]));
  const credentials = new Map<string, IntegrationCredentialRecord>((seed?.credentials ?? []).map((credential) => [credential.id, credential]));
  const replayKeys = new Map<string, IntegrationReplayKeyRecord>();

  for (const replayKey of seed?.replayKeys ?? []) {
    replayKeys.set(`${replayKey.credentialId}:${replayKey.dedupKey}`, replayKey);
  }

  function cloneCredential(record: IntegrationCredentialRecord): IntegrationCredentialRecord {
    return {
      ...record,
      issuedAt: new Date(record.issuedAt),
      lastUsedAt: record.lastUsedAt ? new Date(record.lastUsedAt) : null,
      rotatedAt: record.rotatedAt ? new Date(record.rotatedAt) : null,
      revokedAt: record.revokedAt ? new Date(record.revokedAt) : null,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    };
  }

  function cloneReplayKey(record: IntegrationReplayKeyRecord): IntegrationReplayKeyRecord {
    return {
      ...record,
      requestTimestamp: new Date(record.requestTimestamp),
      expiresAt: new Date(record.expiresAt),
      createdAt: new Date(record.createdAt),
    };
  }

  return {
    async findInstanceById(instanceId) {
      return instances.get(instanceId) ?? null;
    },

    async findCredentialByTokenHash(tokenHash) {
      const found = Array.from(credentials.values()).find((credential) => credential.tokenHash === tokenHash);
      return found ? cloneCredential(found) : null;
    },

    async findActiveCredentialByInstanceId(instanceId) {
      const found = Array.from(credentials.values())
        .filter((credential) => credential.instanceId === instanceId && credential.status === IntegrationCredentialStatus.ACTIVE)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
      return found ? cloneCredential(found) : null;
    },

    async createCredential(input) {
      const duplicateActive = Array.from(credentials.values()).find((credential) => (
        credential.instanceId === input.instanceId && credential.status === IntegrationCredentialStatus.ACTIVE
      ));
      if (duplicateActive) {
        throw new ActiveIntegrationCredentialExistsError();
      }

      const duplicateHash = Array.from(credentials.values()).find((credential) => credential.tokenHash === input.tokenHash);
      if (duplicateHash) {
        throw new ActiveIntegrationCredentialExistsError();
      }

      const now = input.issuedAt;
      const credential: IntegrationCredentialRecord = {
        id: randomUUID(),
        instanceId: input.instanceId,
        tokenHash: input.tokenHash,
        encryptedToken: input.encryptedToken,
        tokenPreview: input.tokenPreview,
        status: IntegrationCredentialStatus.ACTIVE,
        replayWindowMs: input.replayWindowMs,
        dedupWindowMs: input.dedupWindowMs,
        issuedAt: now,
        lastUsedAt: null,
        rotatedAt: null,
        revokedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      credentials.set(credential.id, credential);
      return cloneCredential(credential);
    },

    async revokeActiveCredentials(instanceId, now) {
      let count = 0;
      for (const [id, credential] of credentials.entries()) {
        if (credential.instanceId === instanceId && credential.status === IntegrationCredentialStatus.ACTIVE) {
          credentials.set(id, {
            ...credential,
            status: IntegrationCredentialStatus.REVOKED,
            revokedAt: now,
            rotatedAt: now,
            updatedAt: now,
          });
          count += 1;
        }
      }
      return count;
    },

    async updateCredentialStatus(input) {
      const credential = credentials.get(input.credentialId);
      if (!credential) {
        return null;
      }
      const next: IntegrationCredentialRecord = {
        ...credential,
        status: input.status,
        revokedAt: input.status === IntegrationCredentialStatus.ACTIVE ? null : input.now,
        rotatedAt: input.status === IntegrationCredentialStatus.REVOKED ? input.now : null,
        updatedAt: input.now,
      };
      credentials.set(input.credentialId, next);
      return cloneCredential(next);
    },

    async touchCredentialLastUsed(credentialId, usedAt) {
      const credential = credentials.get(credentialId);
      if (!credential) {
        return;
      }
      credentials.set(credentialId, {
        ...credential,
        lastUsedAt: usedAt,
        updatedAt: usedAt,
      });
    },

    async createReplayKey(input) {
      const key = `${input.credentialId}:${input.dedupKey}`;
      if (replayKeys.has(key)) {
        return null;
      }
      const replayKey: IntegrationReplayKeyRecord = {
        id: randomUUID(),
        credentialId: input.credentialId,
        dedupKey: input.dedupKey,
        requestTimestamp: input.requestTimestamp,
        expiresAt: input.expiresAt,
        createdAt: input.requestTimestamp,
      };
      replayKeys.set(key, replayKey);
      return cloneReplayKey(replayKey);
    },
  };
}
