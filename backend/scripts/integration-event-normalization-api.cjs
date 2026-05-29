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
  UnsupportedIntegrationEventError,
} = require("../src/services/integrations/integrationEventCatalog.service.ts");

function createBasePayload() {
  return {
    customer: {
      name: "  Maria Cliente  ",
      email: "maria@example.com",
      phone: "(11) 99876-5432",
      cpf: "12345678900",
    },
    order: {
      phone: "+55 (11) 4002-8922",
      email: "pedido@example.com",
      cpf: "98765432100",
      user: { phone: "+55 (21) 99999-9999" },
      product: { name: "  Curso Premium  " },
      product_offer: { name: " Oferta Relampago " },
      subscription_plan: { name: " Plano Anual " },
    },
    subscription: {
      user: { phone: "31988887777", email: "assinatura@example.com" },
      product: { name: "Clube VIP" },
      subscription_plan: { name: "Plano Mensal" },
    },
    checkout_link: " https://checkout.example.com/carrinho/123 ",
    pix: {
      qrcode: "data:image/png;base64,abc",
      copy_paste: "000201pix",
      transaction_id: "tx-123",
      secret: "should-not-leak",
    },
    boleto: {
      amount: "149.90",
      expire_at: "2026-06-15",
      barcode: "34191.79001 01043.510047 91020.150008 5 87470026000",
      pdf_url: "https://checkout.example.com/boleto.pdf",
      internal_token: "hidden",
    },
    access: {
      url: "https://members.example.com/aula-1",
      login: "maria@example.com",
      password: "temporary-pass",
      expires_at: "2026-07-01T12:00:00Z",
      secret_note: "only raw should keep this",
    },
  };
}

function expectPhoneContext(context, digits) {
  assert.equal(context.phoneDigits, digits);
  assert.equal(context.recipientJid, digits ? `${digits}@s.whatsapp.net` : null);
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
      delete payload.customer.phone;
      delete payload.order;
      payload.subscription.product = { name: "Comunidade de Assinantes" };
    }

    const context = normalizeIntegrationEventContext(eventSlug, payload);
    assert.equal(context.eventSlug, eventSlug);
    assert.deepEqual(context.raw, payload);
    assert.equal(context.customer.name, "Maria Cliente");
    assert.equal(context.checkoutLink, "https://checkout.example.com/carrinho/123");

    if (eventSlug === "carrinho_abandonado") {
      assert.equal(context.product.name, "Recuperacao Carrinho");
      expectPhoneContext(context, null);
    } else if (eventSlug.startsWith("assinatura_")) {
      assert.equal(context.product.name, "Comunidade de Assinantes");
      expectPhoneContext(context, "5531988887777");
    } else {
      assert.equal(context.product.name, "Curso Premium");
      assert.equal(context.product.offerName, "Oferta Relampago");
      assert.equal(context.product.planName, "Plano Anual");
      expectPhoneContext(context, "5511998765432");
    }

    if (eventSlug === "pix_gerado") {
      assert.deepEqual(context.pix, {
        qrcode: "data:image/png;base64,abc",
        copyPaste: "000201pix",
        transactionId: "tx-123",
      });
      assert.equal(context.boleto, null);
      assert.equal(context.access, null);
      assert.equal("secret" in context.pix, false);
    }

    if (eventSlug === "boleto_gerado") {
      assert.deepEqual(context.boleto, {
        amount: "149.90",
        expireAt: "2026-06-15",
        barcode: "34191.79001 01043.510047 91020.150008 5 87470026000",
        pdfUrl: "https://checkout.example.com/boleto.pdf",
      });
      assert.equal(context.pix, null);
      assert.equal(context.access, null);
      assert.equal("internal_token" in context.boleto, false);
    }

    if (eventSlug === "envio_acesso") {
      assert.deepEqual(context.access, {
        url: "https://members.example.com/aula-1",
        login: "maria@example.com",
        password: "temporary-pass",
        expiresAt: "2026-07-01T12:00:00Z",
      });
      assert.equal(context.pix, null);
      assert.equal(context.boleto, null);
    }

    if (!["pix_gerado"].includes(eventSlug)) {
      assert.equal(context.pix, null);
    }

    if (!["boleto_gerado"].includes(eventSlug)) {
      assert.equal(context.boleto, null);
    }

    if (!["envio_acesso"].includes(eventSlug)) {
      assert.equal(context.access, null);
    }
  }

  {
    const payload = createBasePayload();
    payload.customer.phone = "11 98888-7777";
    const context = normalizeIntegrationEventContext("pedido_pago", payload);
    expectPhoneContext(context, "5511988887777");
  }

  {
    const payload = createBasePayload();
    payload.customer.phone = "12345";
    const context = normalizeIntegrationEventContext("pedido_pago", payload);
    assert.equal(context.phone, "12345");
    expectPhoneContext(context, null);
  }

  {
    const payload = createBasePayload();
    delete payload.customer.phone;
    delete payload.order.phone;
    delete payload.order.user;
    delete payload.subscription;
    const context = normalizeIntegrationEventContext("pedido_pago", payload);
    assert.equal(context.phone, null);
    expectPhoneContext(context, null);
  }

  {
    const payload = createBasePayload();
    payload.checkout_link = "ftp://invalid-link";
    const context = normalizeIntegrationEventContext("pedido_pago", payload);
    assert.equal(context.checkoutLink, null);
  }

  {
    assert.throws(
      () => normalizeIntegrationEventContext("webhook.test", createBasePayload()),
      (error) => error instanceof UnsupportedIntegrationEventError && error.code === "UNSUPPORTED_INTEGRATION_EVENT",
    );
  }

  console.log("integration-event-normalization-api: OK");
})();
