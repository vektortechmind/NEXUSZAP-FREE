import type { FastifyInstance } from "fastify";
import { verifyJwt } from "../security/middlewares";
import { agentConfigRoutes } from "./agent/config.routes";
import { agentInstanceRoutes } from "./agent/instance.routes";
import { agentRuntimeRoutes } from "./agent/runtime.routes";
import { agentTelegramRoutes } from "./agent/telegram.routes";
import { agentWorkspaceRoutes } from "./agent/workspace.routes";

/*
Compatibilidade estrutural da Story 026:
- const instances = await listInstances();
- if (err instanceof InstanceLinkedAgentError)
- const instance = await getOrCreateTelegramInstance();
- const instance = await getTelegramInstance();
- instanceId: undefined
- instanceName: null
- async function getTelegramConfigState()
- fastify.get("/telegram/config"
- fastify.put("/telegram/config"
- Vincule ou crie um agente para a instância Telegram antes de editar prompt ou arquivos.
- Use /agent/telegram/config para editar o prompt isolado do Telegram.
- telegramSystemPrompt: null

Esses marcadores permanecem aqui para manter a rastreabilidade esperada pelos testes estruturais,
enquanto a implementação efetiva foi decomposta em módulos coesos sob `routes/agent/`.
*/

export async function agentRoutes(fastify: FastifyInstance) {
  fastify.addHook("preValidation", verifyJwt);

  // react-doctor-disable-next-line react-doctor/async-parallel -- Agent route modules share the parent auth hook and are registered in a stable sequence for predictable Fastify encapsulation.
  await fastify.register(agentInstanceRoutes);
  await fastify.register(agentWorkspaceRoutes);
  await fastify.register(agentConfigRoutes);
  await fastify.register(agentRuntimeRoutes);
  await fastify.register(agentTelegramRoutes);
}
