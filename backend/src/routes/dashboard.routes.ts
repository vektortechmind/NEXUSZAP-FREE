import type { FastifyInstance, preValidationHookHandler } from "fastify";
import { z } from "zod";
import { env } from "../config/env";
import { verifyJwt } from "../security/middlewares";
import { getDashboardStats } from "../services/analytics/messageEvent.service";
import { integrationDashboardService } from "../services/integrations/integrationDashboard.service";

type DashboardRouteDeps = {
  statsService?: Pick<typeof dashboardStatsServiceBridge, "getDashboardStats">;
  integrationOverviewService?: Pick<typeof integrationDashboardService, "getOverview">;
  preValidationHook?: preValidationHookHandler;
};

const dashboardStatsServiceBridge = {
  getDashboardStats,
};

function resolveEndpointUrl(requestProtocol: string, requestHost: string | undefined): string | null {
  if (env.APP_URL) {
    return new URL("/api/integrations/events", env.APP_URL).toString();
  }

  const host = requestHost?.trim();
  if (!host) return null;
  return `${requestProtocol}://${host}/api/integrations/events`;
}

export function createDashboardRoutes(deps: DashboardRouteDeps = {}) {
  const statsService = deps.statsService ?? dashboardStatsServiceBridge;
  const overviewService = deps.integrationOverviewService ?? integrationDashboardService;
  const preValidationHook = deps.preValidationHook ?? verifyJwt;

  return async function dashboardRoutes(fastify: FastifyInstance) {
    fastify.addHook("preValidation", preValidationHook);

    const querySchema = z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      channel: z.enum(["WHATSAPP", "TELEGRAM"]).optional(),
    });

    fastify.get("/stats", async (request, reply) => {
      try {
        const filters = querySchema.parse(request.query);
        const stats = await statsService.getDashboardStats(filters);
        return reply.send(stats);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({ error: err.message });
        }
        throw err;
      }
    });

    fastify.get("/integrations", async (request, reply) => {
      const endpointUrl = resolveEndpointUrl(request.protocol, request.headers.host);
      const overview = await overviewService.getOverview({ endpointUrl });
      return reply.send(overview);
    });
  };
}

export const dashboardRoutes = createDashboardRoutes();
