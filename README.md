# NexusZAP - Chatbot com IA v1.0.3

Chatbot para WhatsApp e Telegram com IA, suporte a audio, base de conhecimento e painel administrativo.

## Recursos

- Respostas com LLMs: Gemini, Groq e OpenRouter.
- Processamento de audio e documentos: PDF, DOCX e TXT.
- Painel administrativo para instancias, agente IA, Telegram e configuracoes.
- Autenticacao JWT, criptografia de chaves sensiveis e rate limiting.
- Banco de dados oficial: PostgreSQL.

## Pre-requisitos

| Ferramenta | Versao | Download |
|------------|--------|----------|
| Node.js | 18+ | https://nodejs.org/ |
| Git | Latest | https://git-scm.com/ |
| Docker | Instalado automaticamente pelo `install.sh` em Debian/Ubuntu | https://www.docker.com/ |

Verificacao rapida:

```bash
node --version
npm --version
git --version
```

## Instalacao com um comando

Na VPS/Linux, rode a instalacao completa com um unico comando:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/vektortechmind/NEXUSZAP-FREE/main/install.sh)"
```

Esse comando pode ser executado em uma VPS limpa: se a pasta do projeto ainda nao existir, o instalador clona `NEXUSZAP-FREE` automaticamente e continua a instalacao dentro dela.

Se preferir auditar o script antes de executar, baixe e rode manualmente na VPS:

```bash
curl -fsSL https://raw.githubusercontent.com/vektortechmind/NEXUSZAP-FREE/main/install.sh -o install.sh
chmod +x install.sh
sudo ./install.sh
```

Em um clone Git existente na VPS/Linux, use `install.sh`:

```bash
chmod +x install.sh update.sh
sudo ./install.sh
```

O instalador faz o fluxo completo:

- cria `backend/.env` automaticamente se ainda nao existir;
- gera `JWT_SECRET` e `ENCRYPTION_KEY` automaticamente;
- gera `SETUP_TOKEN`, uma senha temporaria e mostra no terminal as URLs iniciais;
- na VPS Debian/Ubuntu, instala Docker Engine e Docker Compose plugin se estiverem ausentes;
- instala dependencias da raiz, backend e frontend;
- executa `prisma generate`;
- builda backend e frontend;
- se Docker estiver disponivel, sobe `postgres`, `backend` e `frontend` com `docker compose up -d --build`.

Ao final da instalacao na VPS, abra a URL exibida no terminal:

```text
http://SEU_IP/docker-setup?token=SEU_TOKEN
```

Informe o dominio publico, por exemplo `seudominio.com`. Isso ajusta `APP_URL`, `CORS_ORIGINS` e prepara a configuracao final.

Depois crie o primeiro administrador:

```text
http://SEU_DOMINIO/criar-admin?token=SEU_TOKEN
```

Essa etapa substitui a senha temporaria gerada na instalacao e bloqueia nova criacao publica de administrador.

URLs padrao na VPS com Docker:

- Painel: `http://SEU_IP` ou `https://SEU_DOMINIO`
- API: `http://SEU_IP/api` ou `https://SEU_DOMINIO/api`
- PostgreSQL: container interno `postgres:5432`

## Update

Na VPS/Linux, dentro da pasta do projeto:

```bash
./update.sh
```

O script de update:

- garante o remote oficial `https://github.com/vektortechmind/NEXUSZAP-FREE.git`;
- executa `git fetch` e `git pull --ff-only`;
- reinstala dependencias usando `npm ci` quando houver lockfile;
- executa `prisma generate` e `prisma migrate deploy`;
- builda o projeto;
- se Docker estiver disponivel, recria a stack com `docker compose up -d --build`.

Se o projeto foi baixado como ZIP, o update automatico nao deve ser usado nessa pasta. Clone pelo Git para manter updates seguros.

## Variaveis de ambiente

Arquivo: `backend/.env`

Modelo: `backend/.env.example`

Minimo esperado:

```env
NODE_ENV="production"
DATABASE_URL="postgresql://nexus:nexus_secret@localhost:5432/nexus_chatbot_db?schema=public"
PORT=3000
JWT_SECRET="gerado-automaticamente"
ENCRYPTION_KEY="gerado-automaticamente"
ADMIN_EMAIL="admin@nexuszap.com"
ADMIN_PASSWORD="senha-gerada"
ADMIN_SETUP_REQUIRED="true"
CORS_ORIGINS="http://localhost,http://localhost:5173,http://localhost:4173"
APP_URL="https://seudominio.com"
SETUP_TOKEN="token-gerado"
SETUP_COMPLETED="false"
GITHUB_REPO="vektortechmind/NEXUSZAP-FREE"
```

Em producao, ajuste `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `CORS_ORIGINS` para o dominio real do painel.

## Versao da aplicacao

A versao atual fica em `backend/VERSION`. Esse arquivo e versionado no Git e e atualizado pelo `update.sh` junto com o codigo.

Nao use `APP_VERSION` no `.env` como fonte principal de versao: o `.env` e preservado no update para nao sobrescrever secrets e configuracoes da VPS.

## Docker

Subir stack manualmente:

```bash
docker compose up -d --build
```

Ver logs:

```bash
docker compose logs -f
```

Parar:

```bash
docker compose down
```

## Scripts disponiveis

| Script | Descricao |
|--------|-----------|
| `install.sh` | Instalacao completa em VPS/Linux |
| `update.sh` | Atualizacao em VPS/Linux pelo repositorio oficial |
| `npm run build` | Build de backend e frontend |
| `npm run test:smoke` | Smoke test da API |
| `npm test --prefix backend` | Validacoes de seguranca e smoke do backend |

## Estrutura

```text
NEXUSZAP-FREE/
├── backend/
│   ├── prisma/
│   ├── scripts/
│   └── src/
├── frontend/
│   ├── public/
│   └── src/
├── scripts/
│   └── start-safe.cjs
├── docker-compose.yml
├── install.sh
├── update.sh
└── ecosystem.config.cjs
```

## Endpoints principais

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Usuario autenticado |
| GET | `/api/agent/status` | Status da instancia |
| POST | `/api/agent/start` | Iniciar WhatsApp |
| POST | `/api/agent/stop` | Parar WhatsApp |
| GET | `/api/config` | Configuracoes |
| PUT | `/api/config` | Atualizar configuracoes |
| GET | `/api/knowledge` | Listar base de conhecimento |
| POST | `/api/knowledge/upload` | Upload de documento |

## Seguranca operacional

Nunca commite `backend/.env`, `node_modules` ou `dist`. Esses caminhos devem permanecer locais e ja ficam fora do controle de versao pelo `.gitignore`.
