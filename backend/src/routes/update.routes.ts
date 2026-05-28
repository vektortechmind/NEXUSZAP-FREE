import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { verifyJwt } from "../security/middlewares";
import {
  checkForUpdate,
  CURRENT_VERSION,
  GITHUB_REPO,
} from "../services/update.service";
import { safeErrorMessage, safeLogError } from "../utils/redaction";

async function updateRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/update/status",
    { preHandler: [verifyJwt], config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const updateInfo = await checkForUpdate();
        return reply.send({
          currentVersion: updateInfo.currentVersion,
          latestVersion: updateInfo.latestVersion,
          hasUpdate: updateInfo.hasUpdate,
          releaseUrl: updateInfo.releaseUrl,
          changelog: updateInfo.changelog,
          githubRepo: GITHUB_REPO,
        });
      } catch (error) {
        const message = safeErrorMessage(error, "Erro desconhecido");
        fastify.log.error({ err: safeLogError(error) }, "Erro ao verificar update");
        return reply.status(500).send({ error: message });
      }
    }
  );

  fastify.post(
    "/update/apply",
    { preHandler: [verifyJwt], config: { rateLimit: { max: 2, timeWindow: "1 minute" } } },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      return reply.status(410).send({
        success: false,
        error: "Apply remoto desativado por seguranca. Use o runbook de atualizacao manual.",
      });
    }
  );
}

export default updateRoutes;
