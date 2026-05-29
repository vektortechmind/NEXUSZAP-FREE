import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../database/prisma";
import { geminiChat } from "../ai/gemini";
import { groqChat, groqPingModels } from "../ai/groq";
import {
  CHAT_PROVIDER_OPTIONS,
  describeRuntimeFallback,
  isChatProviderId,
  MAX_INSTANCE_MEMORY_LIMIT,
  normalizeMemoryLimit,
} from "../ai/chatRuntime";
import { openRouterChat } from "../ai/openrouter";
import { fetchOpenRouterModelsGrouped } from "../ai/openrouterModels";
import { buildAgentConfigUpdateData, sanitizeAgentConfigForResponse } from "../services/agentConfigSecrets";
import {
  AgentEligibilityError,
  createAgent,
  deleteAgent,
  getPrimaryAgent,
  getOrCreatePrimaryAgent,
  getAgentById,
  listAgents,
  listEligibleInstances,
  updateAgentWorkspace,
} from "../services/agent.service";
import {
  createInstance,
  deleteInstance,
  getInstanceById,
  getOrCreateTelegramInstance,
  getOrCreatePrimaryInstance,
  getPrimaryInstance,
  getTelegramInstance,
  InstanceLinkedAgentError,
  listInstances,
  MaxWhatsAppInstancesError,
} from "../services/instance.service";
import { tryDecryptSecret } from "../services/crypto.service";
import { TelegramBotManager } from "../telegram/TelegramBotManager";
import { handlePrismaError } from "../utils/prismaErrorHandler";
import { safeErrorMessage, safeLogError } from "../utils/redaction";
import { verifyJwt } from "../security/middlewares";
import { getLabelsForInstance } from "../whatsapp/labelsCache";
import { InstanceManager } from "../whatsapp/InstanceManager";

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
  groqAudioKey: z.preprocess(emptyToNull, z.string().nullable().optional()),
  geminiKey: z.preprocess(emptyToNull, z.string().nullable().optional()),
  openrouterKey: z.preprocess(emptyToNull, z.string().nullable().optional()),
  openrouterModel: z.preprocess(emptyToNull, z.string().nullable().optional()),
}).superRefine((val, ctx) => {
  if (typeof val.delayMin === "number" && typeof val.delayMax === "number" && val.delayMax < val.delayMin) {
    ctx.addIssue({
      code: "custom",
      path: ["delayMax"],
      message: "delayMax não pode ser menor que delayMin",
    });
  }
});

const createInstanceSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

const updateInstanceSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  aiWhatsappEnabled: z.coerce.boolean().optional(),
  chatProvider: z.preprocess(emptyToNull, z.string().nullable().optional()),
  openrouterModel: z.preprocess(emptyToNull, z.string().nullable().optional()),
  memoryLimit: z.coerce.number().int().min(1).max(MAX_INSTANCE_MEMORY_LIMIT).optional(),
});

const createAgentSchema = z.object({
  name: z.string().trim().min(1).max(80),
  instanceId: z.string().uuid("Instância inválida"),
});

const updateAgentWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  systemPrompt: z.preprocess(emptyToNull, z.string().nullable().optional()),
  chatProvider: z.preprocess(emptyToNull, z.string().nullable().optional()),
  openrouterModel: z.preprocess(emptyToNull, z.string().nullable().optional()),
  memoryLimit: z.coerce.number().int().min(1).max(MAX_INSTANCE_MEMORY_LIMIT).optional(),
  audioTranscriptionEnabled: z.coerce.boolean().optional(),
}).superRefine((val, ctx) => {
  if (val.chatProvider !== undefined && val.chatProvider !== null && !isChatProviderId(val.chatProvider)) {
    ctx.addIssue({
      code: "custom",
      path: ["chatProvider"],
      message: "Provider de IA inválido",
    });
  }
});

function serializeInstanceStatus(instance: {
  id: string;
  slot: number;
  name: string;
  status: string;
  aiWhatsappEnabled: boolean;
  chatProvider?: string | null;
  openrouterModel?: string | null;
  memoryLimit?: number;
  agent?: { id: string; name: string; chatProvider?: string | null; openrouterModel?: string | null; memoryLimit?: number } | null;
}) {
  const active = InstanceManager.isRunning(instance.id);
  const connected = instance.status === "CONNECTED";
  const occupied = connected && !!instance.agent;

  const fallback = describeRuntimeFallback({
    chatProvider: instance.agent?.chatProvider ?? instance.chatProvider,
    openrouterModel: instance.agent?.openrouterModel ?? instance.openrouterModel,
  });

  return {
    id: instance.id,
    channel: "WHATSAPP" as const,
    slot: instance.slot,
    name: instance.name,
    status: instance.status,
    qr: InstanceManager.getLastQr(instance.id),
    active,
    connected,
    available: connected && !occupied,
    occupied,
    agent: instance.agent
      ? {
          id: instance.agent.id,
          name: instance.agent.name,
        }
      : null,
    aiWhatsappEnabled: instance.aiWhatsappEnabled,
    chatProvider: isChatProviderId(instance.agent?.chatProvider ?? instance.chatProvider) ? (instance.agent?.chatProvider ?? instance.chatProvider ?? null) : null,
    openrouterModel: instance.agent?.openrouterModel ?? instance.openrouterModel ?? null,
    memoryLimit: normalizeMemoryLimit(instance.agent?.memoryLimit ?? instance.memoryLimit),
    providerFallback: fallback.providerFallback,
    providerFallbackLabel: fallback.providerFallbackLabel,
    modelFallback: fallback.modelFallback,
    modelFallbackLabel: fallback.modelFallbackLabel,
  };
}

function serializeAgent(agent: {
  id: string;
  name: string;
  telegramEnabled: boolean;
  systemPrompt?: string | null;
  chatProvider?: string | null;
  openrouterModel?: string | null;
  memoryLimit?: number;
  audioTranscriptionEnabled?: boolean;
  createdAt: Date;
  instance: {
    id: string;
    slot: number;
    name: string;
    status: string;
    chatProvider?: string | null;
    openrouterModel?: string | null;
  };
}) {
  return {
    id: agent.id,
    name: agent.name,
    telegramEnabled: agent.telegramEnabled,
    audioTranscriptionEnabled: agent.audioTranscriptionEnabled ?? false,
    chatProvider: isChatProviderId(agent.chatProvider) ? agent.chatProvider : null,
    openrouterModel: agent.openrouterModel ?? null,
    memoryLimit: normalizeMemoryLimit(agent.memoryLimit),
    createdAt: agent.createdAt,
    instanceId: agent.instance.id,
    instanceName: agent.instance.name,
    instanceSlot: agent.instance.slot,
    instanceStatus: agent.instance.status,
    instanceChatProvider: isChatProviderId(agent.chatProvider) ? agent.chatProvider : null,
    instanceOpenrouterModel: agent.openrouterModel ?? null,
    systemPrompt: agent.systemPrompt ?? null,
  };
}

async function waitForQr(instanceId: string) {
  let finalQr = "";
  const deadline = Date.now() + 3500;

  while (Date.now() < deadline) {
    const q = InstanceManager.getLastQr(instanceId);
    if (q) {
      finalQr = q;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return finalQr || InstanceManager.getLastQr(instanceId) || "";
}

export async function agentRoutes(fastify: FastifyInstance) {
  fastify.addHook("preValidation", verifyJwt);

  function buildEmptyConfigResponse() {
    return {
      id: "",
      slot: 0,
      name: "",
      agentName: null,
      status: "DISCONNECTED",
      aiWhatsappEnabled: true,
      aiTelegramEnabled: true,
      typing: true,
      delayMin: 4000,
      delayMax: 7000,
      systemPrompt: null,
      telegramSystemPrompt: null,
      chatProvider: null,
      groqKey: null,
      groqAudioKey: null,
      geminiKey: null,
      openrouterKey: null,
      openrouterModel: null,
      memoryLimit: 5,
      createdAt: null,
      updatedAt: null,
      groqKeyConfigured: false,
      groqKeyMasked: null,
      groqAudioKeyConfigured: false,
      groqAudioKeyMasked: null,
      geminiKeyConfigured: false,
      geminiKeyMasked: null,
      openrouterKeyConfigured: false,
      openrouterKeyMasked: null,
      telegramBotTokenConfigured: false,
      telegramBotTokenMasked: null,
      agentWorkspaceId: null,
    };
  }

  async function getAgent() {
    return getOrCreatePrimaryInstance();
  }

  async function getTelegramConfigState() {
    const telegramInstance = await prisma.instance.findUnique({
      where: { slot: 0 },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            telegramSystemPrompt: true,
          },
        },
      },
    });

    if (!telegramInstance) {
      return {
        instanceId: null,
        instanceName: null,
        agentWorkspaceId: null,
        agentWorkspaceName: null,
        telegramSystemPrompt: null,
        canEdit: false,
        blockingReason: "Salve e configure a instância Telegram antes de editar prompt ou arquivos.",
      };
    }

    if (!telegramInstance.agent) {
      return {
        instanceId: telegramInstance.id,
        instanceName: telegramInstance.name,
        agentWorkspaceId: null,
        agentWorkspaceName: null,
        telegramSystemPrompt: telegramInstance.telegramSystemPrompt ?? null,
        canEdit: false,
        blockingReason: "Vincule ou crie um agente para a instância Telegram antes de editar prompt ou arquivos.",
      };
    }

    return {
      instanceId: telegramInstance.id,
      instanceName: telegramInstance.name,
      agentWorkspaceId: telegramInstance.agent.id,
      agentWorkspaceName: telegramInstance.agent.name,
      telegramSystemPrompt: telegramInstance.agent.telegramSystemPrompt ?? telegramInstance.telegramSystemPrompt ?? null,
      canEdit: true,
      blockingReason: null,
    };
  }
  fastify.get("/instances", async (_request, reply) => {
    const instances = await listInstances();
    const instancesWithAgent = await prisma.instance.findMany({
      where: {
        id: {
          in: instances.map((instance) => instance.id),
        },
      },
      orderBy: { slot: "asc" },
      include: {
        agent: {
          select: { id: true, name: true, chatProvider: true, openrouterModel: true, memoryLimit: true },
        },
      },
    });
    return reply.send(instancesWithAgent.map(serializeInstanceStatus));
  });

  fastify.get("/instances/runtime-options", async (_request, reply) => {
    return reply.send({
      providers: CHAT_PROVIDER_OPTIONS,
      defaults: {
        memoryLimit: normalizeMemoryLimit(undefined),
      },
    });
  });

  fastify.get("/agents", async (_request, reply) => {
    const agents = await listAgents();
    return reply.send(agents.map(serializeAgent));
  });

  fastify.get("/agents/eligible-instances", async (_request, reply) => {
    const instances = await listEligibleInstances();
    return reply.send(instances.map((instance) => serializeInstanceStatus({ ...instance, agent: null })));
  });

  fastify.get("/agents/:agentId", async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const agent = await getAgentById(agentId);
    if (!agent) {
      return reply.status(404).send({ error: "Agente não encontrado." });
    }
    return reply.send(serializeAgent(agent));
  });

  fastify.post("/agents", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    try {
      const body = createAgentSchema.parse(request.body);
      const agent = await createAgent(body);
      return reply.status(201).send(serializeAgent(agent));
    } catch (err) {
      if (err instanceof AgentEligibilityError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      if (err instanceof z.ZodError) {
        const msg = err.issues.map((issue) => issue.message).join("; ");
        return reply.status(400).send({ error: msg || "Payload inválido" });
      }
      throw err;
    }
  });

  fastify.put("/agents/:agentId", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    try {
      const body = updateAgentWorkspaceSchema.parse(request.body);
      const agent = await updateAgentWorkspace(agentId, {
        ...body,
        chatProvider: body.chatProvider === undefined
          ? undefined
          : (isChatProviderId(body.chatProvider) ? body.chatProvider : null),
        openrouterModel: body.openrouterModel,
        memoryLimit: body.memoryLimit !== undefined ? normalizeMemoryLimit(body.memoryLimit) : undefined,
      });
      return reply.send(serializeAgent(agent));
    } catch (err) {
      if (err instanceof AgentEligibilityError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      if (err instanceof z.ZodError) {
        const msg = err.issues.map((issue) => issue.message).join("; ");
        return reply.status(400).send({ error: msg || "Payload inválido" });
      }
      throw err;
    }
  });

  fastify.delete("/agents/:agentId", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    try {
      const deleted = await deleteAgent(agentId);
      return reply.send({ success: true, ...deleted });
    } catch (err) {
      if (err instanceof AgentEligibilityError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  fastify.post("/instances", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    try {
      const body = createInstanceSchema.parse(request.body);
      const instance = await createInstance({ name: body.name });
      return reply.status(201).send(serializeInstanceStatus(instance));
    } catch (err) {
      if (err instanceof MaxWhatsAppInstancesError) {
        return reply.status(409).send({ error: err.message });
      }
      if (err instanceof z.ZodError) {
        const msg = err.issues.map((issue) => issue.message).join("; ");
        return reply.status(400).send({ error: msg || "Payload inválido" });
      }
      throw err;
    }
  });

  fastify.get("/instances/:instanceId/status", async (request, reply) => {
    const { instanceId } = request.params as { instanceId: string };
    const instance = await prisma.instance.findUnique({
      where: { id: instanceId },
      include: {
        agent: {
          select: { id: true, name: true, chatProvider: true, openrouterModel: true, memoryLimit: true },
        },
      },
    });
    if (!instance) {
      return reply.status(404).send({ error: "Instância não encontrada." });
    }
    return reply.send(serializeInstanceStatus(instance));
  });

  fastify.put("/instances/:instanceId/config", {
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const { instanceId } = request.params as { instanceId: string };
    const instance = await getInstanceById(instanceId);
    if (!instance) {
      return reply.status(404).send({ error: "Instância não encontrada." });
    }

    try {
      const body = updateInstanceSchema.parse(request.body);
      const updated = await prisma.instance.update({
        where: { id: instanceId },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.aiWhatsappEnabled !== undefined ? { aiWhatsappEnabled: body.aiWhatsappEnabled } : {}),
          ...(body.chatProvider !== undefined ? { chatProvider: isChatProviderId(body.chatProvider) ? body.chatProvider : null } : {}),
          ...(body.openrouterModel !== undefined ? { openrouterModel: body.openrouterModel } : {}),
          ...(body.memoryLimit !== undefined ? { memoryLimit: normalizeMemoryLimit(body.memoryLimit) } : {}),
        },
        include: {
          agent: {
            select: { id: true, name: true, chatProvider: true, openrouterModel: true, memoryLimit: true },
          },
        },
      });
      return reply.send(serializeInstanceStatus(updated));
    } catch (err) {
      if (err instanceof z.ZodError) {
        const msg = err.issues.map((issue) => issue.message).join("; ");
        return reply.status(400).send({ error: msg || "Payload inválido" });
      }
      throw err;
    }
  });

  fastify.post("/instances/:instanceId/start", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const { instanceId } = request.params as { instanceId: string };
    const instance = await getInstanceById(instanceId);
    if (!instance) {
      return reply.status(404).send({ error: "Instância não encontrada." });
    }

    try {
      await InstanceManager.start(instance.id, undefined, { userInitiated: true });
      const qr = await waitForQr(instance.id);
      return reply.send({ success: true, qr });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: "Falha ao iniciar conexão WhatsApp." });
    }
  });

  fastify.post("/instances/:instanceId/stop", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const { instanceId } = request.params as { instanceId: string };
    const instance = await getInstanceById(instanceId);
    if (!instance) {
      return reply.status(404).send({ error: "Instância não encontrada." });
    }

    try {
      await InstanceManager.stop(instance.id);
      return reply.send({ success: true });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: "Falha ao parar a instância." });
    }
  });

  fastify.delete("/instances/:instanceId", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const { instanceId } = request.params as { instanceId: string };
    try {
      const telegramStatus = TelegramBotManager.getStatus();
      const deleted = await deleteInstance(instanceId);

      if (!deleted) {
        return reply.status(404).send({ error: "Instância não encontrada." });
      }

      if (telegramStatus.instanceId === instanceId) {
        await TelegramBotManager.stop();
      }

      return reply.send({ success: true, id: deleted.id, name: deleted.name });
    } catch (err) {
      if (err instanceof InstanceLinkedAgentError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }

      throw err;
    }
  });

  fastify.get("/status", async (_request, reply) => {
    const agent = await getAgent();
    const telegram = TelegramBotManager.getStatus();
    return reply.send({
      id: agent.id,
      slot: agent.slot,
      name: agent.name,
      status: agent.status,
      qr: InstanceManager.getLastQr(agent.id),
      active: InstanceManager.isRunning(agent.id),
      aiWhatsappEnabled: agent.aiWhatsappEnabled,
      aiTelegramEnabled: agent.aiTelegramEnabled,
      telegram,
    });
  });

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

  fastify.post("/start", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (_request, reply) => {
    const agent = await getAgent();
    try {
      await InstanceManager.start(agent.id, undefined, { userInitiated: true });
      const qr = await waitForQr(agent.id);
      return reply.send({ success: true, qr });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: "Falha ao iniciar conexão WhatsApp." });
    }
  });

  fastify.post("/stop", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (_request, reply) => {
    const agent = await getAgent();
    try {
      await InstanceManager.stop(agent.id);
      return reply.send({ success: true });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: "Falha ao parar o agente." });
    }
  });

  fastify.get("/whatsapp-labels", async (_request, reply) => {
    const agent = await getAgent();
    if (!InstanceManager.isRunning(agent.id)) {
      return reply.status(503).send({
        error: "Conecte o agente para sincronizar etiquetas.",
        labels: [],
      });
    }

    const labels = getLabelsForInstance(agent.id).map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color,
    }));

    return reply.send({ labels });
  });

  fastify.post("/telegram/save-token", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const instance = await getOrCreateTelegramInstance();
    const body = z.object({ token: z.string().min(20, "Token inválido") }).parse(request.body);

    const result = await TelegramBotManager.saveAndStart(instance.id, body.token);
    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({
      success: true,
      message: "Token do Telegram salvo e bot iniciado!",
      status: TelegramBotManager.getStatus(),
    });
  });

  fastify.post("/telegram/start", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (_request, reply) => {
    const instance = await getTelegramInstance();
    if (!instance) {
      return reply.status(404).send({ error: "Instância Telegram não encontrada." });
    }

    const isConfigured = await TelegramBotManager.isConfigured(instance.id);

    if (!isConfigured) {
      return reply.status(400).send({ error: "Configure o token do Telegram antes de conectar." });
    }

    await TelegramBotManager.restartForInstance(instance.id);
    return reply.send({ success: true, status: TelegramBotManager.getStatus() });
  });

  fastify.post("/telegram/stop", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (_request, reply) => {
    await TelegramBotManager.stop();
    return reply.send({ success: true, status: TelegramBotManager.getStatus() });
  });

  fastify.delete("/telegram/token", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (_request, reply) => {
    const instance = await getTelegramInstance();
    if (!instance) {
      return reply.status(404).send({ error: "Instância Telegram não encontrada." });
    }

    await TelegramBotManager.stop();
    await prisma.instance.update({
      where: { id: instance.id },
      data: { telegramBotToken: null },
    });
    return reply.send({ success: true, message: "Token removido e bot parado." });
  });

  fastify.get("/telegram/status", async (_request, reply) => {
    const instance = await getTelegramInstance();
    if (!instance) {
      return reply.send({
        ...TelegramBotManager.getStatus(),
        configured: false,
        instanceId: undefined,
        instanceName: null,
        channel: "TELEGRAM" as const,
      });
    }

    const isConfigured = await TelegramBotManager.isConfigured(instance.id);
    return reply.send({
      ...TelegramBotManager.getStatus(),
      configured: isConfigured,
      instanceId: instance.id,
      instanceName: instance.name,
      channel: "TELEGRAM" as const,
    });
  });

  fastify.get("/telegram/config", async (_request, reply) => {
    return reply.send(await getTelegramConfigState());
  });

  fastify.put("/telegram/config", {
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const body = z.object({ telegramSystemPrompt: z.preprocess(emptyToNull, z.string().nullable().optional()) }).parse(request.body);
    const configState = await getTelegramConfigState();

    if (!configState.instanceId) {
      return reply.status(404).send({ error: "Instância Telegram não encontrada." });
    }

    if (!configState.canEdit || !configState.agentWorkspaceId) {
      return reply.status(409).send({ error: configState.blockingReason || "Vincule um agente ao Telegram antes de editar o prompt." });
    }

    await prisma.agent.update({
      where: { id: configState.agentWorkspaceId },
      data: { telegramSystemPrompt: body.telegramSystemPrompt ?? null },
    });

    return reply.send(await getTelegramConfigState());
  });

  fastify.post("/telegram/validate-token", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const body = z.object({ token: z.string().min(20, "Token inválido") }).parse(request.body);
    return reply.send(await TelegramBotManager.validateToken(body.token));
  });
}




