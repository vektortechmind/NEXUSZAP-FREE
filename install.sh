#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_PATH="${BASH_SOURCE[0]:-}"
if [[ -n "$SCRIPT_PATH" && "$SCRIPT_PATH" != "bash" && "$SCRIPT_PATH" != "-bash" ]]; then
  ROOT="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
else
  ROOT="$(pwd)"
fi
cd "$ROOT"
REPO_URL="https://github.com/vektortechmind/NEXUSZAP-FREE.git"
APP_DIR="NEXUSZAP-FREE"

echo ""
echo "========================================"
echo "NexusZAP - Instalacao VPS"
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
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    return 0
  fi

  command -v docker-compose >/dev/null 2>&1
}

docker_compose() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    docker compose "$@"
    return
  fi

  docker-compose "$@"
}

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

  echo "Verificando status das migrations Prisma via Docker..."
  if ! status_output="$(docker_compose run --rm backend npx prisma migrate status --schema prisma/schema.prisma 2>&1)"; then
    printf '%s\n' "$status_output"
    echo "ERRO: falha ao verificar status das migrations Prisma no ambiente Docker." >&2
    exit 1
  fi
  printf '%s\n' "$status_output"

  echo "Aplicando migrations Prisma via Docker..."
  if ! deploy_output="$(docker_compose run --rm backend npm run db:migrate:deploy 2>&1)"; then
    printf '%s\n' "$deploy_output"
    echo "ERRO: falha ao aplicar migrations Prisma no ambiente Docker." >&2
    exit 1
  fi
  printf '%s\n' "$deploy_output"

  print_migration_summary "$deploy_output"
}

ensure_repo_checkout() {
  if [[ -f "package.json" && -d "backend" && -d "frontend" ]]; then
    return 0
  fi

  require git "Instale Git antes de rodar a instalacao remota."

  if [[ -d "$APP_DIR/.git" ]]; then
    echo "Repositorio existente encontrado em $APP_DIR. Atualizando..."
    git -C "$APP_DIR" fetch origin
    git -C "$APP_DIR" pull --ff-only
  else
    echo "Clonando repositorio oficial em $APP_DIR..."
    git clone "$REPO_URL" "$APP_DIR"
  fi

  cd "$APP_DIR"
  exec bash ./install.sh
}

sudo_cmd() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

install_docker_debian_ubuntu() {
  if docker_compose_available; then
    return 0
  fi

  if [[ ! -r /etc/os-release ]]; then
    echo "Docker nao encontrado e nao foi possivel detectar a distribuicao." >&2
    exit 1
  fi

  # shellcheck disable=SC1091
  source /etc/os-release
  local distro_id="${ID:-}"
  local distro_like="${ID_LIKE:-}"
  local docker_repo_id=""

  case "$distro_id" in
    ubuntu|debian) docker_repo_id="$distro_id" ;;
    *)
      if [[ " $distro_like " == *" debian "* ]]; then
        docker_repo_id="debian"
      else
        echo "Docker nao encontrado. Instalacao automatica suportada apenas em Debian/Ubuntu." >&2
        echo "Instale Docker Engine + Docker Compose plugin e rode install.sh novamente." >&2
        exit 1
      fi
      ;;
  esac

  require curl "Instale curl antes de instalar Docker automaticamente."
  require gpg "Instale gnupg/gpg antes de instalar Docker automaticamente."
  require apt-get "Instalacao automatica de Docker requer apt-get."

  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    require sudo "Instale sudo ou rode este script como root para instalar Docker."
  fi

  local codename="${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
  if [[ -z "$codename" ]]; then
    echo "Nao foi possivel detectar VERSION_CODENAME para configurar o repositorio Docker." >&2
    exit 1
  fi

  echo "Docker/Compose nao encontrado. Instalando Docker Engine pelo repositorio oficial..."
  sudo_cmd apt-get update
  sudo_cmd apt-get install -y ca-certificates curl gnupg
  sudo_cmd install -m 0755 -d /etc/apt/keyrings
  sudo_cmd curl -fsSL "https://download.docker.com/linux/${docker_repo_id}/gpg" -o /etc/apt/keyrings/docker.asc
  sudo_cmd chmod a+r /etc/apt/keyrings/docker.asc

  local arch
  arch="$(dpkg --print-architecture)"
  printf 'Types: deb\nURIs: https://download.docker.com/linux/%s\nSuites: %s\nComponents: stable\nArchitectures: %s\nSigned-By: /etc/apt/keyrings/docker.asc\n' \
    "$docker_repo_id" "$codename" "$arch" | sudo_cmd tee /etc/apt/sources.list.d/docker.sources >/dev/null

  sudo_cmd apt-get update
  sudo_cmd apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo_cmd systemctl enable --now docker >/dev/null 2>&1 || true

  docker --version
  docker compose version
}

random_key() {
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
}

random_url_token() {
  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
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

ensure_frontend_port() {
  local preferred="${FRONTEND_HTTP_PORT:-80}"
  if ! port_in_use "$preferred"; then
    env_set FRONTEND_HTTP_PORT "$preferred"
    compose_env_set FRONTEND_HTTP_PORT "$preferred"
    return 0
  fi

  local candidate
  for candidate in 8080 8081 8082 8090; do
    if ! port_in_use "$candidate"; then
      echo "Porta ${preferred} ocupada. Usando porta ${candidate} para o painel."
      env_set FRONTEND_HTTP_PORT "$candidate"
      compose_env_set FRONTEND_HTTP_PORT "$candidate"
      return 0
    fi
  done

  echo "ERRO: nao encontrei porta HTTP livre entre ${preferred}, 8080, 8081, 8082 e 8090." >&2
  exit 1
}

public_base_url() {
  local ip="$1"
  local port="${FRONTEND_HTTP_PORT:-80}"
  if [[ "$port" == "80" ]]; then
    echo "http://${ip}"
  else
    echo "http://${ip}:${port}"
  fi
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
  echo "APP_URL nao definido. Usando bootstrap temporario ${bootstrap_url} ate a configuracao final do dominio/API."
}

ensure_env() {
  if [[ -f "backend/.env" ]]; then
    echo "backend/.env ja existe. Mantendo configuracao atual."
    return 0
  fi

  mkdir -p backend

  local jwt_secret encryption_key admin_password setup_token
  jwt_secret="$(random_key)"
  encryption_key="$(random_key)"
  admin_password="$(random_password)"
  setup_token="$(random_url_token)"

  cat > backend/.env <<EOF
NODE_ENV="production"
DATABASE_URL="postgresql://nexus:nexus_secret@localhost:5432/nexus_chatbot_db?schema=public"
PORT=3000
JWT_SECRET="$jwt_secret"
ENCRYPTION_KEY="$encryption_key"
ADMIN_EMAIL="admin@nexuszap.com"
ADMIN_PASSWORD="$admin_password"
ADMIN_SETUP_REQUIRED="true"
CORS_ORIGINS="http://localhost,http://localhost:5173,http://localhost:4173"
APP_URL=""
SETUP_TOKEN="$setup_token"
SETUP_COMPLETED="false"
FRONTEND_HTTP_PORT="80"
GITHUB_REPO="vektortechmind/NEXUSZAP-FREE"
EOF

  chmod 600 backend/.env

  echo "backend/.env criado automaticamente."
  echo "Token de setup: $setup_token"
  echo "Use o link /criar-admin exibido ao final da instalacao para definir o primeiro administrador."
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

remove_ps1() {
  find "$ROOT" -type f -name '*.ps1' -delete
}

ensure_repo_checkout

require node "Instale Node.js 18+ antes de continuar."
require npm "Instale npm antes de continuar."

install_docker_debian_ubuntu

ensure_env

echo ""
echo "[1/5] Instalando dependencias da raiz..."
npm install

echo ""
echo "[2/5] Instalando dependencias do backend..."
pushd backend >/dev/null
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi
npm run db:generate
popd >/dev/null

echo ""
echo "[3/5] Instalando dependencias do frontend..."
pushd frontend >/dev/null
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi
popd >/dev/null

echo ""
echo "[4/5] Buildando backend e frontend..."
npm run build

echo ""
echo "[5/5] Subindo stack Docker, se Docker estiver disponivel..."
if docker_compose_available; then
  load_env
  ensure_frontend_port
  ensure_bootstrap_app_url
  docker_compose up -d --build
  run_backend_migrations_docker
  PUBLIC_BASE_URL="$(public_base_url "$(public_ip)")"
  SETUP_URL="${PUBLIC_BASE_URL}/docker-setup?token=${SETUP_TOKEN:-}"
  ADMIN_URL="${PUBLIC_BASE_URL}/criar-admin?token=${SETUP_TOKEN:-}"
  echo "Stack Docker iniciada."
  echo ""
  echo "Abra a configuracao inicial no navegador:"
  echo "$SETUP_URL"
  echo ""
  echo "Depois crie o primeiro administrador:"
  echo "$ADMIN_URL"
else
  echo "Docker Compose nao encontrado. Instale Docker Compose e rode install.sh novamente na VPS."
fi

remove_ps1

echo ""
echo "Instalacao concluida."

