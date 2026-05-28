ALTER TABLE "Agent"
RENAME COLUMN "voiceEnabled" TO "audioTranscriptionEnabled";

ALTER TABLE "Agent"
DROP COLUMN IF EXISTS "voiceProvider",
DROP COLUMN IF EXISTS "voiceModel",
DROP COLUMN IF EXISTS "voicePersona";
