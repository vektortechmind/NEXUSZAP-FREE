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
const {
  buildBaileysDispatchPayload,
  buildRealCtaMessage,
  createInMemoryIntegrationDispatchStore,
  createIntegrationDispatchLogService,
  createIntegrationDispatchRuntimeService,
  INTEGRATION_CTA_FORMAT_MATRIX,
  INTEGRATION_DISPATCH_STATUS,
  IntegrationDispatchInstanceNotFoundError,
  IntegrationDispatchInstanceOfflineError,
  IntegrationDispatchRecipientMissingError,
  IntegrationDispatchSendFailedError,
  resolveIntegrationCtaButtonFormat,
} = require("../src/services/integrations/integrationDispatchRuntime.service.ts");

function createBasePayload() {
  return {
    customer: { name: "Maria", phone: "(11) 99876-5432" },
    order: {
      total: "199.90",
      product: { name: "Curso Premium", image: "https://cdn.example.com/curso-premium.jpg" },
    },
    subscription: {
      user: { phone: "31988887777", name: "Assinante VIP" },
      product: { name: "Clube VIP", image: "https://cdn.example.com/clube-vip.jpg" },
    },
    checkout_link: "https://checkout.example.com/c/123",
    pix: {
      copy_paste: "000201PIX-COPIA-COLA",
    },
    boleto: {
      pdf_url: "https://checkout.example.com/boleto.pdf",
      amount: "149.90",
      expire_at: "2026-06-15",
      barcode: "123456",
    },
    access: {
      url: "https://members.example.com/aula-1",
      login: "maria@example.com",
      password: "temporary-pass",
    },
  };
}

function createDispatchService(options = {}) {
  const store = createInMemoryIntegrationDispatchStore();
  const logService = createIntegrationDispatchLogService(store);
  const sentPayloads = [];
  const relayedPayloads = [];
  let sendCounter = 0;
  const sock = options.sock ?? {
    user: { id: "5511911111111@s.whatsapp.net" },
    async sendMessage(jid, content) {
      sentPayloads.push({ jid, content });
      sendCounter += 1;
      return { key: { id: `wamid.${sendCounter}` } };
    },
    async relayMessage(jid, message, options) {
      relayedPayloads.push({ jid, message, options });
      return options?.messageId || "relay.wamid.123";
    },
  };

  const service = createIntegrationDispatchRuntimeService({
    logService,
    instanceLookup: options.instanceLookup ?? (async (instanceId) => ({ id: instanceId, status: "CONNECTED" })),
    socketLookup: options.socketLookup ?? (() => sock),
    imageDownloader: options.imageDownloader ?? (async () => ({ buffer: Buffer.from("image-data"), mimeType: "image/jpeg" })),
    templateService: options.templateService,
  });

  return { service, store, sentPayloads, relayedPayloads, sock };
}

async function withCtaFormat(format, run) {
  const previous = process.env.INTEGRATION_CTA_BUTTON_FORMAT;
  if (format === undefined || format === null) {
    delete process.env.INTEGRATION_CTA_BUTTON_FORMAT;
  } else {
    process.env.INTEGRATION_CTA_BUTTON_FORMAT = format;
  }

  try {
    return await run();
  } finally {
    if (previous === undefined) {
      delete process.env.INTEGRATION_CTA_BUTTON_FORMAT;
    } else {
      process.env.INTEGRATION_CTA_BUTTON_FORMAT = previous;
    }
  }
}

(async () => {
  {
    const { service, store, sentPayloads, relayedPayloads } = createDispatchService();
    const result = await service.dispatchEvent({
      ingressLogId: "ingress-1",
      credentialId: "cred-1",
      instanceId: "instance-a",
      eventSlug: "pedido_pago",
      dedupKey: "evt-1",
      payload: createBasePayload(),
    });
    assert.equal(sentPayloads.length, 0);
    assert.equal(relayedPayloads[0].jid, "5511998765432@s.whatsapp.net");
    assert.equal(relayedPayloads[0].message.templateMessage.hydratedTemplate.hydratedContentText, result.template.body);
    assert.equal(relayedPayloads[0].message.templateMessage.hydratedTemplate.hydratedButtons[0].urlButton.displayText, "Acessar agora");
    assert.equal(relayedPayloads[0].message.templateMessage.hydratedTemplate.hydratedButtons[0].urlButton.url, "https://checkout.example.com/c/123");
    assert.equal(relayedPayloads[0].message.messageContextInfo.messageSecret.length, 32);
    assert.equal(result.dispatchLog.dispatchStatus, INTEGRATION_DISPATCH_STATUS.SENT);
    assert.equal(result.dispatchLog.messageType, "template");
    assert.equal(result.dispatchLog.providerMessageId, relayedPayloads[0].options.messageId);
    assert.equal(Array.from(store.logs.values())[0].dispatchStatus, INTEGRATION_DISPATCH_STATUS.SENT);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"usedRealCtaButton":true'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"deliveryPath":"template_cta"'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"ctaButtonFormat":"template_hydrated"'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"ctaTransport":"relay_message"'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"messageSecretByteLength":32'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"reportingTokenFieldCovered":true'), true);
  }

  await withCtaFormat("buttons_message", async () => {
    const { service, store, relayedPayloads } = createDispatchService();
    const result = await service.dispatchEvent({
      instanceId: "instance-a",
      eventSlug: "pedido_pago",
      dedupKey: "evt-buttons-matrix",
      payload: createBasePayload(),
    });
    assert.equal(service.ctaButtonFormat, "buttons_message");
    assert.equal(relayedPayloads[0].message.buttonsMessage.contentText, result.template.body);
    assert.equal(relayedPayloads[0].message.buttonsMessage.buttons[0].type, 2);
    assert.equal(relayedPayloads[0].message.buttonsMessage.buttons[0].nativeFlowInfo.name, "cta_url");
    assert.equal(relayedPayloads[0].message.messageContextInfo.messageSecret.length, 32);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"deliveryPath":"buttons_cta"'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"ctaButtonFormat":"buttons_message"'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"reportingTokenFieldCovered":false'), true);
  });

  await withCtaFormat("interactive_native_flow", async () => {
    const { service, store, relayedPayloads } = createDispatchService();
    await service.dispatchEvent({
      instanceId: "instance-a",
      eventSlug: "pedido_pago",
      dedupKey: "evt-interactive-matrix",
      payload: createBasePayload(),
    });
    assert.equal(service.ctaButtonFormat, "interactive_native_flow");
    assert.equal(relayedPayloads[0].message.interactiveMessage.body.text.includes("Parabéns"), true);
    assert.equal(relayedPayloads[0].message.interactiveMessage.nativeFlowMessage.buttons[0].name, "cta_url");
    assert.equal(relayedPayloads[0].message.messageContextInfo.messageSecret.length, 32);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"deliveryPath":"interactive_cta"'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"ctaButtonFormat":"interactive_native_flow"'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"reportingTokenFieldCovered":false'), true);
  });

  {
    const { service, sentPayloads } = createDispatchService();
    await service.dispatchEvent({
      instanceId: "instance-a",
      eventSlug: "pagamento_recusado",
      dedupKey: "evt-text-reply",
      payload: createBasePayload(),
    });
    assert.equal(sentPayloads[0].content.text.includes("Tente novamente"), true);
    assert.equal(sentPayloads[0].content.contextInfo.externalAdReply.title, "Tentar novamente");
    assert.equal(sentPayloads[0].content.contextInfo.externalAdReply.sourceUrl, "https://checkout.example.com/c/123");
  }

  {
    const { service, sentPayloads } = createDispatchService();
    await service.dispatchEvent({
      instanceId: "instance-a",
      eventSlug: "boleto_gerado",
      dedupKey: "evt-doc",
      payload: createBasePayload(),
    });
    assert.deepEqual(sentPayloads[0].content, {
      document: { url: "https://checkout.example.com/boleto.pdf" },
      mimetype: "application/pdf",
      fileName: "boleto.pdf",
      caption: sentPayloads[0].content.caption,
      contextInfo: sentPayloads[0].content.contextInfo,
    });
    assert.equal(sentPayloads[0].content.contextInfo.externalAdReply.title, "Baixar boleto");
  }

  {
    const { service, sentPayloads, store } = createDispatchService();
    const result = await service.dispatchEvent({
      instanceId: "instance-a",
      eventSlug: "pix_gerado",
      dedupKey: "evt-image-success",
      payload: createBasePayload(),
    });
    assert.equal(sentPayloads[0].jid, "5511998765432@s.whatsapp.net");
    assert.deepEqual(sentPayloads[0].content.image, Buffer.from("image-data"));
    assert.equal(sentPayloads[0].content.caption, result.template.body);
    assert.equal(sentPayloads[0].content.contextInfo, undefined);
    assert.equal(sentPayloads[0].content.caption.includes("Codigo Pix copia e cola"), true);
    assert.equal(sentPayloads[0].content.caption.includes("logo abaixo"), true);
    assert.equal(sentPayloads[1].content.text, "000201PIX-COPIA-COLA");
    assert.equal(result.dispatchLog.messageType, "image");
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"deliveryPath":"image_clean"'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"imageFallbackReason":null'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"secondaryDispatchStatus":"sent"'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"secondaryDispatchKind":"pix_copy_paste_text"'), true);
  }

  {
    const { service, sentPayloads, store } = createDispatchService({
      sock: {
        user: { id: "5511911111111@s.whatsapp.net" },
        async sendMessage(jid, content) {
          sentPayloads.push({ jid, content });
          return { key: { id: "wamid.123" } };
        },
        async relayMessage() {
          throw new Error("relay failed");
        },
      },
    });
    const result = await service.dispatchEvent({
      instanceId: "instance-a",
      eventSlug: "pedido_pago",
      dedupKey: "evt-img-fallback",
      payload: createBasePayload(),
    });
    assert.equal(sentPayloads[0].content.text.includes("Parabéns"), true);
    assert.equal(sentPayloads[0].content.text.includes("https://checkout.example.com/c/123"), true);
    assert.equal(sentPayloads[0].content.contextInfo, undefined);
    assert.equal(result.dispatchLog.messageType, "text");
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"buttonFallbackReason":"button_dispatch_failed"'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"deliveryPath":"text_fallback_button"'), true);
  }

  {
    const { service, sentPayloads, store } = createDispatchService({
      sock: {
        async sendMessage(jid, content) {
          sentPayloads.push({ jid, content });
          return { key: { id: "wamid.123" } };
        },
      },
    });
    await service.dispatchEvent({
      instanceId: "instance-a",
      eventSlug: "pedido_pago",
      dedupKey: "evt-no-image",
      payload: createBasePayload(),
    });
    assert.equal(sentPayloads[0].content.text.includes("Parabéns"), true);
    assert.equal(sentPayloads[0].content.text.includes("https://checkout.example.com/c/123"), true);
    assert.equal(sentPayloads[0].content.contextInfo, undefined);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"buttonFallbackReason":"unsupported_socket_transport"'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"deliveryPath":"text_fallback_button"'), true);
  }

  {
    const { service, sentPayloads, store } = createDispatchService({
      sock: {
        async sendMessage(jid, content) {
          sentPayloads.push({ jid, content });
          return { key: { id: "wamid.123" } };
        },
      },
      templateService: {
        renderTemplateFromContext(context) {
          return {
            eventSlug: context.eventSlug,
            messageType: "image",
            title: "Synthetic invalid image",
            body: "Texto principal",
            caption: "Texto principal",
            linkUrl: "https://checkout.example.com/c/123",
            documentUrl: null,
            imageUrl: "ftp://invalid-image.example.com/file.png",
            fileName: null,
            mimeType: null,
            externalAdReply: {
              title: "Curso Premium",
              body: "Clique para acessar",
              sourceUrl: "https://checkout.example.com/c/123",
              mediaType: 1,
            },
            context,
          };
        },
      },
    });
    await service.dispatchEvent({
      instanceId: "instance-a",
      eventSlug: "pedido_pago",
      dedupKey: "evt-invalid-image",
      payload: createBasePayload(),
    });
    assert.equal(sentPayloads[0].content.text.includes("https://checkout.example.com/c/123"), true);
    assert.equal(sentPayloads[0].content.contextInfo, undefined);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"buttonFallbackReason":"unsupported_socket_transport"'), true);
  }

  {
    const payload = createBasePayload();
    payload.order.product.image = "   ";
    const { service, sentPayloads, store } = createDispatchService();
    await service.dispatchEvent({
      instanceId: "instance-a",
      eventSlug: "pix_gerado",
      dedupKey: "evt-image-missing",
      payload,
    });
    assert.equal(sentPayloads[0].content.text.includes("PIX"), true);
    assert.equal(sentPayloads[0].content.text.includes("Codigo Pix copia e cola"), true);
    assert.equal(sentPayloads[0].content.text.includes("logo abaixo"), true);
    assert.equal(sentPayloads[0].content.text.includes("https://checkout.example.com/c/123"), true);
    assert.equal(sentPayloads[0].content.contextInfo.externalAdReply.title, "Visualizar pedido");
    assert.equal(sentPayloads[1].content.text, "000201PIX-COPIA-COLA");
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"imageFallbackReason":"missing_image_url"'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"deliveryPath":"text_fallback_image"'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"secondaryDispatchStatus":"sent"'), true);
  }

  {
    const payload = createBasePayload();
    delete payload.pix;
    const { service, sentPayloads, store } = createDispatchService();
    await service.dispatchEvent({
      instanceId: "instance-a",
      eventSlug: "pix_gerado",
      dedupKey: "evt-no-pix-code",
      payload,
    });
    assert.equal(sentPayloads.length, 1);
    assert.equal(sentPayloads[0].content.caption.includes("Codigo Pix"), false);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"secondaryDispatchStatus":"skipped_missing_pix_code"'), true);
  }

  {
    const sentPayloads = [];
    let sendCount = 0;
    const { service, store } = createDispatchService({
      sock: {
        user: { id: "5511911111111@s.whatsapp.net" },
        async sendMessage(jid, content) {
          sentPayloads.push({ jid, content });
          sendCount += 1;
          if (sendCount === 2) {
            throw new Error("followup failed");
          }
          return { key: { id: `wamid.${sendCount}` } };
        },
        async relayMessage(jid, message, options) {
          return options?.messageId || "relay.wamid.123";
        },
      },
    });
    const result = await service.dispatchEvent({
      instanceId: "instance-a",
      eventSlug: "pix_gerado",
      dedupKey: "evt-followup-failed",
      payload: createBasePayload(),
    });
    assert.equal(result.dispatchLog.dispatchStatus, INTEGRATION_DISPATCH_STATUS.SENT);
    assert.equal(sentPayloads.length, 2);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"secondaryDispatchStatus":"failed_send"'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"secondaryDispatchFailureCode":"send_failed"'), true);
  }

  {
    const payload = createBasePayload();
    delete payload.checkout_link;
    payload.order.product.image = "   ";
    const { service, sentPayloads } = createDispatchService();
    await service.dispatchEvent({
      instanceId: "instance-a",
      eventSlug: "assinatura_em_atraso",
      dedupKey: "evt-no-url-no-image",
      payload,
    });
    assert.equal(sentPayloads[0].content.text.includes("Regularize agora"), true);
    assert.equal(sentPayloads[0].content.contextInfo, undefined);
  }

  {
    const { service } = createDispatchService();
    const template = {
      eventSlug: "pedido_pendente",
      messageType: "link",
      title: "Synthetic",
      body: "Use o link abaixo",
      caption: null,
      linkUrl: "https://checkout.example.com/c/123",
      documentUrl: null,
      imageUrl: null,
      fileName: null,
      mimeType: null,
      externalAdReply: null,
      context: { eventSlug: "pedido_pendente" },
    };
    const payload = buildBaileysDispatchPayload(template);
    assert.equal(payload.text, "Use o link abaixo\n\nhttps://checkout.example.com/c/123");
    assert.equal(typeof service.buildBaileysPayload, "function");
  }

  {
    const template = {
      eventSlug: "pedido_pago",
      messageType: "image",
      title: "Synthetic image",
      body: "Texto principal",
      caption: "Texto principal",
      linkUrl: "https://checkout.example.com/c/123",
      documentUrl: null,
      imageUrl: "https://cdn.example.com/file.jpg",
      fileName: null,
      mimeType: null,
      externalAdReply: {
        title: "Curso Premium",
        body: "Clique para acessar",
        sourceUrl: "https://checkout.example.com/c/123",
        mediaType: 1,
      },
      context: { eventSlug: "pedido_pago" },
    };
    const payload = buildBaileysDispatchPayload(template, { imageBuffer: Buffer.from("image-data"), imageMimeType: "image/jpeg" });
    assert.deepEqual(payload.image, Buffer.from("image-data"));
    assert.equal(payload.caption, "Texto principal");
    assert.equal(payload.contextInfo, undefined);
  }
  {
    const template = {
      eventSlug: "pedido_pago",
      messageType: "image",
      title: "Synthetic image",
      body: "Texto principal",
      caption: "Texto principal",
      linkUrl: "https://checkout.example.com/c/123",
      documentUrl: null,
      imageUrl: null,
      fileName: null,
      mimeType: null,
      externalAdReply: {
        title: "Curso Premium",
        body: "Clique para acessar",
        sourceUrl: "https://checkout.example.com/c/123",
        mediaType: 1,
      },
      context: { eventSlug: "pedido_pago" },
    };
    const payload = buildBaileysDispatchPayload(template, { imageBuffer: null, imageMimeType: null });
    assert.equal(payload.text, "Texto principal\n\nhttps://checkout.example.com/c/123");
    assert.equal(payload.contextInfo.externalAdReply.sourceUrl, "https://checkout.example.com/c/123");
  }

  {
    const template = {
      eventSlug: "pedido_pago",
      messageType: "image",
      title: "Synthetic CTA",
      body: "Texto principal",
      caption: "Texto principal",
      linkUrl: "https://checkout.example.com/c/123",
      documentUrl: null,
      imageUrl: "https://cdn.example.com/file.jpg",
      fileName: null,
      mimeType: null,
      externalAdReply: null,
      followup: null,
      context: { eventSlug: "pedido_pago" },
    };
    const templatePayload = buildRealCtaMessage(template, "template_hydrated");
    const buttonsPayload = buildRealCtaMessage(template, "buttons_message");
    const interactivePayload = buildRealCtaMessage(template, "interactive_native_flow");
    assert.equal(templatePayload.templateMessage.hydratedTemplate.hydratedButtons[0].urlButton.url, "https://checkout.example.com/c/123");
    assert.equal(templatePayload.messageContextInfo.messageSecret.length, 32);
    assert.equal(buttonsPayload.buttonsMessage.buttons[0].nativeFlowInfo.paramsJson.includes('display_text'), true);
    assert.equal(buttonsPayload.messageContextInfo.messageSecret.length, 32);
    assert.equal(interactivePayload.interactiveMessage.nativeFlowMessage.buttons[0].buttonParamsJson.includes('https://checkout.example.com/c/123'), true);
    assert.equal(interactivePayload.messageContextInfo.messageSecret.length, 32);
    assert.equal(INTEGRATION_CTA_FORMAT_MATRIX.length, 3);
    assert.equal(resolveIntegrationCtaButtonFormat("invalid-value"), "template_hydrated");
  }

  {
    const { service, store } = createDispatchService({
      instanceLookup: async () => null,
      socketLookup: () => null,
    });
    await assert.rejects(
      () => service.dispatchEvent({
        instanceId: "missing-instance",
        eventSlug: "pedido_pago",
        payload: createBasePayload(),
      }),
      (error) => error instanceof IntegrationDispatchInstanceNotFoundError,
    );
    assert.equal(Array.from(store.logs.values())[0].dispatchStatus, INTEGRATION_DISPATCH_STATUS.FAILED_INSTANCE_NOT_FOUND);
  }

  {
    const { service, store } = createDispatchService({
      instanceLookup: async (instanceId) => ({ id: instanceId, status: "DISCONNECTED" }),
      socketLookup: () => null,
    });
    await assert.rejects(
      () => service.dispatchEvent({
        instanceId: "offline-instance",
        eventSlug: "pedido_pago",
        payload: createBasePayload(),
      }),
      (error) => error instanceof IntegrationDispatchInstanceOfflineError,
    );
    assert.equal(Array.from(store.logs.values())[0].dispatchStatus, INTEGRATION_DISPATCH_STATUS.FAILED_INSTANCE_OFFLINE);
  }

  {
    const payload = createBasePayload();
    delete payload.customer.phone;
    delete payload.order;
    delete payload.subscription;
    const { service, store } = createDispatchService();
    await assert.rejects(
      () => service.dispatchEvent({
        instanceId: "instance-a",
        eventSlug: "pedido_pago",
        payload,
      }),
      (error) => error instanceof IntegrationDispatchRecipientMissingError,
    );
    assert.equal(Array.from(store.logs.values())[0].dispatchStatus, INTEGRATION_DISPATCH_STATUS.FAILED_RECIPIENT_MISSING);
  }

  {
    const { service, store } = createDispatchService({
      sock: {
        async sendMessage() {
          throw new Error("send failed");
        },
      },
    });
    await assert.rejects(
      () => service.dispatchEvent({
        instanceId: "instance-a",
        eventSlug: "pedido_pago",
        payload: createBasePayload(),
      }),
      (error) => error instanceof IntegrationDispatchSendFailedError,
    );
    assert.equal(Array.from(store.logs.values())[0].dispatchStatus, INTEGRATION_DISPATCH_STATUS.FAILED_SEND);
  }

  console.log("integration-dispatch-runtime-api: OK");
})().catch((error) => {
  console.error("integration-dispatch-runtime-api:", error);
  process.exit(1);
});



