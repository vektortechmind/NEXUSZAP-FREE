import { FastifyInstance } from "fastify";
import { verifyJwt } from "../security/middlewares";
import { prisma } from "../database/prisma";
import { z } from "zod";

export async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook("preValidation", verifyJwt);

  const querySchema = z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    channel: z.enum(["WHATSAPP", "TELEGRAM"]).optional(),
  });

  fastify.get("/stats", async (request, reply) => {
    try {
      const { startDate, endDate, channel } = querySchema.parse(request.query);

      // Filtro de data
      const whereClause: any = {};
      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) whereClause.createdAt.gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          whereClause.createdAt.lte = end;
        }
      }

      // Filtro de canal
      if (channel) {
        whereClause.channel = channel;
      }

      // Buscar mensagens agrupadas por data e canal
      // Buscar todas as entradas e agrupar no código
      const allFiles = await prisma.file.findMany({
        where: whereClause,
        orderBy: { createdAt: "asc" },
      });

      // Agrupar por data e canal
      const messagesByDateAndChannel = new Map<string, Map<string, number>>();
      
      for (const file of allFiles) {
        const date = file.createdAt.toISOString().split("T")[0];
        const channelKey = file.channel;
        
        if (!messagesByDateAndChannel.has(date)) {
          messagesByDateAndChannel.set(date, new Map());
        }
        
        const channelMap = messagesByDateAndChannel.get(date)!;
        channelMap.set(channelKey, (channelMap.get(channelKey) || 0) + 1);
      }

      // Converter para array
      const messages: Array<{ date: string; channel: "WHATSAPP" | "TELEGRAM"; count: number }> = [];
      
      for (const [date, channelMap] of messagesByDateAndChannel.entries()) {
        for (const [channelKey, count] of channelMap.entries()) {
          messages.push({
            date,
            channel: channelKey as "WHATSAPP" | "TELEGRAM",
            count,
          });
        }
      }

      return reply.send({
        messages,
        totalFiles: allFiles.length,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: err.message });
      }
      throw err;
    }
  });
}
