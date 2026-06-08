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

assert.ok(dockerfile.includes("docker-ce-cli"), "imagem do backend deve incluir Docker CLI oficial para update remoto");
assert.ok(dockerfile.includes("docker-compose-plugin"), "imagem do backend deve incluir Docker Compose V2 plugin");
assert.ok(!/\n\s*docker-compose\s*\\/.test(dockerfile), "imagem do backend nao deve instalar docker-compose legado V1");
assert.ok(dockerfile.includes("git"), "imagem do backend deve incluir git para update remoto");

assert.ok(serviceSource.includes("UPDATE_WORKSPACE_DIR"), "update.service deve suportar workspace configuravel");
assert.ok(serviceSource.includes("UPDATE_STORAGE_DIR"), "update.service deve suportar storage configuravel");
assert.ok(serviceSource.includes("reconcileRecoveredJob"), "update.service deve reconciliar jobs apos reinicio");
assert.ok(serviceSource.includes("dockerStackRecovered"), "update.service deve validar saude Docker antes de recuperar job como sucesso");
assert.ok(serviceSource.includes("Consulta de release indisponível durante atualização"), "status deve degradar para job local durante update ativo");

assert.ok(compose.includes("pg_isready -U nexus -d nexus_chatbot_db"), "Postgres deve validar o banco correto no healthcheck");

assert.ok(updateScript.includes("require_docker_compose_v2()"), "update.sh deve exigir Docker Compose V2");
assert.ok(updateScript.includes("legacy_docker_compose_available()"), "update.sh deve detectar docker-compose legado para erro claro");
assert.ok(updateScript.includes("Docker Compose V2 e obrigatorio"), "update.sh deve explicar bloqueio de Compose legado");
assert.ok(updateScript.includes("compose_project_name()"), "update.sh deve resolver o nome do projeto Docker Compose");
assert.ok(updateScript.includes("docker compose -p \"$project_name\""), "update.sh deve chamar docker compose com projeto explicito");
assert.ok(!updateScript.includes("docker-compose -p \"$project_name\""), "update.sh nao deve chamar docker-compose legado");
assert.ok(updateScript.includes("port_owned_by_compose_frontend()"), "update.sh deve detectar porta ocupada pelo proprio frontend Compose");
assert.ok(updateScript.includes("label=com.docker.compose.service=frontend"), "update.sh deve identificar o container frontend por label Compose");
assert.ok(updateScript.includes("port_owned_by_compose_frontend \"$preferred\""), "update.sh deve preservar a porta publicada pelo frontend atual");
assert.ok(updateScript.includes("docker_compose build"), "update.sh deve fazer build Docker pelo wrapper de compose");
assert.ok(updateScript.includes("ensure_postgres_running"), "update.sh deve garantir Postgres por helper seguro");
assert.ok(updateScript.includes("docker_compose start postgres"), "update.sh deve iniciar Postgres existente sem recriar");
assert.ok(updateScript.includes("docker_compose up -d --no-recreate postgres"), "update.sh deve usar --no-recreate para Postgres ausente");
assert.ok(!updateScript.includes("docker_compose up -d postgres"), "update.sh nao deve recriar Postgres sem protecao");
assert.ok(updateScript.includes("docker_compose up -d --no-deps backend frontend"), "update.sh deve recriar backend/frontend sem tocar dependencias stateful");
assert.ok(updateScript.includes("docker_compose run --rm --no-deps backend npx prisma migrate status"), "update.sh deve verificar migrations sem recriar dependencias do Compose");
assert.ok(updateScript.includes("docker_compose run --rm --no-deps backend npm run db:migrate:deploy"), "update.sh deve aplicar migrations sem recriar dependencias do Compose");
assert.ok(updateScript.includes("update_panel_job_state"), "update.sh deve persistir progresso do job antes do restart Docker");
assert.ok(updateScript.includes("validate_docker_stack_after_update"), "update.sh deve validar stack antes de marcar sucesso");
assert.ok(updateScript.indexOf("validate_docker_stack_after_update") < updateScript.lastIndexOf("update_panel_job_state \"success\""), "update.sh deve validar saude antes do sucesso");
assert.ok(!/down\s+-v/.test(updateScript), "update.sh nao deve remover volumes Docker");

console.log("update-remote-runtime-config: OK");
