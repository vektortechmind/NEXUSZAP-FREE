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
  extractContext,
  getProductImage,
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
      total: "199.90",
      phone: "+55 (11) 4002-8922",
      email: "pedido@example.com",
      cpf: "98765432100",
      user: { phone: "+55 (21) 99999-9999" },
      product: {
        name: "  Curso Premium  ",
        image: "products/curso-premium/capa.jpg",
      },
      product_offer: { name: " Oferta Relampago " },
      subscription_plan: { name: " Plano Anual " },
    },
    checkout_session: {
      total: "87.50",
      phone: "31987654321",
      email: "checkout@example.com",
      name: " Checkout Lead ",
      product: {
        name: "Produto do Carrinho",
        image: "products/carrinho/imagem.png",
      },
    },
    subscription: {
      next_billing: "59.90",
      user: { phone: "31988887777", email: "assinatura@example.com", name: "Assinante VIP" },
      product: {
        name: "Clube VIP",
        image: "products/clube-vip/capa.png",
      },
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
      delete payload.customer.phone;
      delete payload.order;
      delete payload.subscription;
    }

    if (eventSlug.startsWith("assinatura_")) {
      delete payload.customer.phone;
      delete payload.order;
      delete payload.checkout_session;
      payload.subscription.product = { name: "Comunidade de Assinantes", image: "products/comunidade/capa.jpg" };
    }

    const context = normalizeIntegrationEventContext(eventSlug, payload);
    assert.equal(context.eventSlug, eventSlug);
    assert.deepEqual(context.raw, payload);
    assert.equal(context.checkoutLink, "https://checkout.example.com/carrinho/123");
    assert.equal(context.name, context.customer.name);
    assert.equal(context.email, context.customer.email);
    assert.equal(typeof context.productImage === "string" || context.productImage === null, true);

    if (eventSlug === "carrinho_abandonado") {
      assert.equal(context.product.name, "Produto do Carrinho");
      assert.equal(context.productName, "Produto do Carrinho");
      assert.equal(context.total, "87.50");
      assert.equal(context.productImage, "https://checkout.example.com/storage/products/carrinho/imagem.png");
      expectPhoneContext(context, "5531987654321");
    } else if (eventSlug.startsWith("assinatura_")) {
      assert.equal(context.product.name, "Comunidade de Assinantes");
      assert.equal(context.productName, "Comunidade de Assinantes");
      assert.equal(context.total, "59.90");
      assert.equal(context.productImage, "https://checkout.example.com/storage/products/comunidade/capa.jpg");
      expectPhoneContext(context, "5531988887777");
    } else {
      assert.equal(context.product.name, "Curso Premium");
      assert.equal(context.product.offerName, "Oferta Relampago");
      assert.equal(context.product.planName, "Plano Anual");
      assert.equal(context.productName, "Curso Premium");
      assert.equal(context.total, "199.90");
      assert.equal(context.productImage, "https://checkout.example.com/storage/products/curso-premium/capa.jpg");
      expectPhoneContext(context, "5511998765432");
    }

    if (eventSlug === "pix_gerado") {
      assert.deepEqual(context.pix, {
        qrcode: "data:image/png;base64,abc",
        copyPaste: "000201pix",
        transactionId: "tx-123",
      });
      assert.equal(context.pixQrCode, "data:image/png;base64,abc");
      assert.equal(context.pixCopyPaste, "000201pix");
      assert.equal(context.pixTxId, "tx-123");
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
      assert.equal(context.boletoAmount, "149.90");
      assert.equal(context.boletoExpire, "2026-06-15");
      assert.equal(context.boletoBarcode, "34191.79001 01043.510047 91020.150008 5 87470026000");
      assert.equal(context.boletoUrl, "https://checkout.example.com/boleto.pdf");
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

    if (![("pix_gerado")].includes(eventSlug)) {
      assert.equal(context.pix, null);
      assert.equal(context.pixQrCode, null);
      assert.equal(context.pixCopyPaste, null);
      assert.equal(context.pixTxId, null);
    }

    if (!["boleto_gerado"].includes(eventSlug)) {
      assert.equal(context.boleto, null);
      assert.equal(context.boletoAmount, null);
      assert.equal(context.boletoExpire, null);
      assert.equal(context.boletoBarcode, null);
      assert.equal(context.boletoUrl, null);
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
    payload.customer.phone = "+55 (11) 98765-4321";
    const context = normalizeIntegrationEventContext("pedido_pago", payload);
    expectPhoneContext(context, "5511987654321");
  }

  {
    const payload = createBasePayload();
    payload.customer.phone = "+1 (415) 555-2671";
    const context = normalizeIntegrationEventContext("pedido_pago", payload);
    expectPhoneContext(context, "14155552671");
  }

  {
    const payload = createBasePayload();
    payload.customer.phone = "14155552671";
    const context = normalizeIntegrationEventContext("pedido_pago", payload);
    expectPhoneContext(context, "14155552671");
  }

  {
    const payload = createBasePayload();
    payload.customer.phone = "+351 912 345 678";
    const context = normalizeIntegrationEventContext("pedido_pago", payload);
    expectPhoneContext(context, "351912345678");
  }

  {
    const payload = createBasePayload();
    payload.customer.phone = "+54 9 11 2345-6789";
    const context = normalizeIntegrationEventContext("pedido_pago", payload);
    expectPhoneContext(context, "5491123456789");
  }

  {
    const payload = createBasePayload();
    payload.customer.phone = "351912345678";
    const context = normalizeIntegrationEventContext("pedido_pago", payload);
    expectPhoneContext(context, "351912345678");
  }

  {
    const payload = createBasePayload();
    payload.customer.phone = "12345";
    const context = normalizeIntegrationEventContext("pedido_pago", payload);
    assert.equal(context.phone, "12345");
    expectPhoneContext(context, null);
  }

  for (const invalidPhone of ["+1 415 555 2671 ext 9", "+1 415 ABC 2671", "++14155552671", "0014155552671", "1234567", "1234567890123456"]) {
    const payload = createBasePayload();
    payload.customer.phone = invalidPhone;
    const context = normalizeIntegrationEventContext("pedido_pago", payload);
    assert.equal(context.phone, invalidPhone);
    expectPhoneContext(context, null);
  }

  {
    const payload = createBasePayload();
    delete payload.customer.phone;
    delete payload.order.phone;
    delete payload.order.user;
    delete payload.subscription;
    delete payload.checkout_session.phone;
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
    const payload = createBasePayload();
    payload.order.product = {
      name: "Curso Premium",
      thumbnail_url: "https://cdn.example.com/thumb.png",
      image: "products/curso-premium/capa.jpg",
    };
    assert.equal(getProductImage(payload), "https://cdn.example.com/thumb.png");
  }

  {
    const payload = createBasePayload();
    payload.order.product = {
      name: "Curso Premium",
      cover: "/products/curso-premium/cover.jpg",
    };
    assert.equal(getProductImage(payload), "https://checkout.example.com/storage/products/curso-premium/cover.jpg");
  }

  {
    const payload = createBasePayload();
    delete payload.order.product.image;
    delete payload.checkout_session;
    delete payload.subscription;
    assert.equal(getProductImage(payload), null);
  }

  {
    const payload = createBasePayload();
    delete payload.checkout_link;
    delete payload.boleto;
    delete payload.access;
    payload.order.product = { name: "Curso Premium", image: "products/curso-premium/capa.jpg" };
    delete payload.checkout_session;
    delete payload.subscription;
    assert.equal(getProductImage(payload), null);
  }

  {
    const payload = createBasePayload();
    const context = extractContext("pedido_pago", payload);
    assert.deepEqual(context, {
      name: "Maria Cliente",
      email: "maria@example.com",
      phone: "(11) 99876-5432",
      productName: "Curso Premium",
      productImage: "https://checkout.example.com/storage/products/curso-premium/capa.jpg",
      total: "199.90",
      checkoutLink: "https://checkout.example.com/carrinho/123",
      pixQrCode: null,
      pixCopyPaste: null,
      pixTxId: null,
      boletoAmount: null,
      boletoExpire: null,
      boletoBarcode: null,
      boletoUrl: null,
    });
  }

  {
    const payload = createBasePayload();
    delete payload.order;
    delete payload.subscription;
    const context = extractContext("carrinho_abandonado", payload);
    assert.equal(context.productName, "Produto do Carrinho");
    assert.equal(context.productImage, "https://checkout.example.com/storage/products/carrinho/imagem.png");
    assert.equal(context.total, "87.50");
  }

  {
    const payload = createBasePayload();
    delete payload.order;
    delete payload.checkout_session;
    payload.customer.phone = null;
    payload.subscription.product = { image: "   ", name: "Clube VIP" };
    const context = extractContext("assinatura_criada", payload);
    assert.equal(context.phone, "31988887777");
    assert.equal(context.productName, "Clube VIP");
    assert.equal(context.productImage, null);
    assert.equal(context.total, "59.90");
    for (const value of Object.values(context)) {
      assert.notStrictEqual(value, undefined);
    }
  }

  {
    const payload = createBasePayload();
    payload.order.product = { name: "Primeiro", image: "products/primeiro/capa.jpg" };
    payload.checkout_session.product = { name: "Segundo", image: "products/segundo/capa.jpg" };
    payload.subscription.product = { name: "Terceiro", image: "products/terceiro/capa.jpg" };
    assert.equal(getProductImage(payload), "https://checkout.example.com/storage/products/primeiro/capa.jpg");
  }

  {
    const payload = createBasePayload();
    delete payload.checkout_link;
    assert.equal(getProductImage(payload, "https://files.example.com"), "https://files.example.com/storage/products/curso-premium/capa.jpg");
  }

  {
    assert.throws(
      () => normalizeIntegrationEventContext("webhook.test", createBasePayload()),
      (error) => error instanceof UnsupportedIntegrationEventError && error.code === "UNSUPPORTED_INTEGRATION_EVENT",
    );
  }

  console.log("integration-event-normalization-api: OK");
})();
