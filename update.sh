#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_URL="https://github.com/vektortechmind/NEXUSZAP-FREE.git"
cd "$ROOT"

echo ""
echo "========================================"
echo "NexusZAP - Update VPS"
echo "========================================"
echo ""

require() {
  local bin="$1"
  local message="$2"
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "ERRO: $message" >&2
    exit 1
  fi
}

docker_compose_available() {
  command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1
}

legacy_docker_compose_available() {
  command -v docker-compose >/dev/null 2>&1
}

require_docker_compose_v2() {
  if docker_compose_available; then
    return 0
  fi

  if legacy_docker_compose_available; then
    echo "ERRO: Docker Compose V2 e obrigatorio para update remoto." >&2
    echo "Detectei docker-compose legado, que pode falhar com KeyError: ContainerConfig e derrubar containers stateful." >&2
    echo "Instale o plugin Docker Compose V2 e rode novamente usando 'docker compose version' como validacao." >&2
    exit 1
  fi

  echo "ERRO: Docker Compose V2 nao encontrado. Instale Docker com o plugin 'docker compose'." >&2
  exit 1
}

compose_project_name() {
  echo "${COMPOSE_PROJECT_NAME:-nexuszap-free}"
}

docker_compose() {
  local project_name
  project_name="$(compose_project_name)"
  docker compose -p "$project_name" "$@"
}

compose_service_container_id() {
  local service="$1"
  docker_compose ps -a -q "$service" 2>/dev/null | head -n 1
}

container_status() {
  local container_id="$1"
  docker inspect -f '{{.State.Status}}' "$container_id" 2>/dev/null || true
}

container_health() {
  local container_id="$1"
  docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true
}

package_version_from_file() {
  local package_file="$1"
  node -e "const fs=require('fs'); const p=process.argv[1]; if (!fs.existsSync(p)) process.exit(0); const pkg=JSON.parse(fs.readFileSync(p,'utf8')); process.stdout.write(String(pkg.version || ''));" "$package_file"
}

backend_code_version() {
  package_version_from_file "backend/package.json"
}

backend_container_version() {
  local backend_id
  backend_id="$(compose_service_container_id backend || true)"
  if [[ -z "$backend_id" ]]; then
    return 0
  fi

  docker exec "$backend_id" node -e "const fs=require('fs'); const paths=['/app/package.json','./package.json']; for (const p of paths) { if (fs.existsSync(p)) { const pkg=JSON.parse(fs.readFileSync(p,'utf8')); process.stdout.write(String(pkg.version || '')); process.exit(0); } }" 2>/dev/null || true
}

detect_stale_backend_container() {
  local code_version container_version
  code_version="$(backend_code_version)"
  container_version="$(backend_container_version)"

  if [[ -z "$code_version" ]]; then
    return 1
  fi

  if [[ -z "$container_version" ]]; then
    echo "Versao do backend no container nao detectada. Rebuild Docker sera executado."
    return 0
  fi

  if [[ "$code_version" != "$container_version" ]]; then
    echo "Backend no container esta em ${container_version}, mas o codigo esta em ${code_version}. Rebuild Docker sera executado."
    return 0
  fi

  echo "Backend no container ja esta na versao ${container_version}."
  return 1
}

POSTGRES_WAS_RUNNING=false

remember_postgres_state() {
  local postgres_id status
  postgres_id="$(compose_service_container_id postgres || true)"
  status=""
  if [[ -n "$postgres_id" ]]; then
    status="$(container_status "$postgres_id")"
  fi
  if [[ "$status" == "running" ]]; then
    POSTGRES_WAS_RUNNING=true
  else
    POSTGRES_WAS_RUNNING=false
  fi
}

restore_postgres_if_needed() {
  if [[ "${POSTGRES_WAS_RUNNING:-false}" != "true" ]]; then
    return 0
  fi
  if ! docker_compose_available; then
    return 0
  fi

  local postgres_id status
  postgres_id="$(compose_service_container_id postgres || true)"
  status=""
  if [[ -n "$postgres_id" ]]; then
    status="$(container_status "$postgres_id")"
  fi

  if [[ "$status" != "running" ]]; then
    echo "Tentando restaurar Postgres que estava ativo antes da falha..."
    docker_compose start postgres >/dev/null 2>&1 || docker_compose up -d --no-recreate postgres >/dev/null 2>&1 || true
  fi
}

on_update_error() {
  local exit_code=$?
  restore_postgres_if_needed
  exit "$exit_code"
}

trap on_update_error ERR

print_migration_summary() {
  local deploy_output="$1"
  if printf '%s\n' "$deploy_output" | grep -qi "No pending migrations to apply"; then
    echo "Migrations Prisma verificadas: sem pendencias."
    return 0
  fi

  if printf '%s\n' "$deploy_output" | grep -Eqi "Applying migration|migrations found|The following migration"; then
    echo "Migrations Prisma verificadas e aplicadas com sucesso."
    return 0
  fi

  echo "Migrations Prisma verificadas com sucesso."
}

update_panel_job_state() {
  local status="$1"
  local summary="$2"
  local error="${3:-}"

  if [[ -z "${UPDATE_JOB_FILE:-}" || -z "${UPDATE_JOB_ID:-}" || ! -f "${UPDATE_JOB_FILE:-}" ]]; then
    return 0
  fi

  node - "$UPDATE_JOB_FILE" "$UPDATE_JOB_ID" "$status" "$summary" "$error" <<'NODE'
const fs = require("fs");
const [file, jobId, status, summary, error] = process.argv.slice(2);
const job = JSON.parse(fs.readFileSync(file, "utf8"));
if (job.id !== jobId) process.exit(0);
job.status = status;
job.summary = summary;
job.error = error || null;
if (status === "success" || status === "failed") {
  job.finishedAt = new Date().toISOString();
}
fs.writeFileSync(file, `${JSON.stringify(job, null, 2)}\n`);
NODE
}

run_backend_migrations_local() {
  local status_output=""
  local deploy_output=""

  echo "Verificando status das migrations Prisma..."
  pushd backend >/dev/null
  if ! status_output="$(npx prisma migrate status --schema prisma/schema.prisma 2>&1)"; then
    printf '%s\n' "$status_output"
    popd >/dev/null
    echo "ERRO: falha ao verificar status das migrations Prisma." >&2
    exit 1
  fi
  printf '%s\n' "$status_output"

  echo "Aplicando migrations Prisma..."
  if ! deploy_output="$(npm run db:migrate:deploy 2>&1)"; then
    printf '%s\n' "$deploy_output"
    popd >/dev/null
    echo "ERRO: falha ao aplicar migrations Prisma." >&2
    exit 1
  fi
  printf '%s\n' "$deploy_output"
  popd >/dev/null

  print_migration_summary "$deploy_output"
}

run_backend_migrations_docker() {
  local status_output=""
  local deploy_output=""

  ensure_postgres_running
  wait_postgres_healthy

  echo "Verificando status das migrations Prisma via Docker..."
  if ! status_output="$(docker_compose run --rm --no-deps backend npx prisma migrate status --schema prisma/schema.prisma 2>&1)"; then
    printf '%s\n' "$status_output"
    echo "ERRO: falha ao verificar status das migrations Prisma no ambiente Docker." >&2
    exit 1
  fi
  printf '%s\n' "$status_output"

  echo "Aplicando migrations Prisma via Docker..."
  if ! deploy_output="$(docker_compose run --rm --no-deps backend npm run db:migrate:deploy 2>&1)"; then
    printf '%s\n' "$deploy_output"
    echo "ERRO: falha ao aplicar migrations Prisma no ambiente Docker." >&2
    exit 1
  fi
  printf '%s\n' "$deploy_output"

  print_migration_summary "$deploy_output"
}

ensure_postgres_running() {
  local postgres_id status
  echo "Garantindo Postgres ativo no projeto Docker $(compose_project_name) sem recriar volume/container existente..."

  postgres_id="$(compose_service_container_id postgres || true)"
  status=""
  if [[ -n "$postgres_id" ]]; then
    status="$(container_status "$postgres_id")"
  fi

  if [[ "$status" == "running" ]]; then
    echo "Postgres ja esta rodando. Preservando container existente."
    return 0
  fi

  if [[ -n "$postgres_id" ]]; then
    echo "Postgres existente esta em estado '${status:-desconhecido}'. Iniciando sem recriar..."
    docker_compose start postgres
    return 0
  fi

  echo "Postgres ainda nao existe neste projeto. Criando com --no-recreate para preservar volumes existentes."
  docker_compose up -d --no-recreate postgres
}

wait_postgres_healthy() {
  local attempt postgres_id health
  echo "Aguardando Postgres healthy e banco nexus_chatbot_db acessivel..."

  for attempt in $(seq 1 60); do
    postgres_id="$(compose_service_container_id postgres || true)"
    if [[ -n "$postgres_id" ]]; then
      health="$(container_health "$postgres_id")"
      if [[ "$health" == "healthy" ]] && docker_compose exec -T postgres pg_isready -U nexus -d nexus_chatbot_db >/dev/null 2>&1; then
        echo "Postgres healthy."
        return 0
      fi
    fi
    sleep 2
  done

  docker_compose ps postgres || true
  echo "ERRO: Postgres nao ficou healthy dentro do tempo esperado." >&2
  exit 1
}

wait_backend_healthy() {
  local attempt backend_id health
  echo "Validando backend apos restart..."

  for attempt in $(seq 1 90); do
    backend_id="$(compose_service_container_id backend || true)"
    if [[ -n "$backend_id" ]]; then
      health="$(container_health "$backend_id")"
      if [[ "$health" == "healthy" ]] && docker_compose exec -T backend node -e "fetch('http://127.0.0.1:3000/api/ping').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
        echo "Backend healthy."
        return 0
      fi
    fi
    sleep 2
  done

  docker_compose ps backend || true
  echo "ERRO: backend nao ficou healthy dentro do tempo esperado." >&2
  exit 1
}

wait_frontend_ready() {
  local attempt frontend_id status
  echo "Validando frontend apos restart..."

  for attempt in $(seq 1 60); do
    frontend_id="$(compose_service_container_id frontend || true)"
    if [[ -n "$frontend_id" ]]; then
      status="$(container_status "$frontend_id")"
      if [[ "$status" == "running" ]] && docker_compose exec -T frontend wget -qO- http://127.0.0.1/ >/dev/null 2>&1; then
        echo "Frontend pronto."
        return 0
      fi
    fi
    sleep 2
  done

  docker_compose ps frontend || true
  echo "ERRO: frontend nao respondeu dentro do tempo esperado." >&2
  exit 1
}

validate_docker_stack_after_update() {
  wait_postgres_healthy
  wait_backend_healthy
  wait_frontend_ready
}

random_key() {
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
}

random_password() {
  node -e "console.log(require('crypto').randomBytes(18).toString('base64').replace(/[+/=]/g,'A')+'a1!')"
}

public_ip() {
  local ip=""
  if command -v curl >/dev/null 2>&1; then
    ip="$(curl -fsSL --max-time 4 https://api.ipify.org 2>/dev/null || true)"
  fi
  if [[ -z "$ip" ]]; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  fi
  echo "${ip:-SEU_IP}"
}

env_set() {
  local key="$1"
  local value="$2"
  if [[ ! -f "backend/.env" ]]; then
    return 0
  fi

  if grep -q "^${key}=" backend/.env; then
    sed -i "s|^${key}=.*|${key}=\"${value}\"|" backend/.env
  else
    printf '%s="%s"\n' "$key" "$value" >> backend/.env
  fi
  export "$key=$value"
}

ensure_env() {
  if [[ -f "backend/.env" ]]; then
    return 0
  fi

  mkdir -p backend

  local jwt_secret encryption_key admin_password
  jwt_secret="$(random_key)"
  encryption_key="$(random_key)"
  admin_password="$(random_password)"

  cat > backend/.env <<EOF
NODE_ENV="production"
DATABASE_URL="postgresql://nexus:nexus_secret@localhost:5432/nexus_chatbot_db?schema=public"
PORT=3000
JWT_SECRET="$jwt_secret"
ENCRYPTION_KEY="$encryption_key"
ADMIN_EMAIL="admin@nexuszap.com"
ADMIN_PASSWORD="$admin_password"
CORS_ORIGINS="http://localhost,http://localhost:5173,http://localhost:4173"
GITHUB_REPO="vektortechmind/NEXUSZAP-FREE"
EOF

  chmod 600 backend/.env

  echo "backend/.env criado automaticamente."
  echo "Login inicial: admin@nexuszap.com"
  echo "Senha inicial: $admin_password"
}

load_env() {
  if [[ ! -f "backend/.env" ]]; then
    return 0
  fi

  set -a
  # shellcheck disable=SC1091
  source backend/.env
  set +a
}

ensure_bootstrap_app_url() {
  local current="${APP_URL:-}"
  if [[ -n "$current" ]]; then
    return 0
  fi

  local ip bootstrap_url
  ip="$(public_ip)"
  bootstrap_url="http://${ip}:3001"
  env_set APP_URL "$bootstrap_url"
  echo "APP_URL ausente no backend/.env. Aplicando bootstrap temporario ${bootstrap_url} para permitir o start da API."
}

compose_env_set() {
  local key="$1"
  local value="$2"
  touch .env
  chmod 600 .env 2>/dev/null || true

  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${value}|" .env
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
  export "$key=$value"
}

port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltnH "sport = :${port}" | grep -q .
    return $?
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi
  return 1
}

port_owned_by_compose_frontend() {
  local port="$1"
  local project_name
  project_name="$(compose_project_name)"

  if ! command -v docker >/dev/null 2>&1; then
    return 1
  fi

  docker ps \
    --filter "label=com.docker.compose.project=${project_name}" \
    --filter "label=com.docker.compose.service=frontend" \
    --format '{{.Ports}}' 2>/dev/null | grep -Eq "(^|, )((0\.0\.0\.0|::):)?${port}->"
}

ensure_frontend_port() {
  local preferred="${FRONTEND_HTTP_PORT:-80}"
  if ! port_in_use "$preferred" || port_owned_by_compose_frontend "$preferred"; then
    compose_env_set FRONTEND_HTTP_PORT "$preferred"
    return 0
  fi

  local candidate
  for candidate in 8080 8081 8082 8090; do
    if ! port_in_use "$candidate"; then
      echo "Porta ${preferred} ocupada. Usando porta ${candidate} para o painel."
      compose_env_set FRONTEND_HTTP_PORT "$candidate"
      return 0
    fi
  done

  echo "ERRO: nao encontrei porta HTTP livre entre ${preferred}, 8080, 8081, 8082 e 8090." >&2
  exit 1
}

remove_ps1() {
  find "$ROOT" -type f -name '*.ps1' -delete
}

restore_managed_scripts() {
  local paths=()
  for path in install.sh update.sh; do
    if git ls-files --error-unmatch "$path" >/dev/null 2>&1; then
      paths+=("$path")
    fi
  done

  if [[ ${#paths[@]} -eq 0 ]]; then
    return 0
  fi

  if ! git diff --quiet -- "${paths[@]}" || ! git diff --cached --quiet -- "${paths[@]}"; then
    echo "Alteracoes locais em scripts gerenciados detectadas. Restaurando install.sh/update.sh antes do pull..."
    git restore --staged -- "${paths[@]}" >/dev/null 2>&1 || true
    git restore --worktree -- "${paths[@]}"
  fi
}

changed_any() {
  local pattern
  for pattern in "$@"; do
    if printf '%s\n' "$CHANGED_FILES" | grep -Eq "$pattern"; then
      return 0
    fi
  done
  return 1
}

require git "Instale Git antes de atualizar."
require node "Instale Node.js 18+ antes de atualizar."
require npm "Instale npm antes de atualizar."

ensure_env

if [[ ! -d .git ]]; then
  echo "ERRO: esta pasta nao e um clone Git." >&2
  echo "Clone correto: git clone $REPO_URL" >&2
  exit 1
fi

echo ""
echo "[1/5] Sincronizando repositorio..."
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi

git fetch origin --tags
current_branch="$(git branch --show-current)"
if [[ -z "$current_branch" ]]; then
  current_branch="main"
fi

restore_managed_scripts
old_rev="$(git rev-parse HEAD)"

if ! git pull --ff-only origin "$current_branch"; then
  echo "Pull direto falhou para branch $current_branch." >&2
  echo "Resolva conflitos/commits locais e rode update.sh novamente." >&2
  exit 1
fi
new_rev="$(git rev-parse HEAD)"
if [[ "$old_rev" == "$new_rev" ]]; then
  CHANGED_FILES=""
else
  CHANGED_FILES="$(git diff --name-only "$old_rev" "$new_rev")"
fi

if docker_compose_available || legacy_docker_compose_available || command -v docker >/dev/null 2>&1; then
  require_docker_compose_v2
  echo ""
  echo "[2/5] Ambiente Docker detectado. Dependencias e build serao feitos pelos Dockerfiles."

  load_env
  ensure_frontend_port
  ensure_bootstrap_app_url
  remember_postgres_state

  update_backend=false
  update_frontend=false
  update_stack=false

  if [[ -z "$CHANGED_FILES" ]]; then
    echo "Nenhuma mudanca nova no Git. Verificando se containers ja estao na versao do codigo."
  else
    if changed_any '^docker-compose\.yml$' '^\.dockerignore$'; then
      update_stack=true
    fi
    if changed_any '^backend/' '^package(-lock)?\.json$'; then
      update_backend=true
    fi
    if changed_any '^frontend/' '^package(-lock)?\.json$'; then
      update_frontend=true
    fi
  fi

  if detect_stale_backend_container; then
    update_backend=true
    update_frontend=true
  fi

  echo ""
  echo "[3/5] Build Docker seletivo..."
  if [[ "$update_stack" == "true" ]]; then
    docker_compose build
  else
    if [[ "$update_backend" == "true" || "$update_frontend" == "true" ]]; then
      docker_compose build backend frontend
    else
      echo "Nenhum build Docker necessario."
    fi
  fi

  echo ""
  echo "[4/5] Verificando migrations..."
  run_backend_migrations_docker

  echo ""
  echo "[5/5] Restart Docker seletivo..."
  if [[ "$update_stack" == "true" ]]; then
    update_panel_job_state "running" "Build e migrations concluídos. Recriando backend/frontend sem recriar Postgres."
    docker_compose up -d --no-deps backend frontend
  else
    if [[ "$update_backend" == "true" || "$update_frontend" == "true" ]]; then
      update_panel_job_state "running" "Build e migrations concluídos. Recriando backend/frontend sem recriar Postgres."
      docker_compose up -d --no-deps backend frontend
    fi
    if [[ "$update_backend" != "true" && "$update_frontend" != "true" && -n "$CHANGED_FILES" ]]; then
      echo "Mudancas sem impacto em containers. Nenhum restart Docker necessario."
    fi
  fi

  if [[ "$update_backend" == "true" || "$update_stack" == "true" ]]; then
    docker_compose ps backend
  fi

  echo ""
  echo "[5/5] Validando saude final da stack..."
  update_panel_job_state "running" "Containers iniciados. Validando Postgres, backend e frontend antes de concluir."
  validate_docker_stack_after_update
  update_panel_job_state "success" "Atualização concluída com sucesso."
  echo "Stack Docker atualizada."
else
  echo ""
  echo "[2/5] Atualizando dependencias da raiz..."
  if [[ -f package-lock.json ]]; then
    npm ci
  else
    npm install
  fi

  echo ""
  echo "[3/5] Atualizando backend..."
  pushd backend >/dev/null
  if [[ -f package-lock.json ]]; then
    npm ci
  else
    npm install
  fi
  npm run db:generate
  popd >/dev/null

  echo ""
  echo "[4/5] Atualizando frontend..."
  pushd frontend >/dev/null
  if [[ -f package-lock.json ]]; then
    npm ci
  else
    npm install
  fi
  popd >/dev/null

  echo ""
  echo "[5/5] Build local..."
  npm run build

  load_env
  ensure_bootstrap_app_url
  run_backend_migrations_local
  echo "Update local concluido. Reinicie seu process manager manualmente."
fi

remove_ps1

echo ""
echo "Update concluido."
