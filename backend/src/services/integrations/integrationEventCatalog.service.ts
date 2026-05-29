export const SUPPORTED_INTEGRATION_EVENT_SLUGS = [
  "pedido_pendente",
  "pedido_pago",
  "envio_acesso",
  "pagamento_recusado",
  "pedido_cancelado",
  "reembolso",
  "pix_gerado",
  "boleto_gerado",
  "carrinho_abandonado",
  "assinatura_criada",
  "assinatura_renovada",
  "assinatura_cancelada",
  "assinatura_em_atraso",
] as const;

export type SupportedIntegrationEventSlug = typeof SUPPORTED_INTEGRATION_EVENT_SLUGS[number];

type IntegrationPayload = Record<string, unknown>;

export type IntegrationNormalizedCustomer = {
  name: string | null;
  email: string | null;
  phone: string | null;
  cpf: string | null;
};

export type IntegrationNormalizedProduct = {
  name: string | null;
  offerName: string | null;
  planName: string | null;
};

export type IntegrationNormalizedPix = {
  qrcode: string | null;
  copyPaste: string | null;
  transactionId: string | null;
} | null;

export type IntegrationNormalizedBoleto = {
  amount: string | null;
  expireAt: string | null;
  barcode: string | null;
  pdfUrl: string | null;
} | null;

export type IntegrationNormalizedAccess = Record<string, unknown> | null;

export type IntegrationNormalizedEventContext = {
  eventSlug: SupportedIntegrationEventSlug;
  customer: IntegrationNormalizedCustomer;
  phone: string | null;
  phoneDigits: string | null;
  recipientJid: string | null;
  product: IntegrationNormalizedProduct;
  checkoutLink: string | null;
  pix: IntegrationNormalizedPix;
  boleto: IntegrationNormalizedBoleto;
  access: IntegrationNormalizedAccess;
  raw: IntegrationPayload;
};

export class UnsupportedIntegrationEventError extends Error {
  statusCode = 400;
  code = "UNSUPPORTED_INTEGRATION_EVENT";

  constructor(eventSlug: string) {
    super(`Evento de integração não suportado: ${eventSlug}.`);
    this.name = "UNSUPPORTED_INTEGRATION_EVENT";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function getByPath(source: unknown, path: string): unknown {
  let current: unknown = source;
  for (const key of path.split(".")) {
    if (!current || typeof current !== "object" || !(key in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function firstDefined(source: unknown, paths: string[]): unknown {
  for (const path of paths) {
    const value = getByPath(source, path);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
}

function normalizeString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function normalizeUrl(value: unknown): string | null {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function normalizePhoneDigits(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D+/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) {
    return digits;
  }
  if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
    return `55${digits}`;
  }
  return null;
}

function normalizeCustomer(payload: IntegrationPayload): IntegrationNormalizedCustomer {
  return {
    name: normalizeString(firstDefined(payload, ["customer.name"])),
    email: normalizeString(firstDefined(payload, ["customer.email", "order.email", "subscription.user.email"])),
    phone: normalizeString(firstDefined(payload, ["customer.phone"])),
    cpf: normalizeString(firstDefined(payload, ["customer.cpf", "order.cpf"])),
  };
}

function resolveOperationalPhone(payload: IntegrationPayload): string | null {
  return normalizeString(firstDefined(payload, [
    "customer.phone",
    "order.phone",
    "order.user.phone",
    "subscription.user.phone",
  ]));
}

function normalizeProduct(payload: IntegrationPayload): IntegrationNormalizedProduct {
  return {
    name: normalizeString(firstDefined(payload, [
      "order.product.name",
      "checkout_session.product.name",
      "subscription.product.name",
    ])),
    offerName: normalizeString(firstDefined(payload, [
      "order.product_offer.name",
      "order.productOffer.name",
    ])),
    planName: normalizeString(firstDefined(payload, [
      "order.subscription_plan.name",
      "order.subscriptionPlan.name",
      "subscription.subscription_plan.name",
      "subscription.subscriptionPlan.name",
    ])),
  };
}

function normalizePix(eventSlug: SupportedIntegrationEventSlug, payload: IntegrationPayload): IntegrationNormalizedPix {
  if (eventSlug !== "pix_gerado") return null;
  const pix = asRecord(payload.pix);
  if (!pix) return null;
  const normalized = {
    qrcode: normalizeString(firstDefined(pix, ["qrcode"])),
    copyPaste: normalizeString(firstDefined(pix, ["copy_paste", "copyPaste"])),
    transactionId: normalizeString(firstDefined(pix, ["transaction_id", "transactionId"])),
  };
  return normalized.qrcode || normalized.copyPaste || normalized.transactionId ? normalized : null;
}

function normalizeBoleto(eventSlug: SupportedIntegrationEventSlug, payload: IntegrationPayload): IntegrationNormalizedBoleto {
  if (eventSlug !== "boleto_gerado") return null;
  const boleto = asRecord(payload.boleto);
  if (!boleto) return null;
  const normalized = {
    amount: normalizeString(firstDefined(boleto, ["amount"])),
    expireAt: normalizeString(firstDefined(boleto, ["expire_at", "expireAt"])),
    barcode: normalizeString(firstDefined(boleto, ["barcode"])),
    pdfUrl: normalizeUrl(firstDefined(boleto, ["pdf_url", "pdfUrl"])),
  };
  return normalized.amount || normalized.expireAt || normalized.barcode || normalized.pdfUrl ? normalized : null;
}

function normalizeAccess(eventSlug: SupportedIntegrationEventSlug, payload: IntegrationPayload): IntegrationNormalizedAccess {
  if (eventSlug !== "envio_acesso") return null;
  const access = asRecord(payload.access);
  if (!access) return null;

  const normalized = {
    url: normalizeUrl(firstDefined(access, ["url"])),
    login: normalizeString(firstDefined(access, ["login"])),
    email: normalizeString(firstDefined(access, ["email"])),
    username: normalizeString(firstDefined(access, ["username"])),
    password: normalizeString(firstDefined(access, ["password"])),
    temporaryPassword: normalizeString(firstDefined(access, ["temporary_password", "temporaryPassword"])),
    code: normalizeString(firstDefined(access, ["code"])),
    token: normalizeString(firstDefined(access, ["token"])),
    instructions: normalizeString(firstDefined(access, ["instructions"])),
    platform: normalizeString(firstDefined(access, ["platform"])),
    expiresAt: normalizeString(firstDefined(access, ["expire_at", "expires_at", "expireAt", "expiresAt"])),
  };

  const entries = Object.entries(normalized).filter(([, value]) => value !== null);
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export function isSupportedIntegrationEventSlug(value: string): value is SupportedIntegrationEventSlug {
  return (SUPPORTED_INTEGRATION_EVENT_SLUGS as readonly string[]).includes(value);
}

export function normalizeIntegrationEventContext(eventSlug: string, payload: IntegrationPayload): IntegrationNormalizedEventContext {
  if (!isSupportedIntegrationEventSlug(eventSlug)) {
    throw new UnsupportedIntegrationEventError(eventSlug);
  }

  const customer = normalizeCustomer(payload);
  const phone = resolveOperationalPhone(payload);
  const phoneDigits = normalizePhoneDigits(phone);

  return {
    eventSlug,
    customer,
    phone,
    phoneDigits,
    recipientJid: phoneDigits ? `${phoneDigits}@s.whatsapp.net` : null,
    product: normalizeProduct(payload),
    checkoutLink: normalizeUrl(firstDefined(payload, ["checkout_link", "checkoutLink"])),
    pix: normalizePix(eventSlug, payload),
    boleto: normalizeBoleto(eventSlug, payload),
    access: normalizeAccess(eventSlug, payload),
    raw: payload,
  };
}

export function createIntegrationEventCatalogService() {
  return {
    supportedEventSlugs: [...SUPPORTED_INTEGRATION_EVENT_SLUGS],
    isSupportedEventSlug: isSupportedIntegrationEventSlug,
    normalizeEventContext: normalizeIntegrationEventContext,
  };
}

export const integrationEventCatalogService = createIntegrationEventCatalogService();
