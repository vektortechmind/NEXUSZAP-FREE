import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { deleteKnowledgeBinary } from "../knowledge/fileStorage.service";
import { getOrCreatePrimaryInstance, getPrimaryInstance, TELEGRAM_INSTANCE_SLOT } from "../instances/instance.service";

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
      slot: { gt: TELEGRAM_INSTANCE_SLOT },
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
      chatProvider: instance.chatProvider,
      openaiModel: instance.openaiModel,
      openrouterModel: instance.openrouterModel,
      memoryLimit: instance.memoryLimit,
      audioTranscriptionEnabled: false,
    },
    include: { instance: true },
  });

  await Promise.all([
    tx.instance.update({
      where: { id: instance.id },
      data: { agentName },
    }),
    tx.file.updateMany({
      where: {
        instanceId: instance.id,
        agentId: null,
      },
      data: {
        agentId: agent.id,
      },
    }),
  ]);

  return agent;
}

export async function ensureAgentForInstance(instanceId: string) {
  return prisma.$transaction((tx) => ensureAgentForInstanceTx(tx, instanceId));
}

export async function getOrCreatePrimaryAgent() {
  const instance = await getOrCreatePrimaryInstance();
  return ensureAgentForInstance(instance.id);
}

export async function getPrimaryAgent() {
  const instance = await getPrimaryInstance();
  if (!instance) return null;
  return prisma.agent.findUnique({
    where: { instanceId: instance.id },
    include: { instance: true },
  });
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
        chatProvider: instance.chatProvider,
        openaiModel: instance.openaiModel,
        openrouterModel: instance.openrouterModel,
        memoryLimit: instance.memoryLimit,
        audioTranscriptionEnabled: false,
      },
      include: {
        instance: true,
      },
    });

    await Promise.all([
      tx.instance.update({
        where: { id: input.instanceId },
        data: {
          agentName: input.name,
        },
      }),
      tx.file.updateMany({
        where: {
          instanceId: input.instanceId,
          agentId: null,
        },
        data: {
          agentId: agent.id,
        },
      }),
    ]);

    return agent;
  });
}

export async function updateAgentWorkspace(
  agentId: string,
  input: {
    name?: string;
    systemPrompt?: string | null;
    chatProvider?: string | null;
    openaiModel?: string | null;
    openrouterModel?: string | null;
    memoryLimit?: number;
    audioTranscriptionEnabled?: boolean;
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
    await Promise.all([
      tx.agent.update({
        where: { id: agentId },
        data: {
          ...(nextName ? { name: nextName } : {}),
          ...(input.systemPrompt !== undefined ? { systemPrompt: input.systemPrompt } : {}),
          ...(input.chatProvider !== undefined ? { chatProvider: input.chatProvider } : {}),
          ...(input.openaiModel !== undefined ? { openaiModel: input.openaiModel } : {}),
          ...(input.openrouterModel !== undefined ? { openrouterModel: input.openrouterModel } : {}),
          ...(input.memoryLimit !== undefined ? { memoryLimit: input.memoryLimit } : {}),
          ...(input.audioTranscriptionEnabled !== undefined ? { audioTranscriptionEnabled: input.audioTranscriptionEnabled } : {}),
        },
      }),
      tx.instance.update({
        where: { id: agent.instanceId },
        data: {
          ...(nextName ? { agentName: nextName } : {}),
        },
      }),
    ]);

    return tx.agent.findUniqueOrThrow({
      where: { id: agentId },
      include: { instance: true },
    });
  });
}

export async function deleteAgent(agentId: string) {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: { instance: true },
  });

  if (!agent) {
    throw new AgentEligibilityError("Agente não encontrado.", 404);
  }

  const files = await prisma.file.findMany({
    where: { agentId: agent.id },
    select: { id: true, storagePath: true },
  });

  for (const file of files) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- Physical knowledge files must be removed deterministically before deleting their database records.
    await deleteKnowledgeBinary(file.storagePath);
  }

  await prisma.$transaction(async (tx) => {
    await tx.file.deleteMany({
      where: { agentId: agent.id },
    });

    await Promise.all([
      tx.agent.delete({
        where: { id: agent.id },
      }),
      tx.instance.update({
        where: { id: agent.instanceId },
        data: { agentName: null },
      }),
    ]);
  });

  return {
    id: agent.id,
    name: agent.name,
    instanceId: agent.instanceId,
    instanceName: agent.instance.name,
  };
}
