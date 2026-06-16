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
  return { app, store };
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

  const createNumberResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-a",
      targetType: "number",
      phone: "+55 (11) 99999-1234",
      contentType: "text",
      body: "Oferta liberada",
      scheduledAt: "2026-06-20T12:00:00.000Z",
    },
  });
  assert.equal(createNumberResponse.statusCode, 201, createNumberResponse.body);
  const createdNumber = JSON.parse(createNumberResponse.body).dispatch;
  assert.equal(createdNumber.instanceId, "instance-a");
  assert.equal(createdNumber.targetType, "NUMBER");
  assert.equal(createdNumber.recipientPhone, "5511999991234");
  assert.equal(createdNumber.recipientJid, null);
  assert.equal(createdNumber.contentType, "TEXT");
  assert.equal(createdNumber.status, "SCHEDULED");

  const createGroupResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-a",
      targetType: "group",
      groupJid: "120363000001@G.US",
      contentType: "text",
      body: "Legenda do disparo",
      scheduledAt: "2026-06-21T15:30:00.000Z",
    },
  });
  assert.equal(createGroupResponse.statusCode, 201, createGroupResponse.body);
  const createdGroup = JSON.parse(createGroupResponse.body).dispatch;
  assert.equal(createdGroup.targetType, "GROUP");
  assert.equal(createdGroup.recipientPhone, null);
  assert.equal(createdGroup.recipientJid, "120363000001@g.us");
  assert.equal(createdGroup.contentType, "TEXT");

  const invalidGroupResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-a",
      targetType: "group",
      groupJid: "120363000555@g.us",
      contentType: "text",
      body: "Grupo nao sincronizado",
      scheduledAt: "2026-06-21T15:30:00.000Z",
    },
  });
  assert.equal(invalidGroupResponse.statusCode, 422, invalidGroupResponse.body);
  assert.equal(JSON.parse(invalidGroupResponse.body).code, "SCHEDULED_DISPATCH_VALIDATION_ERROR");

  const invalidTargetResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-a",
      targetType: "number",
      contentType: "text",
      body: "Sem telefone",
      scheduledAt: "2026-06-20T12:00:00.000Z",
    },
  });
  assert.equal(invalidTargetResponse.statusCode, 400, invalidTargetResponse.body);
  assert.equal(JSON.parse(invalidTargetResponse.body).code, "SCHEDULED_DISPATCH_VALIDATION_ERROR");

  const invalidDateResponse = await app.inject({
    method: "POST",
    url: "/api/scheduled-dispatches",
    payload: {
      instanceId: "instance-a",
      targetType: "group",
      groupJid: "120363000001@g.us",
      contentType: "video",
      mediaUrl: "https://cdn.example.com/video.mp4",
      scheduledAt: "not-a-date",
    },
  });
  assert.equal(invalidDateResponse.statusCode, 400, invalidDateResponse.body);

  const listAllResponse = await app.inject({ method: "GET", url: "/api/scheduled-dispatches" });
  assert.equal(listAllResponse.statusCode, 200, listAllResponse.body);
  const allDispatches = JSON.parse(listAllResponse.body).dispatches;
  assert.equal(allDispatches.length, 2);

  const listFilteredResponse = await app.inject({ method: "GET", url: "/api/scheduled-dispatches?instanceId=instance-a" });
  assert.equal(listFilteredResponse.statusCode, 200, listFilteredResponse.body);
  const filteredDispatches = JSON.parse(listFilteredResponse.body).dispatches;
  assert.equal(filteredDispatches.length, 2);

  const detailResponse = await app.inject({ method: "GET", url: `/api/scheduled-dispatches/${createdGroup.id}` });
  assert.equal(detailResponse.statusCode, 200, detailResponse.body);
  assert.equal(JSON.parse(detailResponse.body).dispatch.id, createdGroup.id);

  const notFoundResponse = await app.inject({ method: "GET", url: "/api/scheduled-dispatches/missing-id" });
  assert.equal(notFoundResponse.statusCode, 404, notFoundResponse.body);

  await app.close();
  console.log("scheduled-dispatch-api: OK");
})().catch((error) => {
  console.error("scheduled-dispatch-api:", error);
  process.exit(1);
});
