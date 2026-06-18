"use strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-with-more-than-32-characters";
process.env.PORT = process.env.PORT || "0";

const assert = require("assert");
const { execSync } = require("child_process");
const Fastify = require("fastify");
const multipart = require("@fastify/multipart");
const path = require("path");

const backendRoot = path.resolve(__dirname, "..");
execSync("npm run build", { cwd: backendRoot, stdio: "inherit" });

const { createScheduledDispatchRoutes } = require("../dist/routes/scheduled-dispatch.routes.js");
const {
  createInMemoryScheduledDispatchStore,
  createScheduledDispatchService,
} = require("../dist/services/scheduled-dispatch.service.js");

function multipartBody(fields, file) {
  const boundary = `----codex-${Date.now().toString(16)}`;
  const parts = [];
  for (const [key, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
  }
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`));
  parts.push(file.buffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(parts),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

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
      {
        instanceId: "instance-a",
        jid: "120363000002@g.us",
        name: "Grupo Financeiro",
        lastMessageAt: new Date("2026-06-16T11:00:00.000Z"),
        updatedAt: new Date("2026-06-16T11:20:00.000Z"),
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
  app.register(multipart, { limits: { fileSize: 60 * 1024 * 1024 } });
  app.register(createScheduledDispatchRoutes({ service, groupSyncService, preValidationHook: async () => {} }), { prefix: "/api/scheduled-dispatches" });
  return { app };
}

(async () => {
  const { app } = createApp();
  await app.ready();

  const listGroupsResponse = await app.inject({ method: "GET", url: "/api/scheduled-dispatches/groups?instanceId=instance-a" });
  assert.equal(listGroupsResponse.statusCode, 200, listGroupsResponse.body);
  const listedGroups = JSON.parse(listGroupsResponse.body).groups;
  assert.equal(listedGroups.length, 2);

  const upload = multipartBody(
    { instanceId: "instance-a", contentType: "image" },
    { filename: "banner.png", contentType: "image/png", buffer: Buffer.from("fake-image") },
  );
  const uploadResponse = await app.inject({ method: "POST", url: "/api/scheduled-dispatches/media", payload: upload.payload, headers: upload.headers });
  assert.equal(uploadResponse.statusCode, 201, uploadResponse.body);
  const uploadedMedia = JSON.parse(uploadResponse.body);
  assert.match(uploadedMedia.mediaUrl, /\/api\/scheduled-dispatches\/media\/instance-a\//);

  const createTextResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-a",
      targetType: "number",
      phones: ["11999991234", "1188887777", "1198765432"],
      contentType: "text",
      body: "Oferta liberada",
      buttons: [{ text: "Abrir oferta", url: "https://example.com/oferta" }],
      deliveryMode: "scheduled",
      scheduledAt: "2026-06-20T12:00:00.000Z",
      numberDelaySeconds: 45,
    },
  });
  assert.equal(createTextResponse.statusCode, 201, createTextResponse.body);
  const createdText = JSON.parse(createTextResponse.body).dispatches;
  assert.equal(createdText.length, 3);
  assert.equal(createdText[0].targetType, "NUMBER");
  assert.deepEqual(createdText.map((dispatch) => dispatch.recipientPhone), ["5511999991234", "551188887777", "551198765432"]);
  assert.equal(createdText[0].scheduledAt, "2026-06-20T12:00:00.000Z");
  assert.equal(createdText[1].scheduledAt, "2026-06-20T12:00:45.000Z");
  assert.equal(createdText[2].scheduledAt, "2026-06-20T12:01:30.000Z");
  assert.ok(createdText[0].campaignId, "jobs em massa devem receber campaignId");
  assert.equal(createdText[0].campaignId, createdText[1].campaignId);
  assert.equal(createdText[0].campaign.totalDestinations, 3);
  assert.equal(createdText[0].campaign.pauseEveryCount, 0);

  const createPausedNumbersResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-a",
      targetType: "number",
      phones: ["551100000001", "551100000002", "551100000003", "551100000004", "551100000005"],
      contentType: "text",
      body: "Campanha com pausa",
      deliveryMode: "scheduled",
      scheduledAt: "2026-06-20T13:00:00.000Z",
      numberDelaySeconds: 10,
      pauseEveryCount: 2,
      pauseDurationSeconds: 60,
    },
  });
  assert.equal(createPausedNumbersResponse.statusCode, 201, createPausedNumbersResponse.body);
  const pausedNumbers = JSON.parse(createPausedNumbersResponse.body).dispatches;
  assert.deepEqual(pausedNumbers.map((dispatch) => dispatch.scheduledAt), [
    "2026-06-20T13:00:00.000Z",
    "2026-06-20T13:00:10.000Z",
    "2026-06-20T13:01:20.000Z",
    "2026-06-20T13:01:30.000Z",
    "2026-06-20T13:02:40.000Z",
  ]);
  assert.equal(pausedNumbers[0].campaignId, pausedNumbers[4].campaignId);
  assert.equal(pausedNumbers[0].campaign.pauseEveryCount, 2);
  assert.equal(pausedNumbers[0].campaign.pauseDurationSeconds, 60);

  const createImageResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-a",
      targetType: "group",
      groupJids: ["120363000001@g.us", "120363000002@g.us"],
      contentType: "image",
      body: "Legenda da imagem",
      mediaUrl: uploadedMedia.mediaUrl,
      deliveryMode: "scheduled",
      scheduledAt: "2026-06-21T15:30:00.000Z",
      groupDelaySeconds: 30,
      pauseEveryCount: 1,
      pauseDurationSeconds: 120,
    },
  });
  assert.equal(createImageResponse.statusCode, 201, createImageResponse.body);
  const createdImage = JSON.parse(createImageResponse.body).dispatches;
  assert.equal(createdImage.length, 2);
  assert.equal(createdImage[0].targetType, "GROUP");
  assert.equal(createdImage[0].contentType, "IMAGE");
  assert.equal(createdImage[0].mediaUrl, uploadedMedia.mediaUrl);
  assert.equal(createdImage[0].scheduledAt, "2026-06-21T15:30:00.000Z");
  assert.equal(createdImage[1].scheduledAt, "2026-06-21T15:32:30.000Z");
  assert.equal(createdImage[0].campaignId, createdImage[1].campaignId);

  const detailResponse = await app.inject({ method: "GET", url: `/api/scheduled-dispatches/${createdImage[1].id}` });
  assert.equal(detailResponse.statusCode, 200, detailResponse.body);
  assert.equal(JSON.parse(detailResponse.body).dispatch.id, createdImage[1].id);

  const cancelResponse = await app.inject({ method: "POST", url: `/api/scheduled-dispatches/${createdImage[0].id}/cancel` });
  assert.equal(cancelResponse.statusCode, 200, cancelResponse.body);
  assert.equal(JSON.parse(cancelResponse.body).dispatch.campaignId, createdImage[0].campaignId);

  const clearHistoryResponse = await app.inject({ method: "DELETE", url: "/api/scheduled-dispatches/history?instanceId=instance-a" });
  assert.equal(clearHistoryResponse.statusCode, 200, clearHistoryResponse.body);
  assert.equal(JSON.parse(clearHistoryResponse.body).deleted, 1);

  const invalidMediaMissingResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-a",
      targetType: "group",
      groupJids: ["120363000001@g.us"],
      contentType: "image",
      body: "Sem midia",
      deliveryMode: "scheduled",
      scheduledAt: "2026-06-21T15:30:00.000Z",
    },
  });
  assert.equal(invalidMediaMissingResponse.statusCode, 400, invalidMediaMissingResponse.body);

  const invalidTargetsResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-a",
      targetType: "number",
      phones: [],
      contentType: "text",
      body: "Sem destino",
      deliveryMode: "scheduled",
      scheduledAt: "2026-06-21T15:30:00.000Z",
    },
  });
  assert.equal(invalidTargetsResponse.statusCode, 400, invalidTargetsResponse.body);
  assert.equal(JSON.parse(invalidTargetsResponse.body).code, "SCHEDULED_DISPATCH_CONTRACT_INVALID");

  const invalidPauseResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-a",
      targetType: "number",
      phones: ["5511888882222"],
      contentType: "text",
      body: "Pausa invalida",
      deliveryMode: "scheduled",
      scheduledAt: "2026-06-21T15:30:00.000Z",
      pauseEveryCount: 10001,
      pauseDurationSeconds: 1,
    },
  });
  assert.equal(invalidPauseResponse.statusCode, 400, invalidPauseResponse.body);

  const videoButtonsResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-a",
      targetType: "number",
      phones: ["5511888881111"],
      contentType: "video",
      body: "Video com clique",
      mediaUrl: "/api/scheduled-dispatches/media/instance-a/media-9/video.mp4",
      buttons: [{ text: "Abrir", url: "https://example.com/video" }],
      deliveryMode: "scheduled",
      scheduledAt: "2026-06-21T15:30:00.000Z",
    },
  });
  assert.equal(videoButtonsResponse.statusCode, 201, videoButtonsResponse.body);
  assert.equal(JSON.parse(videoButtonsResponse.body).dispatches[0].contentType, "VIDEO");

  const listAllResponse = await app.inject({ method: "GET", url: "/api/scheduled-dispatches" });
  assert.equal(listAllResponse.statusCode, 200, listAllResponse.body);
  const allDispatches = JSON.parse(listAllResponse.body).dispatches;
  assert.equal(allDispatches.length, 10);

  await app.close();
  console.log("scheduled-dispatch-api: OK");
})().catch((error) => {
  console.error("scheduled-dispatch-api:", error);
  process.exit(1);
});
