ALTER TABLE "Agent"
ADD COLUMN     "voiceEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "voiceProvider" TEXT,
ADD COLUMN     "voiceModel" TEXT,
ADD COLUMN     "voicePersona" TEXT;
