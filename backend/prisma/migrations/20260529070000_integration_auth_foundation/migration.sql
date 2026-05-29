DO $$
BEGIN
  CREATE TYPE "IntegrationCredentialStatus" AS ENUM ('ACTIVE', 'DISABLED', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "IntegrationCredential" (
  "id" TEXT NOT NULL,
  "instanceId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "encryptedToken" TEXT NOT NULL,
  "tokenPreview" TEXT NOT NULL,
  "status" "IntegrationCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
  "replayWindowMs" INTEGER NOT NULL DEFAULT 300000,
  "dedupWindowMs" INTEGER NOT NULL DEFAULT 300000,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),
  "rotatedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IntegrationCredential_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IntegrationCredential_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "IntegrationReplayKey" (
  "id" TEXT NOT NULL,
  "credentialId" TEXT NOT NULL,
  "dedupKey" TEXT NOT NULL,
  "requestTimestamp" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IntegrationReplayKey_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IntegrationReplayKey_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "IntegrationCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationCredential_tokenHash_key" ON "IntegrationCredential"("tokenHash");
CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationCredential_instanceId_active_key" ON "IntegrationCredential"("instanceId") WHERE "status" = 'ACTIVE';
CREATE INDEX IF NOT EXISTS "IntegrationCredential_instanceId_idx" ON "IntegrationCredential"("instanceId");
CREATE INDEX IF NOT EXISTS "IntegrationCredential_instanceId_status_idx" ON "IntegrationCredential"("instanceId", "status");
CREATE INDEX IF NOT EXISTS "IntegrationCredential_status_idx" ON "IntegrationCredential"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationReplayKey_credentialId_dedupKey_key" ON "IntegrationReplayKey"("credentialId", "dedupKey");
CREATE INDEX IF NOT EXISTS "IntegrationReplayKey_credentialId_expiresAt_idx" ON "IntegrationReplayKey"("credentialId", "expiresAt");
CREATE INDEX IF NOT EXISTS "IntegrationReplayKey_expiresAt_idx" ON "IntegrationReplayKey"("expiresAt");
