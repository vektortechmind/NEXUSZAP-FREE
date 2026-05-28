import { Prisma } from "@prisma/client";
import { FastifyReply, FastifyInstance } from "fastify";
import { safeLogError } from "./redaction";

/**
 * Lida com erros do Prisma de forma padronizada.
 */
export function handlePrismaError(e: any, reply: FastifyReply, fastify: FastifyInstance) {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    fastify.log.error({ err: safeLogError(e), code: e.code }, "[Prisma]");
    return reply.status(400).send({
      error: e.code === "P2022" ? "Coluna ausente no banco. Rode no servidor: npx prisma migrate deploy && npx prisma generate" : `Erro Prisma ${e.code}`
    });
  }
  
  if (e instanceof Prisma.PrismaClientValidationError) {
    fastify.log.error({ err: safeLogError(e) }, "[Prisma]");
    return reply.status(400).send({
      error: "Validação Prisma: payload inválido"
    });
  }
  
  throw e;
}

