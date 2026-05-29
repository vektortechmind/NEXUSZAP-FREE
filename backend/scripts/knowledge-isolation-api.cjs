"use strict";

const assert = require("assert");

require("ts-node/register");

const prismaModulePath = require.resolve("../src/database/prisma.ts");
const knowledgeServiceModulePath = require.resolve("../src/services/knowledgeService.ts");

delete require.cache[knowledgeServiceModulePath];
delete require.cache[prismaModulePath];

const queries = [];

require.cache[prismaModulePath] = {
  id: prismaModulePath,
  filename: prismaModulePath,
  loaded: true,
  exports: {
    prisma: {
      agent: {
        findUnique: async ({ where }) => {
          if (where.id === "agent-a") {
            return { id: "agent-a", instanceId: "instance-a" };
          }
          return null;
        },
      },
      instance: {
        findUnique: async ({ where }) => {
          if (where.id === "instance-a") return { id: "instance-a" };
          if (where.id === "instance-b") return { id: "instance-b" };
          return null;
        },
      },
      file: {
        findMany: async (input) => {
          queries.push(input);
          return [
            { id: "file-1", instanceId: input.where.instanceId, agentId: "agent-a", channel: input.where.channel },
            { id: "file-2", instanceId: input.where.instanceId, agentId: null, channel: input.where.channel },
          ];
        },
        update: async () => null,
      },
    },
  },
};

const {
  getKnowledgeOwnerByAgent,
  listKnowledgeFilesByAgent,
  listKnowledgeFilesByInstance,
} = require(knowledgeServiceModulePath);

(async () => {
  const owner = await getKnowledgeOwnerByAgent("agent-a");
  assert.deepEqual(owner, { id: "agent-a", instanceId: "instance-a" }, "owner por agente deve continuar resolvendo instanceId");

  const byAgent = await listKnowledgeFilesByAgent("agent-a", "WHATSAPP");
  assert.equal(byAgent.length, 2, "listagem por agente deve retornar os arquivos da instância");
  assert.deepEqual(queries[0].where, { instanceId: "instance-a", channel: "WHATSAPP" }, "listagem por agente deve filtrar somente por instanceId + channel");

  const byInstance = await listKnowledgeFilesByInstance("instance-b", "TELEGRAM");
  assert.equal(byInstance.length, 2, "listagem por instância deve retornar os arquivos da instância");
  assert.deepEqual(queries[1].where, { instanceId: "instance-b", channel: "TELEGRAM" }, "listagem por instância deve filtrar somente por instanceId + channel");

  const missingAgent = await listKnowledgeFilesByAgent("missing-agent", "WHATSAPP");
  assert.equal(missingAgent, null, "agente inexistente deve retornar null");

  const missingInstance = await listKnowledgeFilesByInstance("missing-instance", "WHATSAPP");
  assert.equal(missingInstance, null, "instância inexistente deve retornar null");

  console.log("knowledge-isolation-api: OK");
})().catch((error) => {
  console.error("knowledge-isolation-api:", error.message || error);
  process.exit(1);
});
