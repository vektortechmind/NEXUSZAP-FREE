#!/usr/bin/env node
/**
 * Script de debug para testar inicialização do backend
 * Executa: node debug-start.cjs
 */

const path = require("path");
const fs = require("fs");

function redact(value) {
  if (!value) return "❌";
  return "[REDACTED]";
}

console.log("\n╔═══════════════════════════════════════╗");
console.log("║       DEBUG - Backend Startup         ║");
console.log("╚═══════════════════════════════════════╝\n");

// Verificar .env
const envPath = path.join(__dirname, ".env");
if (!fs.existsSync(envPath)) {
  console.error("❌ ERRO: Arquivo .env não encontrado em:", envPath);
  console.error("   Crie o arquivo com as variáveis necessárias.");
  process.exit(1);
}
console.log("✅ Arquivo .env encontrado");

// Verificar se NODE_MODULES existe
const nmPath = path.join(__dirname, "node_modules");
if (!fs.existsSync(nmPath)) {
  console.error("❌ ERRO: node_modules não encontrado!");
  console.error("   Execute: npm install");
  process.exit(1);
}
console.log("✅ node_modules encontrado");

// Verificar se Prisma está gerado
const prismaPath = path.join(__dirname, "node_modules", ".prisma", "client");
if (!fs.existsSync(prismaPath)) {
  console.warn("⚠️  AVISO: Prisma não foi gerado ainda");
  console.warn("   Isso será feito durante ts-node...\n");
}

// Carregar .env
require("dotenv").config({ path: envPath });

console.log("\n📋 Variáveis de Ambiente:");
console.log("   DATABASE_URL:", redact(process.env.DATABASE_URL));
console.log("   PORT:", process.env.PORT);
console.log("   JWT_SECRET:", process.env.JWT_SECRET ? "✅" : "❌");
console.log("   ADMIN_EMAIL:", redact(process.env.ADMIN_EMAIL));
console.log("   ENCRYPTION_KEY:", process.env.ENCRYPTION_KEY ? "✅" : "❌");

// Tentar iniciar
console.log("\n🚀 Iniciando servidor com ts-node...\n");

const { spawn } = require("child_process");
const child = spawn("npx", ["ts-node-dev", "--respawn", "--transpile-only", "src/server.ts"], {
  cwd: __dirname,
  stdio: "inherit",
  shell: process.platform === "win32"
});

child.on("error", (err) => {
  console.error("\n❌ Erro ao iniciar:", err.message);
  process.exit(1);
});

child.on("exit", (code) => {
  console.error(`\n❌ Servidor encerrou com código ${code}`);
  process.exit(code || 1);
});

process.on("SIGINT", () => {
  child.kill();
  process.exit(0);
});
