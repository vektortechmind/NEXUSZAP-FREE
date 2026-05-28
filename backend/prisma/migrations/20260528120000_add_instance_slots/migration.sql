ALTER TABLE "Instance"
ADD COLUMN "slot" INTEGER;

WITH ordered_instances AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS rn
  FROM "Instance"
)
UPDATE "Instance" AS i
SET "slot" = ordered_instances.rn
FROM ordered_instances
WHERE i."id" = ordered_instances."id";

ALTER TABLE "Instance"
ALTER COLUMN "slot" SET NOT NULL;

CREATE UNIQUE INDEX "Instance_slot_key" ON "Instance"("slot");
CREATE INDEX "Instance_slot_idx" ON "Instance"("slot");
