import type {
  IntegrationNormalizedAccess,
  IntegrationNormalizedEventContext,
  SupportedIntegrationEventSlug,
} from "./integrationEventCatalog.service";
import integrationEventCatalog = require("./integrationEventCatalog.service");

const { normalizeIntegrationEventContext } = integrationEventCatalog;

export type IntegrationDispatchMessageType = "text" | "link" | "document";

export type IntegrationRenderedDispatchTemplate = {
  eventSlug: SupportedIntegrationEventSlug;
  messageType: IntegrationDispatchMessageType;
  title: string | null;
  body: string;
  caption: string | null;
  linkUrl: string | null;
  documentUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  context: IntegrationNormalizedEventContext;
};

export class IntegrationDispatchTemplateRenderError extends Error {
  statusCode = 422;
  code = "INTEGRATION_DISPATCH_TEMPLATE_RENDER_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "INTEGRATION_DISPATCH_TEMPLATE_RENDER_ERROR";
  }
}

export class MissingIntegrationTemplateUrlError extends IntegrationDispatchTemplateRenderError {
  code = "INTEGRATION_TEMPLATE_REQUIRED_URL_MISSING";

  constructor(eventSlug: SupportedIntegrationEventSlug, fieldName: string) {
    super(`Template do evento ${eventSlug} requer URL válida em ${fieldName}.`);
    this.name = "INTEGRATION_TEMPLATE_REQUIRED_URL_MISSING";
  }
}

type IntegrationPayload = Record<string, unknown>;

function normalizeTextValue(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function compactWhitespace(value: string): string {
  return value
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function joinParagraphs(paragraphs: Array<string | null | undefined>): string {
  const filtered = paragraphs
    .map((paragraph) => normalizeTextValue(paragraph))
    .filter(Boolean);

  return compactWhitespace(filtered.join("\n\n"));
}

function toLine(label: string, value: string | null | undefined): string | null {
  const normalized = normalizeTextValue(value);
  return normalized ? `${label}: ${normalized}` : null;
}

function productLabel(context: IntegrationNormalizedEventContext, fallback: string): string {
  return normalizeTextValue(context.product.name)
    || normalizeTextValue(context.product.offerName)
    || normalizeTextValue(context.product.planName)
    || fallback;
}

function customerLabel(context: IntegrationNormalizedEventContext): string {
  return normalizeTextValue(context.customer.name) || "cliente";
}

function accessField(access: IntegrationNormalizedAccess, fieldName: string): string | null {
  if (!access) return null;
  const value = access[fieldName];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function ensureRequiredUrl(eventSlug: SupportedIntegrationEventSlug, fieldName: string, value: string | null): string {
  if (!value) {
    throw new MissingIntegrationTemplateUrlError(eventSlug, fieldName);
  }
  return value;
}

function assertRenderedText(value: string, eventSlug: SupportedIntegrationEventSlug): string {
  const normalized = compactWhitespace(value);
  if (!normalized) {
    throw new IntegrationDispatchTemplateRenderError(`Template do evento ${eventSlug} gerou corpo vazio.`);
  }

  for (const token of ["undefined", "null", "[object Object]"]) {
    if (normalized.includes(token)) {
      throw new IntegrationDispatchTemplateRenderError(`Template do evento ${eventSlug} gerou texto inválido.`);
    }
  }

  return normalized;
}

function renderTextTemplate(
  context: IntegrationNormalizedEventContext,
  title: string,
  paragraphs: Array<string | null | undefined>,
): IntegrationRenderedDispatchTemplate {
  const body = assertRenderedText(joinParagraphs(paragraphs), context.eventSlug);
  return {
    eventSlug: context.eventSlug,
    messageType: "text",
    title,
    body,
    caption: null,
    linkUrl: null,
    documentUrl: null,
    fileName: null,
    mimeType: null,
    context,
  };
}

function renderLinkTemplate(
  context: IntegrationNormalizedEventContext,
  title: string,
  linkUrl: string | null,
  paragraphs: Array<string | null | undefined>,
  fieldName: string,
): IntegrationRenderedDispatchTemplate {
  const requiredUrl = ensureRequiredUrl(context.eventSlug, fieldName, linkUrl);
  const body = assertRenderedText(joinParagraphs(paragraphs), context.eventSlug);

  return {
    eventSlug: context.eventSlug,
    messageType: "link",
    title,
    body,
    caption: null,
    linkUrl: requiredUrl,
    documentUrl: null,
    fileName: null,
    mimeType: null,
    context,
  };
}

function renderDocumentTemplate(
  context: IntegrationNormalizedEventContext,
  title: string,
  documentUrl: string | null,
  paragraphs: Array<string | null | undefined>,
  fieldName: string,
): IntegrationRenderedDispatchTemplate {
  const requiredUrl = ensureRequiredUrl(context.eventSlug, fieldName, documentUrl);
  const body = assertRenderedText(joinParagraphs(paragraphs), context.eventSlug);

  return {
    eventSlug: context.eventSlug,
    messageType: "document",
    title,
    body,
    caption: body,
    linkUrl: null,
    documentUrl: requiredUrl,
    fileName: "boleto.pdf",
    mimeType: "application/pdf",
    context,
  };
}

export function renderIntegrationDispatchTemplateFromContext(
  context: IntegrationNormalizedEventContext,
): IntegrationRenderedDispatchTemplate {
  const customer = customerLabel(context);

  switch (context.eventSlug) {
    case "pedido_pendente":
      return renderLinkTemplate(context, "Pedido pendente", context.checkoutLink, [
        `Ola, ${customer}.`,
        `Seu pedido de ${productLabel(context, "seu produto")} esta pendente.`,
        "Use o link para retomar a compra e concluir o pagamento.",
      ], "checkoutLink");

    case "pedido_pago":
      return renderTextTemplate(context, "Pedido pago", [
        `Ola, ${customer}.`,
        `Recebemos o pagamento de ${productLabel(context, "seu pedido")}.`,
        "Seu pedido foi confirmado com sucesso.",
      ]);

    case "envio_acesso": {
      const accessUrl = accessField(context.access, "url");
      return renderLinkTemplate(context, "Acesso liberado", accessUrl, [
        `Ola, ${customer}.`,
        `Seu acesso para ${productLabel(context, "seu produto")} esta pronto.`,
        toLine("Login", accessField(context.access, "login") ?? accessField(context.access, "email") ?? accessField(context.access, "username")),
        toLine("Senha", accessField(context.access, "password") ?? accessField(context.access, "temporaryPassword")),
        toLine("Codigo", accessField(context.access, "code")),
        toLine("Token", accessField(context.access, "token")),
        toLine("Plataforma", accessField(context.access, "platform")),
        toLine("Expira em", accessField(context.access, "expiresAt")),
        accessField(context.access, "instructions"),
        "Use o link para acessar sua area liberada.",
      ], "access.url");
    }

    case "pagamento_recusado":
      return renderLinkTemplate(context, "Pagamento recusado", context.checkoutLink, [
        `Ola, ${customer}.`,
        `Nao conseguimos aprovar o pagamento de ${productLabel(context, "seu pedido")}.`,
        "Use o link para tentar novamente com uma nova forma de pagamento.",
      ], "checkoutLink");

    case "pedido_cancelado":
      return renderTextTemplate(context, "Pedido cancelado", [
        `Ola, ${customer}.`,
        `O pedido de ${productLabel(context, "seu produto")} foi cancelado.`,
      ]);

    case "reembolso":
      return renderTextTemplate(context, "Reembolso processado", [
        `Ola, ${customer}.`,
        `O reembolso de ${productLabel(context, "seu pedido")} foi processado.`,
      ]);

    case "pix_gerado":
      return renderTextTemplate(context, "PIX gerado", [
        `Ola, ${customer}.`,
        `Geramos o PIX para ${productLabel(context, "seu pedido")}.`,
        toLine("Codigo PIX", context.pix?.copyPaste ?? context.pix?.qrcode),
        toLine("Transacao", context.pix?.transactionId),
      ]);

    case "boleto_gerado":
      return renderDocumentTemplate(context, "Boleto gerado", context.boleto?.pdfUrl ?? null, [
        `Ola, ${customer}.`,
        `Segue o boleto de ${productLabel(context, "seu pedido")}.`,
        toLine("Valor", context.boleto?.amount),
        toLine("Vencimento", context.boleto?.expireAt),
        toLine("Codigo de barras", context.boleto?.barcode),
      ], "boleto.pdfUrl");

    case "carrinho_abandonado":
      return renderLinkTemplate(context, "Carrinho aguardando", context.checkoutLink, [
        `Ola, ${customer}.`,
        `Seu carrinho para ${productLabel(context, "seu produto")} ainda esta esperando por voce.`,
        "Use o link para retomar a compra de onde parou.",
      ], "checkoutLink");

    case "assinatura_criada":
      return renderTextTemplate(context, "Assinatura criada", [
        `Ola, ${customer}.`,
        `Sua assinatura de ${productLabel(context, "seu plano")} foi criada com sucesso.`,
      ]);

    case "assinatura_renovada":
      return renderTextTemplate(context, "Assinatura renovada", [
        `Ola, ${customer}.`,
        `Sua assinatura de ${productLabel(context, "seu plano")} foi renovada com sucesso.`,
      ]);

    case "assinatura_cancelada":
      return renderTextTemplate(context, "Assinatura cancelada", [
        `Ola, ${customer}.`,
        `Sua assinatura de ${productLabel(context, "seu plano")} foi cancelada.`,
      ]);

    case "assinatura_em_atraso":
      return renderLinkTemplate(context, "Assinatura em atraso", context.checkoutLink, [
        `Ola, ${customer}.`,
        `Identificamos atraso no pagamento da assinatura ${productLabel(context, "do seu plano")}.`,
        "Use o link para regularizar sua assinatura.",
      ], "checkoutLink");
  }
}

export function renderIntegrationDispatchTemplate(eventSlug: string, payload: IntegrationPayload): IntegrationRenderedDispatchTemplate {
  return renderIntegrationDispatchTemplateFromContext(normalizeIntegrationEventContext(eventSlug, payload));
}

export function createIntegrationDispatchTemplateService() {
  return {
    renderTemplate: renderIntegrationDispatchTemplate,
    renderTemplateFromContext: renderIntegrationDispatchTemplateFromContext,
  };
}

export const integrationDispatchTemplateService = createIntegrationDispatchTemplateService();
