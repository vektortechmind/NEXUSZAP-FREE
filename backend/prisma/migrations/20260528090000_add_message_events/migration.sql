-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('WHATSAPP', 'TELEGRAM');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateTable
CREATE TABLE "MessageEvent" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "usedAi" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageEvent_instanceId_idx" ON "MessageEvent"("instanceId");

-- CreateIndex
CREATE INDEX "MessageEvent_channel_createdAt_idx" ON "MessageEvent"("channel", "createdAt");

-- CreateIndex
CREATE INDEX "MessageEvent_direction_createdAt_idx" ON "MessageEvent"("direction", "createdAt");

-- CreateIndex
CREATE INDEX "MessageEvent_usedAi_createdAt_idx" ON "MessageEvent"("usedAi", "createdAt");

-- AddForeignKey
ALTER TABLE "MessageEvent" ADD CONSTRAINT "MessageEvent_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
