import { type MessageChannel as PrismaMessageChannel, type MessageDirection as PrismaMessageDirection, Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { safeLogError } from "../../utils/redaction";

export type MessageChannel = PrismaMessageChannel;
export type MessageDirection = PrismaMessageDirection;

type RecordMessageEventInput = {
  instanceId: string;
  channel: MessageChannel;
  direction: MessageDirection;
  usedAi: boolean;
  createdAt?: Date;
};

type DashboardFilter = {
  startDate?: string;
  endDate?: string;
  channel?: MessageChannel;
};

type DashboardMessagePoint = {
  date: string;
  channel: MessageChannel;
  inboundCount: number;
  outboundCount: number;
  withAiCount: number;
  withoutAiCount: number;
  totalCount: number;
};

export async function recordMessageEvent(input: RecordMessageEventInput) {
  try {
    await prisma.messageEvent.create({
      data: {
        instanceId: input.instanceId,
        channel: input.channel,
        direction: input.direction,
        usedAi: input.usedAi,
        createdAt: input.createdAt,
      },
    });
  } catch (err) {
    console.error("[MessageEvent] Falha ao registrar evento:", safeLogError(err));
  }
}

export async function getDashboardStats(filters: DashboardFilter) {
  const whereClause: Prisma.MessageEventWhereInput = {};

  if (filters.startDate || filters.endDate) {
    whereClause.createdAt = {};
    if (filters.startDate) {
      whereClause.createdAt.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      whereClause.createdAt.lte = end;
    }
  }

  if (filters.channel) {
    whereClause.channel = filters.channel;
  }

  const [events, totalKnowledgeFiles] = await Promise.all([
    prisma.messageEvent.findMany({
      where: whereClause,
      orderBy: { createdAt: "asc" },
      select: {
        createdAt: true,
        channel: true,
        direction: true,
        usedAi: true,
      },
    }),
    prisma.file.count({
      where: filters.channel ? { channel: filters.channel } : undefined,
    }),
  ]);

  const grouped = new Map<string, DashboardMessagePoint>();
  let totalMessages = 0;
  let totalInbound = 0;
  let totalOutbound = 0;
  let totalWithAi = 0;
  let totalWithoutAi = 0;
  let whatsappMessages = 0;
  let telegramMessages = 0;

  for (const event of events) {
    const date = event.createdAt.toISOString().split("T")[0];
    const key = `${date}:${event.channel}`;
    const current = grouped.get(key) ?? {
      date,
      channel: event.channel,
      inboundCount: 0,
      outboundCount: 0,
      withAiCount: 0,
      withoutAiCount: 0,
      totalCount: 0,
    };

    current.totalCount += 1;
    totalMessages += 1;

    if (event.direction === "INBOUND") {
      current.inboundCount += 1;
      totalInbound += 1;
    } else {
      current.outboundCount += 1;
      totalOutbound += 1;
    }

    if (event.usedAi) {
      current.withAiCount += 1;
      totalWithAi += 1;
    } else {
      current.withoutAiCount += 1;
      totalWithoutAi += 1;
    }

    if (event.channel === "WHATSAPP") {
      whatsappMessages += 1;
    } else {
      telegramMessages += 1;
    }

    grouped.set(key, current);
  }

  return {
    messages: Array.from(grouped.values()),
    summary: {
      totalMessages,
      totalInbound,
      totalOutbound,
      totalWithAi,
      totalWithoutAi,
      whatsappMessages,
      telegramMessages,
      totalKnowledgeFiles,
    },
  };
}
