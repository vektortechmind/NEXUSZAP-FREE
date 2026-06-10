-- Keep one canonical message per provider id before adding the partial unique index.
-- Duplicates are retained as panel-only deleted rows with providerMessageId cleared so the
-- production migration can complete without destructive row deletion.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "instanceId", "providerMessageId"
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM "Message"
  WHERE "providerMessageId" IS NOT NULL
)
UPDATE "Message" AS m
SET
  "providerMessageId" = NULL,
  "isDeleted" = TRUE,
  body = NULL
FROM ranked
WHERE m.id = ranked.id
  AND ranked.rn > 1;

DROP INDEX IF EXISTS "Message_providerMessageId_idx";

CREATE INDEX IF NOT EXISTS "Message_instanceId_providerMessageId_idx"
  ON "Message"("instanceId", "providerMessageId");

CREATE UNIQUE INDEX IF NOT EXISTS "Message_instanceId_providerMessageId_unique_not_null"
  ON "Message"("instanceId", "providerMessageId")
  WHERE "providerMessageId" IS NOT NULL;
