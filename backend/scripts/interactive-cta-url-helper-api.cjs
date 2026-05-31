"use strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-with-more-than-32-characters";
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "local-test-password";
process.env.PORT = process.env.PORT || "0";
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || Buffer.alloc(32, 9).toString("base64");

require("ts-node/register");

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  buildCtaUrlFallbackText,
  buildCtaUrlInteractivePayload,
  buildNativeInteractiveFallbackText,
  buildNativeInteractivePayload,
} = require("../src/whatsapp/interactivePayloadHelper.ts");
const { sendCtaUrlInteractiveMessage, sendNativeInteractiveMessage } = require("../src/whatsapp/interactiveSender.ts");

const baseInput = {
  body: "Pedido pago com sucesso. Acesse o checkout pelo botao abaixo.",
  buttonText: "Abrir checkout",
  url: "https://app.example.com/checkout/abc",
};

function read(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
}

function assertBuilderShape() {
  const payload = buildCtaUrlInteractivePayload(baseInput);
  const button = payload.message.interactiveMessage.nativeFlowMessage.buttons[0];

  assert.strictEqual(button.name, "cta_url");
  assert.strictEqual(payload.message.interactiveMessage.body.text, baseInput.body);
  assert.strictEqual(payload.summary.deliveryPath, "interactive_cta_url");
  assert.strictEqual(payload.summary.hasAdditionalNodes, true);

  const params = JSON.parse(button.buttonParamsJson);
  assert.deepStrictEqual(Object.keys(params).sort(), ["display_text", "merchant_url", "url"]);
  assert.strictEqual(params.display_text, baseInput.buttonText);
  assert.strictEqual(params.url, baseInput.url);
  assert.strictEqual(params.merchant_url, baseInput.url);
}

function assertAdditionalNodesShape() {
  const payload = buildCtaUrlInteractivePayload(baseInput);
  const biz = payload.additionalNodes[0];

  assert.strictEqual(biz.tag, "biz");
  assert.strictEqual(biz.attrs.actual_actors, "2");
  assert.strictEqual(biz.attrs.host_storage, "2");
  assert.ok(biz.attrs.privacy_mode_ts);

  const interactive = biz.content.find((node) => node.tag === "interactive");
  assert.ok(interactive, "deve incluir node interactive");
  assert.strictEqual(interactive.attrs.type, "native_flow");
  assert.strictEqual(interactive.attrs.v, "1");
  assert.strictEqual(interactive.content[0].tag, "native_flow");
  assert.strictEqual(interactive.content[0].attrs.name, "mixed");

  const qualityControl = biz.content.find((node) => node.tag === "quality_control");
  assert.ok(qualityControl, "deve incluir quality_control");
  assert.ok(qualityControl.attrs.decision_id, "quality_control deve incluir decision_id");
  assert.strictEqual(qualityControl.attrs.source_type, "third_party");
  const decisionSource = qualityControl.content[0];
  assert.strictEqual(decisionSource.tag, "decision_source");
  assert.strictEqual(decisionSource.attrs.value, "df");
}

function assertMultipleCtaButtons() {
  const payload = buildCtaUrlInteractivePayload({
    body: baseInput.body,
    buttons: [
      { text: "Acessar academy", url: "https://app.example.com/academy" },
      { text: "Acessar comunidade", url: "https://app.example.com/community" },
    ],
  });
  const buttons = payload.message.interactiveMessage.nativeFlowMessage.buttons;
  assert.strictEqual(buttons.length, 2);
  assert.strictEqual(payload.summary.buttonCount, 2);
  assert.strictEqual(JSON.parse(buttons[1].buttonParamsJson).display_text, "Acessar comunidade");
}

function assertNativeButtons() {
  const copyPayload = buildNativeInteractivePayload({
    body: "Pix gerado. Use o botao para copiar.",
    buttons: [{ kind: "cta_copy", text: "Copiar Pix", copyCode: "000201PIX-CODE" }],
  });
  const copyButton = copyPayload.message.interactiveMessage.nativeFlowMessage.buttons[0];
  assert.strictEqual(copyButton.name, "cta_copy");
  assert.strictEqual(JSON.parse(copyButton.buttonParamsJson).copy_code, "000201PIX-CODE");
  assert.deepStrictEqual(copyPayload.summary.buttonKinds, ["cta_copy"]);

  const mixedPayload = buildNativeInteractivePayload({
    body: "Boleto gerado.",
    buttons: [
      { kind: "cta_url", text: "Abrir boleto", url: "https://cdn.example.com/boleto.pdf" },
      { kind: "cta_copy", text: "Copiar boleto", copyCode: "23793381286008200009301000012304570660000014990" },
    ],
  });
  const buttons = mixedPayload.message.interactiveMessage.nativeFlowMessage.buttons;
  assert.strictEqual(buttons.length, 2);
  assert.strictEqual(buttons[0].name, "cta_url");
  assert.strictEqual(buttons[1].name, "cta_copy");
  assert.deepStrictEqual(mixedPayload.summary.buttonKinds, ["cta_url", "cta_copy"]);
  assert.strictEqual(buildNativeInteractiveFallbackText({
    body: "Boleto gerado.",
    buttons: [
      { kind: "cta_url", text: "Abrir boleto", url: "https://cdn.example.com/boleto.pdf" },
      { kind: "cta_copy", text: "Copiar boleto", copyCode: "23793381286008200009301000012304570660000014990" },
    ],
  }), "Boleto gerado.\n\nhttps://cdn.example.com/boleto.pdf\n\n23793381286008200009301000012304570660000014990");
}

function assertValidation() {
  assert.throws(() => buildCtaUrlInteractivePayload({ ...baseInput, body: " " }), /body e obrigatorio/);
  assert.throws(() => buildCtaUrlInteractivePayload({ ...baseInput, buttonText: "" }), /Ao menos um botao CTA URL/);
  assert.throws(() => buildCtaUrlInteractivePayload({ ...baseInput, url: "ftp://example.com" }), /http ou https/);
  assert.throws(() => buildCtaUrlInteractivePayload({ ...baseInput, rawPayload: {} }), /Campo nao permitido/);
  assert.throws(() => buildNativeInteractivePayload({ body: baseInput.body, buttons: [{ kind: "cta_copy", text: "Copiar", copyCode: " " }] }), /copyCode e obrigatorio/);
  assert.throws(() => buildNativeInteractivePayload({ body: baseInput.body, buttons: [{ kind: "cta_url", text: "FTP", url: "ftp://example.com" }] }), /http ou https/);
  assert.strictEqual(buildCtaUrlFallbackText(baseInput), `${baseInput.body}\n\n${baseInput.url}`);
}

async function assertSenderRelay() {
  const calls = [];
  const sock = {
    async relayMessage(jid, message, options) {
      calls.push({ jid, message, options });
      return "provider-interactive-id";
    },
    async sendMessage() {
      throw new Error("fallback nao deveria ser usado");
    },
  };

  const result = await sendCtaUrlInteractiveMessage(sock, "5511999999999@s.whatsapp.net", baseInput, {
    messageId: "CTAURLTESTID",
  });

  assert.strictEqual(result.deliveryPath, "interactive_cta_url");
  assert.strictEqual(result.providerMessageId, "provider-interactive-id");
  assert.strictEqual(result.summary.attemptedInteractive, true);
  assert.strictEqual(result.summary.fallbackUsed, false);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].options.messageId, "CTAURLTESTID");
  assert.strictEqual(calls[0].options.additionalNodes[0].tag, "biz");
}

async function assertNativeSenderRelay() {
  const calls = [];
  const sock = {
    async relayMessage(jid, message, options) {
      calls.push({ jid, message, options });
      return "provider-native-id";
    },
    async sendMessage() {
      throw new Error("fallback nao deveria ser usado");
    },
  };

  const result = await sendNativeInteractiveMessage(sock, "5511999999999@s.whatsapp.net", {
    body: "Pix gerado.",
    buttons: [{ kind: "cta_copy", text: "Copiar Pix", copyCode: "000201PIX-CODE" }],
  });

  assert.strictEqual(result.deliveryPath, "interactive_native");
  assert.strictEqual(result.providerMessageId, "provider-native-id");
  assert.deepStrictEqual(result.summary.interactiveButtonKinds, ["cta_copy"]);
  assert.strictEqual(result.summary.interactiveButtonCount, 1);
  assert.strictEqual(calls.length, 1);
}

async function assertSenderFallback() {
  const sent = [];
  const sock = {
    async relayMessage() {
      throw new Error("Bearer secret-token should be hidden");
    },
    async sendMessage(jid, content) {
      sent.push({ jid, content });
      return { key: { id: "fallback-id" } };
    },
  };

  const result = await sendCtaUrlInteractiveMessage(sock, "5511999999999@s.whatsapp.net", baseInput);

  assert.strictEqual(result.deliveryPath, "text_fallback_interactive_cta_url");
  assert.strictEqual(result.fallbackProviderMessageId, "fallback-id");
  assert.ok(result.interactiveError.includes("[REDACTED]"), "erro deve ser sanitizado");
  assert.strictEqual(result.summary.attemptedInteractive, true);
  assert.strictEqual(result.summary.fallbackUsed, true);
  assert.strictEqual(sent[0].content.text, `${baseInput.body}\n\n${baseInput.url}`);
}

function assertPublicContractUnchanged() {
  const integrationRoute = read("src/routes/integration.routes.ts");
  const eventCatalog = read("src/services/integrations/integrationEventCatalog.service.ts");
  const runtimeService = read("src/services/integrations/integrationDispatchRuntime.service.ts");

  assert.ok(!integrationRoute.includes("interactivePayloadHelper"), "endpoint publico nao deve importar helper experimental");
  assert.ok(!integrationRoute.includes("interactiveSender"), "endpoint publico nao deve importar sender experimental");
  assert.ok(runtimeService.includes("getRuntimeNativeInteractiveConfig"), "runtime deve montar botoes nativos internamente");
  assert.ok(eventCatalog.includes('new Set(["enabled", "text", "url", "buttons"])'), "contrato publico deve aceitar apenas campos de negocio do botao");
  assert.ok(!eventCatalog.includes("interactiveMessage"), "contrato publico nao deve aceitar payload tecnico do WhatsApp");
}

async function main() {
  assertBuilderShape();
  assertAdditionalNodesShape();
  assertMultipleCtaButtons();
  assertNativeButtons();
  assertValidation();
  await assertSenderRelay();
  await assertNativeSenderRelay();
  await assertSenderFallback();
  assertPublicContractUnchanged();
  console.log("interactive-cta-url-helper-api: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
