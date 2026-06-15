"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const appRoot = path.resolve(__dirname, "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(appRoot, rel), "utf8");
}

function assertNo(rel, patterns) {
  const text = read(rel);
  for (const pattern of patterns) {
    assert.ok(!pattern.test(text), `${rel} nao deve conter ${pattern}`);
  }
}

function functionBody(source, name) {
  const marker = `${name}() {`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `${name} deve existir`);
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`${name} deve ter corpo delimitado`);
}

const activeFiles = [
  "README.md",
  "install.sh",
  "update.sh",
  "scripts/setup-env.sh",
  "docker-compose.yml",
  "backend/.env.example",
  "backend/Dockerfile",
  "backend/scripts/backup-db.cjs",
  "backend/src/utils/prismaErrorHandler.ts",
];

for (const rel of activeFiles) {
  assertNo(rel, [`file:${"."}/chatbot${"."}db`, "SQL" + "ite", "accept" + "-data" + "-loss"].map((value) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")));
}

assert.ok(
  read("backend/Dockerfile").includes("npx prisma migrate deploy"),
  "Dockerfile deve aplicar migrations com prisma migrate deploy"
);
assert.ok(
  read("backend/package.json").includes('"db:migrate:deploy": "prisma migrate deploy"'),
  "backend/package.json deve expor db:migrate:deploy"
);
assert.ok(
  fs.existsSync(path.join(appRoot, "backend", "prisma", "migrations", "migration_lock.toml")),
  "migration_lock.toml deve existir"
);
assert.ok(
  fs.existsSync(path.join(appRoot, "backend", "prisma", "migrations", "20260527000000_init_postgresql", "migration.sql")),
  "migration inicial PostgreSQL deve existir"
);
assert.ok(
  !fs.existsSync(path.join(appRoot, "frontend", ".env.production.local")),
  "frontend/.env.production.local nao deve existir"
);
assert.ok(
  !fs.existsSync(path.join(appRoot, "backend", "src", "routes", "stats.routes.ts")),
  "stats.routes.ts morto deve ser removido"
);
assert.ok(
  read("backend/src/utils/ai/memoryManager.ts").includes("enforceMaxConversations"),
  "memoryManager deve limitar numero de conversas"
);
assert.ok(
  read("backend/src/utils/ai/memoryManager.ts").includes("pruneExpired"),
  "memoryManager deve ter TTL"
);
assert.ok(
  read("backend/scripts/smoke-api.cjs").includes("SMOKE_PORT"),
  "smoke-api deve permitir porta configuravel"
);
assert.ok(
  read("install.sh").includes("docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin"),
  "install.sh deve instalar Docker Engine e Docker Compose plugin em VPS Debian/Ubuntu"
);
assert.ok(
  read("install.sh").includes("setup_20.x") && read("install.sh").includes("install_node_debian_ubuntu"),
  "install.sh deve instalar Node.js 20 LTS automaticamente em VPS Debian/Ubuntu quando necessario"
);
assert.ok(
  read("install.sh").includes("ca-certificates curl gnupg git build-essential python3"),
  "install.sh deve instalar pacotes basicos automaticamente em VPS Debian/Ubuntu"
);
assert.ok(
  read("install.sh").includes("run_backend_migrations_docker"),
  "install.sh deve verificar e aplicar migrations Prisma no fluxo Docker"
);
assert.ok(
  read("install.sh").includes("prisma migrate status --schema prisma/schema.prisma"),
  "install.sh deve verificar status das migrations Prisma"
);
assert.ok(
  read("install.sh").includes("ensure_bootstrap_app_url"),
  "install.sh deve aplicar bootstrap de APP_URL antes de subir a stack"
);
assert.ok(
  read("install.sh").includes("http://${ip}:3001"),
  "install.sh deve usar a API publica em :3001 como bootstrap de APP_URL"
);
assert.ok(
  read("install.sh").includes('FRONTEND_HTTP_PORT="8081"'),
  "install.sh deve criar backend/.env com FRONTEND_HTTP_PORT=8081 por padrao"
);
assert.ok(
  functionBody(read("install.sh"), "ensure_frontend_port").includes('local preferred="${FRONTEND_HTTP_PORT:-8081}"'),
  "install.sh deve preferir FRONTEND_HTTP_PORT=8081 quando a variavel nao existe"
);
assert.ok(
  functionBody(read("install.sh"), "ensure_frontend_port").includes('compose_env_set FRONTEND_HTTP_PORT "$preferred"'),
  "install.sh deve atualizar .env da raiz por helper compose_env_set"
);
assert.ok(
  functionBody(read("install.sh"), "ensure_frontend_port").includes('env_set FRONTEND_HTTP_PORT "$preferred"'),
  "install.sh deve registrar FRONTEND_HTTP_PORT em backend/.env preservando variaveis existentes"
);
assert.ok(
  read("install.sh").includes("curl -i http://127.0.0.1:${FRONTEND_PORT}/") && read("install.sh").includes("sudo ss -tulpn | grep -E ':80|:443|:${FRONTEND_PORT}|:3001'"),
  "install.sh deve exibir validacoes de frontend, backend e portas"
);
assert.ok(
  read("install.sh").includes("Nginx/Certbot apontando para 127.0.0.1:${FRONTEND_PORT}"),
  "install.sh deve orientar Nginx/Certbot no host para HTTPS"
);
assert.ok(
  read("docker-compose.yml").includes('${FRONTEND_HTTP_PORT:-8081}:80'),
  "docker-compose.yml deve publicar frontend em 8081 quando FRONTEND_HTTP_PORT nao existir"
);
assert.ok(
  read("update.sh").includes("run_backend_migrations_docker"),
  "update.sh deve verificar e aplicar migrations Prisma no fluxo Docker"
);
assert.ok(
  read("update.sh").includes("run_backend_migrations_local"),
  "update.sh deve verificar e aplicar migrations Prisma no fluxo local"
);
assert.ok(
  read("update.sh").includes("prisma migrate status --schema prisma/schema.prisma"),
  "update.sh deve verificar status das migrations Prisma"
);
assert.ok(
  read("update.sh").includes("ensure_bootstrap_app_url"),
  "update.sh deve corrigir APP_URL ausente em ambientes legados"
);
assert.ok(
  read("update.sh").includes("http://${ip}:3001"),
  "update.sh deve usar a API publica em :3001 como bootstrap de APP_URL"
);
assert.ok(
  functionBody(read("update.sh"), "ensure_frontend_port").includes('local preferred="${FRONTEND_HTTP_PORT:-8081}"'),
  "update.sh deve usar 8081 como fallback quando FRONTEND_HTTP_PORT nao existe"
);
assert.ok(
  functionBody(read("update.sh"), "ensure_frontend_port").includes('port_owned_by_compose_frontend "$preferred"'),
  "update.sh deve preservar porta explicitamente publicada pelo proprio frontend Compose"
);
assertNo("install.sh", [/printf\s+['"]FRONTEND_HTTP_PORT=.*>\s*backend\/\.env/, /cat\s*>\s*backend\/\.env\s*<<[^\n]*FRONTEND_HTTP_PORT/]);
assertNo("update.sh", [/printf\s+['"]FRONTEND_HTTP_PORT=.*>\s*backend\/\.env/, /cat\s*>\s*backend\/\.env\s*<<[^\n]*FRONTEND_HTTP_PORT/]);
assert.ok(
  read("README.md").includes("proxy_pass http://127.0.0.1:8081") && read("README.md").includes("proxy_set_header Upgrade $http_upgrade"),
  "README.md deve documentar Nginx para 127.0.0.1:8081 com suporte a WebSocket"
);
assert.ok(
  read("README.md").includes("Use `VITE_API_URL` somente quando o painel e a API estiverem em origens diferentes"),
  "README.md deve limitar VITE_API_URL ao caso de origem separada"
);
assert.ok(
  /^v\d+\.\d+\.\d+/.test(read("backend/VERSION").trim()),
  "backend/VERSION deve conter a versao versionada da aplicacao"
);
assert.ok(
  read("backend/Dockerfile").includes("COPY --from=builder /app/VERSION ./VERSION"),
  "Dockerfile deve copiar backend/VERSION para a imagem de runtime"
);
assert.ok(
  read("backend/src/services/update.service.ts").includes("readVersionFile() || process.env.APP_VERSION"),
  "update.service deve priorizar backend/VERSION antes de APP_VERSION legado"
);

const ignoredRuntimeDirs = new Set([".git", "node_modules", "dist", "build", "coverage"]);

function findPs1Files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && ignoredRuntimeDirs.has(entry.name)) return [];
    if (entry.isDirectory()) return findPs1Files(full);
    return entry.isFile() && entry.name.toLowerCase().endsWith(".ps1") ? [full] : [];
  });
}

assert.deepStrictEqual(
  findPs1Files(appRoot).map((file) => path.relative(appRoot, file)),
  [],
  "nao deve haver arquivos .ps1 no projeto"
);

console.log("ops-postgresql-cleanup: OK");
