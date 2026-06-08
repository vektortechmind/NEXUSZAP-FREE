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
  SUPPORTED_INTEGRATION_EVENT_SLUGS,
  normalizeIntegrationEventContext,
} = require("../src/services/integrations/integrationEventCatalog.service.ts");
const {
  MissingIntegrationTemplateUrlError,
  renderIntegrationDispatchTemplate,
  renderIntegrationDispatchTemplateFromContext,
} = require("../src/services/integrations/integrationDispatchTemplate.service.ts");

function createBasePayload() {
  return {
    customer: {
      name: "Maria Cliente",
      email: "maria@example.com",
      phone: "(11) 99876-5432",
      cpf: "12345678900",
    },
    order: {
      total: "199.90",
      product: {
        name: "Curso Premium",
        image: "products/curso-premium/capa.jpg",
      },
      product_offer: { name: "Oferta Relampago" },
      subscription_plan: { name: "Plano Anual" },
    },
    checkout_session: {
      total: "87.50",
      name: "Lead Carrinho",
      phone: "31987654321",
      product: {
        name: "Produto do Carrinho",
        image: "products/carrinho/imagem.png",
      },
    },
    subscription: {
      next_billing: "59.90",
      user: { phone: "31988887777", email: "assinatura@example.com", name: "Assinante VIP" },
      product: { name: "Clube VIP", image: "products/clube-vip/capa.png" },
      subscription_plan: { name: "Plano Mensal" },
    },
    checkout_link: "https://checkout.example.com/c/123",
    pix: {
      qrcode: "data:image/png;base64,abc",
      copy_paste: "000201PIX-COPIA-COLA",
      transaction_id: "tx-123",
    },
    boleto: {
      amount: "149.90",
      expire_at: "2026-06-15",
      barcode: "34191.79001 01043.510047 91020.150008 5 87470026000",
      pdf_url: "https://checkout.example.com/boleto.pdf",
    },
    access: {
      url: "https://members.example.com/aula-1",
      login: "maria@example.com",
      password: "temporary-pass",
      instructions: "Acesse e altere sua senha no primeiro login.",
      expires_at: "2026-07-01T12:00:00Z",
    },
    message: "TEXTO EXTERNO MALICIOSO",
    text: "IGNORAR TEXTO BRUTO",
    template: "IGNORAR TEMPLATE BRUTO",
  };
}

function payloadForEvent(eventSlug) {
  const payload = createBasePayload();

  if (eventSlug === "carrinho_abandonado") {
    delete payload.customer.phone;
    delete payload.order;
    delete payload.subscription;
  }

  if (eventSlug.startsWith("assinatura_")) {
    delete payload.order;
    delete payload.checkout_session;
    payload.customer.phone = null;
    payload.subscription.product = { name: "Comunidade de Assinantes", image: "products/comunidade/capa.jpg" };
  }

  return payload;
}

function assertNoRawLeak(template) {
  assert.equal(template.body.includes("TEXTO EXTERNO MALICIOSO"), false);
  assert.equal(template.body.includes("IGNORAR TEXTO BRUTO"), false);
  assert.equal(template.body.includes("IGNORAR TEMPLATE BRUTO"), false);
  assert.equal(template.body.includes("undefined"), false);
  assert.equal(template.body.includes("null"), false);
  assert.equal(template.body.includes("[object Object]"), false);
}

(() => {
  const imageEvents = new Set([
    "pedido_pago",
    "pix_gerado",
    "carrinho_abandonado",
    "envio_acesso",
    "assinatura_criada",
    "assinatura_em_atraso",
  ]);
  const externalReplyEvents = new Set([
    "pedido_pago",
    "pagamento_recusado",
    "pix_gerado",
    "boleto_gerado",
    "carrinho_abandonado",
    "envio_acesso",
    "assinatura_criada",
    "assinatura_em_atraso",
  ]);

  for (const eventSlug of SUPPORTED_INTEGRATION_EVENT_SLUGS) {
    const payload = payloadForEvent(eventSlug);
    const rendered = renderIntegrationDispatchTemplate(eventSlug, payload);

    assert.equal(rendered.eventSlug, eventSlug);
    assert.deepEqual(rendered.context, normalizeIntegrationEventContext(eventSlug, payload));
    assert.equal(typeof rendered.body, "string");
    assert.ok(rendered.body.length > 0);
    assertNoRawLeak(rendered);

    if (imageEvents.has(eventSlug)) {
      assert.equal(rendered.messageType, "image");
      assert.equal(rendered.caption, rendered.body);
      assert.equal(typeof rendered.imageUrl === "string" || rendered.imageUrl === null, true);
    }

    if (!imageEvents.has(eventSlug) && eventSlug !== "boleto_gerado") {
      assert.equal(rendered.messageType, "text");
      assert.equal(rendered.imageUrl, null);
      assert.equal(rendered.documentUrl, null);
    }

    if (eventSlug === "boleto_gerado") {
      assert.equal(rendered.messageType, "document");
      assert.equal(rendered.documentUrl, "https://checkout.example.com/boleto.pdf");
      assert.equal(rendered.fileName, "boleto.pdf");
      assert.equal(rendered.mimeType, "application/pdf");
      assert.equal(rendered.caption, rendered.body);
      assert.equal(rendered.externalAdReply.title, "Baixar boleto");
      assert.equal(rendered.body.includes("34191.79001"), false);
      assert.equal(rendered.body.includes("Linha digitável"), true);
      assert.equal(rendered.body.includes("logo abaixo"), true);
      assert.equal(rendered.followup.type, "boleto_barcode_text");
      assert.equal(rendered.followup.body, "34191.79001 01043.510047 91020.150008 5 87470026000");
    }

    if (externalReplyEvents.has(eventSlug)) {
      assert.ok(rendered.externalAdReply);
      assert.equal(rendered.externalAdReply.mediaType, 1);
      assert.equal(typeof rendered.externalAdReply.sourceUrl, "string");
    } else {
      assert.equal(rendered.externalAdReply, null);
    }
  }

  {
    const rendered = renderIntegrationDispatchTemplate("pedido_pago", payloadForEvent("pedido_pago"));
    assert.equal(rendered.body, "✅ *Parabéns Maria Cliente!*\n\nSeu *Curso Premium* foi aprovado com sucesso!\n\n👉 Acesse agora sua área de membros e comece a aprender.");
    assert.equal(rendered.externalAdReply.title, "Curso Premium");
    assert.equal(rendered.externalAdReply.body, "Clique para acessar");
  }

  {
    const payload = payloadForEvent("pedido_pago");
    payload.order_bumps = [{ name: "Mentoria VIP", amount: "20.00", currency: "BRL" }];
    const rendered = renderIntegrationDispatchTemplate("pedido_pago", payload);
    assert.equal(rendered.messageType, "image");
    assert.equal(rendered.body.includes("Itens adicionais:\n- Mentoria VIP - R$ 20,00"), true);
    assert.equal(rendered.caption, rendered.body);
  }

  {
    const payload = payloadForEvent("pedido_pendente");
    payload.order_bumps = [{ name: "Mentoria VIP", amount: "20.00", currency: "BRL" }];
    const rendered = renderIntegrationDispatchTemplate("pedido_pendente", payload);
    assert.equal(rendered.messageType, "text");
    assert.equal(rendered.caption, null);
    assert.equal(rendered.body.includes("Itens adicionais:\n- Mentoria VIP - R$ 20,00"), true);
  }

  {
    const rendered = renderIntegrationDispatchTemplate("pagamento_recusado", payloadForEvent("pagamento_recusado"));
    assert.equal(rendered.messageType, "text");
    assert.equal(rendered.body.includes("• Cartão sem limite"), true);
    assert.equal(rendered.body.includes("↗ *Tentar novamente*\nhttps://checkout.example.com/c/123"), true);
    assert.equal(rendered.externalAdReply.title, "Tentar novamente");
    assert.equal(rendered.linkUrl, "https://checkout.example.com/c/123");
  }

  {
    const rendered = renderIntegrationDispatchTemplate("pix_gerado", payloadForEvent("pix_gerado"));
    assert.equal(rendered.body.includes("R$ 199.90"), true);
    assert.equal(rendered.body.includes("000201PIX-COPIA-COLA"), false);
    assert.equal(rendered.body.includes("Codigo Pix copia e cola"), false);
    assert.equal(rendered.body.includes("logo abaixo"), false);
    assert.equal(rendered.followup.body, "000201PIX-COPIA-COLA");
  }

  {
    const payload = payloadForEvent("pix_gerado");
    payload.orderBumps = [{ product: { name: "Comunidade extra" }, price: "47,90" }];
    const rendered = renderIntegrationDispatchTemplate("pix_gerado", payload);
    assert.equal(rendered.messageType, "image");
    assert.equal(rendered.body.includes("Itens adicionais:\n- Comunidade extra - R$ 47,90"), true);
    assert.equal(rendered.caption, rendered.body);
  }

  for (const [eventSlug, label] of [
    ["carrinho_abandonado", "Finalizar compra"],
    ["assinatura_criada", "Acessar assinatura"],
    ["assinatura_em_atraso", "Regularizar assinatura"],
  ]) {
    const rendered = renderIntegrationDispatchTemplate(eventSlug, payloadForEvent(eventSlug));
    assert.equal(rendered.messageType, "image");
    assert.equal(rendered.caption, rendered.body);
    assert.equal(rendered.body.includes(`↗ *${label}*\nhttps://checkout.example.com/c/123`), true);
    assert.equal(rendered.linkUrl, "https://checkout.example.com/c/123");
  }

  for (const eventSlug of ["carrinho_abandonado", "assinatura_criada", "assinatura_em_atraso"]) {
    const payload = payloadForEvent(eventSlug);
    delete payload.checkout_link;
    const rendered = renderIntegrationDispatchTemplate(eventSlug, payload);
    assert.equal(rendered.messageType, "image");
    assert.equal(rendered.externalAdReply, null);
    assert.equal(rendered.linkUrl, null);
    assert.equal(rendered.body.includes("https://checkout.example.com/c/123"), false);
    assertNoRawLeak(rendered);
  }

  {
    const payload = payloadForEvent("pedido_pago");
    delete payload.customer.name;
    delete payload.order.product.name;
    const rendered = renderIntegrationDispatchTemplate("pedido_pago", payload);
    assert.equal(rendered.body.includes("undefined"), false);
    assert.equal(rendered.body.includes("null"), false);
  }

  {
    const payload = payloadForEvent("pedido_pago");
    payload.order.product.image = "   ";
    const rendered = renderIntegrationDispatchTemplate("pedido_pago", payload);
    assert.equal(rendered.messageType, "image");
    assert.equal(rendered.imageUrl, null);
  }

  {
    const payload = payloadForEvent("pagamento_recusado");
    delete payload.checkout_link;
    const rendered = renderIntegrationDispatchTemplate("pagamento_recusado", payload);
    assert.equal(rendered.messageType, "text");
    assert.equal(rendered.externalAdReply, null);
  }

  {
    const payload = payloadForEvent("pedido_pendente");
    payload.order_bumps = [{ name: "Mentoria VIP", amount: "20.00" }];
    payload.message = { body: "Texto final externo para pedido pendente" };
    const rendered = renderIntegrationDispatchTemplate("pedido_pendente", payload);
    assert.equal(rendered.messageType, "text");
    assert.equal(rendered.body, "Texto final externo para pedido pendente");
    assert.equal(rendered.body.includes("Itens adicionais"), false);
    assert.equal(rendered.caption, null);
  }

  {
    const payload = payloadForEvent("pix_gerado");
    payload.message = {
      body: "Texto externo principal do Pix",
      pix_followup_body: "Texto externo da segunda mensagem Pix",
    };
    const rendered = renderIntegrationDispatchTemplate("pix_gerado", payload);
    assert.equal(rendered.messageType, "image");
    assert.equal(rendered.body, "Texto externo principal do Pix");
    assert.equal(rendered.caption, "Texto externo principal do Pix");
    assert.equal(rendered.followup.body, "Texto externo da segunda mensagem Pix");
    assert.equal(rendered.linkUrl, "https://checkout.example.com/c/123");
  }

  for (const invalidMessage of [
    { body: "   " },
    { body: ["texto"] },
    { body: "Texto com [object Object] invalido" },
    { caption: "caption nao suportada" },
  ]) {
    const payload = payloadForEvent("pedido_pendente");
    payload.message = invalidMessage;
    assert.throws(
      () => renderIntegrationDispatchTemplate("pedido_pendente", payload),
      (error) => error.code === "INTEGRATION_CUSTOM_MESSAGE_INVALID",
    );
  }

  {
    const payload = payloadForEvent("pedido_pendente");
    payload.message = { pix_followup_body: "nao pode" };
    assert.throws(
      () => renderIntegrationDispatchTemplate("pedido_pendente", payload),
      (error) => error.code === "INTEGRATION_CUSTOM_MESSAGE_INVALID",
    );
  }
  {
    const payload = payloadForEvent("boleto_gerado");
    delete payload.boleto.pdf_url;
    assert.throws(
      () => renderIntegrationDispatchTemplate("boleto_gerado", payload),
      (error) => error instanceof MissingIntegrationTemplateUrlError && error.code === "INTEGRATION_TEMPLATE_REQUIRED_URL_MISSING",
    );
  }

  {
    const payload = payloadForEvent("assinatura_em_atraso");
    delete payload.checkout_link;
    const context = normalizeIntegrationEventContext("assinatura_em_atraso", payload);
    const rendered = renderIntegrationDispatchTemplateFromContext(context);
    assert.equal(rendered.messageType, "image");
    assert.equal(rendered.externalAdReply, null);
  }

  console.log("integration-dispatch-template-api: OK");
})();
