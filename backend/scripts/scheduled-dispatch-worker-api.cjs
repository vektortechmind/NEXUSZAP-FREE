"use strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-with-more-than-32-characters";
process.env.PORT = process.env.PORT || "0";

const assert = require("assert");
const { execSync } = require("child_process");
const path = require("path");

const backendRoot = path.resolve(__dirname, "..");
execSync("npm run build", { cwd: backendRoot, stdio: "inherit" });

const { ChatProviderSendError } = require("../dist/services/chat.baileys.js");
const {
  createInMemoryScheduledDispatchStore,
  createScheduledDispatchService,
} = require("../dist/services/scheduled-dispatch.service.js");
const { createScheduledDispatchWorker } = require("../dist/services/scheduled-dispatch.worker.js");

(async () => {
  const store = createInMemoryScheduledDispatchStore({
    instances: [{ id: "instance-a" }],
    groups: [{ instanceId: "instance-a", jid: "120363000001@g.us", name: "Grupo Worker" }],
  });
  const service = createScheduledDispatchService({ store });

  let textSendCount = 0;
  let relayCount = 0;
  let mediaSendCount = 0;
  const sentJids = [];
  const interactiveBodies = [];
  const interactiveHeaders = [];

  const worker = createScheduledDispatchWorker({
    service,
    chat: {
      async sendTextMessage(input) {
        if (input.body === "Falha no provider") {
          throw new ChatProviderSendError("provider blew up");
        }
        textSendCount += 1;
        sentJids.push(input.jid);
        return { providerMessageId: `text-${textSendCount}` };
      },
      async sendMediaMessage(input) {
        mediaSendCount += 1;
        sentJids.push(input.jid);
        return { providerMessageId: `media-${mediaSendCount}` };
      },
    },
    socketLookup() {
      return {
        async relayMessage(jid, message) {
          relayCount += 1;
          sentJids.push(jid);
          interactiveBodies.push(message?.interactiveMessage?.body?.text || null);
          interactiveHeaders.push(message?.interactiveMessage?.header || null);
          return `interactive-${relayCount}`;
        },
        async sendMessage() {
          return { key: { id: `fallback-${relayCount}` } };
        },
        async waUploadToServer() {
          return {
            mediaUrl: "https://mmg.example.com/dispatch-media.enc",
            directPath: "/v/t62.7118/dispatch-media.enc",
          };
        },
      };
    },
    mediaDownloader: async (url) => ({
      buffer: Buffer.from(url),
      mimeType: "image/png",
    }),
    batchSize: 10,
  });

  const plainText = await service.createDispatch({
    instanceId: "instance-a",
    targetType: "number",
    phone: "5511999991234",
    contentType: "text",
    body: "Enviar uma vez",
    deliveryMode: "scheduled",
    scheduledAt: new Date("2026-06-16T10:00:00.000Z"),
  });

  const interactiveText = await service.createDispatch({
    instanceId: "instance-a",
    targetType: "group",
    groupJid: "120363000001@g.us",
    contentType: "text",
    body: "Abrir oferta",
    buttons: [{ text: "Abrir", url: "https://example.com/oferta" }],
    deliveryMode: "scheduled",
    scheduledAt: new Date("2026-06-16T10:00:00.000Z"),
  });

  const providerFailure = await service.createDispatch({
    instanceId: "instance-a",
    targetType: "number",
    phone: "5511888887777",
    contentType: "text",
    body: "Falha no provider",
    deliveryMode: "scheduled",
    scheduledAt: new Date("2026-06-16T10:00:00.000Z"),
  });

  const numberWithMediaAndButtons = await service.createDispatch({
    instanceId: "instance-a",
    targetType: "number",
    phone: "1198765432",
    contentType: "image",
    body: "Abrir material",
    mediaUrl: "https://example.com/banner.png",
    buttons: [{ text: "Abrir", url: "https://example.com/material" }],
    deliveryMode: "scheduled",
    scheduledAt: new Date("2026-06-16T10:00:00.000Z"),
  });
  assert.equal(numberWithMediaAndButtons.recipientPhone, "551198765432");

  const futureCancelled = await service.createDispatch({
    instanceId: "instance-a",
    targetType: "number",
    phone: "5511888881111",
    contentType: "text",
    body: "Nao executar",
    deliveryMode: "scheduled",
    scheduledAt: new Date("2026-06-17T10:00:00.000Z"),
  });
  await service.cancelDispatch(futureCancelled.id);

  const processed = await worker.runDue(new Date("2026-06-16T11:00:00.000Z"));
  assert.equal(processed, 4);

  const sentPlainText = await service.getDispatch(plainText.id);
  assert.equal(sentPlainText.status, "SENT");
  assert.equal(sentPlainText.providerMessageId, "text-1");
  assert.equal(Boolean(sentPlainText.processedAt), true);

  const sentInteractiveText = await service.getDispatch(interactiveText.id);
  assert.equal(sentInteractiveText.status, "SENT");
  assert.equal(sentInteractiveText.providerMessageId, "interactive-1");

  const failedDispatch = await service.getDispatch(providerFailure.id);
  assert.equal(failedDispatch.status, "FAILED");
  assert.equal(failedDispatch.failureCode, "CHAT_PROVIDER_SEND_FAILED");
  assert.match(failedDispatch.providerError || "", /provider blew up/i);

  const sentMediaInteractive = await service.getDispatch(numberWithMediaAndButtons.id);
  assert.equal(sentMediaInteractive.status, "SENT");
  assert.equal(sentMediaInteractive.providerMessageId, "interactive-2");
  assert.equal(interactiveBodies[1], "Abrir material");
  assert.equal(Boolean(interactiveHeaders[1]?.hasMediaAttachment), true);
  assert.equal(Boolean(interactiveHeaders[1]?.imageMessage), true);

  const cancelledDispatch = await service.getDispatch(futureCancelled.id);
  assert.equal(cancelledDispatch.status, "CANCELLED");

  const reprocessed = await worker.runDue(new Date("2026-06-16T12:00:00.000Z"));
  assert.equal(reprocessed, 0);
  assert.equal(textSendCount, 1);
  assert.equal(relayCount, 2);
  assert.equal(mediaSendCount, 0);
  assert.equal(sentJids.includes("551198765432@s.whatsapp.net"), true);

  const concurrentStore = createInMemoryScheduledDispatchStore({
    instances: [{ id: "instance-b" }],
  });
  const concurrentService = createScheduledDispatchService({ store: concurrentStore });
  await concurrentService.createDispatch({
    instanceId: "instance-b",
    targetType: "number",
    phone: "5511991112222",
    contentType: "text",
    body: "Claim unico",
    deliveryMode: "scheduled",
    scheduledAt: new Date("2026-06-16T10:00:00.000Z"),
  });

  const [claimAttemptA, claimAttemptB] = await Promise.all([
    concurrentService.claimDueDispatches({ now: new Date("2026-06-16T11:00:00.000Z"), limit: 10 }),
    concurrentService.claimDueDispatches({ now: new Date("2026-06-16T11:00:00.000Z"), limit: 10 }),
  ]);
  assert.equal(claimAttemptA.length + claimAttemptB.length, 1);

  console.log("scheduled-dispatch-worker: OK");
})().catch((error) => {
  console.error("scheduled-dispatch-worker:", error);
  process.exit(1);
});
