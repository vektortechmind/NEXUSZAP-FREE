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
      product: { name: "Curso Premium" },
      product_offer: { name: "Oferta Relampago" },
      subscription_plan: { name: "Plano Anual" },
    },
    subscription: {
      user: { phone: "31988887777", email: "assinatura@example.com" },
      product: { name: "Clube VIP" },
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

function assertNoRawLeak(template) {
  assert.equal(template.body.includes("TEXTO EXTERNO MALICIOSO"), false);
  assert.equal(template.body.includes("IGNORAR TEXTO BRUTO"), false);
  assert.equal(template.body.includes("IGNORAR TEMPLATE BRUTO"), false);
  assert.equal(template.body.includes("undefined"), false);
  assert.equal(template.body.includes("null"), false);
  assert.equal(template.body.includes("[object Object]"), false);
}

(() => {
  for (const eventSlug of SUPPORTED_INTEGRATION_EVENT_SLUGS) {
    const payload = createBasePayload();

    if (eventSlug === "carrinho_abandonado") {
      payload.checkout_session = { product: { name: "Recuperacao Carrinho" } };
      delete payload.customer.phone;
      delete payload.order;
      delete payload.subscription;
    }

    if (eventSlug.startsWith("assinatura_")) {
      delete payload.order;
      payload.subscription.product = { name: "Comunidade de Assinantes" };
    }

    const rendered = renderIntegrationDispatchTemplate(eventSlug, payload);
    assert.equal(rendered.eventSlug, eventSlug);
    assert.equal(typeof rendered.body, "string");
    assert.ok(rendered.body.length > 0);
    assert.deepEqual(rendered.context, normalizeIntegrationEventContext(eventSlug, payload));
    assertNoRawLeak(rendered);

    if (["pedido_pendente", "envio_acesso", "pagamento_recusado", "carrinho_abandonado", "assinatura_em_atraso"].includes(eventSlug)) {
      assert.equal(rendered.messageType, "link");
      assert.ok(rendered.linkUrl);
      assert.equal(rendered.documentUrl, null);
    }

    if (["pedido_pago", "pedido_cancelado", "reembolso", "pix_gerado", "assinatura_criada", "assinatura_renovada", "assinatura_cancelada"].includes(eventSlug)) {
      assert.equal(rendered.messageType, "text");
      assert.equal(rendered.linkUrl, null);
      assert.equal(rendered.documentUrl, null);
    }

    if (eventSlug === "boleto_gerado") {
      assert.equal(rendered.messageType, "document");
      assert.equal(rendered.documentUrl, "https://checkout.example.com/boleto.pdf");
      assert.equal(rendered.fileName, "boleto.pdf");
      assert.equal(rendered.mimeType, "application/pdf");
      assert.equal(rendered.caption, rendered.body);
    }

    if (eventSlug === "pix_gerado") {
      assert.equal(rendered.body.includes("000201PIX-COPIA-COLA"), true);
      assert.equal(rendered.body.includes("tx-123"), true);
    }

    if (eventSlug === "envio_acesso") {
      assert.equal(rendered.linkUrl, "https://members.example.com/aula-1");
      assert.equal(rendered.body.includes("temporary-pass"), true);
    }
  }

  {
    const payload = createBasePayload();
    delete payload.customer.name;
    delete payload.order.product.name;
    const rendered = renderIntegrationDispatchTemplate("pedido_pago", payload);
    assert.ok(rendered.body.length > 0);
    assert.equal(rendered.body.includes("undefined"), false);
  }

  {
    const payload = createBasePayload();
    delete payload.access.login;
    delete payload.access.password;
    delete payload.access.instructions;
    const rendered = renderIntegrationDispatchTemplate("envio_acesso", payload);
    assert.equal(rendered.messageType, "link");
    assert.equal(rendered.body.includes("Login:"), false);
    assert.equal(rendered.body.includes("Senha:"), false);
  }

  {
    const payload = createBasePayload();
    delete payload.checkout_link;
    assert.throws(
      () => renderIntegrationDispatchTemplate("pedido_pendente", payload),
      (error) => error instanceof MissingIntegrationTemplateUrlError && error.code === "INTEGRATION_TEMPLATE_REQUIRED_URL_MISSING",
    );
  }

  {
    const payload = createBasePayload();
    payload.access.url = "ftp://members.example.com";
    const context = normalizeIntegrationEventContext("envio_acesso", payload);
    assert.throws(
      () => renderIntegrationDispatchTemplateFromContext(context),
      (error) => error instanceof MissingIntegrationTemplateUrlError && error.code === "INTEGRATION_TEMPLATE_REQUIRED_URL_MISSING",
    );
  }

  {
    const payload = createBasePayload();
    delete payload.boleto.pdf_url;
    assert.throws(
      () => renderIntegrationDispatchTemplate("boleto_gerado", payload),
      (error) => error instanceof MissingIntegrationTemplateUrlError && error.code === "INTEGRATION_TEMPLATE_REQUIRED_URL_MISSING",
    );
  }

  console.log("integration-dispatch-template-api: OK");
})();
