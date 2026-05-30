import { generateWAMessageFromContent, proto, type AnyMessageContent, type WASocket, type WAMessage } from "@whiskeysockets/baileys";
import { randomUUID } from "crypto";
import { prisma } from "../../database/prisma";
import { InstanceManager } from "../../whatsapp/InstanceManager";
import { redactSensitiveText } from "../../utils/redaction";
import {
  type IntegrationNormalizedEventContext,
  normalizeIntegrationEventContext,
} from "./integrationEventCatalog.service";
import {
  type IntegrationDispatchMessageType,
  type IntegrationRenderedDispatchTemplate,
  IntegrationDispatchTemplateRenderError,
  renderIntegrationDispatchTemplateFromContext,
} from "./integrationDispatchTemplate.service";

export const INTEGRATION_DISPATCH_STATUS = {
  PENDING_RUNTIME: "PENDING_RUNTIME",
  SENT: "SENT",
  FAILED_INSTANCE_NOT_FOUND: "FAILED_INSTANCE_NOT_FOUND",
  FAILED_INSTANCE_OFFLINE: "FAILED_INSTANCE_OFFLINE",
  FAILED_RECIPIENT_MISSING: "FAILED_RECIPIENT_MISSING",
  FAILED_TEMPLATE_RENDER: "FAILED_TEMPLATE_RENDER",
  FAILED_SEND: "FAILED_SEND",
  ERROR: "ERROR",
} as const;

export type IntegrationDispatchStatus = typeof INTEGRATION_DISPATCH_STATUS[keyof typeof INTEGRATION_DISPATCH_STATUS];

export type IntegrationDispatchLogRecord = {
  id: string;
  ingressLogId: string | null;
  credentialId: string | null;
  instanceId: string | null;
  eventSlug: string | null;
  dedupKey: string | null;
  recipientJid: string | null;
  messageType: string | null;
  dispatchStatus: IntegrationDispatchStatus;
  failureCode: string | null;
  providerMessageId: string | null;
  payloadSummaryJson: string | null;
  createdAt: Date;
  processedAt: Date | null;
};

export type PersistIntegrationDispatchLogInput = {
  ingressLogId?: string | null;
  credentialId?: string | null;
  instanceId?: string | null;
  eventSlug?: string | null;
  dedupKey?: string | null;
  recipientJid?: string | null;
  messageType?: string | null;
  dispatchStatus: IntegrationDispatchStatus;
  failureCode?: string | null;
  providerMessageId?: string | null;
  payloadSummary?: unknown;
  processedAt?: Date | null;
};

export interface IntegrationDispatchStore {
  createLog(input: {
    ingressLogId?: string | null;
    credentialId?: string | null;
    instanceId?: string | null;
    eventSlug?: string | null;
    dedupKey?: string | null;
    recipientJid?: string | null;
    messageType?: string | null;
    dispatchStatus: IntegrationDispatchStatus;
    failureCode?: string | null;
    providerMessageId?: string | null;
    payloadSummaryJson?: string | null;
    processedAt?: Date | null;
  }): Promise<IntegrationDispatchLogRecord>;
  updateLog(id: string, input: {
    recipientJid?: string | null;
    messageType?: string | null;
    dispatchStatus?: IntegrationDispatchStatus;
    failureCode?: string | null;
    providerMessageId?: string | null;
    payloadSummaryJson?: string | null;
    processedAt?: Date | null;
  }): Promise<IntegrationDispatchLogRecord>;
}

export type IntegrationDownloadedImageAsset = {
  buffer: Buffer;
  mimeType: string | null;
};

export type IntegrationImageFallbackReason =
  | "missing_image_url"
  | "invalid_image_url"
  | "image_download_failed";

export type IntegrationButtonFallbackReason =
  | "missing_cta_url"
  | "unsupported_socket_transport"
  | "button_dispatch_failed";

export type IntegrationDispatchDeliveryPath =
  | "template_cta"
  | "image_clean"
  | "text_fallback_button"
  | "text_fallback_image"
  | "document"
  | "link"
  | "text";

export type IntegrationDispatchTransportPayload = AnyMessageContent | proto.IMessage;

export class IntegrationDispatchRuntimeError extends Error {
  statusCode: number;
  code: string;
  dispatchStatus: IntegrationDispatchStatus;

  constructor(message: string, statusCode: number, code: string, dispatchStatus: IntegrationDispatchStatus) {
    super(message);
    this.name = code;
    this.statusCode = statusCode;
    this.code = code;
    this.dispatchStatus = dispatchStatus;
  }
}

export class IntegrationDispatchInstanceNotFoundError extends IntegrationDispatchRuntimeError {
  constructor(instanceId: string) {
    super(`Instância de disparo não encontrada: ${instanceId}.`, 409, "INTEGRATION_DISPATCH_INSTANCE_NOT_FOUND", INTEGRATION_DISPATCH_STATUS.FAILED_INSTANCE_NOT_FOUND);
  }
}

export class IntegrationDispatchInstanceOfflineError extends IntegrationDispatchRuntimeError {
  constructor(instanceId: string) {
    super(`Instância de disparo indisponível: ${instanceId}.`, 409, "INTEGRATION_DISPATCH_INSTANCE_OFFLINE", INTEGRATION_DISPATCH_STATUS.FAILED_INSTANCE_OFFLINE);
  }
}

export class IntegrationDispatchRecipientMissingError extends IntegrationDispatchRuntimeError {
  constructor(eventSlug: string) {
    super(`Evento ${eventSlug} não possui recipientJid válido para disparo.`, 422, "INTEGRATION_DISPATCH_RECIPIENT_MISSING", INTEGRATION_DISPATCH_STATUS.FAILED_RECIPIENT_MISSING);
  }
}

export class IntegrationDispatchSendFailedError extends IntegrationDispatchRuntimeError {
  constructor(eventSlug: string) {
    super(`Falha ao enviar mensagem do evento ${eventSlug}.`, 409, "INTEGRATION_DISPATCH_SEND_FAILED", INTEGRATION_DISPATCH_STATUS.FAILED_SEND);
  }
}

function serializePayloadSummary(payloadSummary: unknown): string | null {
  if (payloadSummary === undefined) return null;
  try {
    return redactSensitiveText(JSON.stringify(payloadSummary), 2000);
  } catch {
    return redactSensitiveText(String(payloadSummary), 2000);
  }
}

function toDispatchLogRecord(record: {
  id: string;
  ingressLogId: string | null;
  credentialId: string | null;
  instanceId: string | null;
  eventSlug: string | null;
  dedupKey: string | null;
  recipientJid: string | null;
  messageType: string | null;
  dispatchStatus: IntegrationDispatchStatus;
  failureCode: string | null;
  providerMessageId: string | null;
  payloadSummaryJson: string | null;
  createdAt: Date;
  processedAt: Date | null;
}): IntegrationDispatchLogRecord {
  return {
    ...record,
    processedAt: record.processedAt ?? null,
  };
}

type PrismaIntegrationDispatchClient = {
  integrationDispatchLog: {
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
};

export function createPrismaIntegrationDispatchStore(db: PrismaIntegrationDispatchClient): IntegrationDispatchStore {
  return {
    async createLog(input) {
      const record = await db.integrationDispatchLog.create({
        data: {
          ingressLogId: input.ingressLogId ?? null,
          credentialId: input.credentialId ?? null,
          instanceId: input.instanceId ?? null,
          eventSlug: input.eventSlug ?? null,
          dedupKey: input.dedupKey ?? null,
          recipientJid: input.recipientJid ?? null,
          messageType: input.messageType ?? null,
          dispatchStatus: input.dispatchStatus,
          failureCode: input.failureCode ?? null,
          providerMessageId: input.providerMessageId ?? null,
          payloadSummaryJson: input.payloadSummaryJson ?? null,
          processedAt: input.processedAt ?? null,
        },
      });
      return toDispatchLogRecord(record as unknown as IntegrationDispatchLogRecord);
    },
    async updateLog(id, input) {
      const record = await db.integrationDispatchLog.update({
        where: { id },
        data: {
          recipientJid: input.recipientJid,
          messageType: input.messageType,
          dispatchStatus: input.dispatchStatus,
          failureCode: input.failureCode,
          providerMessageId: input.providerMessageId,
          payloadSummaryJson: input.payloadSummaryJson,
          processedAt: input.processedAt ?? new Date(),
        },
      });
      return toDispatchLogRecord(record as unknown as IntegrationDispatchLogRecord);
    },
  };
}

export function createInMemoryIntegrationDispatchStore(seed?: { logs?: IntegrationDispatchLogRecord[] }): IntegrationDispatchStore & { logs: Map<string, IntegrationDispatchLogRecord> } {
  const logs = new Map<string, IntegrationDispatchLogRecord>((seed?.logs ?? []).map((entry) => [entry.id, entry]));
  return {
    logs,
    async createLog(input) {
      const now = new Date();
      const record: IntegrationDispatchLogRecord = {
        id: randomUUID(),
        ingressLogId: input.ingressLogId ?? null,
        credentialId: input.credentialId ?? null,
        instanceId: input.instanceId ?? null,
        eventSlug: input.eventSlug ?? null,
        dedupKey: input.dedupKey ?? null,
        recipientJid: input.recipientJid ?? null,
        messageType: input.messageType ?? null,
        dispatchStatus: input.dispatchStatus,
        failureCode: input.failureCode ?? null,
        providerMessageId: input.providerMessageId ?? null,
        payloadSummaryJson: input.payloadSummaryJson ?? null,
        createdAt: now,
        processedAt: input.processedAt ?? now,
      };
      logs.set(record.id, record);
      return { ...record };
    },
    async updateLog(id, input) {
      const current = logs.get(id);
      if (!current) {
        throw new Error(`Integration dispatch log not found: ${id}`);
      }
      const record: IntegrationDispatchLogRecord = {
        ...current,
        recipientJid: input.recipientJid === undefined ? current.recipientJid : input.recipientJid,
        messageType: input.messageType === undefined ? current.messageType : input.messageType,
        dispatchStatus: input.dispatchStatus ?? current.dispatchStatus,
        failureCode: input.failureCode === undefined ? current.failureCode : input.failureCode,
        providerMessageId: input.providerMessageId === undefined ? current.providerMessageId : input.providerMessageId,
        payloadSummaryJson: input.payloadSummaryJson === undefined ? current.payloadSummaryJson : input.payloadSummaryJson,
        processedAt: input.processedAt ?? new Date(),
      };
      logs.set(id, record);
      return { ...record };
    },
  };
}

export function createIntegrationDispatchLogService(store: IntegrationDispatchStore) {
  return {
    async persistLog(input: PersistIntegrationDispatchLogInput) {
      return store.createLog({
        ingressLogId: input.ingressLogId ?? null,
        credentialId: input.credentialId ?? null,
        instanceId: input.instanceId ?? null,
        eventSlug: input.eventSlug ?? null,
        dedupKey: input.dedupKey ?? null,
        recipientJid: input.recipientJid ?? null,
        messageType: input.messageType ?? null,
        dispatchStatus: input.dispatchStatus,
        failureCode: input.failureCode ?? null,
        providerMessageId: input.providerMessageId ?? null,
        payloadSummaryJson: serializePayloadSummary(input.payloadSummary),
        processedAt: input.processedAt ?? new Date(),
      });
    },
    async updateLog(id: string, input: {
      recipientJid?: string | null;
      messageType?: string | null;
      dispatchStatus?: IntegrationDispatchStatus;
      failureCode?: string | null;
      providerMessageId?: string | null;
      payloadSummary?: unknown;
      processedAt?: Date | null;
    }) {
      return store.updateLog(id, {
        recipientJid: input.recipientJid,
        messageType: input.messageType,
        dispatchStatus: input.dispatchStatus,
        failureCode: input.failureCode,
        providerMessageId: input.providerMessageId,
        payloadSummaryJson: input.payloadSummary === undefined ? undefined : serializePayloadSummary(input.payloadSummary),
        processedAt: input.processedAt ?? new Date(),
      });
    },
  };
}

export type IntegrationDispatchInstanceRecord = {
  id: string;
  status: string;
};

export type IntegrationDispatchServiceDeps = {
  eventCatalogService?: Pick<typeof integrationEventCatalogServiceBridge, "normalizeEventContext">;
  templateService?: Pick<typeof integrationDispatchTemplateServiceBridge, "renderTemplateFromContext">;
  logService?: Pick<ReturnType<typeof createIntegrationDispatchLogService>, "persistLog" | "updateLog">;
  instanceLookup?: (instanceId: string) => Promise<IntegrationDispatchInstanceRecord | null>;
  socketLookup?: (instanceId: string) => WASocket | null;
  imageDownloader?: (imageUrl: string) => Promise<IntegrationDownloadedImageAsset>;
};

const integrationEventCatalogServiceBridge = {
  normalizeEventContext: normalizeIntegrationEventContext,
};

const integrationDispatchTemplateServiceBridge = {
  renderTemplateFromContext: renderIntegrationDispatchTemplateFromContext,
};

function buildLinkBody(template: IntegrationRenderedDispatchTemplate): string {
  return `${template.body}\n\n${template.linkUrl ?? ""}`.trim();
}

function buildImageFallbackBody(template: IntegrationRenderedDispatchTemplate): string {
  return template.linkUrl ? buildLinkBody(template) : template.body;
}

function buildButtonFallbackBody(template: IntegrationRenderedDispatchTemplate): string {
  return template.linkUrl ? buildLinkBody(template) : template.body;
}

function shouldUseRealCtaButton(template: IntegrationRenderedDispatchTemplate): boolean {
  return template.eventSlug === "pedido_pago";
}

function buildCtaButtonLabel(template: IntegrationRenderedDispatchTemplate): string {
  if (template.eventSlug === "pedido_pago") {
    return "Acessar agora";
  }

  return template.title ?? "Abrir link";
}

function buildRealCtaTemplateMessage(template: IntegrationRenderedDispatchTemplate): proto.IMessage {
  return proto.Message.fromObject({
    templateMessage: {
      hydratedTemplate: {
        hydratedTitleText: template.title ?? undefined,
        hydratedContentText: template.caption ?? template.body,
        hydratedFooterText: template.linkUrl ?? undefined,
        hydratedButtons: [
          {
            index: 1,
            urlButton: {
              displayText: buildCtaButtonLabel(template),
              url: template.linkUrl,
              webviewPresentation: proto.HydratedTemplateButton.HydratedURLButton.WebviewPresentationType.COMPACT,
            },
          },
        ],
      },
    },
  });
}

function buildButtonFallbackPayload(template: IntegrationRenderedDispatchTemplate): AnyMessageContent {
  return {
    text: buildButtonFallbackBody(template),
  };
}

function resolveDeliveryPath(
  template: IntegrationRenderedDispatchTemplate,
  content: IntegrationDispatchTransportPayload,
  imageFallbackReason: IntegrationImageFallbackReason | null,
  buttonFallbackReason: IntegrationButtonFallbackReason | null,
): IntegrationDispatchDeliveryPath {
  if ("templateMessage" in content && content.templateMessage) return "template_cta";
  if ("image" in content) return "image_clean";
  if ("document" in content) return "document";
  if (buttonFallbackReason) return "text_fallback_button";
  if (imageFallbackReason) return "text_fallback_image";
  if (template.messageType === "link") return "link";
  return "text";
}

function buildContextInfo(template: IntegrationRenderedDispatchTemplate, thumbnail?: Buffer): { externalAdReply: { title: string; body: string; sourceUrl: string; mediaType: 1; thumbnail?: Buffer } } | undefined {
  if (!template.externalAdReply) return undefined;

  return {
    externalAdReply: {
      ...template.externalAdReply,
      thumbnail: thumbnail ?? undefined,
    },
  };
}

export function buildBaileysDispatchPayload(
  template: IntegrationRenderedDispatchTemplate,
  options: {
    imageBuffer?: Buffer | null;
    imageMimeType?: string | null;
  } = {},
): AnyMessageContent {
  if (template.messageType === "image") {
    if (options.imageBuffer) {
      return {
        image: options.imageBuffer,
        mimetype: options.imageMimeType ?? undefined,
        caption: template.caption ?? template.body,
      };
    }

    return {
      text: buildImageFallbackBody(template),
      contextInfo: buildContextInfo(template),
    };
  }

  const contextInfo = buildContextInfo(template, options.imageBuffer ?? undefined);

  if (template.messageType === "text") {
    return {
      text: template.body,
      contextInfo,
    };
  }

  if (template.messageType === "link") {
    return {
      text: buildLinkBody(template),
      contextInfo,
    };
  }

  return {
    document: { url: template.documentUrl! },
    mimetype: template.mimeType!,
    fileName: template.fileName ?? undefined,
    caption: template.caption ?? undefined,
    contextInfo,
  };
}

function buildPayloadSummary(
  template: IntegrationRenderedDispatchTemplate,
  content: IntegrationDispatchTransportPayload,
  imageAsset: IntegrationDownloadedImageAsset | null,
  imageFallbackReason: IntegrationImageFallbackReason | null,
  buttonFallbackReason: IntegrationButtonFallbackReason | null,
) {
  return {
    eventSlug: template.eventSlug,
    intendedMessageType: template.messageType,
    dispatchedMessageType: resolveDispatchedMessageType(template, content),
    deliveryPath: resolveDeliveryPath(template, content, imageFallbackReason, buttonFallbackReason),
    title: template.title,
    linkUrl: template.linkUrl,
    documentUrl: template.documentUrl,
    imageUrl: template.imageUrl,
    fileName: template.fileName,
    hasCaption: Boolean(template.caption),
    hasExternalAdReply: Boolean(template.externalAdReply),
    fallbackWithoutImage: template.messageType === "image" && !imageAsset,
    imageFallbackReason,
    usedRealCtaButton: Boolean("templateMessage" in content && content.templateMessage),
    buttonFallbackReason,
  };
}

function extractProviderMessageId(message: WAMessage | null | undefined): string | null {
  const keyId = message?.key?.id;
  return typeof keyId === "string" && keyId.trim() ? keyId : null;
}

function toTemplateRenderRuntimeError(error: IntegrationDispatchTemplateRenderError): IntegrationDispatchRuntimeError {
  return new IntegrationDispatchRuntimeError(
    error.message,
    error.statusCode ?? 422,
    error.code ?? "INTEGRATION_DISPATCH_TEMPLATE_RENDER_ERROR",
    INTEGRATION_DISPATCH_STATUS.FAILED_TEMPLATE_RENDER,
  );
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function downloadIntegrationImageAsset(imageUrl: string): Promise<IntegrationDownloadedImageAsset> {
  if (!isHttpUrl(imageUrl)) {
    throw new Error("Invalid integration image URL");
  }

  const response = await fetch(imageUrl, {
    headers: {
      Accept: "image/*,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Image download failed with status ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (!buffer.byteLength) {
    throw new Error("Downloaded integration image is empty");
  }

  const mimeType = response.headers.get("content-type");
  return {
    buffer,
    mimeType: mimeType && mimeType.trim() ? mimeType : null,
  };
}

function resolveDispatchedMessageType(
  template: IntegrationRenderedDispatchTemplate,
  content: IntegrationDispatchTransportPayload,
): IntegrationDispatchMessageType {
  if ("templateMessage" in content && content.templateMessage) return "template";
  if ("image" in content) return "image";
  if ("document" in content) return "document";
  if (template.messageType === "link") return "link";
  return "text";
}

export function createIntegrationDispatchRuntimeService(deps: IntegrationDispatchServiceDeps = {}) {
  const eventCatalogService = deps.eventCatalogService ?? integrationEventCatalogServiceBridge;
  const templateService = deps.templateService ?? integrationDispatchTemplateServiceBridge;
  const logService = deps.logService ?? integrationDispatchLogService;
  const instanceLookup = deps.instanceLookup ?? (async (instanceId: string) => prisma.instance.findUnique({ where: { id: instanceId }, select: { id: true, status: true } }));
  const socketLookup = deps.socketLookup ?? ((instanceId: string) => InstanceManager.get(instanceId));
  const imageDownloader = deps.imageDownloader ?? downloadIntegrationImageAsset;

  return {
    buildBaileysPayload: buildBaileysDispatchPayload,
    async dispatchEvent(input: {
      ingressLogId?: string | null;
      credentialId?: string | null;
      instanceId: string;
      eventSlug: string;
      dedupKey?: string | null;
      payload: Record<string, unknown>;
    }) {
      const context = eventCatalogService.normalizeEventContext(input.eventSlug, input.payload) as IntegrationNormalizedEventContext;
      const dispatchLog = await logService.persistLog({
        ingressLogId: input.ingressLogId ?? null,
        credentialId: input.credentialId ?? null,
        instanceId: input.instanceId,
        eventSlug: input.eventSlug,
        dedupKey: input.dedupKey ?? null,
        recipientJid: context.recipientJid,
        dispatchStatus: INTEGRATION_DISPATCH_STATUS.PENDING_RUNTIME,
        payloadSummary: { eventSlug: input.eventSlug },
      });

      try {
        if (!context.recipientJid) {
          throw new IntegrationDispatchRecipientMissingError(context.eventSlug);
        }

        const instance = await instanceLookup(input.instanceId);
        if (!instance) {
          throw new IntegrationDispatchInstanceNotFoundError(input.instanceId);
        }

        const sock = socketLookup(input.instanceId);
        if (instance.status !== "CONNECTED" || !sock) {
          throw new IntegrationDispatchInstanceOfflineError(input.instanceId);
        }

        let template: IntegrationRenderedDispatchTemplate;
        try {
          template = templateService.renderTemplateFromContext(context);
        } catch (error) {
          if (error instanceof IntegrationDispatchTemplateRenderError) {
            throw toTemplateRenderRuntimeError(error);
          }
          throw error;
        }

        let imageAsset: IntegrationDownloadedImageAsset | null = null;
        let imageFallbackReason: IntegrationImageFallbackReason | null = null;
        let buttonFallbackReason: IntegrationButtonFallbackReason | null = null;
        const shouldUseButtonPilot = shouldUseRealCtaButton(template);

        if (template.messageType === "image" && !shouldUseButtonPilot) {
          if (!template.imageUrl) {
            imageFallbackReason = "missing_image_url";
          } else if (!isHttpUrl(template.imageUrl)) {
            imageFallbackReason = "invalid_image_url";
          } else {
            try {
              imageAsset = await imageDownloader(template.imageUrl);
            } catch {
              imageFallbackReason = "image_download_failed";
            }
          }
        }

        const canSendRealCtaButton = shouldUseButtonPilot
          && Boolean(template.linkUrl)
          && typeof sock.relayMessage === "function";

        if (shouldUseButtonPilot && !template.linkUrl) {
          buttonFallbackReason = "missing_cta_url";
        } else if (shouldUseButtonPilot && typeof sock.relayMessage !== "function") {
          buttonFallbackReason = "unsupported_socket_transport";
        }

        const content = canSendRealCtaButton
          ? buildRealCtaTemplateMessage(template)
          : shouldUseButtonPilot
            ? buildButtonFallbackPayload(template)
            : buildBaileysDispatchPayload(template, {
              imageBuffer: imageAsset?.buffer ?? null,
              imageMimeType: imageAsset?.mimeType ?? null,
            });

        try {
          let providerMessageId: string | null;

          if (canSendRealCtaButton) {
            try {
              const senderJid = sock.user?.id ?? "0@s.whatsapp.net";
              const outbound = generateWAMessageFromContent(context.recipientJid, content as proto.IMessage, {
                userJid: senderJid,
              });

              providerMessageId = await sock.relayMessage(context.recipientJid, outbound.message!, {
                messageId: outbound.key.id!,
              });
            } catch {
              buttonFallbackReason = "button_dispatch_failed";
              const fallbackContent = buildButtonFallbackPayload(template);
              const sentMessage = await sock.sendMessage(context.recipientJid, fallbackContent);
              providerMessageId = extractProviderMessageId(sentMessage as WAMessage | null | undefined);

              const finalLog = await logService.updateLog(dispatchLog.id, {
                recipientJid: context.recipientJid,
                messageType: resolveDispatchedMessageType(template, fallbackContent),
                dispatchStatus: INTEGRATION_DISPATCH_STATUS.SENT,
                failureCode: null,
                providerMessageId,
                payloadSummary: buildPayloadSummary(template, fallbackContent, imageAsset, imageFallbackReason, buttonFallbackReason),
              });

              return {
                context,
                template,
                content: fallbackContent,
                providerMessageId,
                dispatchLog: finalLog,
              };
            }
          } else {
            const sentMessage = await sock.sendMessage(context.recipientJid, content as AnyMessageContent);
            providerMessageId = extractProviderMessageId(sentMessage as WAMessage | null | undefined);
          }

          const finalLog = await logService.updateLog(dispatchLog.id, {
            recipientJid: context.recipientJid,
            messageType: resolveDispatchedMessageType(template, content),
            dispatchStatus: INTEGRATION_DISPATCH_STATUS.SENT,
            failureCode: null,
            providerMessageId,
            payloadSummary: buildPayloadSummary(template, content, imageAsset, imageFallbackReason, buttonFallbackReason),
          });

          return {
            context,
            template,
            content,
            providerMessageId,
            dispatchLog: finalLog,
          };
        } catch {
          throw new IntegrationDispatchSendFailedError(context.eventSlug);
        }
      } catch (error) {
        if (error instanceof IntegrationDispatchRuntimeError) {
          await logService.updateLog(dispatchLog.id, {
            recipientJid: context.recipientJid,
            dispatchStatus: error.dispatchStatus,
            failureCode: error.code,
          });
          throw error;
        }

        await logService.updateLog(dispatchLog.id, {
          recipientJid: context.recipientJid,
          dispatchStatus: INTEGRATION_DISPATCH_STATUS.ERROR,
          failureCode: "INTEGRATION_DISPATCH_RUNTIME_ERROR",
        });
        throw error;
      }
    },
  };
}

export const prismaIntegrationDispatchStore = createPrismaIntegrationDispatchStore(prisma);
export const integrationDispatchLogService = createIntegrationDispatchLogService(prismaIntegrationDispatchStore);
export const integrationDispatchRuntimeService = createIntegrationDispatchRuntimeService();
