import { FastifyInstance } from "fastify";
import { prisma } from "../database/prisma";
import { verifyJwt } from "../security/middlewares";
import { extractTextFromBuffer } from "../services/fileExtractor";
import {
  assertStorageQuota,
  buildSafeDownloadHeaders,
  FileSecurityError,
  logExtractionFailure,
  MAX_UPLOAD_BYTES,
  streamToLimitedBuffer,
  validateAndNormalizeUpload,
} from "../services/fileSecurity.service";
import {
  getKnowledgeOwnerByAgent,
  listKnowledgeFilesByAgent,
  listKnowledgeFilesByInstance,
} from "../services/knowledge/knowledge.service";

async function extractKnowledgeText(
  fastify: FastifyInstance,
  buffer: Buffer,
  mimetype: string
) {
  try {
    return await extractTextFromBuffer(buffer, mimetype);
  } catch (e) {
    logExtractionFailure(fastify.log, e, { channel: "TELEGRAM", mimetype });
    throw new FileSecurityError("Arquivo corrompido ou inextraível OWASP.", "FILE_EXTRACTION_FAILED");
  }
}

export async function telegramFilesRoutes(fastify: FastifyInstance) {
  fastify.addHook("preValidation", verifyJwt);

  fastify.get("/download/:fileId", async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file || file.channel !== "TELEGRAM") {
      return reply.status(404).send({ error: "Arquivo não encontrado." });
    }

    const headers = buildSafeDownloadHeaders(file.filename, file.mimetype);
    for (const [key, value] of Object.entries(headers)) reply.header(key, value);
    return reply.send(file.data);
  });

  fastify.get("/agent/:agentId", async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const files = await listKnowledgeFilesByAgent(agentId, "TELEGRAM");
    if (!files) {
      return reply.status(404).send({ error: "Agente não encontrado." });
    }
    return reply.send(files);
  });

  fastify.get("/:instanceId", async (request, reply) => {
    const { instanceId } = request.params as { instanceId: string };
    const files = await listKnowledgeFilesByInstance(instanceId, "TELEGRAM");
    if (!files) {
      return reply.status(404).send({ error: "Instância não encontrada." });
    }
    return reply.send(files);
  });

  fastify.post(
    "/agent/:agentId/upload",
    {
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const { agentId } = request.params as { agentId: string };
      const owner = await getKnowledgeOwnerByAgent(agentId);
      if (!owner) {
        return reply.status(404).send({ error: "Agente não encontrado." });
      }

      const parts = request.parts();
      let savedFile = null;

      for await (const part of parts) {
        if (part.type !== "file") continue;

        try {
          const buffer = await streamToLimitedBuffer(part.file, MAX_UPLOAD_BYTES);
          const normalized = validateAndNormalizeUpload({
            filename: part.filename,
            incomingMime: part.mimetype,
            buffer,
          });

          const existingFiles = (await listKnowledgeFilesByAgent(agentId, "TELEGRAM")) ?? [];
          await assertStorageQuota({ existingFiles, nextBytes: buffer.length });

          let extractedText: string | null = null;
          if (normalized.canExtract) {
            extractedText = await extractKnowledgeText(fastify, buffer, normalized.mimetype);
          }

          savedFile = await prisma.file.create({
            data: {
              instanceId: owner.instanceId,
              agentId: owner.id,
              filename: normalized.filename,
              mimetype: normalized.mimetype,
              data: buffer,
              extracted: extractedText,
              channel: "TELEGRAM",
            },
          });
        } catch (e) {
          if (e instanceof FileSecurityError) {
            return reply.status(400).send({ error: e.message });
          }
          throw e;
        }
      }

      if (!savedFile) {
        return reply.status(400).send({ error: "Nenhum arquivo de upload válido recebido no form-data." });
      }

      return reply.send(savedFile);
    }
  );

  fastify.post(
    "/:instanceId/upload",
    {
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const { instanceId } = request.params as { instanceId: string };
      const instance = await prisma.instance.findUnique({
        where: { id: instanceId },
        select: {
          id: true,
          agent: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!instance) {
        return reply.status(404).send({ error: "Instância Telegram não encontrada." });
      }

      if (!instance.agent) {
        return reply.status(409).send({ error: "Vincule ou crie um agente para a instância Telegram antes de enviar arquivos." });
      }

      const parts = request.parts();
      let savedFile = null;

      for await (const part of parts) {
        if (part.type !== "file") continue;

        try {
          const buffer = await streamToLimitedBuffer(part.file, MAX_UPLOAD_BYTES);
          const normalized = validateAndNormalizeUpload({
            filename: part.filename,
            incomingMime: part.mimetype,
            buffer,
          });

          const existingFiles = (await listKnowledgeFilesByAgent(instance.agent.id, "TELEGRAM")) ?? [];
          await assertStorageQuota({ existingFiles, nextBytes: buffer.length });

          let extractedText: string | null = null;
          if (normalized.canExtract) {
            extractedText = await extractKnowledgeText(fastify, buffer, normalized.mimetype);
          }

          savedFile = await prisma.file.create({
            data: {
              instanceId: instance.id,
              agentId: instance.agent.id,
              filename: normalized.filename,
              mimetype: normalized.mimetype,
              data: buffer,
              extracted: extractedText,
              channel: "TELEGRAM",
            },
          });
        } catch (e) {
          if (e instanceof FileSecurityError) {
            return reply.status(400).send({ error: e.message });
          }
          throw e;
        }
      }

      if (!savedFile) {
        return reply.status(400).send({ error: "Nenhum arquivo de upload válido recebido no form-data." });
      }

      return reply.send(savedFile);
    }
  );

  fastify.delete(
    "/:fileId",
    {
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const { fileId } = request.params as { fileId: string };
      const file = await prisma.file.findUnique({ where: { id: fileId } });
      if (file && file.channel === "TELEGRAM") {
        await prisma.file.delete({ where: { id: fileId } });
      }
      return reply.send({ success: true, message: "Excluído da base do Telegram." });
    }
  );
}
