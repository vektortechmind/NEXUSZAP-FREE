"use strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-with-more-than-32-characters";
process.env.PORT = process.env.PORT || "0";

const assert = require("assert");
const { execSync } = require("child_process");
const Fastify = require("fastify");
const path = require("path");

const backendRoot = path.resolve(__dirname, "..");
execSync("npm run build", { cwd: backendRoot, stdio: "inherit" });

const { createScheduledDispatchRoutes } = require("../dist/routes/scheduled-dispatch.routes.js");
const {
  createInMemoryScheduledDispatchStore,
  createScheduledDispatchService,
} = require("../dist/services/scheduled-dispatch.service.js");

function createApp() {
  const store = createInMemoryScheduledDispatchStore({
    instances: [{ id: "instance-a" }, { id: "instance-b" }],
    groups: [
      {
        instanceId: "instance-a",
        jid: "120363000001@g.us",
        name: "Grupo Vendas",
        lastMessageAt: new Date("2026-06-16T10:00:00.000Z"),
        updatedAt: new Date("2026-06-16T10:30:00.000Z"),
      },
    ],
  });
  const service = createScheduledDispatchService({ store });
  const groupSyncService = {
    async syncGroups({ instanceId }) {
      return [
        {
          instanceId,
          jid: "120363000099@g.us",
          name: "Grupo Sincronizado",
          lastMessageAt: new Date("2026-06-16T12:00:00.000Z"),
        },
      ];
    },
  };
  const app = Fastify();
  app.register(createScheduledDispatchRoutes({ service, groupSyncService, preValidationHook: async () => {} }), { prefix: "/api/scheduled-dispatches" });
  return { app };
}

(async () => {
  const { app } = createApp();
  await app.ready();

  const listGroupsResponse = await app.inject({ method: "GET", url: "/api/scheduled-dispatches/groups?instanceId=instance-a" });
  assert.equal(listGroupsResponse.statusCode, 200, listGroupsResponse.body);
  const listedGroups = JSON.parse(listGroupsResponse.body).groups;
  assert.equal(listedGroups.length, 1);
  assert.equal(listedGroups[0].jid, "120363000001@g.us");

  const syncGroupsResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches/groups/sync",
    payload: { instanceId: "instance-b" },
  });
  assert.equal(syncGroupsResponse.statusCode, 200, syncGroupsResponse.body);
  const syncedPayload = JSON.parse(syncGroupsResponse.body);
  assert.equal(syncedPayload.synced, 1);
  assert.equal(syncedPayload.groups[0].jid, "120363000099@g.us");

  const createTextResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-a",
      targetType: "number",
      phone: "+55 (11) 99999-1234",
      contentType: "text",
      body: "Oferta liberada",
      buttons: [{ text: "Abrir oferta", url: "https://example.com/oferta" }],
      deliveryMode: "scheduled",
      scheduledAt: "2026-06-20T12:00:00.000Z",
    },
  });
  assert.equal(createTextResponse.statusCode, 201, createTextResponse.body);
  const createdText = JSON.parse(createTextResponse.body).dispatch;
  assert.equal(createdText.instanceId, "instance-a");
  assert.equal(createdText.targetType, "NUMBER");
  assert.equal(createdText.recipientPhone, "5511999991234");
  assert.equal(createdText.recipientJid, null);
  assert.equal(createdText.contentType, "TEXT");
  assert.equal(createdText.status, "SCHEDULED");
  assert.deepEqual(createdText.buttons, [{ text: "Abrir oferta", url: "https://example.com/oferta" }]);

  const createImageResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-a",
      targetType: "group",
      groupJid: "120363000001@G.US",
      contentType: "image",
      body: "Legenda da imagem",
      mediaUrl: "https://cdn.example.com/banner.png",
      deliveryMode: "scheduled",
      scheduledAt: "2026-06-21T15:30:00.000Z",
    },
  });
  assert.equal(createImageResponse.statusCode, 201, createImageResponse.body);
  const createdImage = JSON.parse(createImageResponse.body).dispatch;
  assert.equal(createdImage.targetType, "GROUP");
  assert.equal(createdImage.recipientJid, "120363000001@g.us");
  assert.equal(createdImage.contentType, "IMAGE");
  assert.equal(createdImage.mediaUrl, "https://cdn.example.com/banner.png");

  const immediateBefore = Date.now();
  const createVideoImmediateResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-a",
      targetType: "number",
      phone: "5511888887777",
      contentType: "video",
      body: "Legenda do video",
      mediaUrl: "https://cdn.example.com/video.mp4",
      deliveryMode: "immediate",
      scheduledAt: null,
    },
  });
  const immediateAfter = Date.now();
  assert.equal(createVideoImmediateResponse.statusCode, 201, createVideoImmediateResponse.body);
  const createdVideo = JSON.parse(createVideoImmediateResponse.body).dispatch;
  assert.equal(createdVideo.contentType, "VIDEO");
  assert.equal(createdVideo.mediaUrl, "https://cdn.example.com/video.mp4");
  const immediateTimestamp = new Date(createdVideo.scheduledAt).getTime();
  assert.equal(immediateTimestamp >= immediateBefore && immediateTimestamp <= immediateAfter + 2_000, true);

  const invalidMediaMissingResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-a",
      targetType: "group",
      groupJid: "120363000001@g.us",
      contentType: "image",
      body: "Sem midia",
      deliveryMode: "scheduled",
      scheduledAt: "2026-06-21T15:30:00.000Z",
    },
  });
  assert.equal(invalidMediaMissingResponse.statusCode, 400, invalidMediaMissingResponse.body);
  assert.equal(JSON.parse(invalidMediaMissingResponse.body).code, "SCHEDULED_DISPATCH_VALIDATION_ERROR");

  const invalidScheduleResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-a",
      targetType: "number",
      phone: "5511888881111",
      contentType: "text",
      body: "Sem data",
      deliveryMode: "scheduled",
      scheduledAt: null,
    },
  });
  assert.equal(invalidScheduleResponse.statusCode, 400, invalidScheduleResponse.body);

  const invalidButtonsLimitResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-a",
      targetType: "number",
      phone: "5511888881111",
      contentType: "text",
      body: "Campanha com botoes demais",
      buttons: [
        { text: "Botao 1", url: "https://example.com/1" },
        { text: "Botao 2", url: "https://example.com/2" },
        { text: "Botao 3", url: "https://example.com/3" },
        { text: "Botao 4", url: "https://example.com/4" },
      ],
      deliveryMode: "scheduled",
      scheduledAt: "2026-06-21T15:30:00.000Z",
    },
  });
  assert.equal(invalidButtonsLimitResponse.statusCode, 400, invalidButtonsLimitResponse.body);
  assert.equal(JSON.parse(invalidButtonsLimitResponse.body).code, "SCHEDULED_DISPATCH_CONTRACT_INVALID");

  const invalidButtonUrlResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-a",
      targetType: "number",
      phone: "5511888881111",
      contentType: "text",
      body: "Campanha com URL invalida",
      buttons: [{ text: "Abrir", url: "notaurl" }],
      deliveryMode: "scheduled",
      scheduledAt: "2026-06-21T15:30:00.000Z",
    },
  });
  assert.equal(invalidButtonUrlResponse.statusCode, 400, invalidButtonUrlResponse.body);

  const invalidRawInteractivePayloadResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-a",
      targetType: "number",
      phone: "5511888881111",
      contentType: "text",
      body: "Payload cru",
      deliveryMode: "scheduled",
      scheduledAt: "2026-06-21T15:30:00.000Z",
      interactiveMessage: { body: { text: "nao pode" } },
    },
  });
  assert.equal(invalidRawInteractivePayloadResponse.statusCode, 400, invalidRawInteractivePayloadResponse.body);
  assert.equal(JSON.parse(invalidRawInteractivePayloadResponse.body).code, "SCHEDULED_DISPATCH_CONTRACT_INVALID");

  const invalidVideoButtonsResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-a",
      targetType: "number",
      phone: "5511888881111",
      contentType: "video",
      body: "Video com clique",
      mediaUrl: "https://cdn.example.com/video.mp4",
      buttons: [{ text: "Abrir", url: "https://example.com/video" }],
      deliveryMode: "scheduled",
      scheduledAt: "2026-06-21T15:30:00.000Z",
    },
  });
  assert.equal(invalidVideoButtonsResponse.statusCode, 400, invalidVideoButtonsResponse.body);
  assert.equal(JSON.parse(invalidVideoButtonsResponse.body).code, "SCHEDULED_DISPATCH_VALIDATION_ERROR");

  const invalidGroupResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-a",
      targetType: "group",
      groupJid: "120363000555@g.us",
      contentType: "text",
      body: "Grupo nao sincronizado",
      deliveryMode: "scheduled",
      scheduledAt: "2026-06-21T15:30:00.000Z",
    },
  });
  assert.equal(invalidGroupResponse.statusCode, 422, invalidGroupResponse.body);
  assert.equal(JSON.parse(invalidGroupResponse.body).code, "SCHEDULED_DISPATCH_VALIDATION_ERROR");

  const invalidTextMediaResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-a",
      targetType: "number",
      phone: "5511888881111",
      contentType: "text",
      body: "Texto puro",
      mediaUrl: "https://cdn.example.com/nao-pode.png",
      deliveryMode: "scheduled",
      scheduledAt: "2026-06-21T15:30:00.000Z",
    },
  });
  assert.equal(invalidTextMediaResponse.statusCode, 400, invalidTextMediaResponse.body);

  const listAllResponse = await app.inject({ method: "GET", url: "/api/scheduled-dispatches" });
  assert.equal(listAllResponse.statusCode, 200, listAllResponse.body);
  const allDispatches = JSON.parse(listAllResponse.body).dispatches;
  assert.equal(allDispatches.length, 3);

  const detailResponse = await app.inject({ method: "GET", url: `/api/scheduled-dispatches/${createdImage.id}` });
  assert.equal(detailResponse.statusCode, 200, detailResponse.body);
  assert.equal(JSON.parse(detailResponse.body).dispatch.id, createdImage.id);

  await app.close();
  console.log("scheduled-dispatch-api: OK");
})().catch((error) => {
  console.error("scheduled-dispatch-api:", error);
  process.exit(1);
});
