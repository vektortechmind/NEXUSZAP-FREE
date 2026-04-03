import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { env } from "./config/env";
import { prisma } from "./database/prisma";
import { applySqlitePragmas } from "./database/sqlitePragmas";
import { authRoutes } from "./routes/auth.routes";
import { agentRoutes } from "./routes/agent.routes";
import { filesRoutes } from "./routes/files.routes";
import { telegramFilesRoutes } from "./routes/telegram-files.routes";
import { dashboardRoutes } from "./routes/dashboard.routes";
import updateRoutes from "./routes/update.routes";
import { InstanceManager } from "./whatsapp/InstanceManager";
import { TelegramBotManager } from "./telegram/TelegramBotManager";

const fastify = Fastify({
  logger: env.NODE_ENV === "production" ? true : { level: "info" },
});

async function bootstrap() {
  await fastify.register(helmet, {
    global: true,
    contentSecurityPolicy: true
  });
  
  const defaultOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
  const extraOrigins =
    env.CORS_ORIGINS?.split(",")
      .map((o) => o.trim())
      .filter(Boolean) ?? [];
  const corsOrigins = [...defaultOrigins, ...extraOrigins];

  await fastify.register(cors, {
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  });

  await fastify.register(jwt, {
    secret: env.JWT_SECRET,
    cookie: {
      cookieName: "token",
      signed: false
    }
  });

  await fastify.register(cookie);
  
  await fastify.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB Upload Restritiva API Global
    }
  });

  await fastify.register(rateLimit, {
    /** Polling /agent/status + várias abas: limite alto para evitar 429 no painel. */
    max: 800,
    timeWindow: "1 minute"
  });

  // Healthcheck ultra-rápido (antes de any async operations)
  fastify.get("/api/ping", async () => {
    return { pong: true };
  });

  // Healthcheck simples (para o front testar conectividade)
  fastify.get("/api/health", async () => {
    return { ok: true, ts: Date.now() };
  });

  // Rotas da Plataforma (Arquitetura Modular)
  await fastify.register(authRoutes, { prefix: "/api/auth" });
  await fastify.register(agentRoutes, { prefix: "/api/agent" });
  await fastify.register(filesRoutes, { prefix: "/api/files" });
  await fastify.register(telegramFilesRoutes, { prefix: "/api/telegram-files" });
  await fastify.register(dashboardRoutes, { prefix: "/api/dashboard" });
  await fastify.register(updateRoutes, { prefix: "/api" });

  try {
    await fastify.ready();
    if (env.NODE_ENV !== "production") {
      console.log("DEBUG: Fastify pronto (ready).");
    }
    await applySqlitePragmas();
    if (env.NODE_ENV !== "production") {
      console.log("DEBUG: Pragmas do SQLite aplicados.");
    }
    await fastify.listen({ port: env.PORT, host: "0.0.0.0" });
    console.log(`✅ Servidor rodando na porta ${env.PORT}`);

    // Carrega instâncias em background com timeout
    setTimeout(async () => {
      try {
        await InstanceManager.loadInstancesOnBoot();
        console.log("✅ Instâncias WhatsApp carregadas.");
      } catch (err) {
        console.error("⚠️ Erro ao carregar instâncias:", err);
      }
    }, 1000);

    console.log("ℹ️ Telegram: tokens são configurados por instância no painel.");

    const shutdown = async (signal: string) => {
      console.log(`⛔ Recebido ${signal}. Encerrando...`);
      try {
        await TelegramBotManager.stop();
        await fastify.close();
      } finally {
        await prisma.$disconnect();
        process.exit(0);
      }
    };
    process.once("SIGINT", () => void shutdown("SIGINT"));
    process.once("SIGTERM", () => void shutdown("SIGTERM"));
  } catch (err) {
    console.error("❌ Erro ao iniciar servidor:", err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

bootstrap();
