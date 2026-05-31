process.env.NODE_ENV = "test";
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-with-more-than-32-characters";
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "local-test-password";
process.env.PORT = process.env.PORT || "0";

require("ts-node/register/transpile-only");
const assert = require("node:assert/strict");

const {
  buildAgentConfigUpdateData,
  sanitizeAgentConfigForResponse,
} = require("../src/services/agentConfigSecrets");
const {
  decryptSecret,
  encryptSecret,
} = require("../src/services/crypto.service");
const { parseRuntimeEnv } = require("../src/config/env.ts");

function baseAgent(overrides = {}) {
  const now = new Date("2026-05-27T00:00:00.000Z");
  return {
    id: "agent-1",
    name: "Agente Principal",
    agentName: null,
    status: "DISCONNECTED",
    aiWhatsappEnabled: true,
    aiTelegramEnabled: true,
    typing: true,
    delayMin: 4000,
    delayMax: 7000,
    systemPrompt: null,
    telegramSystemPrompt: null,
    telegramBotToken: null,
    chatProvider: null,
    groqKey: null,
    groqAudioKey: null,
    geminiKey: null,
    openrouterKey: null,
    openrouterModel: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function assertNoPlaintextSecrets(response) {
  const serialized = JSON.stringify(response);
  assert.equal(serialized.includes("gsk_plain_secret"), false);
  assert.equal(serialized.includes("telegram_plain_secret"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(response, "telegramBotToken"), false);
  assert.equal(response.groqKey, null);
}

async function main() {
  const storedGroq = encryptSecret("gsk_plain_secret");
  const storedTelegram = encryptSecret("123456:telegram_plain_secret");
  const response = sanitizeAgentConfigForResponse(baseAgent({
    groqKey: storedGroq,
    telegramBotToken: storedTelegram,
  }));

  assertNoPlaintextSecrets(response);
  assert.equal(response.groqKeyConfigured, true);
  assert.match(response.groqKeyMasked, /^gsk_\*\*\*\*/);
  assert.equal(response.telegramBotTokenConfigured, true);
  assert.match(response.telegramBotTokenMasked, /^1234\*\*\*\*/);

  const updateData = buildAgentConfigUpdateData({
    name: "Novo nome",
    groqKey: "gsk_new_secret",
    geminiKey: "",
    openrouterKey: undefined,
  });
  assert.equal(updateData.name, "Novo nome");
  assert.equal(typeof updateData.groqKey, "string");
  assert.notEqual(updateData.groqKey, "gsk_new_secret");
  assert.equal(decryptSecret(updateData.groqKey), "gsk_new_secret");
  assert.equal(Object.prototype.hasOwnProperty.call(updateData, "geminiKey"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(updateData, "openrouterKey"), false);

  const maskedUpdate = buildAgentConfigUpdateData({ groqKey: "gsk_****cret" });
  assert.equal(Object.prototype.hasOwnProperty.call(maskedUpdate, "groqKey"), false);

  assert.throws(() => parseRuntimeEnv({
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://nexus:secret@db.example.com:5432/nexus",
    JWT_SECRET: "production-jwt-secret-with-more-than-32-chars",
    ADMIN_EMAIL: "admin@example.com",
    ADMIN_PASSWORD: "StrongPassword1!",
    APP_URL: "https://app.example.com",
    GITHUB_REPO: "acme/nexuszap",
  }), /ENCRYPTION_KEY/);

  console.log("secrets-api: OK");
}

main().catch((err) => {
  console.error("secrets-api:", err);
  process.exit(1);
});
