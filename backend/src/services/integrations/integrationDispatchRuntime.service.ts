import type { AnyMessageContent, WASocket, WAMessage } from "@whiskeysockets/baileys";
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

export function buildBaileysDispatchPayload(template: IntegrationRenderedDispatchTemplate): AnyMessageContent {
  if (template.messageType === "text") {
    return { text: template.body };
  }

  if (template.messageType === "link") {
    return { text: buildLinkBody(template) };
  }

  return {
    document: { url: template.documentUrl! },
    mimetype: template.mimeType!,
    fileName: template.fileName ?? undefined,
    caption: template.caption ?? undefined,
  };
}

function buildPayloadSummary(template: IntegrationRenderedDispatchTemplate) {
  return {
    eventSlug: template.eventSlug,
    messageType: template.messageType,
    title: template.title,
    linkUrl: template.linkUrl,
    documentUrl: template.documentUrl,
    fileName: template.fileName,
    hasCaption: Boolean(template.caption),
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

export function createIntegrationDispatchRuntimeService(deps: IntegrationDispatchServiceDeps = {}) {
  const eventCatalogService = deps.eventCatalogService ?? integrationEventCatalogServiceBridge;
  const templateService = deps.templateService ?? integrationDispatchTemplateServiceBridge;
  const logService = deps.logService ?? integrationDispatchLogService;
  const instanceLookup = deps.instanceLookup ?? (async (instanceId: string) => prisma.instance.findUnique({ where: { id: instanceId }, select: { id: true, status: true } }));
  const socketLookup = deps.socketLookup ?? ((instanceId: string) => InstanceManager.get(instanceId));

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

        const content = buildBaileysDispatchPayload(template);

        try {
          const sentMessage = await sock.sendMessage(context.recipientJid, content);
          const providerMessageId = extractProviderMessageId(sentMessage as WAMessage | null | undefined);
          const finalLog = await logService.updateLog(dispatchLog.id, {
            recipientJid: context.recipientJid,
            messageType: template.messageType,
            dispatchStatus: INTEGRATION_DISPATCH_STATUS.SENT,
            failureCode: null,
            providerMessageId,
            payloadSummary: buildPayloadSummary(template),
          });

          return {
            context,
            template,
            content,
            providerMessageId,
            dispatchLog: finalLog,
          };
        } catch (error) {
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
