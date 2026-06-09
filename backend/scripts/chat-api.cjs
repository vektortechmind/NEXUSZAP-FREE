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
const Fastify = require("fastify");
const { createChatRoutes } = require("../src/routes/chat.routes.ts");
const {
  createChatService,
  createInMemoryChatStore,
} = require("../src/services/chat.service.ts");
const { ChatProviderSendError } = require("../src/services/chat.baileys.ts");

function createBaileysMock(options = {}) {
  const sent = [];
  const profileRequests = [];
  return {
    sent,
    profileRequests,
    async sendTextMessage(input) {
      sent.push(input);
      if (options.failSend) throw new ChatProviderSendError("provider unavailable");
      return { providerMessageId: options.providerMessageId || "wamid.sent.1", raw: null };
    },
    async getContactProfile(input) {
      profileRequests.push(input);
      return { name: `Contato ${input.jid.slice(0, 4)}`, profilePicUrl: `https://img.example.com/${encodeURIComponent(input.jid)}.jpg` };
    },
  };
}

function createApp({ store, baileys, events }) {
  const app = Fastify();
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
  assert.equal(baileys.profileRequests.length, 0, "mensagem recebida nao deve aguardar consulta de perfil para aparecer no chat");

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
