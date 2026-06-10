import type { FastifyInstance, FastifyReply, preValidationHookHandler } from "fastify";
import { z } from "zod";
import {
  chatService,
  ChatInstanceNotFoundError,
  ChatMediaNotFoundError,
  ChatValidationError,
  createChatService,
  type ChatStore,
  type ChatEventRecorder,
} from "../services/chat.service";
import { ChatInstanceOfflineError, ChatProviderSendError, type ChatBaileysAdapter } from "../services/chat.baileys";
import { ChatMediaStorageValidationError } from "../services/chat.mediaStorage";

type ChatRoutesDeps = {
  service?: ReturnType<typeof createChatService>;
  store?: ChatStore;
  baileys?: ChatBaileysAdapter;
  eventRecorder?: ChatEventRecorder;
  preValidationHook?: preValidationHookHandler;
};

const conversationsQuerySchema = z.object({
  instanceId: z.string().trim().min(1).max(191).optional(),
});

const messagesParamsSchema = z.object({
  jid: z.string().trim().min(1).max(191),
});

const mediaParamsSchema = z.object({
  instanceId: z.string().trim().min(1).max(191),
  providerMessageId: z.string().trim().min(1).max(191),
});

const messagesQuerySchema = z.object({
  instanceId: z.string().trim().min(1).max(191),
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const sendBodySchema = z.object({
  instanceId: z.string().trim().min(1).max(191),
  jid: z.string().trim().min(1).max(191),
  body: z.string().trim().min(1).max(4000),
  quotedMessageId: z.string().trim().min(1).max(191).optional().nullable(),
});

const sendMediaFieldsSchema = z.object({
  instanceId: z.string().trim().min(1).max(191),
  jid: z.string().trim().min(1).max(191),
  messageType: z.enum(["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"]),
  caption: z.string().trim().max(4000).optional().nullable(),
  quotedMessageId: z.string().trim().min(1).max(191).optional().nullable(),
});

const reactBodySchema = z.object({
  instanceId: z.string().trim().min(1).max(191),
  jid: z.string().trim().min(1).max(191),
  providerMessageId: z.string().trim().min(1).max(191),
  emoji: z.string().max(32),
});

const editBodySchema = z.object({
  instanceId: z.string().trim().min(1).max(191),
  jid: z.string().trim().min(1).max(191),
  providerMessageId: z.string().trim().min(1).max(191),
  body: z.string().trim().min(1).max(4000),
});

const deleteBodySchema = z.object({
  instanceId: z.string().trim().min(1).max(191),
  jid: z.string().trim().min(1).max(191),
  providerMessageId: z.string().trim().min(1).max(191),
  mode: z.enum(["for_everyone"]),
});

const clearConversationBodySchema = z.object({
  instanceId: z.string().trim().min(1).max(191),
});

function serializeDate<T extends Record<string, unknown>>(row: T): T {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value])
  ) as T;
}

type SerializableConversation = Awaited<ReturnType<typeof chatService.listConversations>>[number]
  | NonNullable<Awaited<ReturnType<typeof chatService.markConversationRead>>>;

function serializeConversation(conversation: SerializableConversation) {
  return {
    ...serializeDate(conversation),
    lastMessage: conversation.lastMessage ? serializeDate(conversation.lastMessage) : null,
  };
}

function serializeMessage(message: Awaited<ReturnType<typeof chatService.listMessages>>[number]) {
  return serializeDate(message);
}

function sendKnownError(reply: FastifyReply, err: unknown) {
  if (err instanceof z.ZodError) {
    return reply.status(400).send({ error: "Parametros invalidos.", code: "CHAT_CONTRACT_INVALID", details: err.issues });
  }
  if (err instanceof ChatValidationError) {
    return reply.status(err.statusCode).send({ error: err.message, code: err.code });
  }
  if (err instanceof ChatInstanceNotFoundError) {
    return reply.status(404).send({ error: err.message, code: err.code });
  }
  if (err instanceof ChatMediaNotFoundError) {
    return reply.status(404).send({ error: err.message, code: err.code });
  }
  if (err instanceof ChatMediaStorageValidationError) {
    return reply.status(err.statusCode).send({ error: err.message, code: err.code });
  }
  if (err instanceof ChatInstanceOfflineError) {
    return reply.status(503).send({ error: err.message, code: err.code });
  }
  if (err instanceof ChatProviderSendError) {
    return reply.status(502).send({ error: err.message, code: err.code });
  }
  throw err;
}

function multipartFieldValue(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || !("value" in value)) return undefined;
  const fieldValue = (value as { value?: unknown }).value;
  return typeof fieldValue === "string" ? fieldValue : undefined;
}

function normalizeUploadMimeType(filename: string, mimeType: string, messageType: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT") {
  const lowerMime = mimeType.toLowerCase();
  if (lowerMime && lowerMime !== "application/octet-stream") return mimeType;
  const lowerName = filename.toLowerCase();
  if (messageType === "IMAGE") {
    if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
    if (lowerName.endsWith(".png")) return "image/png";
    if (lowerName.endsWith(".webp")) return "image/webp";
    if (lowerName.endsWith(".gif")) return "image/gif";
    if (lowerName.endsWith(".heic")) return "image/heic";
    if (lowerName.endsWith(".heif")) return "image/heif";
  }
  if (messageType === "VIDEO") {
    if (lowerName.endsWith(".mp4") || lowerName.endsWith(".m4v")) return "video/mp4";
    if (lowerName.endsWith(".mov")) return "video/quicktime";
    if (lowerName.endsWith(".webm")) return "video/webm";
    if (lowerName.endsWith(".3gp")) return "video/3gpp";
  }
  if (messageType === "AUDIO") {
    if (lowerName.endsWith(".ogg") || lowerName.endsWith(".opus")) return "audio/ogg";
    if (lowerName.endsWith(".webm")) return "audio/webm";
    if (lowerName.endsWith(".wav")) return "audio/wav";
    if (lowerName.endsWith(".mp3")) return "audio/mpeg";
    if (lowerName.endsWith(".m4a")) return "audio/mp4";
  }
  if (messageType === "DOCUMENT") {
    if (lowerName.endsWith(".pdf")) return "application/pdf";
    if (lowerName.endsWith(".txt")) return "text/plain";
    if (lowerName.endsWith(".doc")) return "application/msword";
    if (lowerName.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return mimeType;
}

export function createChatRoutes(deps: ChatRoutesDeps = {}) {
  const service = deps.service ?? createChatService({ store: deps.store, baileys: deps.baileys, eventRecorder: deps.eventRecorder });
  const preValidationHook = deps.preValidationHook ?? (async (request, reply) => {
    const { verifyJwt } = await import("../security/middlewares");
    return verifyJwt(request, reply);
  });

  return async function chatRoutes(fastify: FastifyInstance) {
    fastify.addHook("preValidation", preValidationHook);

    fastify.get("/conversations", async (request, reply) => {
      try {
        const query = conversationsQuerySchema.parse(request.query);
        const conversations = await service.listConversations(query);
        return reply.send({ conversations: conversations.map(serializeConversation) });
      } catch (err) {
        return sendKnownError(reply, err);
      }
    });

    fastify.get("/conversations/:jid/messages", async (request, reply) => {
      try {
        const params = messagesParamsSchema.parse(request.params);
        const query = messagesQuerySchema.parse(request.query);
        const messages = await service.listMessages({
          instanceId: query.instanceId,
          jid: params.jid,
          cursor: query.cursor ? new Date(query.cursor) : undefined,
          limit: query.limit,
        });
        const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
        return reply.send({ messages: messages.map(serializeMessage), nextCursor: lastMessage?.createdAt.toISOString() ?? null });
      } catch (err) {
        return sendKnownError(reply, err);
      }
    });

    fastify.get("/media/:instanceId/:providerMessageId", async (request, reply) => {
      try {
        const params = mediaParamsSchema.parse(request.params);
        const media = await service.getMessageMedia(params);
        reply.header("Content-Type", media.mimeType);
        reply.header("Content-Disposition", "inline");
        reply.header("X-Content-Type-Options", "nosniff");
        reply.header("Cache-Control", "private, max-age=3600");
        return reply.send(media.buffer);
      } catch (err) {
        return sendKnownError(reply, err);
      }
    });

    fastify.post("/send", async (request, reply) => {
      try {
        const body = sendBodySchema.parse(request.body);
        const message = await service.sendTextMessage(body);
        return reply.status(201).send({ message: serializeMessage(message) });
      } catch (err) {
        return sendKnownError(reply, err);
      }
    });

    fastify.post("/send/media", async (request, reply) => {
      try {
        const multipartRequest = request as typeof request & {
          isMultipart(): boolean;
          file(): Promise<{
            filename: string;
            mimetype: string;
            fields: Record<string, unknown>;
            toBuffer(): Promise<Buffer>;
          } | undefined>;
        };
        if (!multipartRequest.isMultipart()) {
          throw new ChatValidationError("Requisicao multipart/form-data obrigatoria.");
        }
        const uploaded = await multipartRequest.file();
        if (!uploaded) throw new ChatValidationError("Arquivo obrigatorio.");

        const fields = sendMediaFieldsSchema.parse({
          instanceId: multipartFieldValue(uploaded.fields.instanceId),
          jid: multipartFieldValue(uploaded.fields.jid),
          messageType: multipartFieldValue(uploaded.fields.messageType),
          caption: multipartFieldValue(uploaded.fields.caption) ?? null,
          quotedMessageId: multipartFieldValue(uploaded.fields.quotedMessageId) ?? null,
        });
        const message = await service.sendMediaMessage({
          ...fields,
          buffer: await uploaded.toBuffer(),
          mimeType: normalizeUploadMimeType(uploaded.filename, uploaded.mimetype, fields.messageType),
          fileName: uploaded.filename,
        });
        return reply.status(201).send({ message: serializeMessage(message) });
      } catch (err) {
        return sendKnownError(reply, err);
      }
    });

    fastify.post("/edit", async (request, reply) => {
      try {
        const body = editBodySchema.parse(request.body);
        const message = await service.editMessage(body);
        return reply.status(200).send({ message: serializeMessage(message) });
      } catch (err) {
        return sendKnownError(reply, err);
      }
    });

    fastify.post("/delete", async (request, reply) => {
      try {
        const body = deleteBodySchema.parse(request.body);
        const message = await service.deleteMessage(body);
        return reply.status(200).send({ success: true, message: message ? serializeMessage(message) : null });
      } catch (err) {
        return sendKnownError(reply, err);
      }
    });

    fastify.post("/react", async (request, reply) => {
      try {
        const body = reactBodySchema.parse(request.body);
        const message = await service.sendReaction(body);
        return reply.status(200).send({ success: true, message: message ? serializeMessage(message) : null });
      } catch (err) {
        return sendKnownError(reply, err);
      }
    });

    fastify.post("/conversations/:jid/clear", async (request, reply) => {
      try {
        const params = messagesParamsSchema.parse(request.params);
        const body = clearConversationBodySchema.parse(request.body);
        const result = await service.clearConversation({ ...body, jid: params.jid });
        return reply.status(200).send({ success: true, ...result });
      } catch (err) {
        return sendKnownError(reply, err);
      }
    });

    fastify.post("/conversations/:jid/read", async (request, reply) => {
      try {
        const params = messagesParamsSchema.parse(request.params);
        const body = z.object({ instanceId: z.string().trim().min(1).max(191) }).parse(request.body);
        const conversation = await service.markConversationRead({ ...body, jid: params.jid });
        return reply.status(200).send({ success: true, conversation: conversation ? serializeConversation(conversation) : null });
      } catch (err) {
        return sendKnownError(reply, err);
      }
    });
  };
}

export const chatRoutes = createChatRoutes({ service: chatService });
