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

export const INTEGRATION_CUSTOM_MESSAGE_MAX_LENGTH = 4000;
type IntegrationProductSource = Record<string, unknown> | null;

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

export type IntegrationNormalizedOrderBump = {
  name: string;
  amount: string | null;
  currency: string | null;
};

export type IntegrationNormalizedCtaUrlButton = {
  enabled: boolean;
  text: string | null;
  url: string | null;
  buttons: Array<{ text: string; url: string }> | null;
} | null;

export type IntegrationNormalizedMessageOverride = {
  body: string | null;
  pixFollowupBody: string | null;
  bodyLength: number | null;
  pixFollowupBodyLength: number | null;
  ctaUrlButton: IntegrationNormalizedCtaUrlButton;
} | null;

export type IntegrationExtractedContext = {
  name: string | null;
  email: string | null;
  phone: string | null;
  productName: string | null;
  productImage: string | null;
  total: string | null;
  checkoutLink: string | null;
  pixQrCode: string | null;
  pixCopyPaste: string | null;
  pixTxId: string | null;
  boletoAmount: string | null;
  boletoExpire: string | null;
  boletoBarcode: string | null;
  boletoUrl: string | null;
};

export type IntegrationNormalizedEventContext = IntegrationExtractedContext & {
  eventSlug: SupportedIntegrationEventSlug;
  customer: IntegrationNormalizedCustomer;
  phoneDigits: string | null;
  recipientJid: string | null;
  product: IntegrationNormalizedProduct;
  pix: IntegrationNormalizedPix;
  boleto: IntegrationNormalizedBoleto;
  access: IntegrationNormalizedAccess;
  orderBumps: IntegrationNormalizedOrderBump[];
  orderBumpsText: string | null;
  messageOverride: IntegrationNormalizedMessageOverride;
  raw: IntegrationPayload;
};

export class InvalidIntegrationCustomMessageError extends Error {
  statusCode = 422;
  code = "INTEGRATION_CUSTOM_MESSAGE_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "INTEGRATION_CUSTOM_MESSAGE_INVALID";
  }
}

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
  const trimmed = value.trim();
  if (!trimmed || !/^\+?[\d\s().-]+$/.test(trimmed) || /\+(?=.)/.test(trimmed.slice(1))) {
    return null;
  }

  const digits = value.replace(/\D+/g, "");
  if (!digits) return null;

  if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) {
    return null;
  }

  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) {
    return digits;
  }

  if (digits.length === 11 && digits.startsWith("1") && /^[2-9]/.test(digits[1] ?? "")) {
    return digits;
  }

  if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
    return `55${digits}`;
  }

  if (digits.length >= 12 && digits.length <= 15) {
    return digits;
  }

  return null;
}

function normalizeStorageBaseUrl(baseUrl: string | null): string | null {
  const normalized = normalizeUrl(baseUrl);
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    return parsed.origin.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function inferStorageBaseUrl(payload: IntegrationPayload, explicitBaseUrl?: string | null): string | null {
  const explicit = normalizeStorageBaseUrl(explicitBaseUrl ?? null);
  if (explicit) return explicit;

  const absoluteCandidates = [
    "product_image_url",
    "productImageUrl",
    "product.thumbnail_url",
    "product.thumbnailUrl",
    "product.image_url",
    "product.imageUrl",
    "product.image",
    "product.cover",
    "order.product_image_url",
    "order.productImageUrl",
    "order.product.thumbnail_url",
    "order.product.thumbnailUrl",
    "order.product.image_url",
    "order.product.imageUrl",
    "order.product.image",
    "order.product.cover",
    "checkout_session.product_image_url",
    "checkout_session.productImageUrl",
    "checkout_session.product.thumbnail_url",
    "checkout_session.product.thumbnailUrl",
    "checkout_session.product.image_url",
    "checkout_session.product.imageUrl",
    "checkout_session.product.image",
    "checkout_session.product.cover",
    "subscription.product_image_url",
    "subscription.productImageUrl",
    "subscription.product.thumbnail_url",
    "subscription.product.thumbnailUrl",
    "subscription.product.image_url",
    "subscription.product.imageUrl",
    "subscription.product.image",
    "subscription.product.cover",
    "checkout_link",
    "checkoutLink",
    "boleto.pdf_url",
    "boleto.pdfUrl",
    "access.url",
  ];

  for (const path of absoluteCandidates) {
    const candidate = normalizeUrl(getByPath(payload, path));
    const normalized = normalizeStorageBaseUrl(candidate);
    if (normalized) return normalized;
  }

  return null;
}

function buildStorageAssetUrl(path: string, payload: IntegrationPayload, baseUrl?: string | null): string | null {
  const storageUrl = inferStorageBaseUrl(payload, baseUrl);
  if (!storageUrl) return null;

  const normalizedPath = path.replace(/^\/+/, "");
  if (/^(storage|assets)\//i.test(normalizedPath)) {
    return `${storageUrl}/${normalizedPath}`;
  }

  return `${storageUrl}/storage/${normalizedPath}`;
}

function resolveProductSource(payload: IntegrationPayload): IntegrationProductSource {
  return (
    asRecord(getByPath(payload, "order.product"))
    ?? asRecord(getByPath(payload, "checkout_session.product"))
    ?? asRecord(getByPath(payload, "subscription.product"))
    ?? asRecord(getByPath(payload, "product"))
  );
}

function normalizeCustomer(payload: IntegrationPayload): IntegrationNormalizedCustomer {
  return {
    name: normalizeString(firstDefined(payload, ["customer.name", "order.user.name", "subscription.user.name", "checkout_session.name"])),
    email: normalizeString(firstDefined(payload, ["customer.email", "order.email", "subscription.user.email", "checkout_session.email"])),
    phone: normalizeString(firstDefined(payload, ["customer.phone", "order.phone", "order.user.phone", "subscription.user.phone", "checkout_session.phone"])),
    cpf: normalizeString(firstDefined(payload, ["customer.cpf", "order.cpf"])),
  };
}

function resolveOperationalPhone(payload: IntegrationPayload): string | null {
  return normalizeString(firstDefined(payload, [
    "customer.phone",
    "order.phone",
    "order.user.phone",
    "subscription.user.phone",
    "checkout_session.phone",
  ]));
}

function normalizeProduct(payload: IntegrationPayload): IntegrationNormalizedProduct {
  return {
    name: normalizeString(firstDefined(payload, [
      "order.product.name",
      "checkout_session.product.name",
      "subscription.product.name",
      "product.name",
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

function normalizeMoneyText(value: unknown, currency: string | null): string | null {
  const raw = normalizeString(value);
  if (!raw) return null;

  const numericSource = raw.includes(",")
    ? raw.replace(/\./g, "").replace(/,(\d{1,2})$/, ".$1")
    : raw;
  const parsed = Number(numericSource);
  const isPlainNumeric = /^-?\d+(?:[.,]\d{1,2})?$/.test(raw);
  const shouldFormatBrl = !currency || currency.toUpperCase() === "BRL";

  if (Number.isFinite(parsed) && isPlainNumeric && shouldFormatBrl) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parsed).replace(/\u00a0/g, " ");
  }

  return raw;
}

function normalizeOrderBumps(payload: IntegrationPayload): IntegrationNormalizedOrderBump[] {
  const source = Array.isArray(payload.order_bumps)
    ? payload.order_bumps
    : Array.isArray(payload.orderBumps)
      ? payload.orderBumps
      : [];

  return source.flatMap((item) => {
    const record = asRecord(item);
    if (!record) return [];

    const name = normalizeString(firstDefined(record, [
      "name",
      "product.name",
      "offer.name",
      "subscription_plan.name",
      "subscriptionPlan.name",
    ]));
    if (!name) return [];

    const currency = normalizeString(firstDefined(record, ["currency"]));
    const amount = normalizeMoneyText(firstDefined(record, ["amount", "total", "price", "value"]), currency);

    return [{ name, amount, currency }];
  });
}

function buildOrderBumpsText(orderBumps: IntegrationNormalizedOrderBump[]): string | null {
  if (orderBumps.length === 0) return null;

  const visible = orderBumps.slice(0, 5).map((bump) => {
    const value = bump.amount ? ` - ${bump.amount}` : "";
    return `- ${bump.name}${value}`;
  });

  const remaining = orderBumps.length - visible.length;
  if (remaining > 0) {
    visible.push(`+${remaining} itens adicionais`);
  }

  return ["Itens adicionais:", ...visible].join("\n");
}

function normalizeCustomMessageText(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new InvalidIntegrationCustomMessageError(`${fieldName} deve ser string.`);
  }

  const normalized = value
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  if (!normalized) {
    throw new InvalidIntegrationCustomMessageError(`${fieldName} nao pode ser vazio.`);
  }

  if (normalized.length > INTEGRATION_CUSTOM_MESSAGE_MAX_LENGTH) {
    throw new InvalidIntegrationCustomMessageError(`${fieldName} excede o limite de ${INTEGRATION_CUSTOM_MESSAGE_MAX_LENGTH} caracteres.`);
  }

  for (const token of ["undefined", "null", "[object Object]"]) {
    if (normalized.includes(token)) {
      throw new InvalidIntegrationCustomMessageError(`${fieldName} contem texto invalido.`);
    }
  }

  return normalized;
}

function normalizeCtaUrlButton(value: unknown): IntegrationNormalizedCtaUrlButton {
  const config = asRecord(value);
  if (!config) {
    throw new InvalidIntegrationCustomMessageError("message.cta_url_button deve ser objeto.");
  }

  const allowedFields = new Set(["enabled", "text", "url", "buttons"]);
  for (const field of Object.keys(config)) {
    if (!allowedFields.has(field)) {
      throw new InvalidIntegrationCustomMessageError(`Campo message.cta_url_button.${field} nao e aceito no contrato de integracao.`);
    }
  }

  const enabled = config.enabled === undefined ? true : config.enabled === true;
  if (config.enabled !== undefined && typeof config.enabled !== "boolean") {
    throw new InvalidIntegrationCustomMessageError("message.cta_url_button.enabled deve ser booleano.");
  }

  const text = config.text === undefined || config.text === null
    ? null
    : normalizeCustomMessageText(config.text, "message.cta_url_button.text");
  if (text && text.length > 60) {
    throw new InvalidIntegrationCustomMessageError("message.cta_url_button.text excede o limite de 60 caracteres.");
  }

  const url = config.url === undefined || config.url === null
    ? null
    : normalizeUrl(config.url);
  if (config.url !== undefined && config.url !== null && !url) {
    throw new InvalidIntegrationCustomMessageError("message.cta_url_button.url deve ser uma URL http/https valida.");
  }

  let buttons: Array<{ text: string; url: string }> | null = null;
  if (config.buttons !== undefined) {
    if (!Array.isArray(config.buttons) || config.buttons.length === 0 || config.buttons.length > 3) {
      throw new InvalidIntegrationCustomMessageError("message.cta_url_button.buttons deve conter de 1 a 3 botoes.");
    }
    buttons = config.buttons.map((item, index) => {
      const button = asRecord(item);
      if (!button) {
        throw new InvalidIntegrationCustomMessageError(`message.cta_url_button.buttons.${index} deve ser objeto.`);
      }
      const buttonText = normalizeCustomMessageText(button.text, `message.cta_url_button.buttons.${index}.text`);
      if (buttonText.length > 60) {
        throw new InvalidIntegrationCustomMessageError(`message.cta_url_button.buttons.${index}.text excede o limite de 60 caracteres.`);
      }
      const buttonUrl = normalizeUrl(button.url);
      if (!buttonUrl) {
        throw new InvalidIntegrationCustomMessageError(`message.cta_url_button.buttons.${index}.url deve ser uma URL http/https valida.`);
      }
      return { text: buttonText, url: buttonUrl };
    });
  }

  return { enabled, text, url, buttons };
}

function normalizeMessageOverride(eventSlug: SupportedIntegrationEventSlug, payload: IntegrationPayload): IntegrationNormalizedMessageOverride {
  const message = asRecord(payload.message);
  if (!message) return null;

  const allowedFields = new Set(["body", "pix_followup_body", "cta_url_button"]);
  for (const field of Object.keys(message)) {
    if (!allowedFields.has(field)) {
      throw new InvalidIntegrationCustomMessageError(`Campo message.${field} nao e aceito no contrato de integracao.`);
    }
  }

  const hasBody = Object.prototype.hasOwnProperty.call(message, "body");
  const hasPixFollowupBody = Object.prototype.hasOwnProperty.call(message, "pix_followup_body");
  const hasCtaUrlButton = Object.prototype.hasOwnProperty.call(message, "cta_url_button");

  if (hasPixFollowupBody && eventSlug !== "pix_gerado") {
    throw new InvalidIntegrationCustomMessageError("message.pix_followup_body so e aceito para o evento pix_gerado.");
  }

  const body = hasBody ? normalizeCustomMessageText(message.body, "message.body") : null;
  const pixFollowupBody = hasPixFollowupBody ? normalizeCustomMessageText(message.pix_followup_body, "message.pix_followup_body") : null;
  const ctaUrlButton = hasCtaUrlButton ? normalizeCtaUrlButton(message.cta_url_button) : null;

  return body || pixFollowupBody || ctaUrlButton ? {
    body,
    pixFollowupBody,
    bodyLength: body?.length ?? null,
    pixFollowupBodyLength: pixFollowupBody?.length ?? null,
    ctaUrlButton,
  } : null;
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

export function getProductImage(payload: IntegrationPayload, baseUrl?: string | null): string | null {
  const directUrl = normalizeUrl(firstDefined(payload, [
    "product_image_url",
    "productImageUrl",
    "order.product_image_url",
    "order.productImageUrl",
    "checkout_session.product_image_url",
    "checkout_session.productImageUrl",
    "subscription.product_image_url",
    "subscription.productImageUrl",
  ]));
  if (directUrl) return directUrl;

  const product = resolveProductSource(payload);
  if (!product) return null;

  const thumbnailUrl = normalizeUrl(firstDefined(product, ["thumbnail_url", "thumbnailUrl"]));
  if (thumbnailUrl) return thumbnailUrl;

  const imageUrlAlias = normalizeUrl(firstDefined(product, ["image_url", "imageUrl"]));
  if (imageUrlAlias) return imageUrlAlias;

  const cover = normalizeString(firstDefined(product, ["cover"]));
  const coverUrl = normalizeUrl(cover);
  if (coverUrl) return coverUrl;

  const image = normalizeString(firstDefined(product, ["image"]));
  const imageUrl = normalizeUrl(image);
  if (imageUrl) return imageUrl;

  if (image) return buildStorageAssetUrl(image, payload, baseUrl);
  const imageAlias = normalizeString(firstDefined(product, ["image_url", "imageUrl"]));
  if (imageAlias) return buildStorageAssetUrl(imageAlias, payload, baseUrl);
  if (cover) return buildStorageAssetUrl(cover, payload, baseUrl);

  return null;
}

export function extractContext(
  eventSlug: SupportedIntegrationEventSlug,
  payload: IntegrationPayload,
  baseUrl?: string | null,
): IntegrationExtractedContext {
  const customer = normalizeCustomer(payload);
  const phone = resolveOperationalPhone(payload);
  const product = normalizeProduct(payload);
  const pix = normalizePix(eventSlug, payload);
  const boleto = normalizeBoleto(eventSlug, payload);
  return {
    name: customer.name,
    email: customer.email,
    phone,
    productName: product.name ?? product.offerName ?? product.planName,
    productImage: getProductImage(payload, baseUrl),
    total: normalizeString(firstDefined(payload, [
      "order.total",
      "order.amount",
      "checkout_session.total",
      "checkout_session.amount",
      "subscription.next_billing",
      "subscription.amount",
    ])),
    checkoutLink: normalizeUrl(firstDefined(payload, ["checkout_link", "checkoutLink"])),
    pixQrCode: pix?.qrcode ?? null,
    pixCopyPaste: pix?.copyPaste ?? null,
    pixTxId: pix?.transactionId ?? null,
    boletoAmount: boleto?.amount ?? null,
    boletoExpire: boleto?.expireAt ?? null,
    boletoBarcode: boleto?.barcode ?? null,
    boletoUrl: boleto?.pdfUrl ?? null,
  };
}

export function isSupportedIntegrationEventSlug(value: string): value is SupportedIntegrationEventSlug {
  return (SUPPORTED_INTEGRATION_EVENT_SLUGS as readonly string[]).includes(value);
}

export function normalizeIntegrationEventContext(eventSlug: string, payload: IntegrationPayload): IntegrationNormalizedEventContext {
  if (!isSupportedIntegrationEventSlug(eventSlug)) {
    throw new UnsupportedIntegrationEventError(eventSlug);
  }

  const customer = normalizeCustomer(payload);
  const phoneDigits = normalizePhoneDigits(resolveOperationalPhone(payload));
  const product = normalizeProduct(payload);
  const pix = normalizePix(eventSlug, payload);
  const boleto = normalizeBoleto(eventSlug, payload);
  const access = normalizeAccess(eventSlug, payload);
  const orderBumps = normalizeOrderBumps(payload);
  const messageOverride = normalizeMessageOverride(eventSlug, payload);
  const extracted = extractContext(eventSlug, payload);

  return {
    eventSlug,
    customer,
    phoneDigits,
    recipientJid: phoneDigits ? `${phoneDigits}@s.whatsapp.net` : null,
    product,
    pix,
    boleto,
    access,
    orderBumps,
    orderBumpsText: buildOrderBumpsText(orderBumps),
    messageOverride,
    raw: payload,
    ...extracted,
  };
}

export function createIntegrationEventCatalogService() {
  return {
    supportedEventSlugs: [...SUPPORTED_INTEGRATION_EVENT_SLUGS],
    isSupportedEventSlug: isSupportedIntegrationEventSlug,
    normalizeEventContext: normalizeIntegrationEventContext,
    extractContext,
    getProductImage,
  };
}

export const integrationEventCatalogService = createIntegrationEventCatalogService();
