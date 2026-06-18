-- CreateTable
CREATE TABLE "ScheduledDispatchCampaign" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "targetType" "ScheduledDispatchTargetType" NOT NULL,
    "totalDestinations" INTEGER NOT NULL,
    "baseScheduledAt" TIMESTAMP(3) NOT NULL,
    "delaySeconds" INTEGER NOT NULL DEFAULT 0,
    "pauseEveryCount" INTEGER NOT NULL DEFAULT 0,
    "pauseDurationSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledDispatchCampaign_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ScheduledDispatch" ADD COLUMN "campaignId" TEXT;

-- CreateIndex
CREATE INDEX "ScheduledDispatchCampaign_instanceId_createdAt_idx" ON "ScheduledDispatchCampaign"("instanceId", "createdAt");

-- CreateIndex
CREATE INDEX "ScheduledDispatchCampaign_instanceId_baseScheduledAt_idx" ON "ScheduledDispatchCampaign"("instanceId", "baseScheduledAt");

-- CreateIndex
CREATE INDEX "ScheduledDispatch_campaignId_idx" ON "ScheduledDispatch"("campaignId");

-- AddForeignKey
ALTER TABLE "ScheduledDispatchCampaign" ADD CONSTRAINT "ScheduledDispatchCampaign_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledDispatch" ADD CONSTRAINT "ScheduledDispatch_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ScheduledDispatchCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;