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
const { resolveChatBody, resolveChatMessageType, shouldPersistChatMessage } = require("../src/whatsapp/messageHandler.ts");

function createBaileysMock() {
  return {
    async sendTextMessage() {
      return { providerMessageId: "wamid.sent.1", raw: null };
    },
    async sendReaction() {},
    async editMessage() {},
    async deleteMessage() {},
    async clearChat() {},
    async markRead() {},
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
  assert.equal(resolveChatMessageType({ imageMessage: { mimetype: "image/jpeg" } }), "IMAGE");
  assert.equal(resolveChatMessageType({ videoMessage: { mimetype: "video/mp4" } }), "VIDEO");
  assert.equal(resolveChatMessageType({ documentMessage: { mimetype: "application/pdf" } }), "DOCUMENT");
  assert.equal(resolveChatMessageType({ protocolMessage: { editedMessage: { conversation: "Texto editado" } } }), "TEXT");
  assert.equal(resolveChatMessageType({}), "UNKNOWN");
  assert.equal(shouldPersistChatMessage({ body: null, messageType: "UNKNOWN", mediaMimeType: null }), false);
  assert.equal(shouldPersistChatMessage({ body: "Oi", messageType: "TEXT", mediaMimeType: null }), true);
  assert.equal(shouldPersistChatMessage({ body: null, messageType: "AUDIO", mediaMimeType: "audio/ogg" }), true);
  assert.equal(shouldPersistChatMessage({ body: null, messageType: "IMAGE", mediaMimeType: "image/jpeg" }), true);
  assert.equal(shouldPersistChatMessage({ body: null, messageType: "VIDEO", mediaMimeType: "video/mp4" }), true);
  assert.equal(shouldPersistChatMessage({ body: null, messageType: "UNKNOWN", mediaMimeType: "audio/ogg" }), true);

  const handlerSource = fs.readFileSync(path.resolve(__dirname, "../src/whatsapp/messageHandler.ts"), "utf8");
  assert.match(handlerSource, /reactionMessage/);
  assert.match(handlerSource, /persistReaction/);
  assert.match(handlerSource, /ProtocolMessage\.Type\.REVOKE/);
  assert.match(handlerSource, /ProtocolMessage\.Type\.MESSAGE_EDIT/);
  assert.match(handlerSource, /markMessageDeleted/);
  assert.match(handlerSource, /editMessageFromProvider/);
  assert.match(handlerSource, /downloadMediaFromMessage/);

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

  const providerEdited = await service.editMessageFromProvider({
    instanceId: "instance-a",
    providerMessageId: "wamid.audio.1",
    body: "Audio editado pelo provider",
  });
  assert.equal(providerEdited.body, "Audio editado pelo provider");
  assert.ok(providerEdited.editedAt);

  const providerDeleted = await service.markMessageDeleted({ instanceId: "instance-a", providerMessageId: "wamid.audio.1" });
  assert.equal(providerDeleted.isDeleted, true);

  const image = await service.persistInboundMessage({
    instanceId: "instance-a",
    jid: "5511999990000@s.whatsapp.net",
    body: null,
    messageType: "IMAGE",
    providerMessageId: "wamid.image.1",
    mediaUrl: null,
    mediaMimeType: "image/jpeg",
    mediaDurationMs: null,
    createdAt: new Date("2026-06-09T12:01:00.000Z"),
  });
  await writeChatMedia({ instanceId: "instance-a", providerMessageId: "wamid.image.1", buffer: Buffer.from("image-bytes") });
  const imageWithMedia = await service.attachMessageMedia({
    instanceId: "instance-a",
    messageId: image.id,
    mediaUrl: "/api/chat/media/instance-a/wamid.image.1",
    mediaMimeType: "image/jpeg",
  });
  assert.equal(imageWithMedia.mediaUrl, "/api/chat/media/instance-a/wamid.image.1");
  const imageResponse = await app.inject({ method: "GET", url: "/api/chat/media/instance-a/wamid.image.1" });
  assert.equal(imageResponse.statusCode, 200, imageResponse.body);
  assert.equal(imageResponse.headers["content-type"], "image/jpeg");
  assert.equal(imageResponse.rawPayload.toString(), "image-bytes");

  const video = await service.persistInboundMessage({
    instanceId: "instance-a",
    jid: "5511999990000@s.whatsapp.net",
    body: null,
    messageType: "VIDEO",
    providerMessageId: "wamid.video.1",
    mediaUrl: null,
    mediaMimeType: "video/mp4",
    mediaDurationMs: null,
    createdAt: new Date("2026-06-09T12:02:00.000Z"),
  });
  await writeChatMedia({ instanceId: "instance-a", providerMessageId: "wamid.video.1", buffer: Buffer.from("video-bytes") });
  const videoWithMedia = await service.attachMessageMedia({
    instanceId: "instance-a",
    messageId: video.id,
    mediaUrl: "/api/chat/media/instance-a/wamid.video.1",
    mediaMimeType: "video/mp4",
  });
  assert.equal(videoWithMedia.mediaUrl, "/api/chat/media/instance-a/wamid.video.1");
  const videoResponse = await app.inject({ method: "GET", url: "/api/chat/media/instance-a/wamid.video.1" });
  assert.equal(videoResponse.statusCode, 200, videoResponse.body);
  assert.equal(videoResponse.headers["content-type"], "video/mp4");
  assert.equal(videoResponse.rawPayload.toString(), "video-bytes");

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
