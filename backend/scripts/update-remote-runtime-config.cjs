"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", "..", relativePath), "utf8");
}

const compose = read("docker-compose.yml");
const dockerfile = read("backend/Dockerfile");
const serviceSource = read("backend/src/services/update.service.ts");
const updateScript = read("update.sh");

assert.ok(compose.includes("- ./:/workspace"), "backend deve montar o workspace oficial em /workspace");
assert.ok(compose.includes("- /var/run/docker.sock:/var/run/docker.sock"), "backend deve montar o docker socket para update remoto");
assert.ok(compose.includes("UPDATE_SCRIPT_PATH: /workspace/update.sh"), "backend deve apontar o script oficial montado");
assert.ok(compose.includes("UPDATE_STORAGE_DIR: /workspace/updates"), "backend deve persistir jobs em storage compartilhado");
assert.ok(compose.includes("UPDATE_WORKSPACE_DIR: /workspace"), "backend deve conhecer o workspace remoto");
assert.ok(compose.includes("COMPOSE_PROJECT_NAME: nexuszap-free"), "backend deve preservar o projeto Docker Compose oficial no update remoto");

assert.ok(dockerfile.includes("docker-compose"), "imagem do backend deve incluir docker-compose para update remoto");
assert.ok(dockerfile.includes("docker.io"), "imagem do backend deve incluir docker CLI para update remoto");
assert.ok(dockerfile.includes("git"), "imagem do backend deve incluir git para update remoto");

assert.ok(serviceSource.includes("UPDATE_WORKSPACE_DIR"), "update.service deve suportar workspace configuravel");
assert.ok(serviceSource.includes("UPDATE_STORAGE_DIR"), "update.service deve suportar storage configuravel");
assert.ok(serviceSource.includes("reconcileRecoveredJob"), "update.service deve reconciliar jobs apos reinicio");

assert.ok(updateScript.includes("docker_compose_available()"), "update.sh deve suportar docker compose ou docker-compose");
assert.ok(updateScript.includes("compose_project_name()"), "update.sh deve resolver o nome do projeto Docker Compose");
assert.ok(updateScript.includes("docker compose -p \"$project_name\""), "update.sh deve chamar docker compose com projeto explicito");
assert.ok(updateScript.includes("docker-compose -p \"$project_name\""), "update.sh deve chamar docker-compose legado com projeto explicito");
assert.ok(updateScript.includes("port_owned_by_compose_frontend()"), "update.sh deve detectar porta ocupada pelo proprio frontend Compose");
assert.ok(updateScript.includes("label=com.docker.compose.service=frontend"), "update.sh deve identificar o container frontend por label Compose");
assert.ok(updateScript.includes("port_owned_by_compose_frontend \"$preferred\""), "update.sh deve preservar a porta publicada pelo frontend atual");
assert.ok(updateScript.includes("docker_compose build"), "update.sh deve fazer build Docker pelo wrapper de compose");
assert.ok(updateScript.includes("docker_compose up -d"), "update.sh deve usar wrapper de compose no deploy");
assert.ok(updateScript.includes("docker_compose up -d postgres"), "update.sh deve garantir Postgres ativo no projeto correto antes das migrations");
assert.ok(updateScript.includes("docker_compose run --rm --no-deps backend npx prisma migrate status"), "update.sh deve verificar migrations sem recriar dependencias do Compose");
assert.ok(updateScript.includes("docker_compose run --rm --no-deps backend npm run db:migrate:deploy"), "update.sh deve aplicar migrations sem recriar dependencias do Compose");
assert.ok(updateScript.includes("update_panel_job_state"), "update.sh deve persistir progresso do job antes do restart Docker");

console.log("update-remote-runtime-config: OK");
