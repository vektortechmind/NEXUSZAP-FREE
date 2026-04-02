#!/bin/bash

# ================================================
# NexusZAP - Script de Configuração do .env
# ================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════╗"
echo "║   NexusZAP - Configuração do Ambiente      ║"
echo "╚═══════════════════════════════════════════════╝"
echo -e "${NC}"

# Diretório do projeto
PROJECT_DIR="/var/www/nexuszap"
BACKEND_DIR="$PROJECT_DIR/backend"
ENV_FILE="$BACKEND_DIR/.env"

# Verificar se já existe
if [ -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚠ O arquivo .env já existe em: $ENV_FILE${NC}"
    read -p "Deseja sobrescrever? (s/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        echo -e "${GREEN}✓ Configuração cancelada${NC}"
        exit 0
    fi
fi

# Função para ler entrada com valor padrão
read_default() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    
    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " value
        value=${value:-$default}
    else
        read -p "$prompt: " value
    fi
    
    eval "$var_name='$value'"
}

# Função para gerar chave aleatória
generate_key() {
    openssl rand -base64 32
}

echo ""
echo -e "${GREEN}📝 Configurando variáveis de ambiente${NC}"
echo ""

# Credenciais Admin
echo -e "${CYAN}[1/6] Credenciais do Administrador${NC}"
read_default "Email do admin" "admin@nexuszap.com" ADMIN_EMAIL
read_default "Senha do admin" "" ADMIN_PASSWORD

# Repositório GitHub
echo ""
echo -e "${CYAN}[2/6] GitHub${NC}"
read_default "Usuário/Repo (ex: usuario/chatbot)" "vektortechmind/CHATBOT" GITHUB_REPO

# Versão
echo ""
echo -e "${CYAN}[3/6] Versão${NC}"
read_default "Versão do sistema" "v1.0.0" APP_VERSION

# Porta
echo ""
echo -e "${CYAN}[4/6] Servidor${NC}"
read_default "Porta do servidor" "3000" PORT

# CORS
echo ""
echo -e "${CYAN}[5/6] CORS (pressione Enter para pular)${NC}"
read -p "Domínios permitidos (ex: https://app.exemplo.com): " CORS_ORIGINS

# Domínio
echo ""
echo -e "${CYAN}[6/6] Domínio (opcional)${NC}"
read -p "Domínio do site (ex: app.exemplo.com): " DOMAIN

# Gerar chaves
echo ""
echo -e "${YELLOW}🔑 Gerando chaves de segurança...${NC}"
JWT_SECRET=$(generate_key)
ENCRYPTION_KEY=$(generate_key)

# Criar arquivo .env
echo ""
echo -e "${GREEN}📁 Criando arquivo .env...${NC}"

cat > "$ENV_FILE" << EOF
# ===========================================
# NexusZAP - Configuração do Ambiente
# Gerado em: $(date)
# ===========================================

# Ambiente
NODE_ENV="production"

# ===========================================
# BANCO DE DADOS
# ===========================================
DATABASE_URL="file:./chatbot.db"

# ===========================================
# SERVIDOR
# ===========================================
PORT=$PORT

# ===========================================
# SEGURANÇA
# ===========================================
JWT_SECRET="$JWT_SECRET"
ENCRYPTION_KEY="$ENCRYPTION_KEY"

# ===========================================
# ADMIN
# ===========================================
ADMIN_EMAIL="$ADMIN_EMAIL"
ADMIN_PASSWORD="$ADMIN_PASSWORD"

# ===========================================
# CORS (Produção)
# ===========================================
EOF

if [ -n "$CORS_ORIGINS" ]; then
    echo "CORS_ORIGINS=\"$CORS_ORIGINS\"" >> "$ENV_FILE"
else
    echo "# CORS_ORIGINS=\"https://app.seudominio.com\"" >> "$ENV_FILE"
fi

cat >> "$ENV_FILE" << EOF

# ===========================================
# TELEGRAM (Opcional)
# ===========================================
# Obtenha em: https://t.me/BotFather
# TELEGRAM_BOT_TOKEN="seu-token-aqui"

# ===========================================
# APIs de IA (configure pelo painel)
# ===========================================
# GEMINI_KEY="sua-chave-aqui"
# GROQ_KEY="sua-chave-aqui"
# OPENROUTER_KEY="sua-chave-aqui"

# ===========================================
# AUTO-UPDATE (GitHub)
# ===========================================
GITHUB_REPO="$GITHUB_REPO"
APP_VERSION="$APP_VERSION"
EOF

# Permissões
chmod 600 "$ENV_FILE"

# Finalização
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       ✅ CONFIGURAÇÃO CONCLUÍDA!          ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  📄 Arquivo: ${CYAN}$ENV_FILE${NC}"
echo ""
echo -e "  👤 Credenciais:"
echo -e "     Email:    ${YELLOW}$ADMIN_EMAIL${NC}"
echo -e "     Senha:    ${YELLOW}$ADMIN_PASSWORD${NC}"
echo ""
echo -e "  🔑 Chaves geradas automaticamente"
echo -e "     JWT_SECRET: ${CYAN}${JWT_SECRET:0:20}...${NC}"
echo ""
echo -e "  📋 Próximos passos:"
echo -e "     1. npm install"
echo -e "     2. npx prisma generate"
echo -e "     3. npx prisma db push"
echo -e "     4. npm run build"
echo ""

# Mostrar arquivo criado
echo -e "${CYAN}📜 Conteúdo do .env criado:${NC}"
echo "-------------------------------------------"
head -30 "$ENV_FILE"
echo "-------------------------------------------"
