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

## Instalação

> **Nunca commite** `backend/.env`, bases `.db`, `node_modules` nem `dist` — já estão no `.gitignore` (o Git não os envia para o repositório por defeito).

Regra comum aos dois cenários: **criar `backend/.env` antes de `npm install` / scripts de instalação** (senha, JWT, base de dados). Modelo: `backend/.env.example`.

---

### No PC (desenvolvimento local)

1. Clonar e entrar na pasta:
   ```bash
   git clone https://github.com/vektortechmind/CHATBOT.git
   cd CHATBOT
   ```
2. Criar `backend/.env`:
   - **Windows (PowerShell):** `.\setup-env.ps1`
   - **Ou** copiar `backend/.env.example` → `backend/.env` e editar.
3. Instalar e arrancar:
   - **Windows:** `.\setup.ps1` depois `.\start.ps1` (abre API + painel em modo dev).
   - **macOS, WSL ou terminal com Bash:** na raiz, `npm install` dentro de `backend`, `frontend` e na raiz; depois `npm run dev` na raiz (ou dois terminais: `npm run dev` em `backend` e em `frontend`).
4. Abrir o painel: **http://localhost:5173** — login com `ADMIN_EMAIL` / `ADMIN_PASSWORD` do `.env`. API: **http://localhost:3000** por defeito (ou a porta em **`PORT`** no `.env`). Em dev, o Vite faz proxy de `/api` para o backend.

**Extra:** `.\diagnose.ps1` se algo falhar (Windows). `.\clean-repo.ps1` para apagar `node_modules`, `dist`, `.db` locais (pare o servidor antes).  
**Build local de teste:** na raiz, `npm run build`. Sem `VITE_API_URL`, o frontend usa a porta de `backend/.env` (ou `VITE_LOCAL_API_PORT`).

---

### Na VPS (produção)

1. **Node.js 18+** e **npm** na VPS.
2. Clonar e entrar na pasta (mesmo `git clone` de cima).
3. Criar `backend/.env`:
   - `./scripts/setup-env.sh` (torna executável antes: `chmod +x scripts/setup-env.sh`), **ou** copiar/editar `backend/.env.example`.
4. No `backend/.env`: definir **`PORT`** da API; **`CORS_ORIGINS`** = URL do painel no browser (com o script padrão o painel fica na porta **4173**, ex. `CORS_ORIGINS="http://SEU_IP:4173"`).
5. Instalar build e PM2 (na raiz do projeto):
   ```bash
   chmod +x install-vps.sh
   ./install-vps.sh --api-url "http://SEU_IP_OU_DOMINIO:PORTA_DA_API/api"
   ```
   A URL deve ser a que o **navegador** usa para a API (mesma porta que `PORT` no `.env`, salvo proxy).
6. Executar a linha **`sudo`** que o **`pm2 startup`** mostrar, para o PM2 voltar após reboot.
7. **Firewall:** abrir a porta da API e a **4173** (painel), ou só 80/443 se usares Nginx.

**Útil:** `pm2 status`, `pm2 logs`, `pm2 restart all`. Só build sem PM2: `./install-vps.sh --api-url "..." --skip-pm2`. Ajuda: `./install-vps.sh -h`.

---

### Opcional: mesmo fluxo da VPS no teu PC (Bash)

**Git Bash**, **WSL** ou **outro terminal com Bash** na pasta do projeto:  
`./install-vps.sh --api-url "http://127.0.0.1:3000/api"` (ajusta porta ao teu `.env`). Para trabalho diário no Windows, o fluxo **No PC** acima é mais simples.

## Configuração

### Variáveis de Ambiente (backend/.env)

Lista mínima exigida pelo servidor (ver também **`backend/.env.example`**):

```env
NODE_ENV=development

# Obrigatório — SQLite (caminho relativo à pasta prisma/)
DATABASE_URL="file:./chatbot.db"

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
CORS_ORIGINS="https://app.seudominio.com"

# Múltiplos domínios (troque pelos seus)
CORS_ORIGINS="https://app.seudominio.com,https://www.seudominio.com"

```

## Uso

1. Acesse `http://localhost:5173`
2. Faça login com as credenciais do `.env`
3. Conecte uma instância WhatsApp (QR Code ou link)
4. Configure o Agente IA com suas chaves de API
5. Personalize o prompt de sistema
6. Carregue arquivos para a base de conhecimento

### Reiniciar depois de parar (API + painel)

Se tiver fechado o terminal, usado Ctrl+C ou os processos pararam:

| Onde | Comando (na raiz do repositório clonado) |
|------|------------------------------------------|
| **PC (Windows, desenvolvimento)** | `.\start.ps1` — volta a subir o backend e o frontend (API em `http://localhost:3000`, painel em `http://localhost:5173`). |
| **VPS (PM2 já configurado)** | `pm2 restart all` — reinicia `chatbot-api` e `chatbot-web`. |
| **VPS (PM2 vazio / após `pm2 delete`)** | `pm2 start ecosystem.config.cjs` e depois `pm2 save`. |

**VPS após reboot do servidor:** se já tiver executado o `sudo` indicado por `pm2 startup`, o PM2 sobe sozinho. Se não, inicie com `pm2 resurrect` (se existir `pm2 save` anterior) ou `pm2 start ecosystem.config.cjs`.

**Só o processo Node parou, mas o PM2 continua:** use `pm2 logs` para ver erros e `pm2 restart chatbot-api` ou `chatbot-web` individualmente.

## Estrutura do Projeto

```
chatbot/
├── backend/
│   ├── .env.example     # Modelo (copiar para .env)
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
│   └── setup-env.sh     # Configurar .env (bash / VPS)
├── install-vps.sh       # VPS: build + PM2 + systemd (ver cabeçalho do script)
├── ecosystem.config.cjs # Definição PM2 (api + painel)
├── setup.ps1            # Script instalação Windows
├── start.ps1           # Script iniciar Windows
└── clean-repo.ps1      # Limpa node_modules, dist, SQLite (antes de commit / estado limpo)
```

## Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `setup-env.ps1` | **Rodar primeiro:** gera `backend/.env` (Windows, interativo) |
| `scripts/setup-env.sh` | **Rodar primeiro na VPS:** gera/edita `backend/.env` (bash) |
| `setup.ps1` | Instala dependências e base de dados (Windows) — **depois** do `setup-env.ps1` |
| `clean-repo.ps1` | Remove `node_modules`, `dist`, `.db`, etc. (estado limpo; parar o servidor antes) |
| `start.ps1` | Sobe API + painel em modo desenvolvimento (Windows) |
| `install-vps.sh` | VPS: build produção, PM2 (api + painel), `pm2 startup` |
| `ecosystem.config.cjs` | Definição dos processos PM2 |
| `diagnose.ps1` | Diagnóstico no Windows |
| `npm run build` (raiz) | Build produção: backend (`tsc`) + frontend (`vite build`) |
| `npm run test:smoke` (raiz) | Smoke test da API (`backend/scripts/smoke-api.cjs`) |

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
