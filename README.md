# NexusZAP - Chatbot com IA v1.0.0

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
| Docker | Opcional no Windows; instalado automaticamente pelo `install.sh` em Debian/Ubuntu | https://www.docker.com/ |

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

Se preferir auditar o script antes de executar, baixe e rode manualmente:

```bash
curl -fsSL https://raw.githubusercontent.com/vektortechmind/NEXUSZAP-FREE/main/install.sh -o install.sh
chmod +x install.sh
sudo ./install.sh
```

No Windows, clone o repositorio oficial e rode o instalador:

```bash
git clone https://github.com/vektortechmind/NEXUSZAP-FREE.git
cd NEXUSZAP-FREE
install.bat
```

Em um clone Git existente na VPS/Linux, use `install.sh`:

```bash
chmod +x install.sh update.sh
sudo ./install.sh
```

O instalador faz o fluxo completo:

- cria `backend/.env` automaticamente se ainda nao existir;
- gera `JWT_SECRET` e `ENCRYPTION_KEY` automaticamente;
- gera uma senha inicial para o admin e mostra no terminal;
- na VPS Debian/Ubuntu, instala Docker Engine e Docker Compose plugin se estiverem ausentes;
- instala dependencias da raiz, backend e frontend;
- executa `prisma generate`;
- builda backend e frontend;
- se Docker estiver disponivel, sobe `postgres`, `backend` e `frontend` com `docker compose up -d --build`.

URLs padrao com Docker:

- Painel: `http://localhost`
- API: `http://localhost:3000`
- PostgreSQL: `localhost:5432`

Para desenvolvimento sem Docker, depois da instalacao rode:

```bash
npm run dev
```

Nesse modo o painel fica em `http://localhost:5173` e a API em `http://localhost:3000`.

## Update

Na raiz do clone Git:

```bat
update.bat
```

Na VPS/Linux:

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
CORS_ORIGINS="http://localhost,http://localhost:5173,http://localhost:4173"
GITHUB_REPO="vektortechmind/NEXUSZAP-FREE"
```

Em producao, ajuste `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `CORS_ORIGINS` para o dominio real do painel.

## Versao da aplicacao

A versao atual fica em `backend/VERSION`. Esse arquivo e versionado no Git e e atualizado pelo `update.bat`/`update.sh` junto com o codigo.

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
| `install.bat` | Instalacao completa em um comando |
| `install.sh` | Instalacao completa em VPS/Linux |
| `update.bat` | Atualizacao pelo repositorio oficial |
| `update.sh` | Atualizacao em VPS/Linux pelo repositorio oficial |
| `npm run dev` | Backend e frontend em desenvolvimento |
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
├── install.bat
├── install.sh
├── update.bat
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
