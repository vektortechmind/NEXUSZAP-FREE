# NexusZAP - Chatbot com IA v1.0.0

Chatbot inteligente para WhatsApp e Telegram com inteligência artificial, suporte a áudios e painel administrativo completo.

## Funcionalidades

### IA Avançada
- Respostas inteligentes com LLMs (Gemini, Groq, OpenRouter)
- **Processamento de Áudio**: Transcrição e resposta a mensagens de voz
- Base de conhecimento carregável (PDF, DOCX, TXT)
- Personalidade configurável via prompt de sistema

### Canais
- **WhatsApp**: Conexão via QR Code ou link
- **Telegram**: Bot configurável com comandos personalizados
- Respostas automáticas inteligentes

### Painel Administrativo (Dashboard)
- **Dashboard**: Visão geral com estatísticas em tempo real
- **Instâncias**: Gerenciar conexões WhatsApp
- **Agente IA**: Configurar prompts e base de conhecimento
- **Telegram IA**: Configurações específicas do Telegram
- **Configurações**: Chaves de API e preferências

### Segurança
- Autenticação JWT
- Criptografia de chaves sensíveis
- Rate limiting para proteção de APIs

## Pré-requisitos

### Ferramentas Necessárias

| Ferramenta | Versão | Download |
|------------|--------|----------|
| Node.js | 18+ | https://nodejs.org/ |
| Git | Latest | https://git-scm.com/ |

### Verificar Instalação

Abra o terminal e execute:
```bash
node --version
npm --version
git --version
```

## Instalação Automática (Windows)

### Passo 1: Clone o Repositório

```bash
git clone https://github.com/vektortechmind/CHATBOT.git
cd CHATBOT
```

### Passo 2: Execute o Script de Instalação

```bash
.\setup.ps1
```

O script irá:
- Verificar se o Node.js está instalado
- Instalar dependências do backend
- Instalar dependências do frontend
- Gerar o banco de dados
- Criar o arquivo `.env`

### Passo 3: Inicie o Projeto

```bash
.\start.ps1
```

## Instalação Manual

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Edite o .env com suas configurações
npx prisma generate
npx prisma db push
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Configuração

### Variáveis de Ambiente (backend/.env)

```env
# ===========================================
# SEGURANÇA
# ===========================================
# Gere uma chave forte: openssl rand -base64 32
JWT_SECRET="sua-chave-secreta-com-32-caracteres"

# Credenciais do Admin (ALTERE EM PRODUÇÃO!)
ADMIN_EMAIL="admin@seudominio.com"
ADMIN_PASSWORD="sua-senha-forte"

# ===========================================
# CORS (Produção)
# ===========================================
# Adicione seus domínios em produção (separados por vírgula)
CORS_ORIGINS="https://app.seudominio.com,https://www.seudominio.com"

# ===========================================
# PORTA DO SERVIDOR
# ===========================================
PORT=3000

# ===========================================
# APIs de IA (configure pelo painel)
# ===========================================
# GEMINI_KEY=sua-chave-gemini
# GROQ_KEY=sua-chave-groq
# OPENROUTER_KEY=sua-chave-openrouter

# ===========================================
# TELEGRAM (Opcional)
# ===========================================
# Obtenha em: https://t.me/BotFather
# TELEGRAM_BOT_TOKEN=123456789:AA...

# ===========================================
# AUTO-UPDATE (GitHub)
# ===========================================
GITHUB_REPO="usuario/seu-repo"
APP_VERSION="v1.0.0"
```

### Sobre o CORS_ORIGINS

O CORS controla quais domínios podem acessar o backend. Configure em produção:

```env
# Um domínio
CORS_ORIGINS="https://app.nexuszap.com"

# Múltiplos domínios
CORS_ORIGINS="https://app.nexuszap.com,https://www.nexuszap.com"

# Em desenvolvimento (não usar em produção)
CORS_ORIGINS="*"
```

## Uso

1. Acesse `http://localhost:5173`
2. Faça login com as credenciais do `.env`
3. Conecte uma instância WhatsApp (QR Code ou link)
4. Configure o Agente IA com suas chaves de API
5. Personalize o prompt de sistema
6. Carregue arquivos para a base de conhecimento

## Estrutura do Projeto

```
chatbot/
├── backend/
│   ├── src/
│   │   ├── ai/          # Serviços de IA
│   │   ├── routes/      # API routes
│   │   ├── services/    # Lógica de negócio
│   │   ├── whatsapp/    # Conexão WhatsApp
│   │   └── telegram/    # Bot Telegram
│   └── prisma/          # Schema do banco
├── frontend/
│   ├── src/
│   │   ├── components/  # Componentes React
│   │   ├── pages/       # Páginas do painel
│   │   └── contexts/     # React Context
│   └── public/
├── scripts/
│   ├── install-vps.sh   # Script instalação VPS
│   └── start-safe.cjs   # Script segurança
├── setup.ps1            # Script instalação Windows
└── start.ps1           # Script iniciar Windows
```

## Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `setup.ps1` | Instala todas as dependências |
| `start.ps1` | Inicia backend e frontend |
| `diagnose.ps1` | Diagnostica problemas |
| `scripts/install-vps.sh` | Instalação completa para VPS (Linux) |

## Instalação em VPS (Servidor Linux)

### Opção 1: Script Automático

1. Conecte ao servidor como root:
```bash
sudo su
```

2. Baixe o script:
```bash
curl -O https://raw.githubusercontent.com/vektortechmind/CHATBOT/main/scripts/install-vps.sh
```

3. Edite as configurações no início do script:
```bash
nano install-vps.sh
```
Configure:
- `PROJECT_DIR` - diretório de instalação
- `ADMIN_EMAIL` - email do admin
- `ADMIN_PASSWORD` - senha do admin
- `GITHUB_REPO` - seu repositório

4. Execute:
```bash
chmod +x install-vps.sh
./install-vps.sh
```

### O que o script faz:
- Instala Node.js 20 LTS
- Instala Git e PM2
- Instala e configura Nginx
- Configura firewall (UFW)
- Inicia com PM2 (mantém rodando 24/7)
- Auto-start no boot

### Comandos úteis (VPS):
```bash
pm2 status          # Ver status
pm2 logs           # Ver logs
pm2 restart all    # Reiniciar
pm2 stop all      # Parar
```

### Para HTTPS (SSL):
```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d seu-dominio.com
```

### Opção 2: Instalação Manual (VPS)

```bash
# 1. Clone o repositório
cd /var/www
git clone https://github.com/vektortechmind/CHATBOT.git
cd CHATBOT/backend

# 2. Configure
cp .env.example .env
nano .env  # Edite as variáveis

# 3. Instale
npm install
npx prisma generate
npx prisma db push
npm run build

# 4. Inicie com PM2
npm install -g pm2
pm2 start dist/server.js --name nexuszap
pm2 save
pm2 startup

# 5. Configure Nginx
nano /etc/nginx/sites-available/nexuszap
```

### Configuração Nginx:
```nginx
server {
    listen 80;
    server_name _;

    client_max_body_size 100M;

    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        root /var/www/CHATBOT/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/nexuszap /etc/nginx/sites-enabled/
systemctl reload nginx
```

## API Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Dados do usuário |
| GET | /api/agent/status | Status da instância |
| POST | /api/agent/start | Iniciar WhatsApp |
| POST | /api/agent/stop | Parar WhatsApp |
| GET | /api/agent/config | Ver configuração |
| PUT | /api/agent/config | Salvar configuração |
| GET | /api/dashboard/stats | Estatísticas |
| POST | /api/files/upload | Upload de arquivo |
| GET | /api/files | Listar arquivos |
| DELETE | /api/files/:id | Deletar arquivo |
| GET | /api/update/status | Status do update |

## Changelog

### v1.0.0
- Lançamento inicial
- WhatsApp com IA
- Telegram com IA
- Processamento de áudio
- Dashboard com estatísticas
- Base de conhecimento

## Licença

MIT
