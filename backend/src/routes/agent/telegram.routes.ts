import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../database/prisma";
import { getOrCreateTelegramInstance, getTelegramInstance } from "../../services/instances/instance.service";
import { TelegramBotManager } from "../../telegram/TelegramBotManager";
import { emptyToNull } from "./shared";

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

export async function agentTelegramRoutes(fastify: FastifyInstance) {
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
