import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { APP_NAV_GROUPS, getAppRouteTitle } from "../src/features/navigation/appNavigation.ts";
import {
  applyInstanceToDraft,
  applyTemplateToDraft,
  buildScheduledDispatchTemplatePayload,
  calculateScheduledDispatchPreview,
  canCancelScheduledDispatch,
  createEmptyScheduledDispatchButton,
  createInitialScheduledDispatchDraft,
  filterScheduledDispatchGroups,
  isSafeMediaUrl,
  isTemplateMediaUrl,
  MAX_SCHEDULED_DISPATCH_BUTTONS,
  normalizeScheduledDispatchDelay,
  normalizeScheduledDispatchPauseEveryCount,
  normalizeScheduledDispatchPhones,
  resolveScheduledDispatchDelayRange,
  resolveScheduledDispatchIso,
  resolveScheduledDispatchTargetLabel,
  SCHEDULED_DISPATCH_STATUS_LABELS,
  validateScheduledDispatchDraft,
  type ScheduledDispatchGroup,
  type ScheduledDispatchTemplate,
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

test("instance changes clear previous group selection and uploaded media", () => {
  const initial = {
    ...createInitialScheduledDispatchDraft(new Date("2026-06-16T09:00:00.000Z")),
    instanceId: "instance-a",
    groupJids: ["120363000001@g.us"],
    mediaUrl: "/api/scheduled-dispatches/media/instance-a/media-a/banner.png",
    mediaFileName: "banner.png",
    body: "Campanha",
  };
  const next = applyInstanceToDraft(initial, "instance-b");
  assert.equal(next.instanceId, "instance-b");
  assert.deepEqual(next.groupJids, []);
  assert.equal(next.mediaUrl, "");
  assert.equal(next.mediaFileName, "");
  assert.equal(next.body, "Campanha");
  assert.equal(next.numberDelaySeconds, "0");
  assert.equal(next.numberDelayMinSeconds, "0");
  assert.equal(next.numberDelayMaxSeconds, "0");
  assert.equal(next.groupDelaySeconds, "0");
  assert.equal(next.groupDelayMinSeconds, "0");
  assert.equal(next.groupDelayMaxSeconds, "0");
  assert.equal(next.pauseEveryCount, "0");
  assert.equal(next.pauseDurationSeconds, "0");
});

test("phone parsing removes separators and duplicates", () => {
  assert.deepEqual(normalizeScheduledDispatchPhones("+55 (11) 99999-1234\n5511999991234,1188887777,1198765432"), ["5511999991234", "551188887777", "551198765432"]);
  assert.equal(normalizeScheduledDispatchDelay("15"), 15);
  assert.equal(normalizeScheduledDispatchDelay(""), 0);
  assert.deepEqual(resolveScheduledDispatchDelayRange({ fixedSeconds: "15", minSeconds: "", maxSeconds: "" }), { fixedSeconds: 15, minSeconds: 15, maxSeconds: 15 });
  assert.deepEqual(resolveScheduledDispatchDelayRange({ fixedSeconds: "0", minSeconds: "80", maxSeconds: "90" }), { fixedSeconds: 0, minSeconds: 80, maxSeconds: 90 });
  assert.equal(normalizeScheduledDispatchPauseEveryCount("3"), 3);
});

test("programmed pause preview estimates block pauses without initial pause", () => {
  const preview = calculateScheduledDispatchPreview({
    totalDestinations: 5,
    baseScheduledAt: new Date("2026-06-20T13:00:00.000Z"),
    delayMinSeconds: 10,
    delayMaxSeconds: 20,
    pauseEveryCount: 2,
    pauseDurationSeconds: 60,
  });
  assert.equal(preview.estimatedPauseCount, 2);
  assert.equal(preview.estimatedMinFinishAt.toISOString(), "2026-06-20T13:02:40.000Z");
  assert.equal(preview.estimatedMaxFinishAt.toISOString(), "2026-06-20T13:03:20.000Z");
  assert.equal(preview.estimatedFinishAt.toISOString(), "2026-06-20T13:03:20.000Z");
});

test("global scheduled dispatch templates apply only content fields", () => {
  const draft = {
    ...createInitialScheduledDispatchDraft(new Date("2026-06-16T09:00:00.000Z")),
    instanceId: "instance-a",
    targetType: "number" as const,
    phonesText: "5511999991234",
    numberDelaySeconds: "30",
    pauseEveryCount: "5",
    pauseDurationSeconds: "120",
    deliveryMode: "scheduled" as const,
    scheduledAt: "2026-06-20T13:00",
  };
  const template: ScheduledDispatchTemplate = {
    id: "template-a",
    name: "Oferta Global",
    contentType: "IMAGE",
    body: "Legenda global",
    mediaUrl: "/api/scheduled-dispatch-templates/media/media-a/banner.png",
    mediaFileName: "banner.png",
    buttons: [{ text: "Abrir", url: "https://example.com" }],
    createdAt: "2026-06-16T09:00:00.000Z",
    updatedAt: "2026-06-16T09:00:00.000Z",
  };

  const next = applyTemplateToDraft(draft, template);
  assert.equal(next.instanceId, "instance-a");
  assert.equal(next.targetType, "number");
  assert.equal(next.phonesText, "5511999991234");
  assert.equal(next.numberDelaySeconds, "30");
  assert.equal(next.pauseEveryCount, "5");
  assert.equal(next.pauseDurationSeconds, "120");
  assert.equal(next.scheduledAt, "2026-06-20T13:00");
  assert.equal(next.contentType, "image");
  assert.equal(next.body, "Legenda global");
  assert.equal(next.mediaUrl, "/api/scheduled-dispatch-templates/media/media-a/banner.png");
  assert.deepEqual(next.buttons, [{ text: "Abrir", url: "https://example.com" }]);
  assert.equal(isTemplateMediaUrl(next.mediaUrl), true);
  assert.equal(isSafeMediaUrl(next.mediaUrl), true);
});

test("scheduled dispatch template payload serializes current content snapshot", () => {
  const draft = {
    ...createInitialScheduledDispatchDraft(new Date("2026-06-16T09:00:00.000Z")),
    contentType: "text" as const,
    body: "  Mensagem recorrente  ",
    mediaUrl: "/api/scheduled-dispatch-templates/media/media-a/banner.png",
    mediaFileName: "banner.png",
    buttons: [{ text: " Abrir ", url: " https://example.com/oferta " }],
  };

  assert.deepEqual(buildScheduledDispatchTemplatePayload(draft, " Template A "), {
    name: "Template A",
    contentType: "text",
    body: "Mensagem recorrente",
    mediaUrl: null,
    mediaFileName: null,
    buttons: [{ text: "Abrir", url: "https://example.com/oferta" }],
  });
});

test("group filtering and submit validation enforce selected groups", () => {
  assert.deepEqual(filterScheduledDispatchGroups(groups, "vendas").map((group) => group.jid), ["120363000001@g.us"]);
  assert.deepEqual(filterScheduledDispatchGroups(groups, "120363000002").map((group) => group.name), ["Financeiro"]);

  const invalidDraft = {
    ...createInitialScheduledDispatchDraft(new Date("2026-06-16T09:00:00.000Z")),
    instanceId: "instance-a",
    targetType: "group" as const,
    body: "Mensagem pronta",
    groupJids: [],
  };
  const invalidResult = validateScheduledDispatchDraft(invalidDraft);
  assert.equal(invalidResult.canSubmit, false);
  assert.equal(invalidResult.groupJids, "Selecione ao menos um grupo valido.");

  const validResult = validateScheduledDispatchDraft({
    ...invalidDraft,
    groupJids: ["120363000001@g.us", "120363000002@g.us"],
    groupDelaySeconds: "12",
  });
  assert.equal(validResult.canSubmit, true);
});

test("composer validation supports multi-number, local media upload, and immediate scheduling rules", () => {
  const base = {
    ...createInitialScheduledDispatchDraft(new Date("2026-06-16T09:00:00.000Z")),
    instanceId: "instance-a",
    targetType: "number" as const,
    phonesText: "5511999991234\n5511888887777",
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
  assert.equal(imageInvalid.mediaUrl, "Envie uma imagem local para o disparo.");

  const videoValid = validateScheduledDispatchDraft({
    ...base,
    contentType: "video",
    body: "Legenda de video",
    mediaUrl: "/api/scheduled-dispatches/media/instance-a/media-1/video.mp4",
    mediaFileName: "video.mp4",
  });
  assert.equal(videoValid.canSubmit, true);

  const textWithButtonValid = validateScheduledDispatchDraft({
    ...base,
    contentType: "text",
    body: "Oferta com clique",
    buttons: [{ text: "Abrir oferta", url: "https://example.com/oferta" }],
  });
  assert.equal(textWithButtonValid.canSubmit, true);

  const invalidButtonUrl = validateScheduledDispatchDraft({
    ...base,
    contentType: "image",
    body: "Legenda",
    mediaUrl: "/api/scheduled-dispatches/media/instance-a/media-2/banner.png",
    buttons: [{ text: "Abrir", url: "ftp://example.com" }],
  });
  assert.equal(invalidButtonUrl.canSubmit, false);
  assert.equal(invalidButtonUrl.buttons, "Informe uma URL http/https valida no botao 1.");

  const videoWithButtonValid = validateScheduledDispatchDraft({
    ...base,
    contentType: "video",
    body: "Legenda",
    mediaUrl: "/api/scheduled-dispatches/media/instance-a/media-3/video.mp4",
    buttons: [{ text: "Abrir", url: "https://example.com" }],
  });
  assert.equal(videoWithButtonValid.canSubmit, true);

  const tooManyButtonsInvalid = validateScheduledDispatchDraft({
    ...base,
    contentType: "text",
    body: "Campanha",
    buttons: Array.from({ length: MAX_SCHEDULED_DISPATCH_BUTTONS + 1 }, (_, index) => ({ text: `Botao ${index + 1}`, url: `https://example.com/${index + 1}` })),
  });
  assert.equal(tooManyButtonsInvalid.canSubmit, false);
  assert.equal(tooManyButtonsInvalid.buttons, `Adicione no maximo ${MAX_SCHEDULED_DISPATCH_BUTTONS} botoes URL.`);

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
    mediaUrl: "/api/scheduled-dispatches/media/instance-a/media-4/banner.png",
    mediaFileName: "banner.png",
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

  const invalidNumberDelay = validateScheduledDispatchDraft({
    ...base,
    contentType: "text",
    body: "Com atraso invalido",
    numberDelayMinSeconds: "-1",
  });
  assert.equal(invalidNumberDelay.canSubmit, false);
  assert.equal(invalidNumberDelay.numberDelaySeconds, "Informe uma faixa de atraso entre 0 e 86400 segundos.");

  const invalidDelayRange = validateScheduledDispatchDraft({
    ...base,
    contentType: "text",
    body: "Com faixa invalida",
    numberDelayMinSeconds: "90",
    numberDelayMaxSeconds: "80",
  });
  assert.equal(invalidDelayRange.canSubmit, false);
  assert.equal(invalidDelayRange.numberDelaySeconds, "O atraso maximo deve ser maior ou igual ao minimo.");

  const invalidPause = validateScheduledDispatchDraft({
    ...base,
    contentType: "text",
    body: "Pausa invalida",
    pauseEveryCount: "10001",
    pauseDurationSeconds: "1",
  });
  assert.equal(invalidPause.canSubmit, false);
  assert.equal(invalidPause.pauseEveryCount, "Informe uma pausa a cada entre 0 e 10000 envios.");
});

test("scheduled dispatch page keeps multi-target composer, group selection, and upload flow", () => {
  const source = fs.readFileSync(path.resolve(import.meta.dirname, "../src/pages/ScheduledDispatchPage.tsx"), "utf8");
  assert.match(source, /api\.get<GroupListResponse>\("\/scheduled-dispatches\/groups", \{ params: \{ instanceId: draft\.instanceId \} \}\)/);
  assert.match(source, /api\.post<GroupSyncResponse>\("\/scheduled-dispatches\/groups\/sync", \{ instanceId: draft\.instanceId \}\)/);
  assert.match(source, /api\.post<UploadMediaResponse>\("\/scheduled-dispatches\/media", form\)/);
  assert.match(source, /instance\.status === "CONNECTED"/);
  assert.match(source, /Conecte uma instancia WhatsApp antes de criar disparos\./);
  assert.match(source, /api\.get<TemplateListResponse>\("\/scheduled-dispatch-templates"\)/);
  assert.match(source, /api\.post<UploadMediaResponse>\("\/scheduled-dispatch-templates\/media", form\)/);
  assert.match(source, /api\.post<TemplateMutationResponse>\("\/scheduled-dispatch-templates", payload\)/);
  assert.match(source, /api\.patch<TemplateMutationResponse>\(`\/scheduled-dispatch-templates\/\$\{selectedTemplateId\}`, payload\)/);
  assert.match(source, /api\.delete\(`\/scheduled-dispatch-templates\/\$\{selectedTemplateId\}`\)/);
  assert.match(source, /applyTemplateToDraft/);
  assert.match(source, /buildScheduledDispatchTemplatePayload/);
  assert.match(source, /phones: draft\.targetType === "number" \? normalizeScheduledDispatchPhones\(draft\.phonesText\) : null/);
  assert.match(source, /groupJids: draft\.targetType === "group" \? draft\.groupJids : null/);
  assert.match(source, /numberDelaySeconds: draft\.targetType === "number" \? normalizeScheduledDispatchDelay\(draft\.numberDelayMinSeconds\) : null/);
  assert.match(source, /numberDelayMinSeconds: draft\.targetType === "number" \? normalizeScheduledDispatchDelay\(draft\.numberDelayMinSeconds\) : null/);
  assert.match(source, /numberDelayMaxSeconds: draft\.targetType === "number" \? normalizeScheduledDispatchDelay\(draft\.numberDelayMaxSeconds\) : null/);
  assert.match(source, /groupDelaySeconds: draft\.targetType === "group" \? normalizeScheduledDispatchDelay\(draft\.groupDelayMinSeconds\) : null/);
  assert.match(source, /groupDelayMinSeconds: draft\.targetType === "group" \? normalizeScheduledDispatchDelay\(draft\.groupDelayMinSeconds\) : null/);
  assert.match(source, /groupDelayMaxSeconds: draft\.targetType === "group" \? normalizeScheduledDispatchDelay\(draft\.groupDelayMaxSeconds\) : null/);
  assert.match(source, /pauseEveryCount: normalizeScheduledDispatchPauseEveryCount\(draft\.pauseEveryCount\)/);
  assert.match(source, /pauseDurationSeconds: normalizeScheduledDispatchDelay\(draft\.pauseDurationSeconds\)/);
  assert.match(source, /resolveScheduledDispatchSubmitError\(err\)/);
  assert.match(source, /Disparo salvo, mas nao foi possivel atualizar o historico agora\./);
  assert.match(source, /try \{\s*await loadHistory\(draft\.instanceId\);\s*\} catch \(historyError\)/s);
  assert.match(source, /type="checkbox"/);
  assert.match(source, /setActiveView\("composer"\)/);
  assert.match(source, /setActiveView\("history"\)/);
  assert.match(source, /Envios/);
  assert.match(source, /max-h-64 overflow-y-auto/);
  assert.match(source, /HISTORY_PAGE_SIZE = 100/);
  assert.match(source, /Pagina \{currentHistoryPage\} de \{historyTotalPages\}/);
  assert.match(source, /Ritmo de envio/);
  assert.match(source, /Templates globais/);
  assert.match(source, /Aplicar template/);
  assert.match(source, /Salvar como template/);
  assert.match(source, /Midia de template/);
  assert.match(source, /Delay aleatorio de numero \(s\)/);
  assert.match(source, /Delay aleatorio ate numero \(s\)/);
  assert.match(source, /Delay aleatorio de grupo \(s\)/);
  assert.match(source, /Delay aleatorio ate grupo \(s\)/);
  assert.match(source, /Pausar a cada/);
  assert.match(source, /Pausar por \(s\)/);
  assert.match(source, /Termino estimado/);
  assert.match(source, /buildCampaignSummaries/);
  assert.match(source, /api\.post<CancelCampaignResponse>\(`\/scheduled-dispatches\/campaigns\/\$\{summary\.campaignId\}\/cancel`\)/);
  assert.match(source, /Cancelar todos os disparos pendentes desta campanha\?/);
  assert.match(source, /Cancelar campanha/);
  assert.match(source, /Campanha \{dispatch\.campaignId\.slice\(0, 8\)\}/);
  assert.match(source, /Midia opcional/);
  assert.match(source, /accept="image\/\*,video\/\*"/);
  assert.match(source, /Adicionar midia/);
  assert.match(source, /Remover midia/);
  assert.match(source, /Botoes URL/);
  assert.match(source, /Sem botoes\./);
  assert.match(source, /Criar envio imediato/);
  assert.match(source, /Salvar disparo agendado/);
  assert.match(source, /Historico operacional/);
  assert.match(source, /Cancelar job/);
  assert.match(source, /Limpar historico/);
  assert.match(source, /video src=\{draft\.mediaUrl\} className=.*controls/s);
  assert.doesNotMatch(source, /eventSlug|renderContext|variaveis automaticas/i);
});

test("empty scheduled dispatch button factory starts blank", () => {
  assert.deepEqual(createEmptyScheduledDispatchButton(), { text: "", url: "" });
});

test("scheduled dispatch history helpers expose status labels and cancellation rules", () => {
  assert.equal(SCHEDULED_DISPATCH_STATUS_LABELS.SCHEDULED, "Agendado");
  assert.equal(canCancelScheduledDispatch("SCHEDULED"), true);
  assert.equal(canCancelScheduledDispatch("PROCESSING"), false);
  assert.equal(resolveScheduledDispatchTargetLabel({
    id: "1",
    instanceId: "instance-a",
    targetType: "GROUP",
    recipientPhone: null,
    recipientJid: "120363000001@g.us",
    contentType: "TEXT",
    body: null,
    mediaUrl: null,
    buttons: [],
    campaignId: null,
    campaign: null,
    scheduledAt: "2026-06-16T10:00:00.000Z",
    status: "SCHEDULED",
    providerMessageId: null,
    failureCode: null,
    providerError: null,
    processedAt: null,
    createdAt: "2026-06-16T09:00:00.000Z",
    updatedAt: "2026-06-16T09:00:00.000Z",
  }), "120363000001@g.us");
});
