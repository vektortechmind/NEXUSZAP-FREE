import { PrismaClient } from "@prisma/client";
import { env } from "../config/env";

/**
 * Configuração otimizada do Prisma em produção (VPS):
 * - Pool de conexões eficiente
 * - Logs em produção apenas para erros
 */
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: env.DATABASE_URL
    }
  },
  log: env.NODE_ENV === "production"
    ? ["error"]
    : ["query", "info", "warn", "error"],
  errorFormat: "pretty"
});
