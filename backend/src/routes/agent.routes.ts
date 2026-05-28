import { FastifyInstance } from "fastify";
import { verifyJwt } from "../security/middlewares";
import { prisma } from "../database/prisma";
import { InstanceManager } from "../whatsapp/InstanceManager";
import { getLabelsForInstance } from "../whatsapp/labelsCache";
import { z } from "zod";
import { geminiChat } from "../ai/gemini";
import { groqChat, groqPingModels } from "../ai/groq";
import { openRouterChat } from "../ai/openrouter";
import { fetchOpenRouterModelsGrouped } from "../ai/openrouterModels";
import { TelegramBotManager } from "../telegram/TelegramBotManager";
import { handlePrismaError } from "../utils/prismaErrorHandler";
import { buildAgentConfigUpdateData, sanitizeAgentConfigForResponse } from "../services/agentConfigSecrets";
import { tryDecryptSecret } from "../services/crypto.service";
import { safeErrorMessage, safeLogError } from "../utils/redaction";

/** String vazia → null; undefined permanece (campo omitido no JSON). */
const emptyToNull = (v: unknown) => {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  return v;
};

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  agentName: z.preprocess(emptyToNull, z.string().nullable().optional()),
  aiWhatsappEnabled: z.coerce.boolean().optional(),
  aiTelegramEnabled: z.coerce.boolean().optional(),
  typing: z.coerce.boolean().optional(),
  delayMin: z.coerce.number().int().min(0).optional(),
  delayMax: z.coerce.number().int().min(0).optional(),
  systemPrompt: z.preprocess(emptyToNull, z.string().nullable().optional()),
  telegramSystemPrompt: z.preprocess(emptyToNull, z.string().nullable().optional()),
  chatProvider: z.preprocess(emptyToNull, z.string().nullable().optional()),
  groqKey: z.preprocess(emptyToNull, z.string().nullable().optional()),
  groqAudioKey: z.preprocess(emptyToNull, z.string().nullable().optional()),  // ← Chave separada para áudio
  geminiKey: z.preprocess(emptyToNull, z.string().nullable().optional()),
  openrouterKey: z.preprocess(emptyToNull, z.string().nullable().optional()),
  openrouterModel: z.preprocess(emptyToNull, z.string().nullable().optional()),
}).superRefine((val, ctx) => {
  if (typeof val.delayMin === "number" && typeof val.delayMax === "number") {
    if (val.delayMax < val.delayMin) {
      ctx.addIssue({
        code: "custom",
        path: ["delayMax"],
        message: "delayMax não pode ser menor que delayMin"
      });
    }
  }
});

export async function agentRoutes(fastify: FastifyInstance) {
  fastify.addHook("preValidation", verifyJwt);

  /** Pega o agente único (ou cria se não existir) */
  async function getAgent() {
    let agent = await prisma.instance.findFirst();
    if (!agent) {
      agent = await prisma.instance.create({
        data: { name: "Agente Principal", typing: true, delayMin: 4000, delayMax: 7000 }
      });
    }
    return agent;
  }

  fastify.get("/status", async (_request, reply) => {
    const agent = await getAgent();
    const telegram = TelegramBotManager.getStatus();
    return reply.send({
      id: agent.id,
      name: agent.name,
      status: agent.status,
      qr: InstanceManager.getLastQr(),
      active: InstanceManager.isRunning(),
      aiWhatsappEnabled: agent.aiWhatsappEnabled,
      aiTelegramEnabled: agent.aiTelegramEnabled,
      telegram
    });
  });

  fastify.get("/config", async (_request, reply) => {
    const agent = await getAgent();
    return reply.send(sanitizeAgentConfigForResponse(agent));
  });

  fastify.post("/openrouter-models", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } }
  }, async (request, reply) => {
    const body = z.object({ openrouterKey: z.string().min(8, "Chave muito curta") }).parse(request.body);
    try {
      const { free, paid } = await fetchOpenRouterModelsGrouped(body.openrouterKey);
      return reply.send({
        free,
        paid,
        totalFree: free.length,
        totalPaid: paid.length
      });
    } catch (err: unknown) {
      const msg = safeErrorMessage(err, "Falha ao listar modelos");
      fastify.log.warn({ err: safeLogError(err) }, "[openrouter-models]");
      return reply.status(400).send({ error: msg });
    }
  });

  fastify.get("/providers-health", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } }
  }, async (_request, reply) => {
    const agent = await getAgent();

    const messages = [
      { role: "system" as const, content: "Você é um healthcheck. Responda apenas com 'OK'." },
      { role: "user" as const, content: "OK" }
    ];

    async function test(
      name: "gemini" | "groq" | "openrouter" | "groq-audio",
      key: string | null | undefined
    ) {
      if (!key || !String(key).trim()) {
        return { provider: name, configured: false, ok: false as const };
      }
      const t0 = performance.now();
      try {
        if (name === "gemini") await geminiChat(key, messages);
        if (name === "groq") await groqChat(key, messages);
        if (name === "openrouter") await openRouterChat(key, messages, agent.openrouterModel);
        // groq-audio: GET /v1/models (leve, OpenAI-compatible) — antes o bloco estava vazio e dava sempre 0ms
        if (name === "groq-audio") await groqPingModels(key);
        return {
          provider: name,
          configured: true,
          ok: true as const,
          latencyMs: Math.round(performance.now() - t0)
        };
      } catch (err: unknown) {
        const msg =
          safeErrorMessage(err, "Falha desconhecida");
        return {
          provider: name,
          configured: true,
          ok: false as const,
          latencyMs: Math.round(performance.now() - t0),
          error: msg.slice(0, 300)
        };
      }
    }

    const [gemini, groq, openrouter, groqAudio] = await Promise.all([
      test("gemini", agent.geminiKey ? tryDecryptSecret(agent.geminiKey) : agent.geminiKey),
      test("groq", agent.groqKey ? tryDecryptSecret(agent.groqKey) : agent.groqKey),
      test("openrouter", agent.openrouterKey ? tryDecryptSecret(agent.openrouterKey) : agent.openrouterKey),
      test(
        "groq-audio",
        agent.groqAudioKey
          ? tryDecryptSecret(agent.groqAudioKey)
          : agent.groqKey
            ? tryDecryptSecret(agent.groqKey)
            : agent.groqKey
      )  // Usa audioKey ou fallback para groqKey
    ]);

    return reply.send({
      preferredChatProvider: agent.chatProvider ?? null,
      results: [gemini, groq, openrouter, groqAudio]
    });
  });

  fastify.put("/config", {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } }
  }, async (request, reply) => {
    const agent = await getAgent();
    let data: z.infer<typeof updateSchema>;
    try {
      data = updateSchema.parse(request.body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const msg = err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        return reply.status(400).send({ error: msg || "Payload inválido" });
      }
      throw err;
    }
    try {
      const updated = await prisma.instance.update({
        where: { id: agent.id },
        data: buildAgentConfigUpdateData(data)
      });
      return reply.send(sanitizeAgentConfigForResponse(updated));
    } catch (e: any) {
      return handlePrismaError(e, reply, fastify);
    }
  });

  fastify.post("/start", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } }
  }, async (request, reply) => {
    let finalQr = "";
    try {
      await InstanceManager.start(
        (qr) => {
          finalQr = qr;
        },
        { userInitiated: true }
      );
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: "Falha ao iniciar conexão WhatsApp." });
    }
    const deadline = Date.now() + 3500;
    while (Date.now() < deadline) {
      const q = InstanceManager.getLastQr();
      if (q) {
        finalQr = q;
        break;
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    finalQr = finalQr || InstanceManager.getLastQr() || "";
    return reply.send({ success: true, qr: finalQr });
  });

  fastify.post("/stop", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } }
  }, async (request, reply) => {
    try {
      await InstanceManager.stop();
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: "Falha ao parar o agente." });
    }
    return reply.send({ success: true });
  });

  fastify.get("/whatsapp-labels", async (_request, reply) => {
    const agent = await getAgent();
    if (!InstanceManager.isRunning()) {
      return reply.status(503).send({
        error: "Conecte o agente para sincronizar etiquetas.",
        labels: []
      });
    }
    const labels = getLabelsForInstance(agent.id).map((l) => ({
      id: l.id,
      name: l.name,
      color: l.color
    }));
    return reply.send({ labels });
  });

  fastify.post("/telegram/save-token", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } }
  }, async (request, reply) => {
    const agent = await getAgent();
    const body = z.object({
      token: z.string().min(20, "Token inválido")
    }).parse(request.body);

    const result = await TelegramBotManager.saveAndStart(agent.id, body.token);
    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({
      success: true,
      message: "Token do Telegram salvo e bot iniciado!",
      status: TelegramBotManager.getStatus()
    });
  });

  fastify.delete("/telegram/token", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } }
  }, async (_request, reply) => {
    const agent = await getAgent();
    await TelegramBotManager.stop();
    await prisma.instance.update({
      where: { id: agent.id },
      data: { telegramBotToken: null }
    });
    return reply.send({ success: true, message: "Token removido e bot parado." });
  });

  fastify.get("/telegram/status", async (_request, reply) => {
    const agent = await getAgent();
    const isConfigured = await TelegramBotManager.isConfigured(agent.id);
    return reply.send({
      configured: isConfigured,
      ...TelegramBotManager.getStatus()
    });
  });

  fastify.post("/telegram/validate-token", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } }
  }, async (request, reply) => {
    const body = z.object({
      token: z.string().min(20, "Token inválido")
    }).parse(request.body);

    const result = await TelegramBotManager.validateToken(body.token);
    return reply.send(result);
  });
}
