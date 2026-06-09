"use strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-with-more-than-32-characters";
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "local-test-password";
process.env.PORT = process.env.PORT || "0";
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || Buffer.alloc(32, 11).toString("base64");

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-chat-media-"));
process.env.CHAT_MEDIA_STORAGE_ROOT = tempRoot;

require("ts-node/register");

const Fastify = require("fastify");
const { createChatRoutes } = require("../src/routes/chat.routes.ts");
const { createChatService, createInMemoryChatStore } = require("../src/services/chat.service.ts");
const { writeChatMedia } = require("../src/services/chat.mediaStorage.ts");
const { resolveChatBody, resolveChatMessageType } = require("../src/whatsapp/messageHandler.ts");

function createBaileysMock() {
  return {
    async sendTextMessage() {
      return { providerMessageId: "wamid.sent.1", raw: null };
    },
    async getContactProfile() {
      return { name: null, profilePicUrl: null };
    },
  };
}

(async () => {
  assert.equal(resolveChatBody({ conversation: "Texto simples" }), "Texto simples");
  assert.equal(resolveChatBody({ extendedTextMessage: { text: "Texto estendido" } }), "Texto estendido");
  assert.equal(resolveChatBody({ imageMessage: { caption: "Legenda imagem" } }), "Legenda imagem");
  assert.equal(resolveChatBody({ videoMessage: { caption: "Legenda video" } }), "Legenda video");
  assert.equal(resolveChatBody({ documentMessage: { fileName: "contrato.pdf" } }), "contrato.pdf");
  assert.equal(resolveChatBody({ buttonsResponseMessage: { selectedDisplayText: "Quero atendimento" } }), "Quero atendimento");
  assert.equal(resolveChatBody({ listResponseMessage: { title: "Plano Pro", description: "Detalhes" } }), "Plano Pro");
  assert.equal(resolveChatBody({ templateButtonReplyMessage: { selectedDisplayText: "Confirmar" } }), "Confirmar");
  assert.equal(resolveChatBody({ interactiveResponseMessage: { body: { text: "Fluxo escolhido" } } }), "Fluxo escolhido");
  assert.equal(resolveChatBody({ ephemeralMessage: { message: { extendedTextMessage: { text: "Texto em wrapper" } } } }), "Texto em wrapper");
  assert.equal(resolveChatBody({ viewOnceMessage: { message: { imageMessage: { caption: "Legenda em visualizacao unica" } } } }), "Legenda em visualizacao unica");
  assert.equal(resolveChatBody({ protocolMessage: { editedMessage: { conversation: "Texto editado" } } }), "Texto editado");
  assert.equal(resolveChatBody({}), null);

  assert.equal(resolveChatMessageType({ conversation: "Oi" }), "TEXT");
  assert.equal(resolveChatMessageType({ audioMessage: { mimetype: "audio/ogg" } }), "AUDIO");
  assert.equal(resolveChatMessageType({ videoMessage: { mimetype: "video/mp4" } }), "VIDEO");
  assert.equal(resolveChatMessageType({ documentMessage: { mimetype: "application/pdf" } }), "DOCUMENT");
  assert.equal(resolveChatMessageType({}), "UNKNOWN");

  const store = createInMemoryChatStore({ instances: [{ id: "instance-a" }] });
  const service = createChatService({ store, baileys: createBaileysMock() });
  const app = Fastify();
  app.register(createChatRoutes({ service, preValidationHook: async () => {} }), { prefix: "/api/chat" });
  await app.ready();

  const audio = await service.persistInboundMessage({
    instanceId: "instance-a",
    jid: "5511999990000@s.whatsapp.net",
    body: null,
    messageType: "AUDIO",
    providerMessageId: "wamid.audio.1",
    mediaUrl: null,
    mediaMimeType: "audio/ogg; codecs=opus",
    mediaDurationMs: 12000,
    createdAt: new Date("2026-06-09T12:00:00.000Z"),
  });

  assert.equal(audio.messageType, "AUDIO");
  assert.equal(audio.mediaDurationMs, 12000);
  assert.equal(audio.mediaUrl, null);

  await writeChatMedia({ instanceId: "instance-a", providerMessageId: "wamid.audio.1", buffer: Buffer.from("audio-bytes") });
  const audioWithMedia = await service.attachMessageMedia({
    instanceId: "instance-a",
    messageId: audio.id,
    mediaUrl: "/api/chat/media/instance-a/wamid.audio.1",
    mediaMimeType: "audio/ogg; codecs=opus",
    mediaDurationMs: 12000,
  });
  assert.equal(audioWithMedia.mediaUrl, "/api/chat/media/instance-a/wamid.audio.1");

  const response = await app.inject({ method: "GET", url: "/api/chat/media/instance-a/wamid.audio.1" });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.headers["content-type"], "audio/ogg; codecs=opus");
  assert.equal(response.headers["content-disposition"], "inline");
  assert.equal(response.rawPayload.toString(), "audio-bytes");

  const missing = await app.inject({ method: "GET", url: "/api/chat/media/instance-a/missing" });
  assert.equal(missing.statusCode, 404);

  await app.close();
  fs.rmSync(tempRoot, { recursive: true, force: true });
  console.log("chat-content-media-api: OK");
})().catch((error) => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
  console.error("chat-content-media-api:", error);
  process.exit(1);
});
