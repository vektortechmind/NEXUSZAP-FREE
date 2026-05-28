import { Prisma } from "@prisma/client";
import { prisma } from "../database/prisma";
import { getOrCreatePrimaryInstance } from "./instance.service";

export class AgentEligibilityError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 409) {
    super(message);
    this.name = "AGENT_ELIGIBILITY_ERROR";
    this.statusCode = statusCode;
  }
}

function deriveAgentName(instance: {
  slot: number;
  name: string;
  agentName: string | null;
}) {
  const explicit = instance.agentName?.trim();
  if (explicit) return explicit;

  const fallbackName = instance.name.trim();
  if (fallbackName) return fallbackName;

  return `Agente ${instance.slot}`;
}

export async function listAgents() {
  return prisma.agent.findMany({
    include: {
      instance: {
        select: { id: true, slot: true, name: true, status: true },
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });
}

export async function getAgentById(agentId: string) {
  return prisma.agent.findUnique({
    where: { id: agentId },
    include: {
      instance: true,
    },
  });
}

export async function listEligibleInstances() {
  return prisma.instance.findMany({
    where: {
      status: "CONNECTED",
      agent: null,
    },
    orderBy: { slot: "asc" },
    select: {
      id: true,
      slot: true,
      name: true,
      status: true,
      aiWhatsappEnabled: true,
    },
  });
}

export async function ensureAgentForInstanceTx(
  tx: Prisma.TransactionClient,
  instanceId: string
) {
  const instance = await tx.instance.findUnique({
    where: { id: instanceId },
    include: { agent: true },
  });

  if (!instance) {
    throw new AgentEligibilityError("Instância não encontrada.", 404);
  }

  if (instance.agent) {
    return tx.agent.findUniqueOrThrow({
      where: { id: instance.agent.id },
      include: { instance: true },
    });
  }

  const agentName = deriveAgentName(instance);

    const agent = await tx.agent.create({
      data: {
        name: agentName,
        instanceId: instance.id,
        telegramEnabled: true,
        systemPrompt: instance.systemPrompt,
        telegramSystemPrompt: instance.telegramSystemPrompt,
        voiceEnabled: false,
      },
      include: { instance: true },
    });

  await tx.instance.update({
    where: { id: instance.id },
    data: { agentName },
  });

  await tx.file.updateMany({
    where: {
      instanceId: instance.id,
      agentId: null,
    },
    data: {
      agentId: agent.id,
    },
  });

  return agent;
}

export async function ensureAgentForInstance(instanceId: string) {
  return prisma.$transaction((tx) => ensureAgentForInstanceTx(tx, instanceId));
}

export async function getOrCreatePrimaryAgent() {
  const instance = await getOrCreatePrimaryInstance();
  return ensureAgentForInstance(instance.id);
}

export async function createAgent(input: { name: string; instanceId: string }) {
  return prisma.$transaction(async (tx) => {
    const instance = await tx.instance.findUnique({
      where: { id: input.instanceId },
      include: { agent: true },
    });

    if (!instance) {
      throw new AgentEligibilityError("Instância não encontrada.", 404);
    }

    if (instance.status !== "CONNECTED") {
      throw new AgentEligibilityError("Selecione uma instância conectada.");
    }

    if (instance.agent) {
      throw new AgentEligibilityError("Esta instância já está vinculada a outro agente.");
    }

    const agent = await tx.agent.create({
      data: {
        name: input.name,
        instanceId: input.instanceId,
        telegramEnabled: true,
        systemPrompt: instance.systemPrompt,
        telegramSystemPrompt: instance.telegramSystemPrompt,
        voiceEnabled: false,
      },
      include: {
        instance: true,
      },
    });

    await tx.instance.update({
      where: { id: input.instanceId },
      data: {
        agentName: input.name,
      },
    });

    await tx.file.updateMany({
      where: {
        instanceId: input.instanceId,
        agentId: null,
      },
      data: {
        agentId: agent.id,
      },
    });

    return agent;
  });
}

export async function updateAgentWorkspace(
  agentId: string,
  input: {
    name?: string;
    systemPrompt?: string | null;
    voiceEnabled?: boolean;
    voiceProvider?: string | null;
    voiceModel?: string | null;
    voicePersona?: string | null;
  }
) {
  return prisma.$transaction(async (tx) => {
    const agent = await tx.agent.findUnique({
      where: { id: agentId },
      include: { instance: true },
    });

    if (!agent) {
      throw new AgentEligibilityError("Agente não encontrado.", 404);
    }

    const nextName = input.name?.trim();
    await tx.agent.update({
      where: { id: agentId },
      data: {
        ...(nextName ? { name: nextName } : {}),
        ...(input.systemPrompt !== undefined ? { systemPrompt: input.systemPrompt } : {}),
        ...(input.voiceEnabled !== undefined ? { voiceEnabled: input.voiceEnabled } : {}),
        ...(input.voiceProvider !== undefined ? { voiceProvider: input.voiceProvider } : {}),
        ...(input.voiceModel !== undefined ? { voiceModel: input.voiceModel } : {}),
        ...(input.voicePersona !== undefined ? { voicePersona: input.voicePersona } : {}),
      },
    });

    await tx.instance.update({
      where: { id: agent.instanceId },
      data: {
        ...(nextName ? { agentName: nextName } : {}),
      },
    });

    return tx.agent.findUniqueOrThrow({
      where: { id: agentId },
      include: { instance: true },
    });
  });
}
