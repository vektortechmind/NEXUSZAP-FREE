"use strict";

const assert = require("assert");
const path = require("path");

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || Buffer.alloc(32, 7).toString("base64");

require("ts-node/register");

const prismaModulePath = require.resolve("../src/database/prisma.ts");
const instanceServiceModulePath = require.resolve("../src/services/instance.service.ts");
const providerSelectorModulePath = require.resolve("../src/ai/providerSelector.ts");

delete require.cache[providerSelectorModulePath];
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
};

const instancesById = {
  [secondaryWhatsapp.id]: secondaryWhatsapp,
  [overrideWhatsapp.id]: overrideWhatsapp,
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
        findFirst: async ({ where }) => {
          if (where.instanceId === secondaryWhatsapp.id) {
            return { chatProvider: null, openrouterModel: null, memoryLimit: 11 };
          }
          if (where.instanceId === overrideWhatsapp.id) {
            return { chatProvider: "openrouter", openrouterModel: "anthropic/claude-3.5-haiku", memoryLimit: 13 };
          }
          return null;
        },
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
    getPrimaryInstance: async () => {
      getPrimaryInstanceCalls += 1;
      return primaryWhatsapp;
    },
  },
};

const { getKeys, isAudioTranscriptionEnabled } = require(providerSelectorModulePath);

(async () => {
  const baseKeys = await getKeys();
  assert.equal(baseKeys.chatProvider, "gemini", "getKeys sem instanceId deve usar a instancia primaria de WhatsApp");
  assert.equal(baseKeys.geminiKey, "primary-gemini-key", "getKeys sem instanceId deve usar a chave da instancia primaria de WhatsApp");
  assert.equal(baseKeys.groqAudioKey, "primary-audio-key", "getKeys sem instanceId deve usar a chave de audio da instancia primaria de WhatsApp");

  const inheritedKeys = await getKeys(secondaryWhatsapp.id);
  assert.equal(inheritedKeys.geminiKey, "primary-gemini-key", "instancia secundaria deve herdar a chave global do WhatsApp primario");
  assert.equal(inheritedKeys.chatProvider, secondaryWhatsapp.chatProvider, "provider nulo da instancia deve permanecer nulo quando nao houver agent override");
  assert.equal(inheritedKeys.memoryLimit, 11, "memoryLimit deve respeitar override do agente vinculado");

  const overrideKeys = await getKeys(overrideWhatsapp.id);
  assert.equal(overrideKeys.groqKey, "override-groq-key", "instancia com chave propria nao deve depender do fallback global");
  assert.equal(overrideKeys.chatProvider, "openrouter", "chatProvider deve respeitar override do agente vinculado");
  assert.equal(overrideKeys.openrouterModel, "anthropic/claude-3.5-haiku", "modelo OpenRouter deve respeitar override do agente vinculado");
  assert.equal(overrideKeys.memoryLimit, 13, "memoryLimit deve respeitar override do agente vinculado");

  const transcriptionEnabled = await isAudioTranscriptionEnabled(secondaryWhatsapp.id);
  assert.equal(transcriptionEnabled, true, "flag de transcricao do agente deve continuar funcionando");
  assert.ok(getPrimaryInstanceCalls >= 3, "lookup da instancia primaria de WhatsApp deve ser usado nas resolucoes de chave");

  console.log("provider-fallback-api: OK");
})().catch((error) => {
  console.error("provider-fallback-api:", error.message || error);
  process.exit(1);
});
