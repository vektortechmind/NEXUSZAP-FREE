-- CreateTable
CREATE TABLE "ScheduledDispatchTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contentType" "ScheduledDispatchContentType" NOT NULL,
    "body" TEXT,
    "mediaUrl" TEXT,
    "mediaFileName" TEXT,
    "buttonsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledDispatchTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledDispatchTemplate_name_idx" ON "ScheduledDispatchTemplate"("name");

-- CreateIndex
CREATE INDEX "ScheduledDispatchTemplate_createdAt_idx" ON "ScheduledDispatchTemplate"("createdAt");
