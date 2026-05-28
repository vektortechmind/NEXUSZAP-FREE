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

random_key() {
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
}

random_password() {
  node -e "console.log(require('crypto').randomBytes(18).toString('base64').replace(/[+/=]/g,'A')+'a1!')"
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

if ! git pull --ff-only origin "$current_branch"; then
  echo "Pull direto falhou para branch $current_branch." >&2
  echo "Resolva conflitos/commits locais e rode update.sh novamente." >&2
  exit 1
fi

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
echo "[5/5] Build e restart Docker, se disponivel..."
npm run build

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  load_env
  ensure_frontend_port
  docker compose up -d --build
  echo "Stack Docker atualizada."
else
  echo "Docker Compose nao encontrado. Update local concluido. Reinicie seu process manager manualmente."
fi

remove_ps1

echo ""
echo "Update concluido."
