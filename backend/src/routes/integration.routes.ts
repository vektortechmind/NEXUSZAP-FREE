import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  DuplicateIntegrationRequestError,
  InactiveIntegrationCredentialError,
  IntegrationInstanceMismatchError,
  IntegrationReplayWindowError,
  InvalidIntegrationTokenError,
  type AuthorizedIntegrationRequest,
  type IntegrationCredentialRecord,
  integrationAuthService,
} from "../services/integrations/integrationAuth.service";
import {
  INTEGRATION_INGRESS_STATUS,
  integrationIngressService,
  parseOptionalDate,
} from "../services/integrations/integrationIngress.service";
import {
  UnsupportedIntegrationEventError,
  integrationEventCatalogService,
} from "../services/integrations/integrationEventCatalog.service";
import {
  IntegrationDispatchRuntimeError,
  isRetryableIntegrationDispatchError,
  integrationDispatchRuntimeService,
} from "../services/integrations/integrationDispatchRuntime.service";
import { redactSensitiveText, safeLogError } from "../utils/redaction";

const integrationHeadersSchema = {
  type: "object",
  required: ["authorization"],
  properties: {
    authorization: {
      type: "string",
      pattern: "^Bearer\\s+.+$",
    },
    "content-type": {
      type: "string",
    },
  },
} as const;

const integrationBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["event", "payload", "instanceId", "timestamp", "dedupKey"],
  properties: {
    event: {
      type: "string",
      minLength: 1,
      maxLength: 120,
    },
    payload: {
      type: "object",
      additionalProperties: true,
    },
    instanceId: {
      type: "string",
      minLength: 1,
      maxLength: 191,
    },
    timestamp: {
      type: "string",
      format: "date-time",
    },
    dedupKey: {
      type: "string",
      minLength: 1,
      maxLength: 180,
    },
  },
} as const;

type IntegrationEventHeaders = {
  authorization: string;
  "content-type"?: string;
};

type IntegrationEventBody = {
  event: string;
  payload: Record<string, unknown>;
  instanceId: string;
  timestamp: string;
  dedupKey: string;
};

type IntegrationRouteDeps = {
  authService?: Pick<typeof integrationAuthService, "authorizeRequest">;
  ingressService?: Pick<typeof integrationIngressService, "persistLog" | "updateLog">;
  eventCatalogService?: Pick<typeof integrationEventCatalogService, "normalizeEventContext">;
  dispatchRuntimeService?: Pick<typeof integrationDispatchRuntimeService, "dispatchEvent">;
};

function extractBearerToken(headerValue: string): string {
  return headerValue.replace(/^Bearer\s+/i, "").trim();
}

function sendError(reply: FastifyReply, statusCode: number, code: string, message: string) {
  return reply.status(statusCode).send({
    success: false,
    error: {
      code,
      message,
    },
  });
}

function requestSummary(request: FastifyRequest) {
  const body = request.body as Partial<IntegrationEventBody> | undefined;
  return {
    authorization: redactSensitiveText(String(request.headers.authorization ?? ""), 120),
    event: typeof body?.event === "string" ? body.event : null,
    instanceId: typeof body?.instanceId === "string" ? body.instanceId : null,
    dedupKey: typeof body?.dedupKey === "string" ? body.dedupKey : null,
  };
}

function authFailureMessage(error: Error): { statusCode: number; code: string; message: string } {
  if (error instanceof UnsupportedIntegrationEventError) {
    return { statusCode: error.statusCode, code: error.code, message: error.message };
  }
  if (error instanceof InvalidIntegrationTokenError) {
    return { statusCode: 401, code: error.code, message: error.message };
  }
  if (error instanceof InactiveIntegrationCredentialError || error instanceof IntegrationInstanceMismatchError) {
    return { statusCode: 403, code: error.code, message: error.message };
  }
  if (error instanceof IntegrationReplayWindowError) {
    return { statusCode: 409, code: error.code, message: error.message };
  }
  if (error instanceof DuplicateIntegrationRequestError) {
    return { statusCode: 409, code: error.code, message: error.message };
  }
  if (error instanceof IntegrationDispatchRuntimeError) {
    return { statusCode: error.statusCode, code: error.code, message: error.message };
  }
  return { statusCode: 500, code: "INTEGRATION_INGRESS_INTERNAL_ERROR", message: "Erro interno ao processar ingresso do evento." };
}

export function createIntegrationRoutes(deps: IntegrationRouteDeps = {}) {
  const authService = deps.authService ?? integrationAuthService;
  const ingressService = deps.ingressService ?? integrationIngressService;
  const eventCatalogService = deps.eventCatalogService ?? integrationEventCatalogService;
  const dispatchRuntimeService = deps.dispatchRuntimeService ?? integrationDispatchRuntimeService;

  return async function integrationRoutes(fastify: FastifyInstance) {
    fastify.post<{ Headers: IntegrationEventHeaders; Body: IntegrationEventBody }>("/events", {
      config: {
        rateLimit: {
          max: 120,
          timeWindow: "1 minute",
        },
      },
      schema: {
        headers: integrationHeadersSchema,
        body: integrationBodySchema,
      },
      attachValidation: true,
    }, async (request, reply) => {
      fastify.log.info({ ingress: requestSummary(request) }, "integration ingress request received");

      if (request.validationError) {
        const body = (request.body ?? {}) as Partial<IntegrationEventBody>;
        await ingressService.persistLog({
          instanceId: typeof body.instanceId === "string" ? body.instanceId : null,
          eventSlug: typeof body.event === "string" ? body.event : null,
          dedupKey: typeof body.dedupKey === "string" ? body.dedupKey : null,
          requestTimestamp: parseOptionalDate(body.timestamp),
          status: INTEGRATION_INGRESS_STATUS.REJECTED_CONTRACT,
          failureCode: "INTEGRATION_CONTRACT_INVALID",
          payload: body.payload,
        });

        return sendError(reply, 400, "INTEGRATION_CONTRACT_INVALID", "Payload ou headers inválidos para o contrato de integração.");
      }

      const body = request.body;
      const token = extractBearerToken(request.headers.authorization);

      let authorization: AuthorizedIntegrationRequest | null = null;
      try {
        authorization = await authService.authorizeRequest({
          token,
          instanceId: body.instanceId,
          timestamp: body.timestamp,
          dedupKey: body.dedupKey,
          now: new Date(),
        });
      } catch (error) {
        const mapped = authFailureMessage(error as Error);
        const status = error instanceof IntegrationReplayWindowError
          ? INTEGRATION_INGRESS_STATUS.REJECTED_REPLAY
          : error instanceof DuplicateIntegrationRequestError
            ? INTEGRATION_INGRESS_STATUS.REJECTED_DUPLICATE
            : error instanceof InvalidIntegrationTokenError || error instanceof InactiveIntegrationCredentialError || error instanceof IntegrationInstanceMismatchError
              ? INTEGRATION_INGRESS_STATUS.REJECTED_AUTH
              : INTEGRATION_INGRESS_STATUS.ERROR;

        await ingressService.persistLog({
          instanceId: body.instanceId,
          eventSlug: body.event,
          dedupKey: body.dedupKey,
          requestTimestamp: parseOptionalDate(body.timestamp),
          status,
          failureCode: mapped.code,
          payload: status === INTEGRATION_INGRESS_STATUS.REJECTED_AUTH ? undefined : body.payload,
        });

        fastify.log.warn({ ingress: requestSummary(request), err: safeLogError(error) }, "integration ingress request rejected");
        return sendError(reply, mapped.statusCode, mapped.code, mapped.message);
      }

      try {
        eventCatalogService.normalizeEventContext(body.event, body.payload);
      } catch (error) {
        const mapped = authFailureMessage(error as Error);
        await ingressService.persistLog({
          credentialId: authorization.credential.id,
          instanceId: body.instanceId,
          eventSlug: body.event,
          dedupKey: body.dedupKey,
          requestTimestamp: authorization.requestTimestamp,
          status: INTEGRATION_INGRESS_STATUS.REJECTED_CONTRACT,
          failureCode: mapped.code,
          payload: body.payload,
        });

        fastify.log.warn({ ingress: requestSummary(request), credentialId: authorization.credential.id, err: safeLogError(error) }, "integration ingress event rejected by catalog");
        return sendError(reply, mapped.statusCode, mapped.code, mapped.message);
      }

      const ingressLog = await ingressService.persistLog({
        credentialId: authorization.credential.id,
        instanceId: body.instanceId,
        eventSlug: body.event,
        dedupKey: body.dedupKey,
        requestTimestamp: authorization.requestTimestamp,
        status: INTEGRATION_INGRESS_STATUS.ACCEPTED,
        failureCode: null,
        payload: body.payload,
      });

      try {
        const dispatchResult = await dispatchRuntimeService.dispatchEvent({
          ingressLogId: ingressLog.id,
          credentialId: authorization.credential.id,
          instanceId: body.instanceId,
          eventSlug: body.event,
          dedupKey: body.dedupKey,
          payload: body.payload,
        });

        fastify.log.info({ ingressId: ingressLog.id, ingress: requestSummary(request), credentialId: authorization.credential.id }, "integration ingress request accepted");
        return reply.status(202).send({
          success: true,
          data: {
            ingressId: ingressLog.id,
            dispatchId: dispatchResult.dispatchLog.id,
            providerMessageId: dispatchResult.providerMessageId,
            status: "accepted",
            instanceId: body.instanceId,
            event: body.event,
          },
        });
      } catch (error) {
        const mapped = authFailureMessage(error as Error);
        if (isRetryableIntegrationDispatchError(error)) {
          fastify.log.warn({ ingress: requestSummary(request), err: safeLogError(error) }, "integration dispatch queued for retry after temporary failure");
          return reply.status(202).send({
            success: true,
            data: {
              ingressId: ingressLog.id,
              dispatchId: error.dispatchLogId,
              providerMessageId: null,
              status: "accepted",
              dispatchStatus: error.dispatchStatus,
              retryQueued: true,
              instanceId: body.instanceId,
              event: body.event,
            },
          });
        }

        await ingressService.updateLog(ingressLog.id, {
          status: INTEGRATION_INGRESS_STATUS.ERROR,
          failureCode: mapped.code,
          processedAt: new Date(),
        });

        fastify.log.error({ ingress: requestSummary(request), err: safeLogError(error) }, "integration ingress request failed");
        return sendError(reply, mapped.statusCode, mapped.code, mapped.message);
      }
    });
  };
}

export const integrationRoutes = createIntegrationRoutes();
