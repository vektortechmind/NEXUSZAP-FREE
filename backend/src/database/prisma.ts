import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../config/env";

/**
 * Configuração otimizada do Prisma em produção (VPS):
 * - Pool de conexões eficiente
 * - Logs em produção apenas para erros
 */
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter,
  log: env.NODE_ENV === "production"
    ? ["error"]
    : ["query", "info", "warn", "error"],
  errorFormat: "pretty"
});
