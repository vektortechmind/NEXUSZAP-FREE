import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, preValidationHookHandler } from "fastify";
import { z } from "zod";
import { chatService } from "../services/chat.service";
import { streamToLimitedBuffer } from "../services/fileSecurity.service";
import {
  buildScheduledDispatchMediaUrl,
  inferScheduledDispatchMediaMimeType,
  readScheduledDispatchMedia,
  resolveScheduledDispatchMediaKind,
  writeScheduledDispatchMedia,
} from "../services/scheduled-dispatch.mediaStorage";
import {
  createScheduledDispatchService,
  scheduledDispatchService,
  ScheduledDispatchCampaignNotFoundError,
  ScheduledDispatchConflictError,
  ScheduledDispatchInstanceNotConnectedError,
  ScheduledDispatchInstanceNotFoundError,
  ScheduledDispatchNotFoundError,
  ScheduledDispatchValidationError,
  type ScheduledDispatchStore,
} from "../services/scheduled-dispatch.service";

type GroupSyncService = {
  syncGroups(input: { instanceId: string }): Promise<Array<{ instanceId: string; jid: string; name: string | null; lastMessageAt: Date }>>;
};

type ScheduledDispatchRoutesDeps = {
  service?: ReturnType<typeof createScheduledDispatchService>;
  store?: ScheduledDispatchStore;
  groupSyncService?: GroupSyncService;
  preValidationHook?: preValidationHookHandler;
};

const createDispatchBodySchema = z.object({
  instanceId: z.string().trim().min(1).max(191),
  targetType: z.enum(["number", "group"]),
  phone: z.string().trim().min(1).max(30).optional().nullable(),
  groupJid: z.string().trim().min(1).max(191).optional().nullable(),
  phones: z.array(z.string().trim().min(1).max(30)).min(1).max(500).optional().nullable(),
  groupJids: z.array(z.string().trim().min(1).max(191)).min(1).max(500).optional().nullable(),
  contentType: z.enum(["text", "image", "video"]),
  body: z.string().trim().max(4000).optional().nullable(),
  mediaUrl: z.string().trim().max(2048).optional().nullable(),
  buttons: z.array(
    z.object({
      text: z.string().trim().min(1).max(60),
      url: z.string().trim().min(1).max(2048),
    }).strict()
  ).max(3).optional().nullable(),
  deliveryMode: z.enum(["immediate", "scheduled"]),
  scheduledAt: z.string().datetime().optional().nullable(),
  numberDelaySeconds: z.coerce.number().int().min(0).max(86400).optional().nullable(),
  numberDelayMinSeconds: z.coerce.number().int().min(0).max(86400).optional().nullable(),
  numberDelayMaxSeconds: z.coerce.number().int().min(0).max(86400).optional().nullable(),
  groupDelaySeconds: z.coerce.number().int().min(0).max(86400).optional().nullable(),
  groupDelayMinSeconds: z.coerce.number().int().min(0).max(86400).optional().nullable(),
  groupDelayMaxSeconds: z.coerce.number().int().min(0).max(86400).optional().nullable(),
  pauseEveryCount: z.coerce.number().int().min(0).max(10000).optional().nullable(),
  pauseDurationSeconds: z.coerce.number().int().min(0).max(86400).optional().nullable(),
}).strict();

const listDispatchesQuerySchema = z.object({
  instanceId: z.string().trim().min(1).max(191).optional(),
});

const clearHistoryQuerySchema = z.object({
  instanceId: z.string().trim().min(1).max(191),
});

const listGroupsQuerySchema = z.object({
  instanceId: z.string().trim().min(1).max(191),
  search: z.string().trim().max(191).optional(),
});

const syncGroupsBodySchema = z.object({
  instanceId: z.string().trim().min(1).max(191),
});

const dispatchParamsSchema = z.object({
  id: z.string().trim().min(1).max(191),
});

const campaignParamsSchema = z.object({
  campaignId: z.string().trim().min(1).max(191),
});

const mediaParamsSchema = z.object({
  instanceId: z.string().trim().min(1).max(191),
  mediaId: z.string().trim().min(1).max(191),
  fileName: z.string().trim().min(1).max(191),
});

const uploadMediaFieldsSchema = z.object({
  instanceId: z.string().trim().min(1).max(191),
  contentType: z.enum(["image", "video"]),
});

function multipartFieldValue(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || !("value" in value)) return undefined;
  const fieldValue = (value as { value?: unknown }).value;
  return typeof fieldValue === "string" ? fieldValue : undefined;
}

function serializeDate<T extends Record<string, unknown>>(row: T): T {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value])
  ) as T;
}

function serializeGroupTarget(group: { instanceId: string; jid: string; name: string | null; lastMessageAt: Date; updatedAt?: Date }) {
  return serializeDate({
    instanceId: group.instanceId,
    jid: group.jid,
    name: group.name,
    lastMessageAt: group.lastMessageAt,
    updatedAt: group.updatedAt ?? group.lastMessageAt,
  });
}

function sendKnownError(reply: FastifyReply, err: unknown) {
  if (err instanceof z.ZodError) {
    return reply.status(400).send({ error: "Parametros invalidos.", code: "SCHEDULED_DISPATCH_CONTRACT_INVALID", details: err.issues });
  }
  if (err instanceof ScheduledDispatchValidationError) {
    return reply.status(err.statusCode).send({ error: err.message, code: err.code });
  }
  if (err instanceof ScheduledDispatchInstanceNotFoundError) {
    return reply.status(404).send({ error: err.message, code: err.code });
  }
  if (err instanceof ScheduledDispatchInstanceNotConnectedError) {
    return reply.status(err.statusCode).send({ error: err.message, code: err.code });
  }
  if (err instanceof ScheduledDispatchCampaignNotFoundError) {
    return reply.status(404).send({ error: err.message, code: err.code });
  }
  if (err instanceof ScheduledDispatchNotFoundError) {
    return reply.status(404).send({ error: err.message, code: err.code });
  }
  if (err instanceof ScheduledDispatchConflictError) {
    return reply.status(err.statusCode).send({ error: err.message, code: err.code });
  }
  throw err;
}

export function createScheduledDispatchRoutes(deps: ScheduledDispatchRoutesDeps = {}) {
  const service = deps.service ?? createScheduledDispatchService({ store: deps.store });
  const groupSyncService = deps.groupSyncService ?? chatService;
  const preValidationHook = deps.preValidationHook ?? (async (request, reply) => {
    const { verifyJwt } = await import("../security/middlewares");
    return verifyJwt(request, reply);
  });

  return async function scheduledDispatchRoutes(fastify: FastifyInstance) {
    fastify.addHook("preValidation", preValidationHook);

    fastify.get("/", async (request, reply) => {
      try {
        const query = listDispatchesQuerySchema.parse(request.query);
        const dispatches = await service.listDispatches(query);
        return reply.send({ dispatches: dispatches.map(serializeDate) });
      } catch (err) {
        return sendKnownError(reply, err);
      }
    });

    fastify.get("/groups", async (request, reply) => {
      try {
        const query = listGroupsQuerySchema.parse(request.query);
        const groups = await service.listGroupTargets(query);
        return reply.send({ groups: groups.map(serializeGroupTarget) });
      } catch (err) {
        return sendKnownError(reply, err);
      }
    });

    fastify.delete("/history", async (request, reply) => {
      try {
        const query = clearHistoryQuerySchema.parse(request.query);
        const deleted = await service.clearHistory(query.instanceId);
        return reply.send({ deleted });
      } catch (err) {
        return sendKnownError(reply, err);
      }
    });

    fastify.post("/groups/sync", async (request, reply) => {
      try {
        const body = syncGroupsBodySchema.parse(request.body);
        const groups = await groupSyncService.syncGroups(body);
        return reply.status(200).send({ synced: groups.length, groups: groups.map(serializeGroupTarget) });
      } catch (err) {
        return sendKnownError(reply, err);
      }
    });

    fastify.post("/campaigns/:campaignId/cancel", async (request, reply) => {
      try {
        const params = campaignParamsSchema.parse(request.params);
        const summary = await service.cancelCampaign({ campaignId: params.campaignId });
        return reply.send(summary);
      } catch (err) {
        return sendKnownError(reply, err);
      }
    });

    fastify.get("/:id", async (request, reply) => {
      try {
        const params = dispatchParamsSchema.parse(request.params);
        const dispatch = await service.getDispatch(params.id);
        return reply.send({ dispatch: serializeDate(dispatch) });
      } catch (err) {
        return sendKnownError(reply, err);
      }
    });

    fastify.post("/:id/cancel", async (request, reply) => {
      try {
        const params = dispatchParamsSchema.parse(request.params);
        const dispatch = await service.cancelDispatch(params.id);
        return reply.send({ dispatch: serializeDate(dispatch) });
      } catch (err) {
        return sendKnownError(reply, err);
      }
    });

    fastify.get("/media/:instanceId/:mediaId/:fileName", async (request, reply) => {
      try {
        const params = mediaParamsSchema.parse(request.params);
        const media = await readScheduledDispatchMedia(params);
        reply.header("Content-Type", media.mimeType);
        reply.header("Content-Disposition", "inline");
        reply.header("X-Content-Type-Options", "nosniff");
        reply.header("Cache-Control", "private, max-age=3600");
        return reply.send(media.buffer);
      } catch (err) {
        return sendKnownError(reply, err);
      }
    });

    fastify.post("/media", async (request, reply) => {
      try {
        const multipartRequest = request as typeof request & {
          isMultipart(): boolean;
          file(): Promise<{
            filename: string;
            mimetype: string;
            fields: Record<string, unknown>;
            file: NodeJS.ReadableStream;
          } | undefined>;
        };
        if (!multipartRequest.isMultipart()) {
          throw new ScheduledDispatchValidationError("Requisicao multipart/form-data obrigatoria.");
        }
        const uploaded = await multipartRequest.file();
        if (!uploaded) {
          throw new ScheduledDispatchValidationError("Arquivo obrigatorio.");
        }

        const fields = uploadMediaFieldsSchema.parse({
          instanceId: multipartFieldValue(uploaded.fields.instanceId),
          contentType: multipartFieldValue(uploaded.fields.contentType),
        });
        await service.assertInstance(fields.instanceId);

        const kind = resolveScheduledDispatchMediaKind(fields.contentType);
        const fileName = uploaded.filename?.trim() || `${kind === "VIDEO" ? "video" : "imagem"}.${kind === "VIDEO" ? "mp4" : "png"}`;
        const buffer = await streamToLimitedBuffer(uploaded.file, kind === "VIDEO" ? 50 * 1024 * 1024 : 10 * 1024 * 1024);
        const mimeType = inferScheduledDispatchMediaMimeType(fileName, uploaded.mimetype, kind) ?? uploaded.mimetype ?? "application/octet-stream";
        const mediaId = randomUUID();
        const persisted = await writeScheduledDispatchMedia({
          instanceId: fields.instanceId,
          mediaId,
          fileName,
          buffer,
          mimeType,
          kind,
        });

        return reply.status(201).send({
          mediaId,
          fileName,
          mimeType,
          mediaUrl: buildScheduledDispatchMediaUrl({ instanceId: fields.instanceId, mediaId, fileName }),
          storagePath: persisted.storagePath,
        });
      } catch (err) {
        return sendKnownError(reply, err);
      }
    });

    fastify.post("/", async (request, reply) => {
      try {
        const body = createDispatchBodySchema.parse(request.body);
        const dispatches = await service.createDispatches({
          instanceId: body.instanceId,
          targetType: body.targetType,
          phone: body.phone ?? null,
          groupJid: body.groupJid ?? null,
          phones: body.phones ?? null,
          groupJids: body.groupJids ?? null,
          contentType: body.contentType,
          body: body.body ?? null,
          mediaUrl: body.mediaUrl ?? null,
          buttons: body.buttons ?? null,
          deliveryMode: body.deliveryMode,
          scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
          numberDelaySeconds: body.numberDelaySeconds ?? null,
          numberDelayMinSeconds: body.numberDelayMinSeconds ?? null,
          numberDelayMaxSeconds: body.numberDelayMaxSeconds ?? null,
          groupDelaySeconds: body.groupDelaySeconds ?? null,
          groupDelayMinSeconds: body.groupDelayMinSeconds ?? null,
          groupDelayMaxSeconds: body.groupDelayMaxSeconds ?? null,
          pauseEveryCount: body.pauseEveryCount ?? null,
          pauseDurationSeconds: body.pauseDurationSeconds ?? null,
        });
        return reply.status(201).send({
          dispatch: dispatches[0] ? serializeDate(dispatches[0]) : null,
          dispatches: dispatches.map(serializeDate),
        });
      } catch (err) {
        return sendKnownError(reply, err);
      }
    });
  };
}

export const scheduledDispatchRoutes = createScheduledDispatchRoutes({ service: scheduledDispatchService });
