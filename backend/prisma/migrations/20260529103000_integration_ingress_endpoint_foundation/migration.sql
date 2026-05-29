DO $$
BEGIN
  CREATE TYPE "IntegrationIngressStatus" AS ENUM ('ACCEPTED', 'REJECTED_AUTH', 'REJECTED_CONTRACT', 'REJECTED_REPLAY', 'REJECTED_DUPLICATE', 'ERROR');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "IntegrationIngressLog" (
  "id" TEXT NOT NULL,
  "credentialId" TEXT,
  "instanceId" TEXT,
  "eventSlug" TEXT,
  "dedupKey" TEXT,
  "requestTimestamp" TIMESTAMP(3),
  "status" "IntegrationIngressStatus" NOT NULL,
  "failureCode" TEXT,
  "payloadJson" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),

  CONSTRAINT "IntegrationIngressLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IntegrationIngressLog_instanceId_receivedAt_idx" ON "IntegrationIngressLog"("instanceId", "receivedAt");
CREATE INDEX IF NOT EXISTS "IntegrationIngressLog_status_receivedAt_idx" ON "IntegrationIngressLog"("status", "receivedAt");
CREATE INDEX IF NOT EXISTS "IntegrationIngressLog_dedupKey_idx" ON "IntegrationIngressLog"("dedupKey");
