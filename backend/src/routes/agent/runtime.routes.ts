import type { FastifyInstance } from "fastify";
import { getOrCreatePrimaryInstance } from "../../services/instance.service";
import { getLabelsForInstance } from "../../whatsapp/labelsCache";
import { InstanceManager } from "../../whatsapp/InstanceManager";
import { waitForQr } from "./shared";

async function getPrimaryRuntimeInstance() {
  return getOrCreatePrimaryInstance();
}

export async function agentRuntimeRoutes(fastify: FastifyInstance) {
  fastify.get("/status", async (_request, reply) => {
    const agent = await getPrimaryRuntimeInstance();
    const telegram = (await import("../../telegram/TelegramBotManager")).TelegramBotManager.getStatus();
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

  fastify.post("/start", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (_request, reply) => {
    const agent = await getPrimaryRuntimeInstance();
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
    const agent = await getPrimaryRuntimeInstance();
    try {
      await InstanceManager.stop(agent.id);
      return reply.send({ success: true });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: "Falha ao parar o agente." });
    }
  });

  fastify.get("/whatsapp-labels", async (_request, reply) => {
    const agent = await getPrimaryRuntimeInstance();
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
}
