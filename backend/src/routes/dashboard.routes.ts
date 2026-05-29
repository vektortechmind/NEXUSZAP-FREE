import type { FastifyInstance, preValidationHookHandler } from "fastify";
import { z } from "zod";
import { env } from "../config/env";
import { verifyJwt } from "../security/middlewares";
import { getDashboardStats } from "../services/analytics/messageEvent.service";
import {
  ActiveIntegrationCredentialExistsError,
  IntegrationCredentialNotFoundError,
} from "../services/integrations/integrationAuth.service";
import { integrationCredentialsSurfaceService } from "../services/integrations/integrationCredentialsSurface.service";
import { integrationDashboardService } from "../services/integrations/integrationDashboard.service";

type DashboardRouteDeps = {
  statsService?: Pick<typeof dashboardStatsServiceBridge, "getDashboardStats">;
  integrationOverviewService?: Pick<typeof integrationDashboardService, "getOverview">;
  integrationCredentialsService?: Pick<typeof integrationCredentialsSurfaceService, "getWorkspace" | "getInstanceDetail" | "issueInstanceCredential" | "rotateInstanceCredential">;
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
  const credentialsService = deps.integrationCredentialsService ?? integrationCredentialsSurfaceService;
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

    const instanceParamsSchema = z.object({
      instanceId: z.string().trim().min(1).max(191),
    });

    fastify.get("/integrations/credentials", async (request, reply) => {
      const endpointUrl = resolveEndpointUrl(request.protocol, request.headers.host);
      const workspace = await credentialsService.getWorkspace({ endpointUrl });
      return reply.send(workspace);
    });

    fastify.get("/integrations/credentials/:instanceId", async (request, reply) => {
      try {
        const { instanceId } = instanceParamsSchema.parse(request.params);
        const endpointUrl = resolveEndpointUrl(request.protocol, request.headers.host);
        const detail = await credentialsService.getInstanceDetail({ instanceId, endpointUrl });
        return reply.send(detail);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({ error: err.message });
        }
        if (err instanceof IntegrationCredentialNotFoundError) {
          return reply.status(404).send({ error: err.message, code: err.code });
        }
        throw err;
      }
    });

    fastify.post("/integrations/credentials/:instanceId/issue", async (request, reply) => {
      try {
        const { instanceId } = instanceParamsSchema.parse(request.params);
        const endpointUrl = resolveEndpointUrl(request.protocol, request.headers.host);
        const detail = await credentialsService.issueInstanceCredential({ instanceId, endpointUrl });
        return reply.status(201).send(detail);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({ error: err.message });
        }
        if (err instanceof IntegrationCredentialNotFoundError) {
          return reply.status(404).send({ error: err.message, code: err.code });
        }
        if (err instanceof ActiveIntegrationCredentialExistsError) {
          return reply.status(409).send({ error: err.message, code: err.code });
        }
        throw err;
      }
    });

    fastify.post("/integrations/credentials/:instanceId/rotate", async (request, reply) => {
      try {
        const { instanceId } = instanceParamsSchema.parse(request.params);
        const endpointUrl = resolveEndpointUrl(request.protocol, request.headers.host);
        const detail = await credentialsService.rotateInstanceCredential({ instanceId, endpointUrl });
        return reply.send(detail);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({ error: err.message });
        }
        if (err instanceof IntegrationCredentialNotFoundError) {
          return reply.status(404).send({ error: err.message, code: err.code });
        }
        throw err;
      }
    });
  };
}

export const dashboardRoutes = createDashboardRoutes();
