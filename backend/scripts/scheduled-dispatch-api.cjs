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
const { createScheduledDispatchTemplateRoutes } = require("../dist/routes/scheduled-dispatch-template.routes.js");
const {
  createInMemoryScheduledDispatchStore,
  createScheduledDispatchService,
} = require("../dist/services/scheduled-dispatch.service.js");
const {
  createInMemoryScheduledDispatchTemplateStore,
  createScheduledDispatchTemplateService,
} = require("../dist/services/scheduled-dispatch-template.service.js");

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

function createApp(options = {}) {
  const store = createInMemoryScheduledDispatchStore({
    instances: [{ id: "instance-a" }, { id: "instance-b" }, { id: "instance-offline", status: "DISCONNECTED" }],
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
  const service = createScheduledDispatchService({ store, randomInt: options.randomInt });
  const templateStore = createInMemoryScheduledDispatchTemplateStore();
  const templateService = createScheduledDispatchTemplateService({ store: templateStore });
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
  app.register(createScheduledDispatchTemplateRoutes({ service: templateService, preValidationHook: async () => {} }), { prefix: "/api/scheduled-dispatch-templates" });
  app.register(createScheduledDispatchRoutes({ service, groupSyncService, preValidationHook: async () => {} }), { prefix: "/api/scheduled-dispatches" });
  return { app, store };
}

(async () => {
  const randomDelays = [84, 89, 81, 87];
  const { app, store } = createApp({
    randomInt(min, max) {
      if (min === max) return min;
      const next = randomDelays.shift();
      assert.equal(typeof next, "number", "random delay sequence exhausted");
      return next;
    },
  });
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

  const templateUpload = multipartBody(
    { contentType: "image" },
    { filename: "template-banner.png", contentType: "image/png", buffer: Buffer.from("fake-template-image") },
  );
  const templateUploadResponse = await app.inject({ method: "POST", url: "/api/scheduled-dispatch-templates/media", payload: templateUpload.payload, headers: templateUpload.headers });
  assert.equal(templateUploadResponse.statusCode, 201, templateUploadResponse.body);
  const uploadedTemplateMedia = JSON.parse(templateUploadResponse.body);
  assert.match(uploadedTemplateMedia.mediaUrl, /\/api\/scheduled-dispatch-templates\/media\//);

  const createTemplateResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatch-templates",
    payload: {
      name: "Oferta Global",
      contentType: "image",
      body: "Legenda global",
      mediaUrl: uploadedTemplateMedia.mediaUrl,
      mediaFileName: uploadedTemplateMedia.fileName,
      buttons: [{ text: "Abrir oferta", url: "https://example.com/global" }],
    },
  });
  assert.equal(createTemplateResponse.statusCode, 201, createTemplateResponse.body);
  const createdTemplate = JSON.parse(createTemplateResponse.body).template;
  assert.equal(createdTemplate.name, "Oferta Global");
  assert.equal(createdTemplate.contentType, "IMAGE");
  assert.deepEqual(createdTemplate.buttons, [{ text: "Abrir oferta", url: "https://example.com/global" }]);

  const listTemplatesResponse = await app.inject({ method: "GET", url: "/api/scheduled-dispatch-templates" });
  assert.equal(listTemplatesResponse.statusCode, 200, listTemplatesResponse.body);
  assert.equal(JSON.parse(listTemplatesResponse.body).templates.length, 1);

  const updateTemplateResponse = await app.inject({
    method: "PATCH",
    url: `/api/scheduled-dispatch-templates/${createdTemplate.id}`,
    payload: {
      name: "Oferta Global Atualizada",
      contentType: "text",
      body: "Texto global",
      mediaUrl: null,
      buttons: [{ text: "Abrir", url: "https://example.com/texto" }],
    },
  });
  assert.equal(updateTemplateResponse.statusCode, 200, updateTemplateResponse.body);
  assert.equal(JSON.parse(updateTemplateResponse.body).template.contentType, "TEXT");

  const invalidTemplateMediaResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatch-templates",
    payload: {
      name: "Midia errada",
      contentType: "image",
      body: "Nao deve aceitar",
      mediaUrl: uploadedMedia.mediaUrl,
    },
  });
  assert.equal(invalidTemplateMediaResponse.statusCode, 400, invalidTemplateMediaResponse.body);

  const invalidTemplateTextResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatch-templates",
    payload: {
      name: "Texto com midia",
      contentType: "text",
      body: "Nao deve aceitar midia",
      mediaUrl: uploadedTemplateMedia.mediaUrl,
    },
  });
  assert.equal(invalidTemplateTextResponse.statusCode, 400, invalidTemplateTextResponse.body);

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

  const disconnectedInstanceResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-offline",
      targetType: "number",
      phones: ["5511999991111"],
      contentType: "text",
      body: "Nao deve criar em instancia offline",
      deliveryMode: "scheduled",
      scheduledAt: "2026-06-20T12:00:00.000Z",
    },
  });
  assert.equal(disconnectedInstanceResponse.statusCode, 409, disconnectedInstanceResponse.body);
  assert.equal(JSON.parse(disconnectedInstanceResponse.body).code, "SCHEDULED_DISPATCH_INSTANCE_NOT_CONNECTED");

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

  const createRandomDelayNumbersResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-a",
      targetType: "number",
      phones: ["551100000101", "551100000102", "551100000103", "551100000104", "551100000105"],
      contentType: "text",
      body: "Campanha com delay aleatorio",
      deliveryMode: "scheduled",
      scheduledAt: "2026-06-20T14:00:00.000Z",
      numberDelayMinSeconds: 80,
      numberDelayMaxSeconds: 90,
      pauseEveryCount: 2,
      pauseDurationSeconds: 60,
    },
  });
  assert.equal(createRandomDelayNumbersResponse.statusCode, 201, createRandomDelayNumbersResponse.body);
  const randomDelayNumbers = JSON.parse(createRandomDelayNumbersResponse.body).dispatches;
  assert.deepEqual(randomDelayNumbers.map((dispatch) => dispatch.scheduledAt), [
    "2026-06-20T14:00:00.000Z",
    "2026-06-20T14:01:24.000Z",
    "2026-06-20T14:03:53.000Z",
    "2026-06-20T14:05:14.000Z",
    "2026-06-20T14:07:41.000Z",
  ]);
  assert.equal(randomDelayNumbers[0].campaign.delaySeconds, 80);

  const createInvalidDelayRangeResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-a",
      targetType: "number",
      phones: ["551100000201", "551100000202"],
      contentType: "text",
      body: "Faixa invalida",
      deliveryMode: "scheduled",
      scheduledAt: "2026-06-20T15:00:00.000Z",
      numberDelayMinSeconds: 90,
      numberDelayMaxSeconds: 80,
    },
  });
  assert.equal(createInvalidDelayRangeResponse.statusCode, 400, createInvalidDelayRangeResponse.body);
  assert.equal(JSON.parse(createInvalidDelayRangeResponse.body).code, "SCHEDULED_DISPATCH_VALIDATION_ERROR");

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

  const createTemplateMediaDispatchResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-b",
      targetType: "number",
      phones: ["5511777770000"],
      contentType: "image",
      body: "Snapshot de template global",
      mediaUrl: uploadedTemplateMedia.mediaUrl,
      buttons: [{ text: "Abrir", url: "https://example.com/global" }],
      deliveryMode: "scheduled",
      scheduledAt: "2026-06-21T16:30:00.000Z",
    },
  });
  assert.equal(createTemplateMediaDispatchResponse.statusCode, 201, createTemplateMediaDispatchResponse.body);
  const templateMediaDispatch = JSON.parse(createTemplateMediaDispatchResponse.body).dispatches[0];
  assert.equal(templateMediaDispatch.instanceId, "instance-b");
  assert.equal(templateMediaDispatch.mediaUrl, uploadedTemplateMedia.mediaUrl);

  const deleteTemplateResponse = await app.inject({ method: "DELETE", url: `/api/scheduled-dispatch-templates/${createdTemplate.id}` });
  assert.equal(deleteTemplateResponse.statusCode, 200, deleteTemplateResponse.body);
  const detailAfterTemplateDelete = await app.inject({ method: "GET", url: `/api/scheduled-dispatches/${templateMediaDispatch.id}` });
  assert.equal(detailAfterTemplateDelete.statusCode, 200, detailAfterTemplateDelete.body);
  assert.equal(JSON.parse(detailAfterTemplateDelete.body).dispatch.mediaUrl, uploadedTemplateMedia.mediaUrl);

  const detailResponse = await app.inject({ method: "GET", url: `/api/scheduled-dispatches/${createdImage[1].id}` });
  assert.equal(detailResponse.statusCode, 200, detailResponse.body);
  assert.equal(JSON.parse(detailResponse.body).dispatch.id, createdImage[1].id);

  const cancelResponse = await app.inject({ method: "POST", url: `/api/scheduled-dispatches/${createdImage[0].id}/cancel` });
  assert.equal(cancelResponse.statusCode, 200, cancelResponse.body);
  assert.equal(JSON.parse(cancelResponse.body).dispatch.campaignId, createdImage[0].campaignId);

  const clearHistoryResponse = await app.inject({ method: "DELETE", url: "/api/scheduled-dispatches/history?instanceId=instance-a" });
  assert.equal(clearHistoryResponse.statusCode, 200, clearHistoryResponse.body);
  assert.equal(JSON.parse(clearHistoryResponse.body).deleted, 1);

  const createCampaignToCancelResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-a",
      targetType: "number",
      phones: ["551100000011", "551100000012", "551100000013", "551100000014", "551100000015"],
      contentType: "text",
      body: "Campanha para cancelar",
      deliveryMode: "scheduled",
      scheduledAt: "2026-06-22T10:00:00.000Z",
    },
  });
  assert.equal(createCampaignToCancelResponse.statusCode, 201, createCampaignToCancelResponse.body);
  const campaignToCancel = JSON.parse(createCampaignToCancelResponse.body).dispatches;
  const [sentJob, failedJob, processingJob, alreadyCancelledJob, scheduledJob] = campaignToCancel.map((dispatch) => store.dispatches.get(dispatch.id));
  store.dispatches.set(sentJob.id, { ...sentJob, status: "SENT", processedAt: new Date("2026-06-22T10:01:00.000Z") });
  store.dispatches.set(failedJob.id, { ...failedJob, status: "FAILED", failureCode: "PROVIDER_ERROR", providerError: "Falha externa", processedAt: new Date("2026-06-22T10:02:00.000Z") });
  store.dispatches.set(processingJob.id, { ...processingJob, status: "PROCESSING" });
  store.dispatches.set(alreadyCancelledJob.id, { ...alreadyCancelledJob, status: "CANCELLED", processedAt: new Date("2026-06-22T10:03:00.000Z") });

  const cancelCampaignResponse = await app.inject({ method: "POST", url: `/api/scheduled-dispatches/campaigns/${campaignToCancel[0].campaignId}/cancel` });
  assert.equal(cancelCampaignResponse.statusCode, 200, cancelCampaignResponse.body);
  const cancelCampaignSummary = JSON.parse(cancelCampaignResponse.body);
  assert.deepEqual(cancelCampaignSummary, {
    campaignId: campaignToCancel[0].campaignId,
    cancelledCount: 1,
    scheduledRemainingCount: 0,
    processingCount: 1,
    sentCount: 1,
    failedCount: 1,
    alreadyCancelledCount: 1,
  });
  assert.equal(store.dispatches.get(sentJob.id).status, "SENT");
  assert.equal(store.dispatches.get(failedJob.id).status, "FAILED");
  assert.equal(store.dispatches.get(processingJob.id).status, "PROCESSING");
  assert.equal(store.dispatches.get(alreadyCancelledJob.id).status, "CANCELLED");
  assert.equal(store.dispatches.get(scheduledJob.id).status, "CANCELLED");
  assert.equal(store.dispatches.get(scheduledJob.id).failureCode, "CAMPAIGN_CANCELLED");
  assert.equal(store.dispatches.get(scheduledJob.id).providerError, "Campanha cancelada pelo operador.");

  const missingCampaignCancelResponse = await app.inject({ method: "POST", url: "/api/scheduled-dispatches/campaigns/missing-campaign/cancel" });
  assert.equal(missingCampaignCancelResponse.statusCode, 404, missingCampaignCancelResponse.body);
  assert.equal(JSON.parse(missingCampaignCancelResponse.body).code, "SCHEDULED_DISPATCH_CAMPAIGN_NOT_FOUND");

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
  assert.equal(allDispatches.length, 21);

  await app.close();
  console.log("scheduled-dispatch-api: OK");
})().catch((error) => {
  console.error("scheduled-dispatch-api:", error);
  process.exit(1);
});
