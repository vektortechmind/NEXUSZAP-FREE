import { PrismaClient } from "@prisma/client";

/**
 * Configuração otimizada do Prisma em produção (VPS):
 * - Pool de conexões eficiente
 * - Logs em produção apenas para erros
 */
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: process.env.NODE_ENV === "production"
    ? ["error"]
    : ["query", "info", "warn", "error"],
  errorFormat: "pretty"
});
