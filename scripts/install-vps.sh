# ================================================
# NexusZAP - Script de Instalação Completa para VPS
# ================================================
# Uso: Execute como root (sudo su) no servidor
# ================================================

#!/bin/bash

# ================================================
# CONFIGURAÇÕES - EDITE AQUI
# ================================================
PROJECT_DIR="/var/www/nexuszap"           # Diretório de instalação
ADMIN_EMAIL="admin@seudominio.com"       # Email do admin
ADMIN_PASSWORD="MudeEstaSenha123!"       # Senha do admin
GITHUB_REPO="vektortechmind/CHATBOT"    # Seu repo GitHub
DOMAIN="app.seudominio.com"             # Domínio (opcional)

# ================================================
# NÃO EDITE ABAIXO A MENOS QUE SAIBA O QUE FAZ
# ================================================

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

clear
echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════╗"
echo "║   NexusZAP - Instalação Completa para VPS     ║"
echo "╚═══════════════════════════════════════════════╝"
echo -e "${NC}"

# Verificar root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Execute como root: sudo su${NC}"
    exit 1
fi

# Função para mensagens
msg() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

# ============================================
# PASSO 1: Atualizar Sistema
# ============================================
echo -e "\n${CYAN}[1/9] Atualizando sistema...${NC}"
apt update -qq && apt upgrade -y -qq 2>/dev/null
msg "Sistema atualizado"

# ============================================
# PASSO 2: Instalar Node.js 20 LTS
# ============================================
echo -e "\n${CYAN}[2/9] Instalando Node.js 20 LTS...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
apt-get install -y nodejs > /dev/null 2>&1
msg "Node.js $(node --version) instalado"

# ============================================
# PASSO 3: Instalar Git e PM2
# ============================================
echo -e "\n${CYAN}[3/9] Instalando Git e PM2...${NC}"
apt-get install -y git > /dev/null 2>&1
npm install -g pm2 > /dev/null 2>&1
msg "Git $(git --version | cut -d' ' -f3) e PM2 instalados"

# ============================================
# PASSO 4: Criar diretório e clonar
# ============================================
echo -e "\n${CYAN}[4/9] Baixando projeto do GitHub...${NC}"
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# Clonar repo
if git clone https://github.com/${GITHUB_REPO}.git . 2>/dev/null; then
    msg "Projeto clonado"
else
    warn "Clone público não funcionou, tentando com HTTPS..."
    git clone https://github.com/${GITHUB_REPO}.git . || error "Falha ao clonar repositório"
fi

# ============================================
# PASSO 5: Configurar Backend
# ============================================
echo -e "\n${CYAN}[5/9] Configurando Backend...${NC}"

cd $PROJECT_DIR/backend
cp .env.example .env

# Gerar chaves seguras
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)

# Atualizar .env
sed -i "s/JWT_SECRET=\"troque-por-um-segredo-com-ao-menos-32-caracteres\"/JWT_SECRET=\"${JWT_SECRET}\"/" .env 2>/dev/null || true
sed -i "s/ADMIN_EMAIL=\"admin@chatbot.ia\"/ADMIN_EMAIL=\"${ADMIN_EMAIL}\"/" .env 2>/dev/null || true
sed -i "s/ADMIN_PASSWORD=\"troque-por-uma-senha-forte\"/ADMIN_PASSWORD=\"${ADMIN_PASSWORD}\"/" .env 2>/dev/null || true
sed -i "s/GITHUB_REPO=\"usuario\/seu-repo\"/GITHUB_REPO=\"${GITHUB_REPO}\"/" .env 2>/dev/null || true
sed -i "s/# ENCRYPTION_KEY=\"base64-32-chars\"/ENCRYPTION_KEY=\"${ENCRYPTION_KEY}\"/" .env 2>/dev/null || true

# Instalar e build
npm install --silent 2>/dev/null
npx prisma generate --silent 2>/dev/null
npx prisma db push --silent 2>/dev/null
npm run build 2>/dev/null
msg "Backend configurado"

# ============================================
# PASSO 6: Configurar Frontend
# ============================================
echo -e "\n${CYAN}[6/9] Configurando Frontend...${NC}"
cd $PROJECT_DIR/frontend
npm install --silent 2>/dev/null
npm run build 2>/dev/null
msg "Frontend buildado"

# ============================================
# PASSO 7: Configurar PM2
# ============================================
echo -e "\n${CYAN}[7/9] Configurando PM2 (mantém rodando)...${NC}"

cd $PROJECT_DIR/backend

# Criar ecosystem config
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'nexuszap-backend',
    script: 'dist/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
EOF

# Reiniciar PM2
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup > /dev/null 2>&1 || true

# Auto-restart em reboot
pm2 install ubuntu-server-updater > /dev/null 2>&1 || true

msg "PM2 configurado - sistema manterá rodando"

# ============================================
# PASSO 8: Configurar Nginx
# ============================================
echo -e "\n${CYAN}[8/9] Configurando Nginx...${NC}"

apt-get install -y nginx > /dev/null 2>&1

cat > /etc/nginx/sites-available/nexuszap << EOF
server {
    listen 80;
    server_name _;

    client_max_body_size 100M;

    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Frontend
    location / {
        root ${PROJECT_DIR}/frontend/dist;
        try_files \$uri \$uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, max-age=3600";
    }
}
EOF

ln -sf /etc/nginx/sites-available/nexuszap /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
systemctl enable nginx

msg "Nginx configurado"

# ============================================
# PASSO 9: Configurar Firewall
# ============================================
echo -e "\n${CYAN}[9/9] Configurando Firewall...${NC}"
ufw allow 22/tcp > /dev/null 2>&1 || true
ufw allow 80/tcp > /dev/null 2>&1 || true
ufw allow 443/tcp > /dev/null 2>&1 || true
ufw --force enable > /dev/null 2>&1 || true
msg "Firewall configurado"

# ============================================
# FINALIZAÇÃO
# ============================================
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       ✅ INSTALAÇÃO CONCLUÍDA!                ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  📁 Projeto: ${CYAN}$PROJECT_DIR${NC}"
echo -e "  🌐 Frontend: ${CYAN}http://$(curl -s ifconfig.me)${NC}"
echo -e "  🔌 Backend:  ${CYAN}http://127.0.0.1:3000${NC}"
echo ""
echo -e "  👤 Login:"
echo -e "     Email:    ${YELLOW}$ADMIN_EMAIL${NC}"
echo -e "     Senha:    ${YELLOW}$ADMIN_PASSWORD${NC}"
echo ""
echo -e "  📋 Comandos úteis:"
echo -e "     ${CYAN}pm2 status${NC}          Ver status dos serviços"
echo -e "     ${CYAN}pm2 logs${NC}             Ver logs em tempo real"
echo -e "     ${CYAN}pm2 restart all${NC}       Reiniciar todos os serviços"
echo -e "     ${CYAN}pm2 stop all${NC}          Parar todos os serviços"
echo ""

# Mostrar URL de acesso
IP=$(curl -s ifconfig.me 2>/dev/null || echo "localhost")
echo -e "  🌐 Acesse: ${GREEN}http://$IP${NC}"
echo ""

# SSL (opcional)
echo -e "  🔒 Para SSL (HTTPS):"
echo -e "     apt install certbot python3-certbot-nginx"
echo -e "     certbot --nginx -d seu-dominio.com"
echo ""

# Salvar credenciais
cat > $PROJECT_DIR/credenciais.txt << EOF
========================================
NexusZAP - Credenciais de Acesso
========================================

Email: $ADMIN_EMAIL
Senha: $ADMIN_PASSWORD

Backend: http://127.0.0.1:3000
Frontend: http://$IP

Comandos:
  pm2 status      - Ver status
  pm2 logs        - Ver logs
  pm2 restart all - Reiniciar
  pm2 stop all    - Parar

========================================
EOF

chmod 600 $PROJECT_DIR/credenciais.txt
echo -e "  📄 Credenciais salvas em: ${CYAN}$PROJECT_DIR/credenciais.txt${NC}"
echo ""

# Mostrar logs
echo -e "${CYAN}📜 Últimos logs do sistema:${NC}"
pm2 logs --lines 10 --nostream 2>/dev/null || true
