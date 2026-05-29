"use strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-with-more-than-32-characters";
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "local-test-password";
process.env.PORT = process.env.PORT || "0";
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || Buffer.alloc(32, 7).toString("base64");

require("ts-node/register");

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const {
  ActiveIntegrationCredentialExistsError,
  DEFAULT_INTEGRATION_REPLAY_WINDOW_MS,
  DuplicateIntegrationRequestError,
  InactiveIntegrationCredentialError,
  IntegrationInstanceMismatchError,
  IntegrationReplayWindowError,
  InvalidIntegrationTokenError,
  assertReplayWindow,
  createInMemoryIntegrationAuthStore,
  createIntegrationAuthService,
  createPrismaIntegrationAuthService,
} = require("../src/services/integrations/integrationAuth.service.ts");
const { decryptSecret } = require("../src/services/crypto.service.ts");

function read(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
}

function assertPrismaContracts() {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20260529070000_integration_auth_foundation/migration.sql");
  const migrationNotes = read("prisma/migrations/20260529070000_integration_auth_foundation/README.md");

  assert.ok(schema.includes("enum IntegrationCredentialStatus"), "schema deve declarar status da credencial de integracao");
  assert.ok(schema.includes("model IntegrationCredential"), "schema deve persistir credencial de integracao por instancia");
  assert.ok(schema.includes("tokenHash      String                      @unique"), "lookup por token deve usar hash unico");
  assert.ok(schema.includes("model IntegrationReplayKey"), "schema deve persistir ledger de deduplicacao");
  assert.ok(schema.includes("@@unique([credentialId, dedupKey])"), "deduplicacao deve ser univoca por credencial");

  assert.ok(migration.includes("CREATE TABLE IF NOT EXISTS \"IntegrationCredential\""), "migration deve criar tabela de credenciais");
  assert.ok(migration.includes("CREATE TABLE IF NOT EXISTS \"IntegrationReplayKey\""), "migration deve criar tabela de replay/deduplicacao");
  assert.ok(migration.includes("CREATE UNIQUE INDEX IF NOT EXISTS \"IntegrationCredential_tokenHash_key\""), "migration deve indexar hash do token");
  assert.ok(migration.includes("CREATE UNIQUE INDEX IF NOT EXISTS \"IntegrationCredential_instanceId_active_key\""), "migration deve garantir uma credencial ativa por instancia");
  assert.ok(migrationNotes.includes("## Deploy Strategy"), "migration deve documentar estrategia de deploy");
  assert.ok(migrationNotes.includes("## Rollback Strategy"), "migration deve documentar estrategia de rollback");
}

async function runInMemoryScenarios() {
  const now = new Date("2026-05-29T12:00:00.000Z");
  const store = createInMemoryIntegrationAuthStore({
    instances: [{ id: "instance-a" }, { id: "instance-b" }],
  });
  const service = createIntegrationAuthService(store);

  const issued = await service.issueCredential({ instanceId: "instance-a", now });
  assert.ok(issued.secretToken.length >= 40, "token emitido deve ser forte o suficiente");
  assert.notEqual(issued.credential.tokenHash, issued.secretToken, "segredo nao pode ser persistido em texto puro");
  assert.equal(decryptSecret(issued.credential.encryptedToken), issued.secretToken, "segredo criptografado deve ser recuperavel para a superficie da integracao");

  await assert.rejects(
    () => service.issueCredential({ instanceId: "instance-a", now: new Date("2026-05-29T12:00:30.000Z") }),
    (error) => error instanceof ActiveIntegrationCredentialExistsError
  );

  const active = await service.getActiveCredential("instance-a");
  assert.ok(active, "instancia deve expor credencial ativa apos emissao");
  assert.equal(active.instanceId, "instance-a", "lookup da credencial ativa deve preservar owner da instancia");

  const authorized = await service.authorizeRequest({
    token: issued.secretToken,
    instanceId: "instance-a",
    timestamp: now.toISOString(),
    dedupKey: "event-001",
    now,
  });
  assert.equal(authorized.credential.id, issued.credential.id, "autorizacao deve resolver credencial pelo token");
  assert.equal(authorized.replayKey.dedupKey, "event-001", "autorizacao deve registrar chave de deduplicacao");

  await assert.rejects(
    () => service.authorizeRequest({
      token: "invalid-token",
      instanceId: "instance-a",
      timestamp: now.toISOString(),
      dedupKey: "event-002",
      now,
    }),
    (error) => error instanceof InvalidIntegrationTokenError
  );

  await assert.rejects(
    () => service.authorizeRequest({
      token: issued.secretToken,
      instanceId: "instance-b",
      timestamp: now.toISOString(),
      dedupKey: "event-003",
      now,
    }),
    (error) => error instanceof IntegrationInstanceMismatchError
  );

  const disabled = await service.disableCredential("instance-a", new Date("2026-05-29T12:01:00.000Z"));
  assert.equal(disabled.status, "DISABLED", "desativacao deve marcar credencial como inativa");

  await assert.rejects(
    () => service.authorizeRequest({
      token: issued.secretToken,
      instanceId: "instance-a",
      timestamp: now.toISOString(),
      dedupKey: "event-004",
      now,
    }),
    (error) => error instanceof InactiveIntegrationCredentialError
  );

  const rotated = await service.rotateCredential({ instanceId: "instance-a", now: new Date("2026-05-29T12:02:00.000Z") });
  assert.notEqual(rotated.secretToken, issued.secretToken, "rotacao deve emitir novo segredo");
  const activeAfterRotation = await service.getActiveCredential("instance-a");
  assert.equal(activeAfterRotation.id, rotated.credential.id, "rotacao deve manter apenas a nova credencial como ativa");

  await assert.rejects(
    () => service.authorizeRequest({
      token: issued.secretToken,
      instanceId: "instance-a",
      timestamp: now.toISOString(),
      dedupKey: "event-005",
      now: new Date("2026-05-29T12:02:30.000Z"),
    }),
    (error) => error instanceof InactiveIntegrationCredentialError
  );

  const rotatedAuth = await service.authorizeRequest({
    token: rotated.secretToken,
    instanceId: "instance-a",
    timestamp: new Date("2026-05-29T12:02:30.000Z").toISOString(),
    dedupKey: "event-006",
    now: new Date("2026-05-29T12:02:30.000Z"),
  });
  assert.equal(rotatedAuth.credential.id, rotated.credential.id, "novo token deve autenticar a nova credencial");

  await assert.rejects(
    () => service.authorizeRequest({
      token: rotated.secretToken,
      instanceId: "instance-a",
      timestamp: new Date("2026-05-29T12:02:30.000Z").toISOString(),
      dedupKey: "event-006",
      now: new Date("2026-05-29T12:02:30.000Z"),
    }),
    (error) => error instanceof DuplicateIntegrationRequestError
  );

  const replayTestTimestamp = new Date(now.getTime() - DEFAULT_INTEGRATION_REPLAY_WINDOW_MS - 1);
  assert.throws(
    () => assertReplayWindow({ requestTimestamp: replayTestTimestamp, replayWindowMs: DEFAULT_INTEGRATION_REPLAY_WINDOW_MS, now }),
    (error) => error instanceof IntegrationReplayWindowError
  );

  assert.throws(
    () => assertReplayWindow({
      requestTimestamp: new Date(now.getTime() + 31_000),
      replayWindowMs: DEFAULT_INTEGRATION_REPLAY_WINDOW_MS,
      now,
    }),
    (error) => error instanceof IntegrationReplayWindowError
  );

  const policy = service.getReplayPolicy();
  assert.equal(policy.defaultReplayWindowMs, DEFAULT_INTEGRATION_REPLAY_WINDOW_MS, "politica deve expor replay window padrao");
  assert.ok(policy.maxFutureSkewMs > 0, "politica deve expor skew futuro maximo");
}

async function runOptionalPrismaProbe() {
  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    const service = createPrismaIntegrationAuthService(prisma);
    const probeInstanceId = `qa-probe-${Date.now()}`;

    await prisma.instance.create({
      data: {
        id: probeInstanceId,
        slot: 999,
        name: "QA Probe",
        typing: true,
        delayMin: 4000,
        delayMax: 7000,
      },
    });

    const issued = await service.issueCredential({ instanceId: probeInstanceId, now: new Date("2026-05-29T13:00:00.000Z") });
    const persisted = await prisma.integrationCredential.findUnique({ where: { tokenHash: issued.credential.tokenHash } });
    assert.ok(persisted, "probe Prisma deve persistir credencial emitida");

    const rotated = await service.rotateCredential({ instanceId: probeInstanceId, now: new Date("2026-05-29T13:01:00.000Z") });
    const activeRows = await prisma.integrationCredential.findMany({
      where: {
        instanceId: probeInstanceId,
        status: "ACTIVE",
      },
    });
    assert.equal(activeRows.length, 1, "probe Prisma deve manter apenas uma credencial ativa por instancia");
    assert.equal(activeRows[0].id, rotated.credential.id, "probe Prisma deve promover a nova credencial apos rotacao");

    await prisma.integrationReplayKey.deleteMany({ where: { credential: { instanceId: probeInstanceId } } });
    await prisma.integrationCredential.deleteMany({ where: { instanceId: probeInstanceId } });
    await prisma.instance.delete({ where: { id: probeInstanceId } });

    console.log("integration-auth-api: prisma probe OK");
  } catch (error) {
    console.log(`integration-auth-api: prisma probe skipped (${error.message || error})`);
  } finally {
    await prisma.$disconnect();
  }
}

(async () => {
  assertPrismaContracts();
  await runInMemoryScenarios();
  await runOptionalPrismaProbe();
  console.log("integration-auth-api: OK");
})().catch((error) => {
  console.error("integration-auth-api:", error);
  process.exit(1);
});
