import { randomUUID } from "node:crypto";
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
  loadKnowledgeFileBuffer,
} from "../services/knowledge/knowledge.service";
import {
  buildKnowledgeStoragePath,
  deleteKnowledgeBinary,
  writeKnowledgeBinary,
} from "../services/knowledge/fileStorage.service";

async function extractKnowledgeText(
  fastify: FastifyInstance,
  buffer: Buffer,
  mimetype: string,
  channel: "WHATSAPP" | "TELEGRAM"
) {
  try {
    return await extractTextFromBuffer(buffer, mimetype);
  } catch (e) {
    logExtractionFailure(fastify.log, e, { channel, mimetype });
    throw new FileSecurityError("Arquivo corrompido ou inextraível OWASP.", "FILE_EXTRACTION_FAILED");
  }
}

export async function filesRoutes(fastify: FastifyInstance) {
  fastify.addHook("preValidation", verifyJwt);

  fastify.get("/", async (_request, reply) => {
    const files = await prisma.file.findMany({
      where: { channel: "WHATSAPP" },
      include: {
        instance: { select: { id: true, name: true } },
        agent: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return reply.send(files);
  });

  fastify.get("/download/:fileId", async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) {
      return reply.status(404).send({ error: "Arquivo não encontrado." });
    }

    const headers = buildSafeDownloadHeaders(file.filename, file.mimetype);
    for (const [key, value] of Object.entries(headers)) reply.header(key, value);
    const buffer = await loadKnowledgeFileBuffer(file as any);
    return reply.send(buffer);
  });

  fastify.get("/agent/:agentId", async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const files = await listKnowledgeFilesByAgent(agentId, "WHATSAPP");
    if (!files) {
      return reply.status(404).send({ error: "Agente não encontrado." });
    }

    return reply.send(files);
  });

  fastify.get("/:instanceId", async (request, reply) => {
    const { instanceId } = request.params as { instanceId: string };
    const files = await listKnowledgeFilesByInstance(instanceId, "WHATSAPP");
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

          const existingFiles = (await listKnowledgeFilesByAgent(agentId, "WHATSAPP")) ?? [];
          await assertStorageQuota({ existingFiles: existingFiles as any, nextBytes: buffer.length });

          let extractedText: string | null = null;
          if (normalized.canExtract) {
            extractedText = await extractKnowledgeText(fastify, buffer, normalized.mimetype, "WHATSAPP");
          }

          const fileId = randomUUID();
          const storagePath = buildKnowledgeStoragePath({
            instanceId: owner.instanceId,
            channel: "WHATSAPP",
            fileId,
            filename: normalized.filename,
          });
          await writeKnowledgeBinary(storagePath, buffer);

          try {
            savedFile = await (prisma.file as any).create({
              data: {
                id: fileId,
                instanceId: owner.instanceId,
                agentId: owner.id,
                filename: normalized.filename,
                mimetype: normalized.mimetype,
                storagePath,
                sizeBytes: buffer.length,
                data: Buffer.alloc(0),
                extracted: extractedText,
                channel: "WHATSAPP",
              },
            });
          } catch (err) {
            await deleteKnowledgeBinary(storagePath);
            throw err;
          }
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
          agent: { select: { id: true } },
        },
      });

      if (!instance) {
        return reply.status(404).send({ error: "Instância não encontrada." });
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

          const existingFiles = (await listKnowledgeFilesByInstance(instanceId, "WHATSAPP")) ?? [];
          await assertStorageQuota({ existingFiles: existingFiles as any, nextBytes: buffer.length });

          let extractedText: string | null = null;
          if (normalized.canExtract) {
            extractedText = await extractKnowledgeText(fastify, buffer, normalized.mimetype, "WHATSAPP");
          }

          const fileId = randomUUID();
          const storagePath = buildKnowledgeStoragePath({
            instanceId,
            channel: "WHATSAPP",
            fileId,
            filename: normalized.filename,
          });
          await writeKnowledgeBinary(storagePath, buffer);

          try {
            savedFile = await (prisma.file as any).create({
              data: {
                id: fileId,
                instanceId,
                agentId: instance.agent?.id ?? null,
                filename: normalized.filename,
                mimetype: normalized.mimetype,
                storagePath,
                sizeBytes: buffer.length,
                data: Buffer.alloc(0),
                extracted: extractedText,
                channel: "WHATSAPP",
              },
            });
          } catch (err) {
            await deleteKnowledgeBinary(storagePath);
            throw err;
          }
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
      if (file && file.channel === "WHATSAPP") {
        await deleteKnowledgeBinary((file as any).storagePath);
        await prisma.file.delete({ where: { id: fileId } });
      }
      return reply.send({ success: true, message: "Excluído da Máquina." });
    }
  );
}
