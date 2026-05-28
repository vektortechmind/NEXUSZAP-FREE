-- CreateTable
CREATE TABLE "Instance" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Agente Principal',
    "agentName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "aiWhatsappEnabled" BOOLEAN NOT NULL DEFAULT true,
    "aiTelegramEnabled" BOOLEAN NOT NULL DEFAULT true,
    "typing" BOOLEAN NOT NULL DEFAULT true,
    "delayMin" INTEGER NOT NULL DEFAULT 4000,
    "delayMax" INTEGER NOT NULL DEFAULT 7000,
    "systemPrompt" TEXT,
    "telegramSystemPrompt" TEXT,
    "telegramBotToken" TEXT,
    "chatProvider" TEXT,
    "groqKey" TEXT,
    "groqAudioKey" TEXT,
    "geminiKey" TEXT,
    "openrouterKey" TEXT,
    "openrouterModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "extracted" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'github_update_settings',
    "githubToken" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "File_instanceId_idx" ON "File"("instanceId");

-- CreateIndex
CREATE INDEX "File_channel_idx" ON "File"("channel");

-- CreateIndex
CREATE INDEX "Session_instanceId_idx" ON "Session"("instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_instanceId_key_key" ON "Session"("instanceId", "key");

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

