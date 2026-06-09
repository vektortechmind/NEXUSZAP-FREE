"use strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-with-more-than-32-characters";
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "local-test-password";
process.env.PORT = process.env.PORT || "0";
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || Buffer.alloc(32, 11).toString("base64");

require("ts-node/register");

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Fastify = require("fastify");
const multipart = require("@fastify/multipart");
process.env.CHAT_MEDIA_STORAGE_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-chat-media-"));
const { createChatRoutes } = require("../src/routes/chat.routes.ts");
const {
  createChatService,
  createInMemoryChatStore,
} = require("../src/services/chat.service.ts");
const { chatRealtime } = require("../src/services/chat.realtime.ts");
const { ChatProviderSendError } = require("../src/services/chat.baileys.ts");
const { cleanupOldChatMedia, writeChatMedia } = require("../src/services/chat.mediaStorage.ts");

function createBaileysMock(options = {}) {
  const sent = [];
  const mediaSent = [];
  const reactions = [];
  const edits = [];
  const deletes = [];
  const markReads = [];
  const profileRequests = [];
  return {
    sent,
    mediaSent,
    reactions,
    edits,
    deletes,
    markReads,
    profileRequests,
    async sendTextMessage(input) {
      sent.push(input);
      if (options.failSend) throw new ChatProviderSendError("provider unavailable");
      return { providerMessageId: options.providerMessageId || "wamid.sent.1", raw: null };
    },
    async sendMediaMessage(input) {
      mediaSent.push(input);
      if (options.failSend) throw new ChatProviderSendError("provider unavailable");
      return { providerMessageId: options.mediaProviderMessageId || "wamid.media.1", raw: null };
    },
    async sendReaction(input) {
      reactions.push(input);
      if (options.failReaction) throw new ChatProviderSendError("reaction unavailable");
    },
    async editMessage(input) {
      edits.push(input);
      if (options.failEdit) throw new ChatProviderSendError("edit unavailable");
    },
    async deleteMessage(input) {
      deletes.push(input);
      if (options.failDelete) throw new ChatProviderSendError("delete unavailable");
    },
    async markRead(input) {
      markReads.push(input);
      if (options.failMarkRead) throw new ChatProviderSendError("mark read unavailable");
    },
    async getContactProfile(input) {
      profileRequests.push(input);
      return { name: `Contato ${input.jid.slice(0, 4)}`, profilePicUrl: `https://img.example.com/${encodeURIComponent(input.jid)}.jpg` };
    },
  };
}

function multipartBody(fields, file) {
  const boundary = `----nexuszap-${Date.now().toString(36)}`;
  const chunks = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.filename}"\r\nContent-Type: ${file.mimeType}\r\n\r\n`));
  chunks.push(file.buffer);
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(chunks),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

function createApp({ store, baileys, events }) {
  const app = Fastify();
  app.register(multipart, { limits: { fileSize: 60 * 1024 * 1024 } });
  const service = createChatService({
    store,
    baileys,
    eventRecorder: async (event) => {
      events.push(event);
    },
  });
  app.register(createChatRoutes({ service, preValidationHook: async () => {} }), { prefix: "/api/chat" });
  return { app, service };
}

(async () => {
  const store = createInMemoryChatStore({ instances: [{ id: "instance-a" }, { id: "instance-b" }] });
  const baileys = createBaileysMock();
  const events = [];
  const { app, service } = createApp({ store, baileys, events });
  await app.ready();

  const firstInbound = await service.persistInboundMessage({
    instanceId: "instance-a",
    jid: "5511999990000@s.whatsapp.net",
    body: "Oi",
    messageType: "TEXT",
    providerMessageId: "wamid.in.1",
    createdAt: new Date("2026-06-09T10:00:00.000Z"),
  });
  assert.equal(firstInbound.status, "DELIVERED");
  assert.equal(baileys.profileRequests.length, 1, "mensagem recebida deve buscar perfil do contato para preencher avatar");
  assert.equal(baileys.profileRequests[0].jid, "5511999990000@s.whatsapp.net");

  const duplicateInbound = await service.persistInboundMessage({
    instanceId: "instance-a",
    jid: "5511999990000@s.whatsapp.net",
    body: "Oi duplicado",
    messageType: "TEXT",
    providerMessageId: "wamid.in.1",
    createdAt: new Date("2026-06-09T10:01:00.000Z"),
  });
  assert.equal(duplicateInbound.id, firstInbound.id, "providerMessageId duplicado nao deve criar nova mensagem");
  assert.equal(store.conversations.size, 1, "unique instanceId/jid deve manter uma conversa");

  await service.persistInboundMessage({
    instanceId: "instance-a",
    jid: "5511888880000@s.whatsapp.net",
    body: "Outra conversa",
    messageType: "TEXT",
    providerMessageId: "wamid.in.2",
    createdAt: new Date("2026-06-09T10:02:00.000Z"),
  });
  await service.persistInboundMessage({
    instanceId: "instance-b",
    jid: "5511777770000@s.whatsapp.net",
    body: "Instancia B",
    messageType: "TEXT",
    providerMessageId: "wamid.in.3",
    createdAt: new Date("2026-06-09T10:03:00.000Z"),
  });

  const allConversationsResponse = await app.inject({ method: "GET", url: "/api/chat/conversations" });
  assert.equal(allConversationsResponse.statusCode, 200, allConversationsResponse.body);
  assert.equal(JSON.parse(allConversationsResponse.body).conversations.length, 3);

  const filteredConversationsResponse = await app.inject({ method: "GET", url: "/api/chat/conversations?instanceId=instance-a" });
  assert.equal(filteredConversationsResponse.statusCode, 200, filteredConversationsResponse.body);
  const filteredConversations = JSON.parse(filteredConversationsResponse.body).conversations;
  assert.equal(filteredConversations.length, 2);
  assert.equal(filteredConversations[0].lastMessage.body, "Outra conversa");
  assert.equal(filteredConversations[0].profilePicUrl, `https://img.example.com/${encodeURIComponent("5511888880000@s.whatsapp.net")}.jpg`);
  assert.equal(filteredConversations[0].unreadCount, 1);

  await service.persistInboundMessage({
    instanceId: "instance-a",
    jid: "5511999990000@s.whatsapp.net",
    body: "Mensagem 2",
    messageType: "TEXT",
    providerMessageId: "wamid.in.4",
    createdAt: new Date("2026-06-09T10:04:00.000Z"),
  });
  await service.persistInboundMessage({
    instanceId: "instance-a",
    jid: "5511999990000@s.whatsapp.net",
    body: "Mensagem 3",
    messageType: "TEXT",
    providerMessageId: "wamid.in.5",
    createdAt: new Date("2026-06-09T10:05:00.000Z"),
  });

  const firstPageResponse = await app.inject({
    method: "GET",
    url: `/api/chat/conversations/${encodeURIComponent("5511999990000@s.whatsapp.net")}/messages?instanceId=instance-a&limit=2`,
  });
  assert.equal(firstPageResponse.statusCode, 200, firstPageResponse.body);
  const firstPage = JSON.parse(firstPageResponse.body);
  assert.equal(firstPage.messages.length, 2);
  assert.equal(firstPage.messages[0].body, "Mensagem 3");
  assert.equal(firstPage.nextCursor, "2026-06-09T10:04:00.000Z");

  const secondPageResponse = await app.inject({
    method: "GET",
    url: `/api/chat/conversations/${encodeURIComponent("5511999990000@s.whatsapp.net")}/messages?instanceId=instance-a&cursor=${encodeURIComponent(firstPage.nextCursor)}&limit=2`,
  });
  assert.equal(secondPageResponse.statusCode, 200, secondPageResponse.body);
  const secondPage = JSON.parse(secondPageResponse.body);
  assert.equal(secondPage.messages.length, 1);
  assert.equal(secondPage.messages[0].body, "Oi");

  const sendResponse = await app.inject({
    method: "POST",
    url: "/api/chat/send",
    payload: { instanceId: "instance-a", jid: "5511999990000@s.whatsapp.net", body: "Resposta manual" },
  });
  assert.equal(sendResponse.statusCode, 201, sendResponse.body);
  const sentMessage = JSON.parse(sendResponse.body).message;
  assert.equal(sentMessage.status, "SENT");
  assert.equal(sentMessage.providerMessageId, "wamid.sent.1");
  assert.equal(baileys.sent.length, 1);
  assert.equal(events.length, 1);
  assert.equal(events[0].direction, "OUTBOUND");

  const quotedSendResponse = await app.inject({
    method: "POST",
    url: "/api/chat/send",
    payload: { instanceId: "instance-a", jid: "5511999990000@s.whatsapp.net", body: "Resposta com quote", quotedMessageId: "wamid.in.1" },
  });
  assert.equal(quotedSendResponse.statusCode, 201, quotedSendResponse.body);
  assert.equal(JSON.parse(quotedSendResponse.body).message.quotedMessageId, "wamid.in.1");
  assert.equal(baileys.sent[1].quotedMessage.key.id, "wamid.in.1");

  const mediaUpload = multipartBody(
    {
      instanceId: "instance-a",
      jid: "5511999990000@s.whatsapp.net",
      messageType: "IMAGE",
      caption: "Imagem com legenda",
      quotedMessageId: "wamid.in.1",
    },
    { filename: "foto.jpg", mimeType: "image/jpeg", buffer: Buffer.from("fake-jpeg") }
  );
  const mediaResponse = await app.inject({
    method: "POST",
    url: "/api/chat/send/media",
    ...mediaUpload,
  });
  assert.equal(mediaResponse.statusCode, 201, mediaResponse.body);
  const mediaMessage = JSON.parse(mediaResponse.body).message;
  assert.equal(mediaMessage.messageType, "IMAGE");
  assert.equal(mediaMessage.status, "SENT");
  assert.equal(mediaMessage.providerMessageId, "wamid.media.1");
  assert.equal(mediaMessage.mediaMimeType, "image/jpeg");
  assert.match(mediaMessage.mediaUrl, /\/api\/chat\/media\/instance-a\/wamid\.media\.1/);
  assert.equal(baileys.mediaSent.length, 1);
  assert.equal(baileys.mediaSent[0].caption, "Imagem com legenda");
  assert.equal(baileys.mediaSent[0].quotedMessage.key.id, "wamid.in.1");

  const oldStored = await writeChatMedia({
    instanceId: "instance-a",
    providerMessageId: "wamid.old.media",
    buffer: Buffer.from("old"),
    messageType: "DOCUMENT",
    mimeType: "text/plain",
  });
  const oldAbsolute = path.join(process.env.CHAT_MEDIA_STORAGE_ROOT, oldStored.storagePath);
  const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
  fs.utimesSync(oldAbsolute, oldDate, oldDate);
  const cleanupResult = await cleanupOldChatMedia();
  assert.equal(cleanupResult.removed >= 1, true, "cleanup deve remover midias com mais de 30 dias");
  assert.equal(fs.existsSync(oldAbsolute), false);

  const largeImageUpload = multipartBody(
    { instanceId: "instance-a", jid: "5511999990000@s.whatsapp.net", messageType: "IMAGE" },
    { filename: "grande.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(10 * 1024 * 1024 + 1) }
  );
  const largeImageResponse = await app.inject({
    method: "POST",
    url: "/api/chat/send/media",
    ...largeImageUpload,
  });
  assert.equal(largeImageResponse.statusCode, 413, largeImageResponse.body);
  assert.equal(baileys.mediaSent.length, 1, "arquivo grande deve ser rejeitado antes de enviar ao WhatsApp");

  const editInboundResponse = await app.inject({
    method: "POST",
    url: "/api/chat/edit",
    payload: { instanceId: "instance-a", jid: "5511999990000@s.whatsapp.net", providerMessageId: "wamid.in.1", body: "Nao pode" },
  });
  assert.equal(editInboundResponse.statusCode, 400, editInboundResponse.body);

  const editResponse = await app.inject({
    method: "POST",
    url: "/api/chat/edit",
    payload: { instanceId: "instance-a", jid: "5511999990000@s.whatsapp.net", providerMessageId: "wamid.sent.1", body: "Resposta editada" },
  });
  assert.equal(editResponse.statusCode, 200, editResponse.body);
  const editedMessage = JSON.parse(editResponse.body).message;
  assert.equal(editedMessage.body, "Resposta editada");
  assert.ok(editedMessage.editedAt);
  assert.equal(baileys.edits.length, 1);

  const oldOutbound = await service.persistOutboundMessage({
    instanceId: "instance-a",
    jid: "5511999990000@s.whatsapp.net",
    body: "Muito antiga",
    messageType: "TEXT",
    providerMessageId: "wamid.old.edit",
    createdAt: new Date(Date.now() - 16 * 60 * 1000),
  });
  assert.equal(oldOutbound.fromMe, true);
  const oldEditResponse = await app.inject({
    method: "POST",
    url: "/api/chat/edit",
    payload: { instanceId: "instance-a", jid: "5511999990000@s.whatsapp.net", providerMessageId: "wamid.old.edit", body: "Tarde demais" },
  });
  assert.equal(oldEditResponse.statusCode, 422, oldEditResponse.body);

  const deleteEveryoneResponse = await app.inject({
    method: "POST",
    url: "/api/chat/delete",
    payload: { instanceId: "instance-a", jid: "5511999990000@s.whatsapp.net", providerMessageId: "wamid.sent.1", mode: "for_everyone" },
  });
  assert.equal(deleteEveryoneResponse.statusCode, 200, deleteEveryoneResponse.body);
  assert.equal(JSON.parse(deleteEveryoneResponse.body).message.isDeleted, false);
  assert.equal(baileys.deletes.length, 1);

  const deleteForMeResponse = await app.inject({
    method: "POST",
    url: "/api/chat/delete",
    payload: { instanceId: "instance-a", jid: "5511999990000@s.whatsapp.net", providerMessageId: "wamid.sent.1", mode: "for_me" },
  });
  assert.equal(deleteForMeResponse.statusCode, 200, deleteForMeResponse.body);
  assert.equal(JSON.parse(deleteForMeResponse.body).message.isDeleted, true);
  assert.equal(baileys.deletes.length, 1, "for_me nao deve enviar delete remoto ao WhatsApp");

  const reactionResponse = await app.inject({
    method: "POST",
    url: "/api/chat/react",
    payload: { instanceId: "instance-a", jid: "5511999990000@s.whatsapp.net", providerMessageId: "wamid.in.1", emoji: "👍" },
  });
  assert.equal(reactionResponse.statusCode, 200, reactionResponse.body);
  const reactedMessage = JSON.parse(reactionResponse.body).message;
  assert.equal(reactedMessage.id, firstInbound.id);
  assert.equal(reactedMessage.reactionEmoji, "👍");
  assert.equal(baileys.reactions.length, 1);
  assert.equal(baileys.reactions[0].targetFromMe, false);

  const removeReactionResponse = await app.inject({
    method: "POST",
    url: "/api/chat/react",
    payload: { instanceId: "instance-a", jid: "5511999990000@s.whatsapp.net", providerMessageId: "wamid.in.1", emoji: "" },
  });
  assert.equal(removeReactionResponse.statusCode, 200, removeReactionResponse.body);
  assert.equal(JSON.parse(removeReactionResponse.body).message.reactionEmoji, null);
  assert.equal(baileys.reactions[1].emoji, "");

  await service.persistOutboundMessage({
    instanceId: "instance-a",
    jid: "5511888880000@s.whatsapp.net",
    body: "Limpar 1",
    messageType: "TEXT",
    providerMessageId: "wamid.clear.1",
    createdAt: new Date("2026-06-09T10:06:00.000Z"),
  });
  await service.persistOutboundMessage({
    instanceId: "instance-a",
    jid: "5511888880000@s.whatsapp.net",
    body: "Limpar 2",
    messageType: "TEXT",
    providerMessageId: "wamid.clear.2",
    createdAt: new Date("2026-06-09T10:07:00.000Z"),
  });
  const clearPanelResponse = await app.inject({
    method: "POST",
    url: `/api/chat/conversations/${encodeURIComponent("5511888880000@s.whatsapp.net")}/clear`,
    payload: { instanceId: "instance-a" },
  });
  assert.equal(clearPanelResponse.statusCode, 200, clearPanelResponse.body);
  assert.equal(JSON.parse(clearPanelResponse.body).deletedCount, 3);
  const clearedMessagesResponse = await app.inject({
    method: "GET",
    url: `/api/chat/conversations/${encodeURIComponent("5511888880000@s.whatsapp.net")}/messages?instanceId=instance-a`,
  });
  assert.equal(JSON.parse(clearedMessagesResponse.body).messages.length, 0);

  const realtimeEvents = [];
  chatRealtime.setEmitter({
    emitToInstance(instanceId, event, payload) {
      realtimeEvents.push({ instanceId, event, payload });
    },
  });
  await service.persistInboundMessage({
    instanceId: "instance-a",
    jid: "5511555550000@s.whatsapp.net",
    body: "Limpar mesmo offline",
    messageType: "TEXT",
    providerMessageId: "wamid.clear.fail.1",
    createdAt: new Date("2026-06-09T10:08:30.000Z"),
  });
  const clearRealtimeResponse = await app.inject({
    method: "POST",
    url: `/api/chat/conversations/${encodeURIComponent("5511555550000@s.whatsapp.net")}/clear`,
    payload: { instanceId: "instance-a" },
  });
  assert.equal(clearRealtimeResponse.statusCode, 200, clearRealtimeResponse.body);
  assert.equal(JSON.parse(clearRealtimeResponse.body).deletedCount, 1);
  const clearFailureMessages = await app.inject({
    method: "GET",
    url: `/api/chat/conversations/${encodeURIComponent("5511555550000@s.whatsapp.net")}/messages?instanceId=instance-a`,
  });
  assert.equal(JSON.parse(clearFailureMessages.body).messages.length, 0);
  assert.equal(realtimeEvents.some((item) => item.event === "conversation:update" && item.payload.unreadCount === 0), true);
  assert.equal(realtimeEvents.filter((item) => item.event === "message:deleted").length, 0, "clearConversation deve emitir somente evento de lote");
  assert.equal(realtimeEvents.some((item) => item.event === "conversation:update" && item.payload.cleared === true), true);
  chatRealtime.setEmitter(null);

  await service.persistInboundMessage({
    instanceId: "instance-a",
    jid: "5511666660000@s.whatsapp.net",
    body: "Nao lida",
    messageType: "TEXT",
    providerMessageId: "wamid.read.1",
    createdAt: new Date("2026-06-09T10:09:00.000Z"),
  });
  const markReadResponse = await app.inject({
    method: "POST",
    url: `/api/chat/conversations/${encodeURIComponent("5511666660000@s.whatsapp.net")}/read`,
    payload: { instanceId: "instance-a" },
  });
  assert.equal(markReadResponse.statusCode, 200, markReadResponse.body);
  assert.equal(JSON.parse(markReadResponse.body).conversation.unreadCount, 0);
  assert.equal(baileys.markReads.length, 1);

  await app.close();

  const failStore = createInMemoryChatStore({ instances: [{ id: "instance-a" }] });
  const failEvents = [];
  const { app: failApp } = createApp({ store: failStore, baileys: createBaileysMock({ failSend: true }), events: failEvents });
  await failApp.ready();
  const failResponse = await failApp.inject({
    method: "POST",
    url: "/api/chat/send",
    payload: { instanceId: "instance-a", jid: "5511999990000@s.whatsapp.net", body: "Vai falhar" },
  });
  assert.equal(failResponse.statusCode, 502, failResponse.body);
  assert.equal(Array.from(failStore.messages.values())[0].status, "FAILED");
  assert.equal(failEvents.length, 0);
  await failApp.close();

  const eventFailureStore = createInMemoryChatStore({ instances: [{ id: "instance-a" }] });
  const eventFailureService = createChatService({
    store: eventFailureStore,
    baileys: createBaileysMock({ providerMessageId: "wamid.sent.event-fail" }),
    eventRecorder: async () => {
      throw new Error("audit down");
    },
  });
  const eventFailureAppWithService = Fastify();
  eventFailureAppWithService.register(createChatRoutes({ service: eventFailureService, preValidationHook: async () => {} }), { prefix: "/api/chat" });
  await eventFailureAppWithService.ready();
  const eventFailureResponse = await eventFailureAppWithService.inject({
    method: "POST",
    url: "/api/chat/send",
    payload: { instanceId: "instance-a", jid: "5511999990000@s.whatsapp.net", body: "Auditoria falha" },
  });
  assert.equal(eventFailureResponse.statusCode, 201, eventFailureResponse.body);
  const eventFailureMessage = JSON.parse(eventFailureResponse.body).message;
  assert.equal(eventFailureMessage.status, "SENT");
  assert.equal(eventFailureMessage.providerMessageId, "wamid.sent.event-fail");
  await eventFailureAppWithService.close();

  console.log("chat-api: OK");
})().catch((error) => {
  console.error("chat-api:", error);
  process.exit(1);
});
