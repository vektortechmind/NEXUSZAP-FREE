DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IntegrationDispatchStatus') THEN
    CREATE TYPE "IntegrationDispatchStatus" AS ENUM (
      'PENDING_RUNTIME',
      'SENT',
      'FAILED_INSTANCE_NOT_FOUND',
      'FAILED_INSTANCE_OFFLINE',
      'FAILED_RECIPIENT_MISSING',
      'FAILED_TEMPLATE_RENDER',
      'FAILED_SEND',
      'ERROR'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "IntegrationDispatchLog" (
  "id" TEXT NOT NULL,
  "ingressLogId" TEXT,
  "credentialId" TEXT,
  "instanceId" TEXT,
  "eventSlug" TEXT,
  "dedupKey" TEXT,
  "recipientJid" TEXT,
  "messageType" TEXT,
  "dispatchStatus" "IntegrationDispatchStatus" NOT NULL,
  "failureCode" TEXT,
  "providerMessageId" TEXT,
  "payloadSummaryJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "IntegrationDispatchLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IntegrationDispatchLog_instanceId_createdAt_idx" ON "IntegrationDispatchLog"("instanceId", "createdAt");
CREATE INDEX IF NOT EXISTS "IntegrationDispatchLog_dispatchStatus_createdAt_idx" ON "IntegrationDispatchLog"("dispatchStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "IntegrationDispatchLog_eventSlug_createdAt_idx" ON "IntegrationDispatchLog"("eventSlug", "createdAt");
CREATE INDEX IF NOT EXISTS "IntegrationDispatchLog_dedupKey_idx" ON "IntegrationDispatchLog"("dedupKey");
CREATE INDEX IF NOT EXISTS "IntegrationDispatchLog_ingressLogId_idx" ON "IntegrationDispatchLog"("ingressLogId");
