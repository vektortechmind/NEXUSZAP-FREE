ALTER TABLE "IntegrationDispatchLog"
  ADD COLUMN "retryable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "retryAttemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextRetryAt" TIMESTAMP(3),
  ADD COLUMN "lastRetryError" TEXT,
  ADD COLUMN "retryLockedAt" TIMESTAMP(3),
  ADD COLUMN "retryExhaustedAt" TIMESTAMP(3);

CREATE INDEX "IntegrationDispatchLog_retryable_nextRetryAt_idx"
  ON "IntegrationDispatchLog"("retryable", "nextRetryAt");

CREATE INDEX "IntegrationDispatchLog_retryLockedAt_idx"
  ON "IntegrationDispatchLog"("retryLockedAt");
