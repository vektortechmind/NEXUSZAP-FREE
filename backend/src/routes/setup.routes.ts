import { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  getSetupStatus,
  isAdminSetupRequired,
  isSetupTokenValid,
  mergeCorsOrigins,
  normalizePublicUrl,
  readEnvValue,
  updateEnvFile,
  updateFrontendProductionApiUrl
} from "../services/setup.service";

const tokenSchema = z.string().min(16).max(256).optional();

const optionalDomainSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
  z.string().trim().min(3).max(253).optional()
);

const dockerSetupSchema = z.object({
  apiDomain: z.string().trim().min(3).max(253),
  panelDomain: optionalDomainSchema,
  token: tokenSchema
});

const adminSetupSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(256),
  confirmPassword: z.string().min(12).max(256),
  token: tokenSchema
}).superRefine((value, ctx) => {
  if (value.password !== value.confirmPassword) {
    ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "As senhas não conferem." });
  }
  if (!/[a-z]/.test(value.password) || !/[A-Z]/.test(value.password) || !/\d/.test(value.password) || !/[^A-Za-z0-9]/.test(value.password)) {
    ctx.addIssue({
      code: "custom",
      path: ["password"],
      message: "Use maiúscula, minúscula, número e símbolo."
    });
  }
});

function tokenFromQuery(query: unknown): string | undefined {
  const parsed = z.object({ token: tokenSchema }).safeParse(query);
  return parsed.success ? parsed.data.token : undefined;
}

function requireSetupToken(token: string | undefined) {
  if (!isSetupTokenValid(token)) {
    const error = new Error("Token de configuração inválido ou ausente.");
    error.name = "SETUP_TOKEN_INVALID";
    throw error;
  }
}

export async function setupRoutes(fastify: FastifyInstance) {
  fastify.get("/status", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request) => {
    const tokenValid = isSetupTokenValid(tokenFromQuery(request.query));
    return { ...getSetupStatus(), tokenValid };
  });

  fastify.post("/docker", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    try {
      const body = dockerSetupSchema.parse(request.body);
      requireSetupToken(body.token);

      const appUrl = normalizePublicUrl(body.apiDomain);
      const panelUrl = body.panelDomain ? normalizePublicUrl(body.panelDomain) : null;
      const corsOrigin = panelUrl ?? appUrl;
      const corsOrigins = mergeCorsOrigins(readEnvValue("CORS_ORIGINS") ?? process.env.CORS_ORIGINS, corsOrigin);
      const envUpdates: Record<string, string> = {
        APP_URL: appUrl,
        CORS_ORIGINS: corsOrigins,
        OPENROUTER_REFERER: panelUrl ?? appUrl
      };
      updateEnvFile(envUpdates);
      updateFrontendProductionApiUrl(appUrl, panelUrl);

      const nextBaseUrl = panelUrl ?? appUrl;
      return reply.send({ success: true, appUrl, panelUrl, nextUrl: `${nextBaseUrl}/criar-admin?token=${body.token}` });
    } catch (error) {
      if (error instanceof Error && error.name === "SETUP_TOKEN_INVALID") {
        return reply.status(403).send({ error: error.message });
      }
      return reply.status(400).send({ error: error instanceof Error ? error.message : "Configuração inválida." });
    }
  });

  fastify.post("/admin", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    try {
      const body = adminSetupSchema.parse(request.body);
      requireSetupToken(body.token);

      if (!isAdminSetupRequired()) {
        return reply.status(409).send({ error: "Administrador inicial já foi configurado." });
      }

      updateEnvFile({
        ADMIN_EMAIL: body.email,
        ADMIN_PASSWORD: body.password,
        ADMIN_SETUP_REQUIRED: "false",
        SETUP_COMPLETED: "true"
      });

      return reply.send({ success: true, loginUrl: "/login" });
    } catch (error) {
      if (error instanceof Error && error.name === "SETUP_TOKEN_INVALID") {
        return reply.status(403).send({ error: error.message });
      }
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.issues[0]?.message ?? "Dados inválidos." });
      }
      return reply.status(400).send({ error: error instanceof Error ? error.message : "Configuração inválida." });
    }
  });
}
