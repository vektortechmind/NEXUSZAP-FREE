import { FastifyInstance } from "fastify";
import { verifyJwt } from "../security/middlewares";
import { prisma } from "../database/prisma";
import { extractTextFromBuffer } from "../services/fileExtractor";
import {
  assertStorageQuota,
  buildSafeDownloadHeaders,
  FileSecurityError,
  logExtractionFailure,
  MAX_UPLOAD_BYTES,
  streamToLimitedBuffer,
  validateAndNormalizeUpload
} from "../services/fileSecurity.service";

export async function filesRoutes(fastify: FastifyInstance) {
  // Hardening e Proteção da Rota via JWT HttpOnly
  fastify.addHook("preValidation", verifyJwt);

  fastify.get("/", async (_request, reply) => {
    const files = await prisma.file.findMany({
      where: { channel: "WHATSAPP" },
      include: {
        instance: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    return reply.send(files);
  });

  // Rotas estáticas ANTES de /:instanceId (senão "download" é capturado como UUID)
  fastify.get("/download/:fileId", async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) {
      return reply.status(404).send({ error: "Arquivo não encontrado." });
    }

    const headers = buildSafeDownloadHeaders(file.filename, file.mimetype);
    for (const [key, value] of Object.entries(headers)) reply.header(key, value);
    return reply.send(file.data);
  });

  fastify.get("/:instanceId", async (request, reply) => {
    const { instanceId } = request.params as { instanceId: string };
    const files = await prisma.file.findMany({
      where: {
        instanceId,
        channel: "WHATSAPP"
      },
      orderBy: { createdAt: "asc" }
    });
    return reply.send(files);
  });

  fastify.post("/:instanceId/upload", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } }
  }, async (request, reply) => {
    const { instanceId } = request.params as { instanceId: string };
    const parts = request.parts(); // O limitador de 5MB já atua nativamente aqui pelo Fastify Core

    let savedFile = null;

    for await (const part of parts) {
      if (part.type === "file") {
        try {
          const buffer = await streamToLimitedBuffer(part.file, MAX_UPLOAD_BYTES);
          const normalized = validateAndNormalizeUpload({
            filename: part.filename,
            incomingMime: part.mimetype,
            buffer
          });

          const existingFiles = await prisma.file.findMany({
            where: { instanceId, channel: "WHATSAPP" },
            select: { data: true }
          });
          await assertStorageQuota({ existingFiles, nextBytes: buffer.length });

          // File Content Sanity Check via Lib — só extrai texto para KNOWLEDGE (contexto da IA)
          let extractedText: string | null = null;
          if (normalized.canExtract) {
            try {
              extractedText = await extractTextFromBuffer(buffer, normalized.mimetype);
            } catch (e) {
              logExtractionFailure(fastify.log, e, { channel: "WHATSAPP", mimetype: normalized.mimetype });
              return reply.status(400).send({ error: "Arquivo corrompido ou inextraível OWASP." });
            }
          }

          savedFile = await prisma.file.create({
            data: {
              instanceId,
              filename: normalized.filename,
              mimetype: normalized.mimetype,
              data: buffer,
              extracted: extractedText,
              channel: "WHATSAPP"
            }
          });
        } catch (e) {
          if (e instanceof FileSecurityError) {
            return reply.status(400).send({ error: e.message });
          }
          throw e;
        }
      }
    }

    if (!savedFile) {
      return reply.status(400).send({ error: "Nenhum arquivo de upload válido recebido no form-data." });
    }

    return reply.send(savedFile);
  });

  fastify.delete("/:fileId", {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } }
  }, async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (file && file.channel === "WHATSAPP") {
      await prisma.file.delete({ where: { id: fileId } });
    }
    return reply.send({ success: true, message: "Excluído da Máquina." });
  });
}
