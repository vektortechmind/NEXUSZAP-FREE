import { FastifyInstance } from "fastify";
import { z } from "zod";
import { verifyJwt } from "../security/middlewares";
import { getDashboardStats } from "../services/messageEvent.service";

export async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook("preValidation", verifyJwt);

  const querySchema = z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    channel: z.enum(["WHATSAPP", "TELEGRAM"]).optional(),
  });

  fastify.get("/stats", async (request, reply) => {
    try {
      const filters = querySchema.parse(request.query);
      const stats = await getDashboardStats(filters);
      return reply.send(stats);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: err.message });
      }
      throw err;
    }
  });
}
