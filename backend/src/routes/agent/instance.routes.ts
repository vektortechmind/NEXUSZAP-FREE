import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../database/prisma";
import {
  createInstance,
  deleteInstance,
  getInstanceById,
  listInstances,
  MaxWhatsAppInstancesError,
} from "../../services/instances/instance.service";
import { TelegramBotManager } from "../../telegram/TelegramBotManager";
import { InstanceManager } from "../../whatsapp/InstanceManager";
import {
  CHAT_PROVIDER_OPTIONS,
  createInstanceSchema,
  isChatProviderId,
  normalizeMemoryLimit,
  serializeInstanceStatus,
  updateInstanceSchema,
  waitForQr,
} from "./shared";

export async function agentInstanceRoutes(fastify: FastifyInstance) {
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
          select: { id: true, name: true, chatProvider: true, openaiModel: true, openrouterModel: true, memoryLimit: true },
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
          select: { id: true, name: true, chatProvider: true, openaiModel: true, openrouterModel: true, memoryLimit: true },
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
          ...(body.openaiModel !== undefined ? { openaiModel: body.openaiModel } : {}),
          ...(body.openrouterModel !== undefined ? { openrouterModel: body.openrouterModel } : {}),
          ...(body.memoryLimit !== undefined ? { memoryLimit: normalizeMemoryLimit(body.memoryLimit) } : {}),
        },
        include: {
          agent: {
            select: { id: true, name: true, chatProvider: true, openaiModel: true, openrouterModel: true, memoryLimit: true },
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
    const telegramStatus = TelegramBotManager.getStatus();
    const deleted = await deleteInstance(instanceId);

    if (!deleted) {
      return reply.status(404).send({ error: "Instância não encontrada." });
    }

    if (telegramStatus.instanceId === instanceId) {
      await TelegramBotManager.stop();
    }

    return reply.send({ success: true, id: deleted.id, name: deleted.name });
  });
}
