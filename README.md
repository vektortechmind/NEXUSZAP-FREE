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
│   └── setup-env.sh     # Configurar .env (Linux)
├── setup.html           # Gerador de .env (navegador)
├── setup.ps1            # Script instalação Windows
└── start.ps1           # Script iniciar Windows
```

## Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `setup.ps1` | Instala todas as dependências |
| `start.ps1` | Inicia backend e frontend |
| `diagnose.ps1` | Diagnostica problemas |
| `setup.html` | Gerador de .env pelo navegador |

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
