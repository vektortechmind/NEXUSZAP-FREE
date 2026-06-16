import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { APP_NAV_GROUPS, getAppRouteTitle } from "../src/features/navigation/appNavigation.ts";
import {
  applyInstanceToDraft,
  createInitialScheduledDispatchDraft,
  filterScheduledDispatchGroups,
  resolveScheduledDispatchIso,
  validateScheduledDispatchDraft,
  type ScheduledDispatchGroup,
} from "../src/features/scheduled-dispatch/state.ts";

const groups: ScheduledDispatchGroup[] = [
  {
    instanceId: "instance-a",
    jid: "120363000001@g.us",
    name: "Grupo Vendas",
    lastMessageAt: "2026-06-16T10:00:00.000Z",
    updatedAt: "2026-06-16T10:30:00.000Z",
  },
  {
    instanceId: "instance-a",
    jid: "120363000002@g.us",
    name: "Financeiro",
    lastMessageAt: "2026-06-16T08:00:00.000Z",
    updatedAt: "2026-06-16T08:10:00.000Z",
  },
];

test("scheduled dispatch route is exposed in navigation and metadata", () => {
  const operationGroup = APP_NAV_GROUPS.find((group) => group.label === "Operação");
  assert.ok(operationGroup?.items.some((item) => item.name === "Disparos" && item.path === "/disparos"));
  assert.equal(getAppRouteTitle("/disparos"), "Disparos");
});

test("instance changes clear previous group selection", () => {
  const initial = {
    ...createInitialScheduledDispatchDraft(new Date("2026-06-16T09:00:00.000Z")),
    instanceId: "instance-a",
    groupJid: "120363000001@g.us",
    body: "Campanha",
  };
  const next = applyInstanceToDraft(initial, "instance-b");
  assert.equal(next.instanceId, "instance-b");
  assert.equal(next.groupJid, "");
  assert.equal(next.body, "Campanha");
});

test("group filtering and submit validation enforce selected group", () => {
  assert.deepEqual(filterScheduledDispatchGroups(groups, "vendas").map((group) => group.jid), ["120363000001@g.us"]);
  assert.deepEqual(filterScheduledDispatchGroups(groups, "120363000002").map((group) => group.name), ["Financeiro"]);

  const invalidDraft = {
    ...createInitialScheduledDispatchDraft(new Date("2026-06-16T09:00:00.000Z")),
    instanceId: "instance-a",
    targetType: "group" as const,
    body: "Mensagem pronta",
    groupJid: "",
  };
  const invalidResult = validateScheduledDispatchDraft(invalidDraft);
  assert.equal(invalidResult.canSubmit, false);
  assert.equal(invalidResult.groupJid, "Selecione um grupo valido.");

  const validResult = validateScheduledDispatchDraft({
    ...invalidDraft,
    groupJid: "120363000001@g.us",
  });
  assert.equal(validResult.canSubmit, true);
});

test("composer validation supports text image video and immediate scheduling rules", () => {
  const base = {
    ...createInitialScheduledDispatchDraft(new Date("2026-06-16T09:00:00.000Z")),
    instanceId: "instance-a",
    targetType: "number" as const,
    phone: "5511999991234",
  };

  const textInvalid = validateScheduledDispatchDraft({
    ...base,
    contentType: "text",
    body: "",
    mediaUrl: "",
  });
  assert.equal(textInvalid.canSubmit, false);
  assert.equal(textInvalid.body, "Escreva a mensagem do disparo.");

  const imageInvalid = validateScheduledDispatchDraft({
    ...base,
    contentType: "image",
    body: "Legenda opcional",
    mediaUrl: "",
  });
  assert.equal(imageInvalid.canSubmit, false);
  assert.equal(imageInvalid.mediaUrl, "Informe uma media URL valida com http ou https.");

  const videoValid = validateScheduledDispatchDraft({
    ...base,
    contentType: "video",
    body: "Legenda de video",
    mediaUrl: "https://cdn.example.com/video.mp4",
  });
  assert.equal(videoValid.canSubmit, true);

  const scheduledMissingDate = validateScheduledDispatchDraft({
    ...base,
    contentType: "text",
    body: "Com data obrigatoria",
    deliveryMode: "scheduled",
    scheduledAt: "",
  });
  assert.equal(scheduledMissingDate.canSubmit, false);
  assert.equal(scheduledMissingDate.scheduledAt, "Informe uma data e hora validas.");

  const immediateValid = validateScheduledDispatchDraft({
    ...base,
    contentType: "image",
    body: "",
    mediaUrl: "https://cdn.example.com/banner.png",
    deliveryMode: "immediate",
    scheduledAt: "",
  });
  assert.equal(immediateValid.canSubmit, true);

  const immediateIso = resolveScheduledDispatchIso({
    ...base,
    contentType: "text",
    body: "Agora",
    mediaUrl: "",
    deliveryMode: "immediate",
  }, new Date("2026-06-16T10:00:00.000Z"));
  assert.equal(immediateIso, "2026-06-16T10:00:00.000Z");
});

test("scheduled dispatch page keeps composer states for media and delivery mode", () => {
  const source = fs.readFileSync(path.resolve(import.meta.dirname, "../src/pages/ScheduledDispatchPage.tsx"), "utf8");
  assert.match(source, /api\.get<GroupListResponse>\("\/scheduled-dispatches\/groups", \{ params: \{ instanceId: draft\.instanceId \} \}\)/);
  assert.match(source, /api\.post<GroupSyncResponse>\("\/scheduled-dispatches\/groups\/sync", \{ instanceId: draft\.instanceId \}\)/);
  assert.match(source, /contentType: draft\.contentType/);
  assert.match(source, /deliveryMode: draft\.deliveryMode/);
  assert.match(source, /draft\.deliveryMode === "scheduled"/);
  assert.match(source, /draft\.deliveryMode === "immediate"/);
  assert.match(source, /Media URL/);
  assert.match(source, /Legenda \(opcional\)/);
  assert.match(source, /Criar envio imediato/);
  assert.match(source, /Salvar disparo agendado/);
  assert.match(source, /O job sera criado com timestamp atual/);
  assert.match(source, /video src=\{draft\.mediaUrl\.trim\(\)\} className=.*controls/s);
  assert.doesNotMatch(source, /eventSlug|renderContext|variaveis automaticas/i);
});
