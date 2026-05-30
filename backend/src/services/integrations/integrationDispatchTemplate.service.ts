import type {
  IntegrationNormalizedEventContext,
  SupportedIntegrationEventSlug,
} from "./integrationEventCatalog.service";
import integrationEventCatalog = require("./integrationEventCatalog.service");

const { normalizeIntegrationEventContext } = integrationEventCatalog;

export type IntegrationDispatchMessageType = "text" | "link" | "document" | "image";

export type IntegrationRenderedExternalAdReply = {
  title: string;
  body: string;
  sourceUrl: string;
  mediaType: 1;
};

export type IntegrationRenderedDispatchTemplate = {
  eventSlug: SupportedIntegrationEventSlug;
  messageType: IntegrationDispatchMessageType;
  title: string | null;
  body: string;
  caption: string | null;
  linkUrl: string | null;
  documentUrl: string | null;
  imageUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  externalAdReply: IntegrationRenderedExternalAdReply | null;
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

function productLabel(context: IntegrationNormalizedEventContext, fallback: string): string {
  return normalizeTextValue(context.productName)
    || normalizeTextValue(context.product.name)
    || normalizeTextValue(context.product.offerName)
    || normalizeTextValue(context.product.planName)
    || fallback;
}

function customerLabel(context: IntegrationNormalizedEventContext): string {
  return normalizeTextValue(context.name)
    || normalizeTextValue(context.customer.name)
    || "cliente";
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

function createExternalAdReply(
  title: string,
  body: string | null | undefined,
  sourceUrl: string | null,
): IntegrationRenderedExternalAdReply | null {
  if (!sourceUrl) return null;
  return {
    title,
    body: normalizeTextValue(body) || title,
    sourceUrl,
    mediaType: 1,
  };
}

function renderTextTemplate(
  context: IntegrationNormalizedEventContext,
  title: string,
  paragraphs: Array<string | null | undefined>,
  externalAdReply?: IntegrationRenderedExternalAdReply | null,
  linkUrl?: string | null,
): IntegrationRenderedDispatchTemplate {
  const body = assertRenderedText(joinParagraphs(paragraphs), context.eventSlug);
  return {
    eventSlug: context.eventSlug,
    messageType: "text",
    title,
    body,
    caption: null,
    linkUrl: linkUrl ?? null,
    documentUrl: null,
    imageUrl: null,
    fileName: null,
    mimeType: null,
    externalAdReply: externalAdReply ?? null,
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
    imageUrl: null,
    fileName: null,
    mimeType: null,
    externalAdReply: null,
    context,
  };
}

function renderDocumentTemplate(
  context: IntegrationNormalizedEventContext,
  title: string,
  documentUrl: string | null,
  paragraphs: Array<string | null | undefined>,
  fieldName: string,
  externalAdReply?: IntegrationRenderedExternalAdReply | null,
): IntegrationRenderedDispatchTemplate {
  const requiredUrl = ensureRequiredUrl(context.eventSlug, fieldName, documentUrl);
  const body = assertRenderedText(joinParagraphs(paragraphs), context.eventSlug);

  return {
    eventSlug: context.eventSlug,
    messageType: "document",
    title,
    body,
    caption: body,
    linkUrl: externalAdReply?.sourceUrl ?? null,
    documentUrl: requiredUrl,
    imageUrl: null,
    fileName: "boleto.pdf",
    mimeType: "application/pdf",
    externalAdReply: externalAdReply ?? null,
    context,
  };
}

function renderImageTemplate(
  context: IntegrationNormalizedEventContext,
  title: string,
  imageUrl: string | null,
  paragraphs: Array<string | null | undefined>,
  externalAdReply?: IntegrationRenderedExternalAdReply | null,
): IntegrationRenderedDispatchTemplate {
  const body = assertRenderedText(joinParagraphs(paragraphs), context.eventSlug);

  return {
    eventSlug: context.eventSlug,
    messageType: "image",
    title,
    body,
    caption: body,
    linkUrl: externalAdReply?.sourceUrl ?? null,
    documentUrl: null,
    imageUrl: imageUrl ?? null,
    fileName: null,
    mimeType: null,
    externalAdReply: externalAdReply ?? null,
    context,
  };
}

export function renderIntegrationDispatchTemplateFromContext(
  context: IntegrationNormalizedEventContext,
): IntegrationRenderedDispatchTemplate {
  const customer = customerLabel(context);
  const product = productLabel(context, "seu produto");

  switch (context.eventSlug) {
    case "pedido_pago":
      return renderImageTemplate(
        context,
        "Pedido pago",
        context.productImage,
        [
          `✅ *Parabéns ${customer}!*`,
          `Seu *${product}* foi aprovado com sucesso!`,
          "👉 Acesse agora sua área de membros e comece a aprender.",
        ],
        createExternalAdReply(product, "Clique para acessar", context.checkoutLink),
      );

    case "pedido_pendente":
      return renderTextTemplate(context, "Pedido pendente", [
        `⏳ *Olá ${customer}!*`,
        `Recebemos seu pedido do *${product}*.` ,
        "Assim que o pagamento for confirmado, você receberá o acesso automaticamente.",
        "Qualquer dúvida, estamos à disposição.",
      ]);

    case "pagamento_recusado":
      return renderTextTemplate(
        context,
        "Pagamento recusado",
        [
          `❌ *${customer}*, o pagamento do *${product}* foi recusado.`,
          "Isso pode ter ocorrido por:\n• Cartão sem limite\n• Dados incorretos\n• Bloqueio da operadora",
          "👉 Tente novamente com outro cartão ou forma de pagamento:",
        ],
        createExternalAdReply("Tentar novamente", product, context.checkoutLink),
        context.checkoutLink,
      );

    case "pedido_cancelado":
      return renderTextTemplate(context, "Pedido cancelado", [
        `⛔ *${customer}*, seu pedido do *${product}* foi cancelado conforme solicitado.`,
        "Se precisar de ajuda, estamos aqui!",
      ]);

    case "reembolso":
      return renderTextTemplate(context, "Reembolso processado", [
        `💰 *${customer}*, o reembolso do *${product}* foi processado com sucesso.`,
        "O valor será estornado em até *5 dias úteis* na forma de pagamento original.",
      ]);

    case "pix_gerado":
      return renderImageTemplate(
        context,
        "PIX gerado",
        context.productImage,
        [
          `💳 *${customer}*, o PIX do *${product}* foi gerado!`,
          context.total ? `📋 *Valor:* R$ ${context.total}` : null,
          "⚠️ *Pague até o vencimento para garantir sua vaga!*",
          context.pixCopyPaste ? `📌 *Código Pix (copia e cola):*\n\`\`\`${context.pixCopyPaste}\`\`\`` : null,
        ],
        createExternalAdReply("Visualizar pedido", product, context.checkoutLink),
      );

    case "boleto_gerado":
      return renderDocumentTemplate(
        context,
        "Boleto gerado",
        context.boletoUrl,
        [
          `📄 *${customer}*, o boleto do *${product}* foi gerado!`,
          context.boletoAmount ? `📋 *Valor:* R$ ${context.boletoAmount}` : null,
          context.boletoExpire ? `📅 *Vencimento:* ${context.boletoExpire}` : null,
          context.boletoBarcode ? `🔢 *Linha digitável:* ${context.boletoBarcode}` : null,
        ],
        "boletoUrl",
        createExternalAdReply("Baixar boleto", product, context.boletoUrl),
      );

    case "carrinho_abandonado":
      return renderImageTemplate(
        context,
        "Carrinho abandonado",
        context.productImage,
        [
          `🛒 *${customer}*, você deixou o *${product}* no carrinho!`,
          "🔥 Não perca esta oportunidade!",
          "👉 Finalize sua compra agora e garanta seu acesso.",
        ],
        createExternalAdReply("Finalizar Compra", product, context.checkoutLink),
      );

    case "envio_acesso":
      return renderImageTemplate(
        context,
        "Acesso liberado",
        context.productImage,
        [
          `🔓 *Olá ${customer}!*`,
          `Seu acesso ao *${product}* foi liberado!`,
          "Já pode assistir às aulas e começar sua jornada.",
        ],
        createExternalAdReply("Acessar agora", product, context.checkoutLink),
      );

    case "assinatura_criada":
      return renderImageTemplate(
        context,
        "Assinatura criada",
        context.productImage,
        [
          `🔄 *${customer}*, sua assinatura do *${product}* foi criada com sucesso!`,
          "Bem-vindo(a) à nossa plataforma! 🎉",
        ],
        createExternalAdReply("Acessar agora", product, context.checkoutLink),
      );

    case "assinatura_renovada":
      return renderTextTemplate(context, "Assinatura renovada", [
        `✅ *${customer}*, sua assinatura do *${product}* foi renovada com sucesso!`,
        "Seu acesso continua ativo.",
      ]);

    case "assinatura_cancelada":
      return renderTextTemplate(context, "Assinatura cancelada", [
        `⛔ *${customer}*, sua assinatura do *${product}* foi cancelada.`,
        "Sentiremos sua falta! Caso queira retornar, estaremos aqui.",
      ]);

    case "assinatura_em_atraso":
      return renderImageTemplate(
        context,
        "Assinatura em atraso",
        context.productImage,
        [
          `⚠️ *${customer}*, sua assinatura do *${product}* está *atrasada*!`,
          "Regularize agora para não perder o acesso.",
        ],
        createExternalAdReply("Pagar agora", product, context.checkoutLink),
      );
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
