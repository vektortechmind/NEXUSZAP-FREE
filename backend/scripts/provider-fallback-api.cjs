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

const prismaModulePath = require.resolve("../src/database/prisma.ts");
const instanceServiceModulePath = require.resolve("../src/services/instance.service.ts");
const providerSelectorModulePath = require.resolve("../src/ai/providerSelector.ts");
const runtimeConfigModulePath = require.resolve("../src/services/runtimeConfig.service.ts");
const agentPromptModulePath = require.resolve("../src/services/agentPrompt.ts");

delete require.cache[providerSelectorModulePath];
delete require.cache[runtimeConfigModulePath];
delete require.cache[agentPromptModulePath];
delete require.cache[instanceServiceModulePath];
delete require.cache[prismaModulePath];

const primaryWhatsapp = {
  id: "wa-primary",
  slot: 1,
  chatProvider: "gemini",
  groqKey: null,
  geminiKey: "primary-gemini-key",
  openrouterKey: null,
  openrouterModel: null,
  groqAudioKey: "primary-audio-key",
  memoryLimit: 9,
  systemPrompt: "prompt da instancia primaria",
  telegramSystemPrompt: null,
};

const secondaryWhatsapp = {
  id: "wa-secondary",
  slot: 2,
  chatProvider: null,
  groqKey: null,
  geminiKey: null,
  openrouterKey: null,
  openrouterModel: null,
  groqAudioKey: null,
  memoryLimit: 4,
  systemPrompt: "prompt da instancia secundaria",
  telegramSystemPrompt: null,
  agent: {
    id: "agent-secondary",
    chatProvider: null,
    openrouterModel: null,
    memoryLimit: 11,
    systemPrompt: null,
    telegramSystemPrompt: null,
  },
};

const overrideWhatsapp = {
  id: "wa-override",
  slot: 3,
  chatProvider: "groq",
  groqKey: "override-groq-key",
  geminiKey: null,
  openrouterKey: null,
  openrouterModel: null,
  groqAudioKey: null,
  memoryLimit: 6,
  systemPrompt: null,
  telegramSystemPrompt: null,
  agent: {
    id: "agent-override",
    chatProvider: "openrouter",
    openrouterModel: "anthropic/claude-3.5-haiku",
    memoryLimit: 13,
    systemPrompt: "prompt do agente override",
    telegramSystemPrompt: null,
  },
};

const telegramInstance = {
  id: "tg-singleton",
  slot: 0,
  chatProvider: null,
  groqKey: null,
  geminiKey: null,
  openrouterKey: null,
  openrouterModel: null,
  groqAudioKey: null,
  memoryLimit: 5,
  systemPrompt: "prompt geral do telegram",
  telegramSystemPrompt: "prompt do telegram na instancia",
  agent: {
    id: "agent-telegram",
    chatProvider: null,
    openrouterModel: null,
    memoryLimit: 7,
    systemPrompt: "prompt do agente telegram",
    telegramSystemPrompt: "prompt do canal telegram no agente",
  },
};

const instancesById = {
  [secondaryWhatsapp.id]: secondaryWhatsapp,
  [overrideWhatsapp.id]: overrideWhatsapp,
  [telegramInstance.id]: telegramInstance,
};

let getPrimaryInstanceCalls = 0;

require.cache[prismaModulePath] = {
  id: prismaModulePath,
  filename: prismaModulePath,
  loaded: true,
  exports: {
    prisma: {
      instance: {
        findUnique: async ({ where }) => instancesById[where.id] ?? null,
      },
      agent: {
        findUnique: async ({ where }) => {
          if (where.instanceId === secondaryWhatsapp.id) {
            return { audioTranscriptionEnabled: true };
          }
          return null;
        },
      },
    },
  },
};

require.cache[instanceServiceModulePath] = {
  id: instanceServiceModulePath,
  filename: instanceServiceModulePath,
  loaded: true,
  exports: {
    TELEGRAM_INSTANCE_SLOT: 0,
    getPrimaryInstance: async () => {
      getPrimaryInstanceCalls += 1;
      return primaryWhatsapp;
    },
  },
};

const { getKeys, isAudioTranscriptionEnabled } = require(providerSelectorModulePath);
const { getResolvedAgentPrompt, getResolvedTelegramPrompt } = require(agentPromptModulePath);

(async () => {
  const baseKeys = await getKeys();
  assert.equal(baseKeys.chatProvider, "gemini", "getKeys sem instanceId deve usar a instancia primaria de WhatsApp");
  assert.equal(baseKeys.geminiKey, "primary-gemini-key", "getKeys sem instanceId deve usar a chave da instancia primaria de WhatsApp");
  assert.equal(baseKeys.groqAudioKey, "primary-audio-key", "getKeys sem instanceId deve usar a chave de audio da instancia primaria de WhatsApp");

  const inheritedKeys = await getKeys(secondaryWhatsapp.id);
  assert.equal(inheritedKeys.geminiKey, "primary-gemini-key", "instancia secundaria deve herdar a chave global do WhatsApp primario");
  assert.equal(inheritedKeys.chatProvider, "gemini", "instancia secundaria deve herdar o chatProvider global do WhatsApp primario quando elegivel a fallback");
  assert.equal(inheritedKeys.memoryLimit, 11, "memoryLimit deve respeitar override do agente vinculado");

  const overrideKeys = await getKeys(overrideWhatsapp.id);
  assert.equal(overrideKeys.groqKey, "override-groq-key", "instancia com chave propria nao deve depender do fallback global");
  assert.equal(overrideKeys.chatProvider, "openrouter", "chatProvider deve respeitar override do agente vinculado");
  assert.equal(overrideKeys.openrouterModel, "anthropic/claude-3.5-haiku", "modelo OpenRouter deve respeitar override do agente vinculado");
  assert.equal(overrideKeys.memoryLimit, 13, "memoryLimit deve respeitar override do agente vinculado");

  const telegramKeys = await getKeys(telegramInstance.id);
  assert.equal(telegramKeys.chatProvider, null, "Telegram nao deve herdar provider global do WhatsApp");
  assert.equal(telegramKeys.geminiKey, null, "Telegram nao deve herdar chave Gemini global do WhatsApp");
  assert.equal(telegramKeys.groqAudioKey, null, "Telegram nao deve herdar chave de audio global do WhatsApp");
  assert.equal(telegramKeys.openrouterModel, null, "Telegram nao deve herdar modelo OpenRouter global do WhatsApp");
  assert.equal(telegramKeys.memoryLimit, 7, "Telegram deve respeitar memoryLimit do agente sem fallback global do WhatsApp");

  const instancePrompt = await getResolvedAgentPrompt(secondaryWhatsapp.id);
  assert.equal(instancePrompt, "prompt da instancia secundaria", "prompt geral deve usar agente e cair para a instancia sem fallback global");

  const telegramPrompt = await getResolvedTelegramPrompt(telegramInstance.id);
  assert.equal(telegramPrompt, "prompt do canal telegram no agente", "prompt do Telegram deve respeitar precedencia agente -> instancia sem fallback global");

  const transcriptionEnabled = await isAudioTranscriptionEnabled(secondaryWhatsapp.id);
  assert.equal(transcriptionEnabled, true, "flag de transcricao do agente deve continuar funcionando");
  assert.ok(getPrimaryInstanceCalls >= 4, "lookup da instancia primaria de WhatsApp deve ser usado nas resolucoes elegiveis de fallback");

  console.log("provider-fallback-api: OK");
})().catch((error) => {
  console.error("provider-fallback-api:", error.message || error);
  process.exit(1);
});

