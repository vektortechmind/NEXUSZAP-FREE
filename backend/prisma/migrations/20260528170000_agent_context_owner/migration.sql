-- Promote prompts to Agent ownership
ALTER TABLE "Agent"
ADD COLUMN "systemPrompt" TEXT,
ADD COLUMN "telegramSystemPrompt" TEXT;

-- Promote file ownership to Agent while keeping instance bridge for runtime compatibility
ALTER TABLE "File"
ADD COLUMN "agentId" TEXT;

CREATE INDEX "File_agentId_idx" ON "File"("agentId");

ALTER TABLE "File"
ADD CONSTRAINT "File_agentId_fkey"
FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Copy prompts from existing linked instances into current agents
UPDATE "Agent" AS a
SET
  "systemPrompt" = i."systemPrompt",
  "telegramSystemPrompt" = i."telegramSystemPrompt"
FROM "Instance" AS i
WHERE a."instanceId" = i."id";

-- Create compatibility agents for legacy instances that already own prompts/files
INSERT INTO "Agent" ("id", "name", "instanceId", "telegramEnabled", "systemPrompt", "telegramSystemPrompt", "createdAt", "updatedAt")
SELECT
  CONCAT('legacy-agent-', i."id"),
  COALESCE(NULLIF(TRIM(i."agentName"), ''), NULLIF(TRIM(i."name"), ''), CONCAT('Agente ', i."slot")),
  i."id",
  true,
  i."systemPrompt",
  i."telegramSystemPrompt",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Instance" AS i
LEFT JOIN "Agent" AS a ON a."instanceId" = i."id"
WHERE a."id" IS NULL
  AND (
    i."slot" = 1
    OR i."systemPrompt" IS NOT NULL
    OR i."telegramSystemPrompt" IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM "File" AS f
      WHERE f."instanceId" = i."id"
    )
  );

-- Backfill file ownership for all existing files that can be mapped to an agent
UPDATE "File" AS f
SET "agentId" = a."id"
FROM "Agent" AS a
WHERE f."instanceId" = a."instanceId"
  AND f."agentId" IS NULL;
