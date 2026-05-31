import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  AgentEligibilityError,
  createAgent,
  deleteAgent,
  getAgentById,
  listAgents,
  listEligibleInstances,
  updateAgentWorkspace,
} from "../../services/agents/agent.service";
import {
  createAgentSchema,
  isChatProviderId,
  normalizeMemoryLimit,
  serializeAgent,
  serializeInstanceStatus,
  updateAgentWorkspaceSchema,
} from "./shared";

export async function agentWorkspaceRoutes(fastify: FastifyInstance) {
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
        openaiModel: body.openaiModel,
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
}
