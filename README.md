# NexusZAP - Chatbot com IA v1.0.3

NexusZAP e uma plataforma de automacao para WhatsApp e Telegram com IA, base de conhecimento, painel administrativo e endpoint publico de integracoes para sistemas externos.

## Visao geral

O produto esta organizado em cinco frentes operacionais dentro do painel:

- `Dashboard`: visao consolidada de volume por canal, uso de IA e base ativa.
- `Instancias`: gestao de conexoes WhatsApp e Telegram, QR Code, status e acoes operacionais.
- `Integracoes`: credenciais, auditoria global e documentacao publica do endpoint `/api/integrations/events`.
- `Agente IA`: configuracao de runtime, prompt principal, arquivos de conhecimento e workspace por agente.
- `Configuracoes`: chaves, providers e recursos de sistema, incluindo OpenRouter quando houver chave configurada.

## Recursos principais

- Automacao para `WhatsApp` e `Telegram` com painel unico.
- Runtime de IA com `Gemini`, `Groq` e `OpenRouter`.
- Base de conhecimento com upload de `PDF`, `DOCX`, `TXT`, `JSON` e imagens.
- Gestao de agentes com prompt principal, configuracoes de runtime e arquivos por workspace.
- Endpoint publico de integracoes com autenticacao por `Bearer token`, `instanceId`, `timestamp` e `dedupKey`.
- Templates operacionais por evento para cobranca, acesso, assinatura, Pix, boleto e recuperacao.
- Auditoria global de ingressos e dispatches das integracoes.
- Autenticacao JWT, criptografia de segredos e rate limiting.
- PostgreSQL como banco oficial.

## Pre-requisitos

| Ferramenta | Versao | Download |
|------------|--------|----------|
| Node.js | 18+ | https://nodejs.org/ |
| Git | Atual | https://git-scm.com/ |
| Docker | Instalado automaticamente pelo `install.sh` em Debian/Ubuntu | https://www.docker.com/ |

Verificacao rapida:

```bash
node --version
npm --version
git --version
```

## Instalacao com um comando

Em uma VPS Linux, rode a instalacao completa com um unico comando:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/vektortechmind/NEXUSZAP-FREE/main/install.sh)"
```

Esse comando pode ser executado em uma VPS limpa. Se a pasta do projeto ainda nao existir, o instalador clona `NEXUSZAP-FREE` automaticamente e continua a instalacao dentro dela.

Se preferir auditar o script antes de executar:

```bash
curl -fsSL https://raw.githubusercontent.com/vektortechmind/NEXUSZAP-FREE/main/install.sh -o install.sh
chmod +x install.sh
sudo ./install.sh
```

Em um clone Git ja existente na VPS:

```bash
chmod +x install.sh update.sh
sudo ./install.sh
```

## O que o instalador faz

O `install.sh` executa o fluxo completo:

- cria `backend/.env` automaticamente se ele ainda nao existir;
- gera `JWT_SECRET`, `ENCRYPTION_KEY`, `SETUP_TOKEN` e senha temporaria de bootstrap;
- instala Docker Engine e Docker Compose plugin em Debian/Ubuntu quando necessario;
- instala dependencias da raiz, backend e frontend;
- executa `prisma generate`;
- builda backend e frontend;
- sobe `postgres`, `backend` e `frontend` com `docker compose up -d --build` quando Docker estiver disponivel.

## Primeiro acesso

Ao final da instalacao na VPS, abra a URL mostrada no terminal:

```text
http://SEU_IP/docker-setup?token=SEU_TOKEN
```

Informe o dominio publico, por exemplo `seudominio.com`. Essa etapa ajusta `APP_URL`, `CORS_ORIGINS` e prepara a configuracao final.

Depois crie o primeiro administrador:

```text
http://SEU_DOMINIO/criar-admin?token=SEU_TOKEN
```

Essa etapa substitui a senha temporaria gerada na instalacao e bloqueia nova criacao publica de administrador.

URLs padrao na VPS com Docker:

- Painel: `http://SEU_IP` ou `https://SEU_DOMINIO`
- API: `http://SEU_IP/api` ou `https://SEU_DOMINIO/api`
- PostgreSQL: container interno `postgres:5432`

## Update na VPS

Dentro da pasta do projeto na VPS/Linux:

```bash
./update.sh
```

O `update.sh`:

- garante o remote oficial `https://github.com/vektortechmind/NEXUSZAP-FREE.git`;
- executa `git fetch` e `git pull --ff-only`;
- reinstala dependencias com `npm ci` quando houver lockfile;
- executa `prisma generate`;
- builda o projeto;
- recria `backend` e `frontend` com Docker quando houver mudancas que afetem os containers.

Se a pasta atual foi baixada como ZIP, nao use update automatico nela. Clone pelo Git para manter updates seguros.

## Variaveis de ambiente

Arquivo principal:

```text
backend/.env
```

Modelo:

```text
backend/.env.example
```

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

Em producao, ajuste `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `APP_URL` e `CORS_ORIGINS` para o dominio real do painel.

## Estrutura do projeto

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

## Desenvolvimento local

Subir frontend e backend em modo desenvolvimento:

```bash
npm install
npm run dev
```

Outros comandos uteis:

```bash
npm run dev:api
npm run dev:web
npm run build
npm run lint
npm run typecheck
npm test
```

## Docker

Subir stack manualmente:

```bash
docker compose up -d --build
```

Ver logs:

```bash
docker compose logs -f
```

Parar containers:

```bash
docker compose down
```

## Painel administrativo

### Dashboard

Mostra:

- volume por periodo;
- volume por canal;
- uso de IA;
- quantidade de arquivos da base;
- tendencia diaria;
- atividade em destaque.

### Instancias

Permite:

- criar instancias WhatsApp;
- gerar QR Code e conectar;
- configurar o singleton do Telegram;
- abrir detalhes operacionais de cada canal;
- desconectar ou remover quando aplicavel.

### Agente IA

Permite:

- criar agentes para WhatsApp e Telegram;
- definir nome e prompt principal;
- ajustar provider e memoria do runtime;
- configurar modelo OpenRouter quando selecionado;
- enviar arquivos de conhecimento;
- manter workspace separado por agente.

### Integracoes

A area de integracoes separa credenciais, operacao e documentacao tecnica.

Fluxo operacional:

1. selecione a instancia correta;
2. abra `Credenciais`;
3. obtenha `instanceId`, `endpointUrl` e `secretToken`;
4. configure o sistema externo para enviar eventos para o endpoint publico.

A operacao tambem oferece auditoria global de ingressos e dispatches para todos os eventos.

## Endpoint publico de integracoes

Endpoint principal:

```text
POST /api/integrations/events
```

Headers obrigatorios:

```text
Authorization: Bearer <secretToken>
Content-Type: application/json
```

Campos principais do body:

- `event`: slug do evento suportado;
- `instanceId`: precisa pertencer a mesma credencial autenticada;
- `timestamp`: entra na replay window operacional;
- `dedupKey`: chave idempotente obrigatoria por credencial;
- `payload`: contexto operacional usado para normalizacao e renderizacao.

Eventos suportados atualmente:

- `pedido_pendente`
- `pedido_pago`
- `envio_acesso`
- `pagamento_recusado`
- `pedido_cancelado`
- `reembolso`
- `pix_gerado`
- `boleto_gerado`
- `carrinho_abandonado`
- `assinatura_criada`
- `assinatura_renovada`
- `assinatura_cancelada`
- `assinatura_em_atraso`

Tipos de mensagem usados pelo runtime:

- `text`
- `link`
- `image`
- `document`

A documentacao publica completa desse endpoint fica dentro do proprio painel, em `Integracoes -> Documentacao`.

## Credenciais de integracao

Cada credencial e vinculada a uma instancia operacional.

Campos operacionais:

- `endpointUrl`: URL final completa da integracao;
- `instanceId`: identificador autorizado para a chamada;
- `secretToken`: token Bearer ativo emitido ou rotacionado no painel.

Regras principais:

- o `instanceId` do body precisa pertencer a credencial autenticada;
- `timestamp` fora da janela permitida gera bloqueio;
- `dedupKey` repetida dentro da janela da credencial e recusada;
- a resposta `202 accepted` indica aceite do evento e inicio do dispatch, nao confirmacao sincrona de entrega no WhatsApp.

## Scripts disponiveis

| Script | Descricao |
|--------|-----------|
| `install.sh` | Instalacao completa em VPS/Linux |
| `update.sh` | Atualizacao em VPS/Linux pelo repositorio oficial |
| `npm run dev` | Frontend e backend em desenvolvimento |
| `npm run build` | Build de backend e frontend |
| `npm run lint` | Lint do frontend |
| `npm run typecheck` | Typecheck de backend e frontend |
| `npm test` | Suite atual do backend |
| `npm run test:smoke` | Smoke test do backend/API |

## Seguranca operacional

Nunca commite:

- `backend/.env`
- `node_modules`
- `dist`
- secrets, tokens ou credenciais exportadas do painel

Esses caminhos devem permanecer locais e ja ficam protegidos pelo `.gitignore` quando aplicavel.
