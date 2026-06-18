import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, preValidationHookHandler } from "fastify";
import { z } from "zod";
import { streamToLimitedBuffer } from "../services/fileSecurity.service";
import {
  buildScheduledDispatchTemplateMediaUrl,
  inferScheduledDispatchTemplateMediaMimeType,
  readScheduledDispatchTemplateMedia,
  resolveScheduledDispatchTemplateMediaKind,
  writeScheduledDispatchTemplateMedia,
} from "../services/scheduled-dispatch-template.mediaStorage";
import {
  createScheduledDispatchTemplateService,
  scheduledDispatchTemplateService,
  ScheduledDispatchTemplateNotFoundError,
  ScheduledDispatchTemplateValidationError,
  type ScheduledDispatchTemplateStore,
} from "../services/scheduled-dispatch-template.service";

type ScheduledDispatchTemplateRoutesDeps = {
  service?: ReturnType<typeof createScheduledDispatchTemplateService>;
  store?: ScheduledDispatchTemplateStore;
  preValidationHook?: preValidationHookHandler;
};

const templateBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  contentType: z.enum(["text", "image", "video"]),
  body: z.string().trim().max(4000).optional().nullable(),
  mediaUrl: z.string().trim().max(2048).optional().nullable(),
  mediaFileName: z.string().trim().max(191).optional().nullable(),
  buttons: z.array(
    z.object({
      text: z.string().trim().min(1).max(60),
      url: z.string().trim().min(1).max(2048),
    }).strict()
  ).max(3).optional().nullable(),
}).strict();

const templateParamsSchema = z.object({
  id: z.string().trim().min(1).max(191),
});

const mediaParamsSchema = z.object({
  mediaId: z.string().trim().min(1).max(191),
  fileName: z.string().trim().min(1).max(191),
});

const uploadMediaFieldsSchema = z.object({
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

function sendKnownError(reply: FastifyReply, err: unknown) {
  if (err instanceof z.ZodError) {
    return reply.status(400).send({ error: "Parametros invalidos.", code: "SCHEDULED_DISPATCH_TEMPLATE_CONTRACT_INVALID", details: err.issues });
  }
  if (err instanceof ScheduledDispatchTemplateValidationError) {
    return reply.status(err.statusCode).send({ error: err.message, code: err.code });
  }
  if (err instanceof ScheduledDispatchTemplateNotFoundError) {
    return reply.status(404).send({ error: err.message, code: err.code });
  }
  throw err;
}

export function createScheduledDispatchTemplateRoutes(deps: ScheduledDispatchTemplateRoutesDeps = {}) {
  const service = deps.service ?? createScheduledDispatchTemplateService({ store: deps.store });
  const preValidationHook = deps.preValidationHook ?? (async (request, reply) => {
    const { verifyJwt } = await import("../security/middlewares");
    return verifyJwt(request, reply);
  });

  return async function scheduledDispatchTemplateRoutes(fastify: FastifyInstance) {
    fastify.addHook("preValidation", preValidationHook);

    fastify.get("/", async (_request, reply) => {
      try {
        const templates = await service.listTemplates();
        return reply.send({ templates: templates.map(serializeDate) });
      } catch (err) {
        return sendKnownError(reply, err);
      }
    });

    fastify.post("/", async (request, reply) => {
      try {
        const body = templateBodySchema.parse(request.body);
        const template = await service.createTemplate(body);
        return reply.status(201).send({ template: serializeDate(template) });
      } catch (err) {
        return sendKnownError(reply, err);
      }
    });

    fastify.get("/:id", async (request, reply) => {
      try {
        const params = templateParamsSchema.parse(request.params);
        const template = await service.getTemplate(params.id);
        return reply.send({ template: serializeDate(template) });
      } catch (err) {
        return sendKnownError(reply, err);
      }
    });

    fastify.patch("/:id", async (request, reply) => {
      try {
        const params = templateParamsSchema.parse(request.params);
        const body = templateBodySchema.parse(request.body);
        const template = await service.updateTemplate(params.id, body);
        return reply.send({ template: serializeDate(template) });
      } catch (err) {
        return sendKnownError(reply, err);
      }
    });

    fastify.delete("/:id", async (request, reply) => {
      try {
        const params = templateParamsSchema.parse(request.params);
        const result = await service.deleteTemplate(params.id);
        return reply.send(result);
      } catch (err) {
        return sendKnownError(reply, err);
      }
    });

    fastify.get("/media/:mediaId/:fileName", async (request, reply) => {
      try {
        const params = mediaParamsSchema.parse(request.params);
        const media = await readScheduledDispatchTemplateMedia(params);
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
          throw new ScheduledDispatchTemplateValidationError("Requisicao multipart/form-data obrigatoria.");
        }
        const uploaded = await multipartRequest.file();
        if (!uploaded) {
          throw new ScheduledDispatchTemplateValidationError("Arquivo obrigatorio.");
        }

        const fields = uploadMediaFieldsSchema.parse({
          contentType: multipartFieldValue(uploaded.fields.contentType),
        });
        const kind = resolveScheduledDispatchTemplateMediaKind(fields.contentType);
        const fileName = uploaded.filename?.trim() || `${kind === "VIDEO" ? "video" : "imagem"}.${kind === "VIDEO" ? "mp4" : "png"}`;
        const buffer = await streamToLimitedBuffer(uploaded.file, kind === "VIDEO" ? 50 * 1024 * 1024 : 10 * 1024 * 1024);
        const mimeType = inferScheduledDispatchTemplateMediaMimeType(fileName, uploaded.mimetype, kind) ?? uploaded.mimetype ?? "application/octet-stream";
        const mediaId = randomUUID();
        const persisted = await writeScheduledDispatchTemplateMedia({
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
          mediaUrl: buildScheduledDispatchTemplateMediaUrl({ mediaId, fileName }),
          storagePath: persisted.storagePath,
        });
      } catch (err) {
        return sendKnownError(reply, err);
      }
    });
  };
}

export const scheduledDispatchTemplateRoutes = createScheduledDispatchTemplateRoutes({ service: scheduledDispatchTemplateService });
