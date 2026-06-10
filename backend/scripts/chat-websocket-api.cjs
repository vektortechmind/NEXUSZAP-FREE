"use strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-with-more-than-32-characters";
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "local-test-password";
process.env.PORT = process.env.PORT || "0";
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || Buffer.alloc(32, 12).toString("base64");

require("ts-node/register");

const assert = require("assert");
const Fastify = require("fastify");
const jwt = require("@fastify/jwt");
const { io: createClient } = require("socket.io-client");
const { WAMessageStatus } = require("@whiskeysockets/baileys");
const { createChatSocketServer, CHAT_SOCKET_PATH, CHAT_SOCKET_NAMESPACE } = require("../src/services/chat.websocket.ts");
const { createChatService, createInMemoryChatStore } = require("../src/services/chat.service.ts");
const { chatRealtime } = require("../src/services/chat.realtime.ts");

function createBaileysMock(providerMessageId = "wamid.sent.ws") {
  return {
    async sendTextMessage() {
      return { providerMessageId, raw: null };
    },
    async sendMediaMessage() {
      return { providerMessageId: "wamid.media.ws", raw: null };
    },
    async sendReaction() {},
    async editMessage() {},
    async deleteMessage() {},
    async markRead() {},
  };
}

function waitFor(socket, event, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`timeout waiting for ${event}`));
    }, timeoutMs);
    function onEvent(payload) {
      clearTimeout(timer);
      resolve(payload);
    }
    socket.once(event, onEvent);
  });
}

function waitForNoEvent(socket, event, timeoutMs = 250) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      resolve();
    }, timeoutMs);
    function onEvent(payload) {
      clearTimeout(timer);
      reject(new Error(`unexpected ${event}: ${JSON.stringify(payload)}`));
    }
    socket.once(event, onEvent);
  });
}

function connectClient(baseUrl, token) {
  return createClient(`${baseUrl}${CHAT_SOCKET_NAMESPACE}`, {
    path: CHAT_SOCKET_PATH,
    auth: { token },
    transports: ["websocket"],
    reconnection: false,
    timeout: 1000,
    forceNew: true,
  });
}

function connectClientWithCookie(baseUrl, token) {
  return createClient(`${baseUrl}${CHAT_SOCKET_NAMESPACE}`, {
    path: CHAT_SOCKET_PATH,
    extraHeaders: { cookie: `token=${encodeURIComponent(token)}` },
    transports: ["websocket"],
    reconnection: false,
    timeout: 1000,
    forceNew: true,
  });
}

async function createHarness() {
  const app = Fastify({ logger: false });
  await app.register(jwt, { secret: process.env.JWT_SECRET });
  const socketServer = createChatSocketServer(app, {
    instanceResolver: async (payload) => Array.isArray(payload.instances) ? payload.instances : [],
  });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  assert.ok(address && typeof address === "object");
  return {
    app,
    socketServer,
    baseUrl: `http://127.0.0.1:${address.port}`,
    tokenFor(instances) {
      return app.jwt.sign({ email: "admin@example.com", role: "admin", instances });
    },
    tokenForPayload(payload) {
      return app.jwt.sign(payload);
    },
    async close() {
      chatRealtime.setEmitter(null);
      socketServer.close();
      await app.close();
    },
  };
}

(async () => {
  const harness = await createHarness();
  assert.equal(harness.socketServer.opts.connectionStateRecovery.maxDisconnectionDuration, 120000);
  assert.equal(harness.socketServer.opts.connectionStateRecovery.skipMiddlewares, false);
  const store = createInMemoryChatStore({ instances: [{ id: "instance-a" }, { id: "instance-b" }] });
  const service = createChatService({
    store,
    baileys: createBaileysMock(),
    eventRecorder: async () => {},
  });

  const invalidSocket = connectClient(harness.baseUrl, "invalid-token");
  const invalidError = await waitFor(invalidSocket, "connect_error");
  assert.match(invalidError.message, /Invalid token|Unauthorized/);
  invalidSocket.close();

  const noInstanceSocket = connectClient(harness.baseUrl, harness.tokenForPayload({ email: "user@example.com", role: "operator" }));
  const noInstanceError = await waitFor(noInstanceSocket, "connect_error");
  assert.match(noInstanceError.message, /No instances available/);
  noInstanceSocket.close();

  const socketA = connectClient(harness.baseUrl, harness.tokenFor(["instance-a"]));
  const socketB = connectClient(harness.baseUrl, harness.tokenFor(["instance-b"]));
  await Promise.all([waitFor(socketA, "connect"), waitFor(socketB, "connect")]);

  const cookieSocket = connectClientWithCookie(harness.baseUrl, harness.tokenFor(["instance-a"]));
  await waitFor(cookieSocket, "connect");
  cookieSocket.close();

  const messageNewPromise = waitFor(socketA, "message:new");
  const conversationUpdatePromise = waitFor(socketA, "conversation:update");
  const blockedPromise = waitForNoEvent(socketB, "message:new");
  await service.persistInboundMessage({
    instanceId: "instance-a",
    jid: "5511999990000@s.whatsapp.net",
    body: "Oi realtime",
    messageType: "TEXT",
    providerMessageId: "wamid.ws.in.1",
    createdAt: new Date("2026-06-09T11:00:00.000Z"),
  });
  const messageNew = await messageNewPromise;
  assert.equal(messageNew.body, "Oi realtime");
  assert.equal(messageNew.fromMe, false);
  assert.equal(messageNew.messageType, "TEXT");
  assert.equal(store.messages.has(messageNew.id), true, "mensagem deve existir no store antes da emissao observada");
  const conversationUpdate = await conversationUpdatePromise;
  assert.equal(conversationUpdate.lastMessage.body, "Oi realtime");
  assert.equal(conversationUpdate.unreadCount, 1);
  await blockedPromise;

  const sentPromise = waitFor(socketA, "message:sent");
  await service.sendTextMessage({ instanceId: "instance-a", jid: "5511999990000@s.whatsapp.net", body: "Resposta realtime" });
  const sent = await sentPromise;
  assert.equal(sent.fromMe, true);
  assert.equal(sent.providerMessageId, "wamid.sent.ws");

  const statusPromise = waitFor(socketA, "message:status");
  await service.recordBaileysMessageUpdate("instance-a", {
    key: { id: "wamid.sent.ws", remoteJid: "5511999990000@s.whatsapp.net", fromMe: true },
    update: { status: WAMessageStatus.DELIVERY_ACK },
  });
  const status = await statusPromise;
  assert.equal(status.providerMessageId, "wamid.sent.ws");
  assert.equal(status.status, "DELIVERED");
  assert.equal(status.jid, "5511999990000@s.whatsapp.net");

  const presencePromise = waitFor(socketA, "presence:update");
  service.emitPresenceUpdate({ instanceId: "instance-a", jid: "5511999990000@s.whatsapp.net", isTyping: true });
  const presence = await presencePromise;
  assert.deepEqual(presence, { instanceId: "instance-a", jid: "5511999990000@s.whatsapp.net", isTyping: true });

  socketA.close();
  socketB.close();
  await harness.close();

  console.log("chat-websocket-api: OK");
})().catch((error) => {
  console.error("chat-websocket-api:", error);
  process.exit(1);
});
