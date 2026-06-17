import type { FastifyInstance, FastifyReply, preValidationHookHandler } from "fastify";
import { z } from "zod";
import { chatService } from "../services/chat.service";
import {
  createScheduledDispatchService,
  scheduledDispatchService,
  ScheduledDispatchConflictError,
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
}).strict();

const listDispatchesQuerySchema = z.object({
  instanceId: z.string().trim().min(1).max(191).optional(),
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

    fastify.post("/groups/sync", async (request, reply) => {
      try {
        const body = syncGroupsBodySchema.parse(request.body);
        const groups = await groupSyncService.syncGroups(body);
        return reply.status(200).send({ synced: groups.length, groups: groups.map(serializeGroupTarget) });
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

    fastify.post("/", async (request, reply) => {
      try {
        const body = createDispatchBodySchema.parse(request.body);
        const dispatch = await service.createDispatch({
          instanceId: body.instanceId,
          targetType: body.targetType,
          phone: body.phone ?? null,
          groupJid: body.groupJid ?? null,
          contentType: body.contentType,
          body: body.body ?? null,
          mediaUrl: body.mediaUrl ?? null,
          buttons: body.buttons ?? null,
          deliveryMode: body.deliveryMode,
          scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        });
        return reply.status(201).send({ dispatch: serializeDate(dispatch) });
      } catch (err) {
        return sendKnownError(reply, err);
      }
    });
  };
}

export const scheduledDispatchRoutes = createScheduledDispatchRoutes({ service: scheduledDispatchService });
