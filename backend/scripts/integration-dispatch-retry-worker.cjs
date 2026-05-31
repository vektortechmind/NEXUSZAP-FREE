"use strict";

require("dotenv/config");
require("ts-node/register");

const { integrationDispatchRetryWorker } = require("../src/services/integrations/integrationDispatchRetry.service.ts");
const { prisma } = require("../src/database/prisma.ts");

function readLimit(argv) {
  const index = argv.indexOf("--limit");
  if (index === -1) return undefined;
  const value = Number(argv[index + 1]);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("--limit deve ser um inteiro positivo.");
  }
  return value;
}

(async () => {
  const limit = readLimit(process.argv.slice(2));
  const result = await integrationDispatchRetryWorker.processDue({ limit });
  console.log(JSON.stringify({ success: true, result }, null, 2));
})().catch((error) => {
  console.error(JSON.stringify({
    success: false,
    error: {
      message: error instanceof Error ? error.message : String(error),
    },
  }, null, 2));
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
