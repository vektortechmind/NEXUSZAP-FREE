import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { APP_NAV_GROUPS, getAppRouteTitle } from "../src/features/navigation/appNavigation.ts";
import {
  applyInstanceToDraft,
  createInitialScheduledDispatchDraft,
  filterScheduledDispatchGroups,
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

test("scheduled dispatch page keeps explicit load, empty, error and sync states for groups", () => {
  const source = fs.readFileSync(path.resolve(import.meta.dirname, "../src/pages/ScheduledDispatchPage.tsx"), "utf8");
  assert.match(source, /api\.get<GroupListResponse>\("\/scheduled-dispatches\/groups", \{ params: \{ instanceId: draft\.instanceId \} \}\)/);
  assert.match(source, /api\.post<GroupSyncResponse>\("\/scheduled-dispatches\/groups\/sync", \{ instanceId: draft\.instanceId \}\)/);
  assert.match(source, /Carregando grupos da instancia selecionada/);
  assert.match(source, /Nenhum grupo sincronizado para esta instancia/);
  assert.match(source, /Nao foi possivel carregar os grupos desta instancia/);
  assert.match(source, /Nenhum grupo encontrado para a busca informada/);
  assert.match(source, /Selecione uma instancia antes de sincronizar grupos/);
  assert.match(source, /Salvar disparo agendado/);
  assert.doesNotMatch(source, /label="Group JID"/);
  assert.doesNotMatch(source, /placeholder="120363/);
});
