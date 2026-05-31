ALTER TABLE "Instance"
ADD COLUMN "openaiKey" TEXT,
ADD COLUMN "openaiModel" TEXT;

ALTER TABLE "Agent"
ADD COLUMN "openaiModel" TEXT;
