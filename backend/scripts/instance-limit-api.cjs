"use strict";

const assert = require("assert");

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-with-more-than-32-characters";
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "local-test-password";
process.env.PORT = process.env.PORT || "0";
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || Buffer.alloc(32, 7).toString("base64");

require("ts-node/register");

const {
  findNextWhatsAppSlot,
  MAX_WHATSAPP_INSTANCES,
  TELEGRAM_INSTANCE_SLOT,
  WHATSAPP_INSTANCE_SLOTS,
} = require("../src/services/instances/instance.service.ts");

assert.equal(TELEGRAM_INSTANCE_SLOT, 0, "Telegram deve permanecer no slot reservado 0");
assert.equal(MAX_WHATSAPP_INSTANCES, 5, "limite WhatsApp deve ser 5");
assert.deepEqual(WHATSAPP_INSTANCE_SLOTS, [1, 2, 3, 4, 5], "slots WhatsApp devem cobrir 1 a 5");

assert.equal(findNextWhatsAppSlot([0, 1, 2, 3]), 4, "deve permitir criar a 4a instancia WhatsApp");
assert.equal(findNextWhatsAppSlot([0, 1, 2, 3, 4]), 5, "deve permitir criar a 5a instancia WhatsApp");
assert.equal(findNextWhatsAppSlot([0, 1, 2, 3, 4, 5]), null, "deve rejeitar uma 6a instancia WhatsApp");
assert.equal(findNextWhatsAppSlot([0, 1, 2, 4, 5]), 3, "deve reaproveitar o menor slot livre");
assert.equal(findNextWhatsAppSlot([1, 3, 5]), 2, "deve preencher lacunas antes de usar slots posteriores");

console.log("instance-limit-api: OK");
