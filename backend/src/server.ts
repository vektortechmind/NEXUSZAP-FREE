import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import type { FastifyCorsOptions, FastifyCorsOptionsDelegate } from "@fastify/cors";
import { env } from "./config/env";
import { prisma } from "./database/prisma";
import { authRoutes } from "./routes/auth.routes";
import { agentRoutes } from "./routes/agent.routes";
import { filesRoutes } from "./routes/files.routes";
import { telegramFilesRoutes } from "./routes/telegram-files.routes";
import { dashboardRoutes } from "./routes/dashboard.routes";
import updateRoutes from "./routes/update.routes";
import { setupRoutes } from "./routes/setup.routes";
import { integrationRoutes } from "./routes/integration.routes";
import { chatRoutes } from "./routes/chat.routes";
import { chatRealtime } from "./services/chat.realtime";
import { createChatSocketServer } from "./services/chat.websocket";
import { startChatMediaCleanupJob } from "./services/chat.mediaStorage";
import { InstanceManager } from "./whatsapp/InstanceManager";
import { TelegramBotManager } from "./telegram/TelegramBotManager";
import { buildAllowedOrigins, createOriginGuard, isCorsOriginAllowedForRequest, verifyCsrf } from "./security/middlewares";
import { safeLogError } from "./utils/redaction";
import { globalMemoryManager } from "./utils/ai/memoryManager";

export async function buildServer() {
  const fastify = Fastify({
    logger: env.NODE_ENV === "production" ? true : { level: "info" },
  });

  await fastify.register(helmet, {
    global: true,
    contentSecurityPolicy: true,
  });

  const defaultOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
  const extraOrigins =
    env.CORS_ORIGINS?.split(",")
      .flatMap((origin) => {
        const trimmed = origin.trim();
        return trimmed ? [trimmed] : [];
      }) ?? [];
  const corsOrigins = [...defaultOrigins, ...extraOrigins];

  const allowedOrigins = buildAllowedOrigins(corsOrigins, env.NODE_ENV);

  await fastify.register(cors, (_instance: FastifyInstance): FastifyCorsOptionsDelegate => {
    return (request, callback) => {
      const corsOptions: FastifyCorsOptions = {
        origin: isCorsOriginAllowedForRequest(request, allowedOrigins, env.NODE_ENV),
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      };
      callback(null, {
        ...corsOptions,
      });
    };
  });

  fastify.addHook("preValidation", createOriginGuard(allowedOrigins, env.NODE_ENV));
  fastify.addHook("preValidation", verifyCsrf);

  // react-doctor-disable-next-line react-doctor/async-parallel -- Fastify plugin registration is intentionally ordered: cookie decorates requests before JWT reads token cookies, followed by multipart and rate limiting.
  await fastify.register(cookie);

  await fastify.register(jwt, {
    secret: env.JWT_SECRET,
    cookie: {
      cookieName: "token",
      signed: false,
    },
  });

  await fastify.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024,
    },
  });

  await fastify.register(rateLimit, {
    max: 800,
    timeWindow: "1 minute",
  });

  fastify.get("/api/ping", { config: { rateLimit: false } }, async () => {
    return { pong: true };
  });

  fastify.get("/api/health", { config: { rateLimit: false } }, async () => {
    return {
      ok: true,
      ts: Date.now(),
      memory: globalMemoryManager.getDiagnostics(),
      whatsappRuntime: InstanceManager.getRuntimeDiagnostics(),
      telegramRuntime: TelegramBotManager.getStatus(),
    };
  });

  // react-doctor-disable-next-line react-doctor/async-parallel -- Route plugins are registered sequentially to preserve Fastify hook/decorator visibility and public route ordering.
  await fastify.register(authRoutes, { prefix: "/api/auth" });
  await fastify.register(agentRoutes, { prefix: "/api/agent" });
  await fastify.register(filesRoutes, { prefix: "/api/files" });
  await fastify.register(telegramFilesRoutes, { prefix: "/api/telegram-files" });
  await fastify.register(dashboardRoutes, { prefix: "/api/dashboard" });
  await fastify.register(updateRoutes, { prefix: "/api" });
  await fastify.register(setupRoutes, { prefix: "/api/setup" });
  await fastify.register(integrationRoutes, { prefix: "/api/integrations" });
  await fastify.register(chatRoutes, { prefix: "/api/chat" });

  const chatSocketServer = createChatSocketServer(fastify);
  const chatMediaCleanupTimer = startChatMediaCleanupJob();
  fastify.addHook("onClose", async () => {
    chatRealtime.setEmitter(null);
    clearInterval(chatMediaCleanupTimer);
    chatSocketServer.close();
  });

  return fastify;
}

async function bootstrap() {
  const fastify = await buildServer();

  try {
    await fastify.ready();
    if (env.NODE_ENV !== "production") {
      console.log("DEBUG: Fastify pronto (ready).");
    }
    await fastify.listen({ port: env.PORT, host: "0.0.0.0" });
    console.log(`✅ Servidor rodando na porta ${env.PORT}`);

    setTimeout(async () => {
      try {
        await InstanceManager.loadInstancesOnBoot();
        await TelegramBotManager.restoreOnBoot();
        console.log("✅ Runtimes suportados reconstruídos no boot.");
      } catch (err) {
        console.error("⚠️ Erro ao carregar runtimes no boot:", safeLogError(err));
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
    console.error("❌ Erro ao iniciar servidor:", safeLogError(err));
    await prisma.$disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  void bootstrap();
}
