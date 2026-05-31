import { type AnyMessageContent, type WASocket, type WAMessage } from "@whiskeysockets/baileys";
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
  retryable: boolean;
  retryAttemptCount: number;
  nextRetryAt: Date | null;
  lastRetryError: string | null;
  retryLockedAt: Date | null;
  retryExhaustedAt: Date | null;
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
  retryable?: boolean;
  retryAttemptCount?: number;
  nextRetryAt?: Date | null;
  lastRetryError?: string | null;
  retryLockedAt?: Date | null;
  retryExhaustedAt?: Date | null;
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
    retryable?: boolean;
    retryAttemptCount?: number;
    nextRetryAt?: Date | null;
    lastRetryError?: string | null;
    retryLockedAt?: Date | null;
    retryExhaustedAt?: Date | null;
    processedAt?: Date | null;
  }): Promise<IntegrationDispatchLogRecord>;
  updateLog(id: string, input: {
    recipientJid?: string | null;
    messageType?: string | null;
    dispatchStatus?: IntegrationDispatchStatus;
    failureCode?: string | null;
    providerMessageId?: string | null;
    payloadSummaryJson?: string | null;
    retryable?: boolean;
    retryAttemptCount?: number;
    nextRetryAt?: Date | null;
    lastRetryError?: string | null;
    retryLockedAt?: Date | null;
    retryExhaustedAt?: Date | null;
    processedAt?: Date | null;
  }): Promise<IntegrationDispatchLogRecord>;
}

export const DEFAULT_INTEGRATION_DISPATCH_RETRY_MAX_ATTEMPTS = 3;
export const DEFAULT_INTEGRATION_DISPATCH_RETRY_BACKOFF_MS = [30_000, 120_000, 600_000] as const;

export type IntegrationDownloadedImageAsset = {
  buffer: Buffer;
  mimeType: string | null;
};

export const DEFAULT_INTEGRATION_IMAGE_FETCH_TIMEOUT_MS = 10_000;

export type IntegrationImageFallbackReason =
  | "missing_image_url"
  | "invalid_image_url"
  | "image_download_failed";

export type IntegrationSecondaryDispatchStatus =
  | "not_applicable"
  | "skipped_missing_pix_code"
  | "sent"
  | "failed_send";

export type IntegrationSecondaryDispatchFailureCode = "send_failed";

export type IntegrationDispatchDeliveryPath =
  | "image_clean"
  | "text_fallback_image"
  | "document"
  | "link"
  | "text";
export type IntegrationDispatchTransportPayload = AnyMessageContent;

export class IntegrationDispatchRuntimeError extends Error {
  statusCode: number;
  code: string;
  dispatchStatus: IntegrationDispatchStatus;
  dispatchLogId: string | null;

  constructor(message: string, statusCode: number, code: string, dispatchStatus: IntegrationDispatchStatus) {
    super(message);
    this.name = code;
    this.statusCode = statusCode;
    this.code = code;
    this.dispatchStatus = dispatchStatus;
    this.dispatchLogId = null;
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
  retryable?: boolean;
  retryAttemptCount?: number;
  nextRetryAt?: Date | null;
  lastRetryError?: string | null;
  retryLockedAt?: Date | null;
  retryExhaustedAt?: Date | null;
  createdAt: Date;
  processedAt: Date | null;
}): IntegrationDispatchLogRecord {
  return {
    ...record,
    retryable: record.retryable ?? false,
    retryAttemptCount: record.retryAttemptCount ?? 0,
    nextRetryAt: record.nextRetryAt ?? null,
    lastRetryError: record.lastRetryError ?? null,
    retryLockedAt: record.retryLockedAt ?? null,
    retryExhaustedAt: record.retryExhaustedAt ?? null,
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
          retryable: input.retryable ?? false,
          retryAttemptCount: input.retryAttemptCount ?? 0,
          nextRetryAt: input.nextRetryAt ?? null,
          lastRetryError: input.lastRetryError ?? null,
          retryLockedAt: input.retryLockedAt ?? null,
          retryExhaustedAt: input.retryExhaustedAt ?? null,
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
          retryable: input.retryable,
          retryAttemptCount: input.retryAttemptCount,
          nextRetryAt: input.nextRetryAt,
          lastRetryError: input.lastRetryError,
          retryLockedAt: input.retryLockedAt,
          retryExhaustedAt: input.retryExhaustedAt,
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
        retryable: input.retryable ?? false,
        retryAttemptCount: input.retryAttemptCount ?? 0,
        nextRetryAt: input.nextRetryAt ?? null,
        lastRetryError: input.lastRetryError ?? null,
        retryLockedAt: input.retryLockedAt ?? null,
        retryExhaustedAt: input.retryExhaustedAt ?? null,
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
        retryable: input.retryable === undefined ? current.retryable : input.retryable,
        retryAttemptCount: input.retryAttemptCount === undefined ? current.retryAttemptCount : input.retryAttemptCount,
        nextRetryAt: input.nextRetryAt === undefined ? current.nextRetryAt : input.nextRetryAt,
        lastRetryError: input.lastRetryError === undefined ? current.lastRetryError : input.lastRetryError,
        retryLockedAt: input.retryLockedAt === undefined ? current.retryLockedAt : input.retryLockedAt,
        retryExhaustedAt: input.retryExhaustedAt === undefined ? current.retryExhaustedAt : input.retryExhaustedAt,
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
        retryable: input.retryable ?? false,
        retryAttemptCount: input.retryAttemptCount ?? 0,
        nextRetryAt: input.nextRetryAt ?? null,
        lastRetryError: input.lastRetryError ?? null,
        retryLockedAt: input.retryLockedAt ?? null,
        retryExhaustedAt: input.retryExhaustedAt ?? null,
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
      retryable?: boolean;
      retryAttemptCount?: number;
      nextRetryAt?: Date | null;
      lastRetryError?: string | null;
      retryLockedAt?: Date | null;
      retryExhaustedAt?: Date | null;
      processedAt?: Date | null;
    }) {
      return store.updateLog(id, {
        recipientJid: input.recipientJid,
        messageType: input.messageType,
        dispatchStatus: input.dispatchStatus,
        failureCode: input.failureCode,
        providerMessageId: input.providerMessageId,
        payloadSummaryJson: input.payloadSummary === undefined ? undefined : serializePayloadSummary(input.payloadSummary),
        retryable: input.retryable,
        retryAttemptCount: input.retryAttemptCount,
        nextRetryAt: input.nextRetryAt,
        lastRetryError: input.lastRetryError,
        retryLockedAt: input.retryLockedAt,
        retryExhaustedAt: input.retryExhaustedAt,
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

function buildTextLinkBody(template: IntegrationRenderedDispatchTemplate): string {
  return template.linkUrl ? buildLinkBody(template) : template.body;
}

function shouldUseTextLinkDispatch(template: IntegrationRenderedDispatchTemplate): boolean {
  return template.eventSlug === "pedido_pago";
}
function buildTextLinkPayload(template: IntegrationRenderedDispatchTemplate): AnyMessageContent {
  return {
    text: buildTextLinkBody(template),
  };
}

function buildFollowupPayload(template: IntegrationRenderedDispatchTemplate): AnyMessageContent | null {
  if (!template.followup) return null;

  return {
    text: template.followup.body,
  };
}

function resolveDeliveryPath(
  template: IntegrationRenderedDispatchTemplate,
  content: IntegrationDispatchTransportPayload,
  imageFallbackReason: IntegrationImageFallbackReason | null,
): IntegrationDispatchDeliveryPath {
  if ("image" in content) return "image_clean";
  if ("document" in content) return "document";
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
  secondaryProviderMessageId: string | null,
  secondaryDispatchFailureCode: IntegrationSecondaryDispatchFailureCode | null,
) {
  const secondaryDispatchStatus: IntegrationSecondaryDispatchStatus = template.followup
    ? secondaryDispatchFailureCode
      ? "failed_send"
      : secondaryProviderMessageId
        ? "sent"
        : "failed_send"
    : template.eventSlug === "pix_gerado"
      ? "skipped_missing_pix_code"
      : "not_applicable";

  return {
    eventSlug: template.eventSlug,
    intendedMessageType: template.messageType,
    dispatchedMessageType: resolveDispatchedMessageType(template, content),
    deliveryPath: resolveDeliveryPath(template, content, imageFallbackReason),
    title: template.title,
    linkUrl: template.linkUrl,
    documentUrl: template.documentUrl,
    imageUrl: template.imageUrl,
    fileName: template.fileName,
    hasCaption: Boolean(template.caption),
    hasExternalAdReply: Boolean(template.externalAdReply),
    fallbackWithoutImage: template.messageType === "image" && !imageAsset,
    imageFallbackReason,
    secondaryDispatchKind: template.followup?.type ?? null,
    secondaryDispatchMessageType: template.followup?.messageType ?? null,
    secondaryDispatchStatus,
    secondaryProviderMessageId,
    secondaryDispatchFailureCode,
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

export async function downloadIntegrationImageAsset(
  imageUrl: string,
  options: { timeoutMs?: number } = {},
): Promise<IntegrationDownloadedImageAsset> {
  if (!isHttpUrl(imageUrl)) {
    throw new Error("Invalid integration image URL");
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_INTEGRATION_IMAGE_FETCH_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Integration image fetch timeout must be a positive number");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;

  try {
    response = await fetch(imageUrl, {
      headers: {
        Accept: "image/*,*/*;q=0.8",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

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
  if ("image" in content) return "image";
  if ("document" in content) return "document";
  if (template.messageType === "link") return "link";
  return "text";
}

function isRetryableDispatchRuntimeError(error: IntegrationDispatchRuntimeError): boolean {
  return error.dispatchStatus === INTEGRATION_DISPATCH_STATUS.FAILED_INSTANCE_OFFLINE
    || error.dispatchStatus === INTEGRATION_DISPATCH_STATUS.FAILED_SEND;
}

export function isRetryableIntegrationDispatchError(error: unknown): error is IntegrationDispatchRuntimeError {
  return error instanceof IntegrationDispatchRuntimeError && isRetryableDispatchRuntimeError(error);
}

function resolveRetryState(error: IntegrationDispatchRuntimeError, attemptCount: number, now: Date) {
  if (!isRetryableDispatchRuntimeError(error)) {
    return {
      retryable: false,
      nextRetryAt: null,
      lastRetryError: null,
      retryLockedAt: null,
      retryExhaustedAt: null,
    };
  }

  if (attemptCount >= DEFAULT_INTEGRATION_DISPATCH_RETRY_MAX_ATTEMPTS) {
    return {
      retryable: false,
      nextRetryAt: null,
      lastRetryError: error.code,
      retryLockedAt: null,
      retryExhaustedAt: now,
    };
  }

  const delayMs = DEFAULT_INTEGRATION_DISPATCH_RETRY_BACKOFF_MS[Math.min(attemptCount - 1, DEFAULT_INTEGRATION_DISPATCH_RETRY_BACKOFF_MS.length - 1)];
  return {
    retryable: true,
    nextRetryAt: new Date(now.getTime() + delayMs),
    lastRetryError: error.code,
    retryLockedAt: null,
    retryExhaustedAt: null,
  };
}

export function createIntegrationDispatchRuntimeService(deps: IntegrationDispatchServiceDeps = {}) {
  const eventCatalogService = deps.eventCatalogService ?? integrationEventCatalogServiceBridge;
  const templateService = deps.templateService ?? integrationDispatchTemplateServiceBridge;
  const logService = deps.logService ?? integrationDispatchLogService;
  const instanceLookup = deps.instanceLookup ?? (async (instanceId: string) => prisma.instance.findUnique({ where: { id: instanceId }, select: { id: true, status: true } }));
  const socketLookup = deps.socketLookup ?? ((instanceId: string) => InstanceManager.get(instanceId));
  const imageDownloader = deps.imageDownloader ?? downloadIntegrationImageAsset;

  async function executeDispatch(input: {
    dispatchLog: IntegrationDispatchLogRecord;
    instanceId: string;
    eventSlug: string;
    payload: Record<string, unknown>;
    attemptCount: number;
  }) {
    const context = eventCatalogService.normalizeEventContext(input.eventSlug, input.payload) as IntegrationNormalizedEventContext;

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
      const shouldUseTextLinkPath = shouldUseTextLinkDispatch(template);

      if (template.messageType === "image" && !shouldUseTextLinkPath) {
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

      const content = shouldUseTextLinkPath
        ? buildTextLinkPayload(template)
        : buildBaileysDispatchPayload(template, {
          imageBuffer: imageAsset?.buffer ?? null,
          imageMimeType: imageAsset?.mimeType ?? null,
        });

      try {
        let providerMessageId: string | null;
        let secondaryProviderMessageId: string | null = null;
        let secondaryDispatchFailureCode: IntegrationSecondaryDispatchFailureCode | null = null;
        const sentMessage = await sock.sendMessage(context.recipientJid, content);
        providerMessageId = extractProviderMessageId(sentMessage as WAMessage | null | undefined);

        const followupPayload = buildFollowupPayload(template);
        if (followupPayload) {
          try {
            const followupMessage = await sock.sendMessage(context.recipientJid, followupPayload);
            secondaryProviderMessageId = extractProviderMessageId(followupMessage as WAMessage | null | undefined);
          } catch {
            secondaryDispatchFailureCode = "send_failed";
          }
        }

        const finalLog = await logService.updateLog(input.dispatchLog.id, {
          recipientJid: context.recipientJid,
          messageType: resolveDispatchedMessageType(template, content),
          dispatchStatus: INTEGRATION_DISPATCH_STATUS.SENT,
          failureCode: null,
          providerMessageId,
          retryable: false,
          nextRetryAt: null,
          lastRetryError: null,
          retryLockedAt: null,
          retryExhaustedAt: null,
          payloadSummary: buildPayloadSummary(template, content, imageAsset, imageFallbackReason, secondaryProviderMessageId, secondaryDispatchFailureCode),
        });

        return {
          context,
          template,
          content,
          providerMessageId,
          secondaryProviderMessageId,
          dispatchLog: finalLog,
        };
      } catch {
        throw new IntegrationDispatchSendFailedError(context.eventSlug);
      }
    } catch (error) {
      if (error instanceof IntegrationDispatchRuntimeError) {
        error.dispatchLogId = input.dispatchLog.id;
        const retryState = resolveRetryState(error, input.attemptCount, new Date());
        await logService.updateLog(input.dispatchLog.id, {
          recipientJid: context.recipientJid,
          dispatchStatus: error.dispatchStatus,
          failureCode: error.code,
          retryable: retryState.retryable,
          retryAttemptCount: input.attemptCount,
          nextRetryAt: retryState.nextRetryAt,
          lastRetryError: retryState.lastRetryError,
          retryLockedAt: retryState.retryLockedAt,
          retryExhaustedAt: retryState.retryExhaustedAt,
        });
        throw error;
      }

      const runtimeError = new IntegrationDispatchRuntimeError(
        "Erro interno ao executar dispatch de integração.",
        500,
        "INTEGRATION_DISPATCH_RUNTIME_ERROR",
        INTEGRATION_DISPATCH_STATUS.ERROR,
      );
      const retryState = resolveRetryState(runtimeError, input.attemptCount, new Date());
      await logService.updateLog(input.dispatchLog.id, {
        recipientJid: context.recipientJid,
        dispatchStatus: INTEGRATION_DISPATCH_STATUS.ERROR,
        failureCode: runtimeError.code,
        retryable: retryState.retryable,
        retryAttemptCount: input.attemptCount,
        nextRetryAt: retryState.nextRetryAt,
        lastRetryError: retryState.lastRetryError,
        retryLockedAt: retryState.retryLockedAt,
        retryExhaustedAt: retryState.retryExhaustedAt,
      });
      throw error;
    }
  }

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
        retryAttemptCount: 1,
        payloadSummary: { eventSlug: input.eventSlug },
      });

      return executeDispatch({
        dispatchLog,
        instanceId: input.instanceId,
        eventSlug: input.eventSlug,
        payload: input.payload,
        attemptCount: 1,
      });
    },
    async retryDispatch(input: {
      dispatchLog: IntegrationDispatchLogRecord;
      payload: Record<string, unknown>;
    }) {
      if (!input.dispatchLog.instanceId || !input.dispatchLog.eventSlug) {
        throw new IntegrationDispatchRuntimeError(
          "Dispatch de integração sem instanceId/eventSlug para retry.",
          422,
          "INTEGRATION_DISPATCH_RETRY_CONTEXT_INVALID",
          INTEGRATION_DISPATCH_STATUS.ERROR,
        );
      }

      const attemptCount = input.dispatchLog.retryAttemptCount + 1;
      const pendingLog = await logService.updateLog(input.dispatchLog.id, {
        dispatchStatus: INTEGRATION_DISPATCH_STATUS.PENDING_RUNTIME,
        failureCode: null,
        providerMessageId: null,
        retryAttemptCount: attemptCount,
        nextRetryAt: null,
        retryLockedAt: new Date(),
      });

      return executeDispatch({
        dispatchLog: pendingLog,
        instanceId: input.dispatchLog.instanceId,
        eventSlug: input.dispatchLog.eventSlug,
        payload: input.payload,
        attemptCount,
      });
    },
  };
}

export const prismaIntegrationDispatchStore = createPrismaIntegrationDispatchStore(prisma);
export const integrationDispatchLogService = createIntegrationDispatchLogService(prismaIntegrationDispatchStore);
export const integrationDispatchRuntimeService = createIntegrationDispatchRuntimeService();
