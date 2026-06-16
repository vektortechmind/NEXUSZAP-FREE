CREATE TYPE "ScheduledDispatchTargetType" AS ENUM ('NUMBER', 'GROUP');

CREATE TYPE "ScheduledDispatchContentType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO');

CREATE TYPE "ScheduledDispatchStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');

CREATE TABLE "ScheduledDispatch" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "targetType" "ScheduledDispatchTargetType" NOT NULL,
    "recipientPhone" TEXT,
    "recipientJid" TEXT,
    "contentType" "ScheduledDispatchContentType" NOT NULL,
    "body" TEXT,
    "mediaUrl" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "ScheduledDispatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "providerMessageId" TEXT,
    "failureCode" TEXT,
    "providerError" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledDispatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScheduledDispatch_instanceId_createdAt_idx" ON "ScheduledDispatch"("instanceId", "createdAt");

CREATE INDEX "ScheduledDispatch_instanceId_scheduledAt_idx" ON "ScheduledDispatch"("instanceId", "scheduledAt");

CREATE INDEX "ScheduledDispatch_status_scheduledAt_idx" ON "ScheduledDispatch"("status", "scheduledAt");

ALTER TABLE "ScheduledDispatch" ADD CONSTRAINT "ScheduledDispatch_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

