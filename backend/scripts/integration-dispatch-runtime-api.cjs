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
  createInMemoryIntegrationDispatchStore,
  createIntegrationDispatchLogService,
  createIntegrationDispatchRuntimeService,
  DEFAULT_INTEGRATION_IMAGE_FETCH_TIMEOUT_MS,
  downloadIntegrationImageAsset,
  INTEGRATION_DISPATCH_STATUS,
  IntegrationDispatchInstanceNotFoundError,
  IntegrationDispatchInstanceOfflineError,
  IntegrationDispatchRecipientMissingError,
  IntegrationDispatchSendFailedError,
  DEFAULT_INTEGRATION_DISPATCH_RETRY_MAX_ATTEMPTS,
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
  const sentPayloads = options.sentPayloads ?? [];
  let sendCounter = 0;

  const sock = options.sock ?? {
    user: { id: "5511911111111@s.whatsapp.net" },
    async sendMessage(jid, content) {
      sentPayloads.push({ jid, content });
      sendCounter += 1;
      return { key: { id: `wamid.${sendCounter}` } };
    },
  };

  const service = createIntegrationDispatchRuntimeService({
    logService,
    instanceLookup: options.instanceLookup ?? (async (instanceId) => ({ id: instanceId, status: "CONNECTED" })),
    socketLookup: options.socketLookup ?? (() => sock),
    imageDownloader: options.imageDownloader ?? (async () => ({ buffer: Buffer.from("image-data"), mimeType: "image/jpeg" })),
    templateService: options.templateService,
  });

  return { service, store, sentPayloads, sock };
}

(async () => {
  {
    assert.equal(DEFAULT_INTEGRATION_IMAGE_FETCH_TIMEOUT_MS, 10000);
  }

  {
    const originalFetch = global.fetch;
    let receivedSignal = null;
    global.fetch = async (_url, init) => {
      receivedSignal = init.signal;
      return {
        ok: true,
        headers: { get: () => "image/png" },
        async arrayBuffer() {
          return Buffer.from("downloaded-image");
        },
      };
    };

    try {
      const asset = await downloadIntegrationImageAsset("https://cdn.example.com/image.png", { timeoutMs: 50 });
      assert.equal(Buffer.compare(asset.buffer, Buffer.from("downloaded-image")), 0);
      assert.equal(asset.mimeType, "image/png");
      assert.equal(receivedSignal instanceof AbortSignal, true);
    } finally {
      global.fetch = originalFetch;
    }
  }

  {
    const originalFetch = global.fetch;
    global.fetch = async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        const error = new Error("image fetch aborted by timeout");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
    });

    try {
      await assert.rejects(
        () => downloadIntegrationImageAsset("https://cdn.example.com/slow-image.png", { timeoutMs: 1 }),
        (error) => error.name === "AbortError",
      );
    } finally {
      global.fetch = originalFetch;
    }
  }

  {
    const sentPayloads = [];
    const { service, store } = createDispatchService({
      sentPayloads,
      sock: {
        user: { id: "5511911111111@s.whatsapp.net" },
        async sendMessage(jid, content) {
          sentPayloads.push({ jid, content });
          return { key: { id: "wamid.link-only" } };
        },
      },
    });
    const result = await service.dispatchEvent({
      ingressLogId: "ingress-1",
      credentialId: "cred-1",
      instanceId: "instance-a",
      eventSlug: "pedido_pago",
      dedupKey: "evt-1",
      payload: createBasePayload(),
    });
    assert.equal(sentPayloads.length, 1);
    assert.equal(sentPayloads[0].jid, "5511998765432@s.whatsapp.net");
    assert.equal(sentPayloads[0].content.text.includes("Parabéns"), true);
    assert.equal(sentPayloads[0].content.text.includes("https://checkout.example.com/c/123"), true);
    assert.equal(sentPayloads[0].content.contextInfo, undefined);
    assert.equal(result.dispatchLog.dispatchStatus, INTEGRATION_DISPATCH_STATUS.SENT);
    assert.equal(result.dispatchLog.messageType, "text");
    assert.equal(result.dispatchLog.providerMessageId, "wamid.link-only");
    assert.equal(Array.from(store.logs.values())[0].dispatchStatus, INTEGRATION_DISPATCH_STATUS.SENT);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"deliveryPath":"text"'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"rawPhone":"(11) 99876-5432"'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"normalizedPhone":"5511998765432"'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"recipientJid":"5511998765432@s.whatsapp.net"'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"dispatchedMessageType":"text"'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"linkUrl":"https://checkout.example.com/c/123"'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"ctaButtonFormat"'), false);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"ctaProtocolTrace"'), false);
  }

  {
    const sentPayloads = [];
    const { service, store } = createDispatchService({
      sentPayloads,
      sock: {
        user: { id: "5511911111111@s.whatsapp.net" },
        async onWhatsApp(jid) {
          assert.equal(jid, "5511998765432@s.whatsapp.net");
          return [{ exists: true, jid: "5511998765432@s.whatsapp.net" }];
        },
        async sendMessage(jid, content) {
          sentPayloads.push({ jid, content });
          return { key: { id: "wamid.lookup-found" } };
        },
      },
    });
    await service.dispatchEvent({
      instanceId: "instance-a",
      eventSlug: "pedido_pago",
      dedupKey: "evt-lookup-found",
      payload: createBasePayload(),
    });
    const summary = Array.from(store.logs.values())[0].payloadSummaryJson;
    assert.equal(sentPayloads.length, 1);
    assert.equal(summary.includes('"whatsappLookupStatus":"found"'), true);
    assert.equal(summary.includes('"whatsappLookupJid":"5511998765432@s.whatsapp.net"'), true);
    assert.equal(summary.includes('"whatsappLookupExists":true'), true);
  }

  {
    const sentPayloads = [];
    const { service, store } = createDispatchService({
      sentPayloads,
      sock: {
        user: { id: "5511911111111@s.whatsapp.net" },
        async onWhatsApp() {
          return [{ exists: false, jid: "5511998765432@s.whatsapp.net" }];
        },
        async sendMessage(jid, content) {
          sentPayloads.push({ jid, content });
          return { key: { id: "wamid.lookup-not-found" } };
        },
      },
    });
    await service.dispatchEvent({
      instanceId: "instance-a",
      eventSlug: "pedido_pago",
      dedupKey: "evt-lookup-not-found",
      payload: createBasePayload(),
    });
    const summary = Array.from(store.logs.values())[0].payloadSummaryJson;
    assert.equal(sentPayloads.length, 1);
    assert.equal(summary.includes('"whatsappLookupStatus":"not_found"'), true);
    assert.equal(summary.includes('"whatsappLookupExists":false'), true);
  }

  {
    const sentPayloads = [];
    const { service, store } = createDispatchService({
      sentPayloads,
      sock: {
        user: { id: "5511911111111@s.whatsapp.net" },
        async onWhatsApp() {
          throw new Error("lookup failed token=secret-lookup-token");
        },
        async sendMessage(jid, content) {
          sentPayloads.push({ jid, content });
          return { key: { id: "wamid.lookup-error" } };
        },
      },
    });
    await service.dispatchEvent({
      instanceId: "instance-a",
      eventSlug: "pedido_pago",
      dedupKey: "evt-lookup-error",
      payload: createBasePayload(),
    });
    const summary = Array.from(store.logs.values())[0].payloadSummaryJson;
    assert.equal(sentPayloads.length, 1);
    assert.equal(summary.includes('"whatsappLookupStatus":"error"'), true);
    assert.equal(summary.includes('"whatsappLookupError":"lookup failed [REDACTED]"'), true);
    assert.equal(summary.includes("secret-lookup-token"), false);
  }

  {
    const sentPayloads = [];
    const { service, store } = createDispatchService({
      sentPayloads,
      sock: {
        user: { id: "5511911111111@s.whatsapp.net" },
        async sendMessage(jid, content) {
          sentPayloads.push({ jid, content });
          return { key: { id: "wamid.lookup-unavailable" } };
        },
      },
    });
    await service.dispatchEvent({
      instanceId: "instance-a",
      eventSlug: "pedido_pago",
      dedupKey: "evt-lookup-unavailable",
      payload: createBasePayload(),
    });
    const summary = Array.from(store.logs.values())[0].payloadSummaryJson;
    assert.equal(sentPayloads.length, 1);
    assert.equal(summary.includes('"whatsappLookupStatus":"unavailable"'), true);
    assert.equal(summary.includes('"whatsappLookupExists":null'), true);
  }

  {
    const sentPayloads = [];
    const { service, store } = createDispatchService({
      sentPayloads,
      sock: {
        user: { id: "5511911111111@s.whatsapp.net" },
        async onWhatsApp() {
          return [{ exists: true, jid: "5511998765432@s.whatsapp.net" }];
        },
        async sendMessage() {
          throw new Error("send failed");
        },
      },
    });
    await assert.rejects(
      () => service.dispatchEvent({
        instanceId: "instance-a",
        eventSlug: "pedido_pago",
        dedupKey: "evt-lookup-before-send-failure",
        payload: createBasePayload(),
      }),
      (error) => error instanceof IntegrationDispatchSendFailedError,
    );
    const summary = Array.from(store.logs.values())[0].payloadSummaryJson;
    assert.equal(sentPayloads.length, 0);
    assert.equal(summary.includes('"whatsappLookupStatus":"found"'), true);
    assert.equal(summary.includes('"whatsappLookupJid":"5511998765432@s.whatsapp.net"'), true);
  }

  {
    const payload = createBasePayload();
    payload.message = { body: "Texto externo aprovado para pedido pago" };
    const { service, sentPayloads, store } = createDispatchService();
    await service.dispatchEvent({
      instanceId: "instance-a",
      eventSlug: "pedido_pago",
      dedupKey: "evt-custom-body",
      payload,
    });
    const summary = Array.from(store.logs.values())[0].payloadSummaryJson;
    assert.equal(sentPayloads[0].content.text.includes("Texto externo aprovado para pedido pago"), true);
    assert.equal(sentPayloads[0].content.text.includes("https://checkout.example.com/c/123"), true);
    assert.equal(summary.includes('"customBodyUsed":true'), true);
    assert.equal(summary.includes('"customBodyLength":39'), true);
    assert.equal(summary.includes("Texto externo aprovado"), false);
  }
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
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"normalizedPhone":"5511998765432"'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"imageFallbackReason":null'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"secondaryDispatchStatus":"sent"'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"secondaryProviderMessageId":"wamid.2"'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"secondaryDispatchKind":"pix_copy_paste_text"'), true);
  }

  {
    const payload = createBasePayload();
    payload.message = {
      body: "Mensagem principal Pix externa",
      pix_followup_body: "Segunda mensagem Pix externa",
    };
    const { service, sentPayloads, store } = createDispatchService();
    await service.dispatchEvent({
      instanceId: "instance-a",
      eventSlug: "pix_gerado",
      dedupKey: "evt-custom-pix",
      payload,
    });
    const summary = Array.from(store.logs.values())[0].payloadSummaryJson;
    assert.equal(sentPayloads[0].content.caption, "Mensagem principal Pix externa");
    assert.equal(sentPayloads[1].content.text, "Segunda mensagem Pix externa");
    assert.equal(summary.includes('"customBodyUsed":true'), true);
    assert.equal(summary.includes('"customPixFollowupUsed":true'), true);
    assert.equal(summary.includes('"customPixFollowupLength":28'), true);
    assert.equal(summary.includes("Segunda mensagem Pix externa"), false);
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
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"deliveryPath":"text"'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"imageFallbackReason":null'), true);
  }

  {
    const { service, sentPayloads, store } = createDispatchService({
      imageDownloader: async () => {
        const error = new Error("image fetch aborted by timeout");
        error.name = "AbortError";
        throw error;
      },
    });
    await service.dispatchEvent({
      instanceId: "instance-a",
      eventSlug: "pix_gerado",
      dedupKey: "evt-image-timeout",
      payload: createBasePayload(),
    });
    assert.equal(sentPayloads[0].content.text.includes("PIX"), true);
    assert.equal(sentPayloads[0].content.text.includes("https://checkout.example.com/c/123"), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"imageFallbackReason":"image_download_failed"'), true);
    assert.equal(Array.from(store.logs.values())[0].payloadSummaryJson.includes('"deliveryPath":"text_fallback_image"'), true);
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
      sentPayloads,
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
    const log = Array.from(store.logs.values())[0];
    assert.equal(log.dispatchStatus, INTEGRATION_DISPATCH_STATUS.FAILED_INSTANCE_OFFLINE);
    assert.equal(log.retryable, true);
    assert.equal(log.retryAttemptCount, 1);
    assert.equal(log.lastRetryError, "INTEGRATION_DISPATCH_INSTANCE_OFFLINE");
    assert.equal(log.nextRetryAt instanceof Date, true);
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
    const log = Array.from(store.logs.values())[0];
    assert.equal(log.dispatchStatus, INTEGRATION_DISPATCH_STATUS.FAILED_RECIPIENT_MISSING);
    assert.equal(log.retryable, false);
    assert.equal(log.nextRetryAt, null);
  }

  {
    const { service, store } = createDispatchService({
      sock: {
        async sendMessage() {
          const error = new Error("send failed with provider timeout");
          error.name = "ProviderTimeoutError";
          error.code = "ETIMEDOUT";
          throw error;
        },
      },
    });
    await assert.rejects(
      () => service.dispatchEvent({
        instanceId: "instance-a",
        eventSlug: "pedido_pago",
        payload: createBasePayload(),
      }),
      (error) => {
        assert.equal(error instanceof IntegrationDispatchSendFailedError, true);
        assert.equal(error.providerSendError.providerSendErrorCode, "ETIMEDOUT");
        assert.equal(error.providerSendError.providerSendErrorType, "ProviderTimeoutError");
        assert.equal(error.providerSendError.providerSendErrorMessage, "send failed with provider timeout");
        return true;
      },
    );
    const log = Array.from(store.logs.values())[0];
    assert.equal(log.dispatchStatus, INTEGRATION_DISPATCH_STATUS.FAILED_SEND);
    assert.equal(log.retryable, true);
    assert.equal(log.retryAttemptCount, 1);
    assert.equal(log.failureCode, "INTEGRATION_DISPATCH_SEND_FAILED");
    assert.equal(log.payloadSummaryJson.includes('"providerSendErrorCode":"ETIMEDOUT"'), true);
    assert.equal(log.payloadSummaryJson.includes('"providerSendErrorType":"ProviderTimeoutError"'), true);
    assert.equal(log.payloadSummaryJson.includes('"providerSendErrorMessage":"send failed with provider timeout"'), true);
  }

  {
    const { service, store } = createDispatchService({
      sock: {
        async sendMessage() {
          const error = new Error("provider denied token=super-secret-token Authorization: Bearer secret-token-123");
          error.name = "ProviderAuthError";
          error.code = "AUTH_FAILED";
          throw error;
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
    const summary = Array.from(store.logs.values())[0].payloadSummaryJson;
    assert.equal(summary.includes('"providerSendErrorCode":"AUTH_FAILED"'), true);
    assert.equal(summary.includes('"providerSendErrorType":"ProviderAuthError"'), true);
    assert.equal(summary.includes('"providerSendErrorMessage":"provider denied [REDACTED] [REDACTED]"'), true);
    assert.equal(summary.includes("super-secret-token"), false);
    assert.equal(summary.includes("secret-token-123"), false);
    assert.equal(summary.includes("Authorization"), false);
  }

  {
    const { service, store } = createDispatchService({
      sock: {
        async sendMessage() {
          throw { status: 503 };
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
    const summary = Array.from(store.logs.values())[0].payloadSummaryJson;
    assert.equal(summary.includes('"providerSendErrorCode":"503"'), true);
    assert.equal(summary.includes('"providerSendErrorType":null'), true);
    assert.equal(summary.includes('"providerSendErrorMessage":"Falha do provider no sendMessage"'), true);
  }

  {
    const { service, store } = createDispatchService();
    const initialLog = await store.createLog({
      ingressLogId: "ingress-retry-success",
      credentialId: "credential-a",
      instanceId: "instance-a",
      eventSlug: "pedido_pago",
      dedupKey: "dedup-retry-success",
      recipientJid: "5511999999999@s.whatsapp.net",
      dispatchStatus: INTEGRATION_DISPATCH_STATUS.FAILED_INSTANCE_OFFLINE,
      retryable: true,
      retryAttemptCount: 1,
      nextRetryAt: new Date(0),
    });
    const result = await service.retryDispatch({
      dispatchLog: initialLog,
      payload: createBasePayload(),
    });
    assert.equal(result.dispatchLog.id, initialLog.id);
    assert.equal(result.dispatchLog.dispatchStatus, INTEGRATION_DISPATCH_STATUS.SENT);
    assert.equal(result.dispatchLog.retryable, false);
    assert.equal(result.dispatchLog.retryAttemptCount, 2);
    assert.equal(result.dispatchLog.nextRetryAt, null);
    assert.equal(store.logs.size, 1);
  }

  {
    const { service, store } = createDispatchService({
      sock: {
        async sendMessage() {
          throw new Error("send failed");
        },
      },
    });
    const initialLog = await store.createLog({
      ingressLogId: "ingress-exhausted",
      credentialId: "credential-a",
      instanceId: "instance-a",
      eventSlug: "pedido_pago",
      dedupKey: "dedup-exhausted",
      recipientJid: "5511999999999@s.whatsapp.net",
      dispatchStatus: INTEGRATION_DISPATCH_STATUS.FAILED_SEND,
      retryable: true,
      retryAttemptCount: DEFAULT_INTEGRATION_DISPATCH_RETRY_MAX_ATTEMPTS - 1,
      nextRetryAt: new Date(0),
    });
    await assert.rejects(
      () => service.retryDispatch({
        dispatchLog: initialLog,
        payload: createBasePayload(),
      }),
      (error) => error instanceof IntegrationDispatchSendFailedError,
    );
    const log = store.logs.get(initialLog.id);
    assert.equal(log.dispatchStatus, INTEGRATION_DISPATCH_STATUS.FAILED_SEND);
    assert.equal(log.retryable, false);
    assert.equal(log.retryAttemptCount, DEFAULT_INTEGRATION_DISPATCH_RETRY_MAX_ATTEMPTS);
    assert.equal(log.retryExhaustedAt instanceof Date, true);
  }

  console.log("integration-dispatch-runtime-api: OK");
})().catch((error) => {
  console.error("integration-dispatch-runtime-api:", error);
  process.exit(1);
});
