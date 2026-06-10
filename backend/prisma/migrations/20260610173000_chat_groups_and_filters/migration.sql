ALTER TABLE "Conversation" ADD COLUMN "isGroup" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Message" ADD COLUMN "senderJid" TEXT;
ALTER TABLE "Message" ADD COLUMN "senderName" TEXT;

UPDATE "Conversation"
SET "isGroup" = true
WHERE "jid" LIKE '%@g.us';