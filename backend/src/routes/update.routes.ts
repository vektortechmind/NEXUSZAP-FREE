import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { verifyJwt } from "../security/middlewares";
import {
  checkForUpdate,
  GITHUB_REPO,
  getCurrentUpdateJobLogs,
  getCurrentUpdateJob,
  getUpdateStatusPayload,
  startUpdateJob,
  UpdateConflictError,
} from "../services/update.service";
import { safeErrorMessage, safeLogError } from "../utils/redaction";

async function updateRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/update/status",
    { preHandler: [verifyJwt], config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const updateInfo = await getUpdateStatusPayload();
        return reply.send({
          currentVersion: updateInfo.currentVersion,
          latestVersion: updateInfo.latestVersion,
          hasUpdate: updateInfo.hasUpdate,
          releaseUrl: updateInfo.releaseUrl,
          changelog: updateInfo.changelog,
          githubRepo: GITHUB_REPO,
          job: updateInfo.job,
        });
      } catch (error) {
        const message = safeErrorMessage(error, "Erro desconhecido");
        fastify.log.error({ err: safeLogError(error) }, "Erro ao verificar update");
        return reply.status(500).send({ error: message });
      }
    }
  );

  fastify.get(
    "/update/job",
    { preHandler: [verifyJwt], config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      return reply.send({ job: getCurrentUpdateJob() });
    }
  );

  fastify.get<{ Querystring: { cursor?: string } }>(
    "/update/job/logs",
    { preHandler: [verifyJwt], config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (req: FastifyRequest<{ Querystring: { cursor?: string } }>, reply: FastifyReply) => {
      const parsedCursor = Number.parseInt(req.query.cursor ?? "0", 10);
      const cursor = Number.isFinite(parsedCursor) && parsedCursor > 0 ? parsedCursor : 0;
      return reply.send(getCurrentUpdateJobLogs(cursor));
    }
  );

  fastify.post(
    "/update/apply",
    { preHandler: [verifyJwt], config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const job = await startUpdateJob();
        return reply.status(202).send({
          success: true,
          message: "Atualização iniciada em background.",
          job,
        });
      } catch (error) {
        if (error instanceof UpdateConflictError) {
          return reply.status(error.statusCode).send({ success: false, error: error.message, job: getCurrentUpdateJob() });
        }
        const message = safeErrorMessage(error, "Erro desconhecido ao iniciar update");
        fastify.log.error({ err: safeLogError(error) }, "Erro ao iniciar update remoto");
        return reply.status(500).send({ success: false, error: message, job: getCurrentUpdateJob() });
      }
    }
  );
}

export default updateRoutes;
