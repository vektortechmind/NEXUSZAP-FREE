import { prisma } from "../../database/prisma";
import { deleteKnowledgeBinary } from "../knowledge/fileStorage.service";
import { InstanceManager } from "../../whatsapp/InstanceManager";

export const TELEGRAM_INSTANCE_SLOT = 0;
export const MAX_WHATSAPP_INSTANCES = 5;
export const WHATSAPP_INSTANCE_SLOTS = Array.from({ length: MAX_WHATSAPP_INSTANCES }, (_, index) => index + 1);

export class MaxWhatsAppInstancesError extends Error {
  constructor() {
    super(`Limite de ${MAX_WHATSAPP_INSTANCES} instâncias WhatsApp atingido.`);
    this.name = "MAX_WHATSAPP_INSTANCES";
  }
}

type CreateInstanceInput = {
  name: string;
};

export function findNextWhatsAppSlot(existingSlots: number[]): number | null {
  const occupiedSlots = new Set(existingSlots.filter((slot) => slot > TELEGRAM_INSTANCE_SLOT));
  return WHATSAPP_INSTANCE_SLOTS.find((slot) => !occupiedSlots.has(slot)) ?? null;
}

export async function listInstances() {
  return prisma.instance.findMany({
    where: { slot: { gt: TELEGRAM_INSTANCE_SLOT } },
    orderBy: { slot: "asc" },
  });
}

export async function getPrimaryInstance() {
  return prisma.instance.findFirst({
    where: { slot: { gt: TELEGRAM_INSTANCE_SLOT } },
    orderBy: { slot: "asc" },
  });
}

export async function getTelegramInstance() {
  return prisma.instance.findUnique({ where: { slot: TELEGRAM_INSTANCE_SLOT } });
}

export async function getOrCreateTelegramInstance() {
  const existing = await getTelegramInstance();
  if (existing) return existing;

  return prisma.instance.create({
    data: {
      slot: TELEGRAM_INSTANCE_SLOT,
      name: "Telegram",
      typing: true,
      delayMin: 4000,
      delayMax: 7000,
    },
  });
}

export async function getOrCreatePrimaryInstance() {
  const existing = await getPrimaryInstance();
  if (existing) return existing;

  return prisma.instance.create({
    data: {
      slot: 1,
      name: "Agente Principal",
      typing: true,
      delayMin: 4000,
      delayMax: 7000,
    },
  });
}

export async function createInstance(input: CreateInstanceInput) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.instance.findMany({
      select: { slot: true },
      orderBy: { slot: "asc" },
    });

    const whatsappInstances = existing.filter((instance) => instance.slot > TELEGRAM_INSTANCE_SLOT);

    if (whatsappInstances.length >= MAX_WHATSAPP_INSTANCES) {
      throw new MaxWhatsAppInstancesError();
    }

    const nextSlot = findNextWhatsAppSlot(whatsappInstances.map((instance) => instance.slot));

    if (!nextSlot) {
      throw new MaxWhatsAppInstancesError();
    }

    return tx.instance.create({
      data: {
        slot: nextSlot,
        name: input.name,
        typing: true,
        delayMin: 4000,
        delayMax: 7000,
      },
    });
  });
}

export async function getInstanceById(instanceId: string) {
  return prisma.instance.findUnique({ where: { id: instanceId } });
}

export async function deleteInstance(instanceId: string) {
  const instance = await prisma.instance.findUnique({
    where: { id: instanceId },
    include: {
      agent: {
        select: { id: true },
      },
    },
  });

  if (!instance) {
    return null;
  }

  if (InstanceManager.isRunning(instanceId) || instance.status === "CONNECTED" || instance.status === "RECONNECTING") {
    await InstanceManager.stop(instanceId);
  }

  const files = await prisma.file.findMany({
    where: { instanceId },
    select: { id: true, storagePath: true },
  });

  for (const file of files) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- Physical knowledge files must be removed deterministically before deleting their database records.
    await deleteKnowledgeBinary(file.storagePath);
  }

  await prisma.$transaction(async (tx) => {
    await tx.file.deleteMany({
      where: { instanceId },
    });

    if (instance.agent) {
      await tx.agent.delete({
        where: { id: instance.agent.id },
      });
    }

    await tx.session.deleteMany({ where: { instanceId } });

    await tx.instance.delete({ where: { id: instanceId } });
  });

  return instance;
}
