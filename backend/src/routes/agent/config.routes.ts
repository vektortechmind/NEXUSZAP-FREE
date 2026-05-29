import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../database/prisma";
import { geminiChat } from "../../ai/gemini";
import { groqChat, groqPingModels } from "../../ai/groq";
import { openRouterChat } from "../../ai/openrouter";
import { fetchOpenRouterModelsGrouped } from "../../ai/openrouterModels";
import { buildAgentConfigUpdateData, sanitizeAgentConfigForResponse } from "../../services/agentConfigSecrets";
import { getPrimaryAgent } from "../../services/agent.service";
import { tryDecryptSecret } from "../../services/crypto.service";
import { getPrimaryInstance } from "../../services/instance.service";
import { handlePrismaError } from "../../utils/prismaErrorHandler";
import { safeErrorMessage, safeLogError } from "../../utils/redaction";
import { buildEmptyConfigResponse, updateSchema } from "./shared";

export async function agentConfigRoutes(fastify: FastifyInstance) {
  fastify.get("/config", async (_request, reply) => {
    const agent = await getPrimaryInstance();
    if (!agent) {
      return reply.send(buildEmptyConfigResponse());
    }
    const primaryAgent = await getPrimaryAgent();
    return reply.send({
      ...sanitizeAgentConfigForResponse(agent),
      systemPrompt: primaryAgent?.systemPrompt ?? agent.systemPrompt ?? null,
      telegramSystemPrompt: null,
      agentWorkspaceId: primaryAgent?.id ?? null,
    });
  });

  fastify.post("/openrouter-models", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const body = z.object({ openrouterKey: z.string().min(8, "Chave muito curta") }).parse(request.body);
    try {
      const { free, paid } = await fetchOpenRouterModelsGrouped(body.openrouterKey);
      return reply.send({ free, paid, totalFree: free.length, totalPaid: paid.length });
    } catch (err: unknown) {
      const msg = safeErrorMessage(err, "Falha ao listar modelos");
      fastify.log.warn({ err: safeLogError(err) }, "[openrouter-models]");
      return reply.status(400).send({ error: msg });
    }
  });

  fastify.get("/providers-health", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (_request, reply) => {
    const agent = await getPrimaryInstance();
    if (!agent) {
      return reply.send({
        preferredChatProvider: null,
        results: [
          { provider: "gemini", configured: false, ok: false as const },
          { provider: "groq", configured: false, ok: false as const },
          { provider: "openrouter", configured: false, ok: false as const },
          { provider: "groq-audio", configured: false, ok: false as const },
        ],
      });
    }
    const primaryInstance = agent;
    const messages = [
      { role: "system" as const, content: "Você é um healthcheck. Responda apenas com 'OK'." },
      { role: "user" as const, content: "OK" },
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
        if (name === "openrouter") await openRouterChat(key, messages, primaryInstance.openrouterModel);
        if (name === "groq-audio") await groqPingModels(key);
        return {
          provider: name,
          configured: true,
          ok: true as const,
          latencyMs: Math.round(performance.now() - t0),
        };
      } catch (err: unknown) {
        return {
          provider: name,
          configured: true,
          ok: false as const,
          latencyMs: Math.round(performance.now() - t0),
          error: safeErrorMessage(err, "Falha desconhecida").slice(0, 300),
        };
      }
    }

    const [gemini, groq, openrouter, groqAudio] = await Promise.all([
      test("gemini", primaryInstance.geminiKey ? tryDecryptSecret(primaryInstance.geminiKey) : primaryInstance.geminiKey),
      test("groq", primaryInstance.groqKey ? tryDecryptSecret(primaryInstance.groqKey) : primaryInstance.groqKey),
      test("openrouter", primaryInstance.openrouterKey ? tryDecryptSecret(primaryInstance.openrouterKey) : primaryInstance.openrouterKey),
      test(
        "groq-audio",
        primaryInstance.groqAudioKey
          ? tryDecryptSecret(primaryInstance.groqAudioKey)
          : primaryInstance.groqKey
            ? tryDecryptSecret(primaryInstance.groqKey)
            : primaryInstance.groqKey
      ),
    ]);

    return reply.send({
      preferredChatProvider: primaryInstance.chatProvider ?? null,
      results: [gemini, groq, openrouter, groqAudio],
    });
  });

  fastify.put("/config", {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const agent = await getPrimaryInstance();
    if (!agent) {
      return reply.status(409).send({ error: "Crie ao menos uma instância antes de salvar configurações." });
    }
    const primaryAgent = await getPrimaryAgent();
    let data: z.infer<typeof updateSchema>;

    try {
      data = updateSchema.parse(request.body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const msg = err.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
        return reply.status(400).send({ error: msg || "Payload inválido" });
      }
      throw err;
    }

    try {
      const { systemPrompt, telegramSystemPrompt, ...instanceConfig } = data;

      if (telegramSystemPrompt !== undefined) {
        return reply.status(409).send({ error: "Use /agent/telegram/config para editar o prompt isolado do Telegram." });
      }

      const updatedInstance = await prisma.$transaction(async (tx) => {
        const nextInstance = await tx.instance.update({
          where: { id: agent.id },
          data: buildAgentConfigUpdateData(instanceConfig),
        });

        if (primaryAgent && systemPrompt !== undefined) {
          await tx.agent.update({
            where: { id: primaryAgent.id },
            data: {
              ...(systemPrompt !== undefined ? { systemPrompt } : {}),
            },
          });
        }

        return nextInstance;
      });

      return reply.send({
        ...sanitizeAgentConfigForResponse(updatedInstance),
        systemPrompt:
          systemPrompt !== undefined ? systemPrompt : (primaryAgent?.systemPrompt ?? updatedInstance.systemPrompt ?? null),
        telegramSystemPrompt: null,
        agentWorkspaceId: primaryAgent?.id ?? null,
      });
    } catch (e: any) {
      return handlePrismaError(e, reply, fastify);
    }
  });
}
