ALTER TABLE "Agent"
ADD COLUMN     "chatProvider" TEXT,
ADD COLUMN     "openrouterModel" TEXT,
ADD COLUMN     "memoryLimit" INTEGER NOT NULL DEFAULT 5;

UPDATE "Agent" a
SET
  "chatProvider" = i."chatProvider",
  "openrouterModel" = i."openrouterModel",
  "memoryLimit" = COALESCE(i."memoryLimit", 5)
FROM "Instance" i
WHERE i."id" = a."instanceId";
