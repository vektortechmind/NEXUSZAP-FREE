---
title: "Limpeza Operacional PostgreSQL e Quality Gates"
epic: "epic-security-hardening"
status: "Ready for Review"
priority: "High"
type: "Technical Debt"
assignee: "@dev"
---

# Story: Limpeza Operacional PostgreSQL e Quality Gates

## Contexto & Objetivo
O projeto ja migrou para PostgreSQL e SQLite nao faz mais parte do produto. Ainda existem referencias legadas a SQLite em documentacao/scripts, uso de `prisma db push --accept-data-loss` em fluxos operacionais, smoke test fragil e pequenos pontos de qualidade pendentes. O objetivo e alinhar operacao, documentacao e gates com PostgreSQL exclusivo.

## Escopo
- Remover referencias legadas a SQLite da documentacao e scripts ativos.
- Substituir fluxos destrutivos de schema por migrations seguras.
- Corrigir smoke test para validar a aplicacao correta.
- Remover ou proteger codigo morto/inseguro.
- Adicionar limite de crescimento para memoria em runtime.

## Fora de Escopo
- Qualquer compatibilidade com SQLite.
- Migracao de dados SQLite para PostgreSQL.
- Mudancas de infraestrutura cloud fora do Docker/local docs.

## Criterios de Aceite (Acceptance Criteria)
- [ ] Nenhum script/documento ativo instrui uso de `DATABASE_URL="file:./chatbot.db"` ou fluxo SQLite.
- [ ] `prisma db push --accept-data-loss` e removido de Dockerfile/scripts de producao/setup; producao usa `prisma migrate deploy`.
- [ ] `backend/package.json` diferencia comandos de desenvolvimento e producao para Prisma sem usar `db push` como migration de producao.
- [ ] `backend/prisma/migrations/` existe e representa o schema PostgreSQL atual ou a decisao equivalente e documentada.
- [ ] `frontend/.env.production.local` nao fica versionado como configuracao local de producao; exemplo correto fica em `.env.example`.
- [ ] `stats.routes.ts` e removido se nao usado, ou protegido por `verifyJwt` e corrigido para status `CONNECTED`.
- [ ] `memoryManager` possui TTL/LRU ou limite maximo de conversas para evitar crescimento indefinido.
- [ ] `smoke-api.cjs` valida explicitamente `/api/ping` da aplicacao correta, com porta configuravel e erro claro quando outro servidor responde.
- [ ] Warnings de lint conhecidos em `ThemeContext.tsx` sao corrigidos ou documentados como aceitaveis.
- [ ] `npm run build`, `npm test --prefix backend`, `npm run lint --prefix frontend` e `npm audit --omit=dev` passam.

## Lista de Arquivos Afetados Esperada
1. `CHATBOT-main/README.md`
2. `CHATBOT-main/install.bat`
3. `CHATBOT-main/update.bat`
4. `CHATBOT-main/scripts/setup-env.sh`
6. `CHATBOT-main/backend/Dockerfile`
7. `CHATBOT-main/backend/package.json`
8. `CHATBOT-main/backend/prisma/schema.prisma`
9. `CHATBOT-main/backend/prisma/migrations/`
10. `CHATBOT-main/backend/scripts/smoke-api.cjs`
11. `CHATBOT-main/backend/src/routes/stats.routes.ts`
12. `CHATBOT-main/backend/src/utils/ai/memoryManager.ts`
13. `CHATBOT-main/frontend/.env.production.local`
14. `CHATBOT-main/frontend/.env.example`
15. `CHATBOT-main/frontend/src/contexts/ThemeContext.tsx`

## Riscos & Validacao QA
- Risco principal: quebrar setup local ou container ao trocar `db push` por migrations.
- QA deve validar ambiente novo com PostgreSQL limpo via Docker.
- QA deve confirmar que nenhuma instrucao ativa sugere SQLite.

## Dev Agent Record

### Checkboxes
- [x] Referencias SQLite removidas
- [x] Migrations PostgreSQL configuradas
- [x] `accept-data-loss` removido de fluxos operacionais
- [x] Smoke test corrigido
- [x] Memory TTL/LRU implementado
- [x] Gates executados

### Debug Log
- 2026-05-27: Pos-solicitacao versao: criado `backend/VERSION` como fonte versionada de versao; `update.service` agora prioriza esse arquivo antes de `APP_VERSION` legado do `.env`.
- 2026-05-27: Pos-solicitacao versao: `install.bat`, `update.bat`, `install.sh`, `update.sh` e `scripts/setup-env.sh` deixaram de gravar `APP_VERSION` no `.env`; Dockerfile copia `VERSION` para runtime.
- 2026-05-27: Pos-solicitacao VPS: criados `install.sh` e `update.sh`; `install.sh` instala Docker Engine e Docker Compose plugin automaticamente em Debian/Ubuntu usando repositorio oficial Docker quando ausentes.
- 2026-05-27: Pos-solicitacao: todos os arquivos `.ps1` foram removidos do workspace; criados `install.bat` e `update.bat` como entrypoints sem PowerShell, com geracao automatica de `backend/.env`, `JWT_SECRET`, `ENCRYPTION_KEY` e repo oficial `vektortechmind/NEXUSZAP-FREE`.
- 2026-05-27: Pos-solicitacao: `install.bat` e `update.bat` limpam wrappers `.ps1` recriados por `npm install/npm ci`; gate `ops-postgresql-cleanup.cjs` agora valida ausencia de arquivos `.ps1`.
- 2026-05-27: Pos-QA: `docker-compose.yml` agora carrega `backend/.env`, recebe `ENCRYPTION_KEY` gerada automaticamente pela instalacao e fixa `GITHUB_REPO=vektortechmind/NEXUSZAP-FREE` para o backend em producao.
- 2026-05-27: Pos-QA: `setup-env.ps1` passou a gerar `ENCRYPTION_KEY` automaticamente sem pergunta manual; `setup-env.sh`, `.env.example` e README atualizados para `vektortechmind/NEXUSZAP-FREE`.
- 2026-05-27: Context7 consultado para Prisma; docs indicam `prisma migrate deploy` para producao/CI e evitar `db push` em ambientes produtivos.
- 2026-05-27: Criada migration inicial PostgreSQL em `backend/prisma/migrations/20260527000000_init_postgresql/migration.sql` e `migration_lock.toml`.
- 2026-05-27: Dockerfile, setup/start scripts e mensagens operacionais migrados para `prisma migrate deploy`; `--accept-data-loss` removido.
- 2026-05-27: Scripts/env/docs ativos deixaram de instruir `DATABASE_URL="file:./chatbot.db"` ou fluxo SQLite.
- 2026-05-27: `backend/scripts/backup-db.cjs` convertido para backup PostgreSQL via `pg_dump`.
- 2026-05-27: `stats.routes.ts` removido por estar morto e nao registrado no servidor; dashboard protegido permanece em `dashboard.routes.ts`.
- 2026-05-27: `memoryManager` recebeu TTL e limite LRU de conversas (`CHAT_MEMORY_TTL_MS`, `CHAT_MEMORY_MAX_CONVERSATIONS`).
- 2026-05-27: `smoke-api.cjs` agora valida explicitamente `{ pong: true }`, suporta `SMOKE_PORT` e emite erro claro quando a resposta nao e da aplicacao esperada.
- 2026-05-27: Warnings de Fast Refresh removidos separando `ThemeContext`, `ThemeProvider` e `useTheme`.
- 2026-05-27: `frontend/.env.production.local` removido; `ensure-env.mjs` nao cria mais arquivo local versionavel durante build.
- 2026-05-27: CodeRabbit nao executou porque o WSL nao possui distribuicoes instaladas.
- 2026-05-27: Workspace nao contem `.git`; `git status` ja falhava em stories anteriores com `fatal: not a git repository`.

### Completion Notes
- Versao da aplicacao agora acompanha o Git em `backend/VERSION`, entao updates podem alterar a versao sem sobrescrever `backend/.env`.
- Validado que `dist/services/update.service.js` retorna `CURRENT_VERSION=v1.0.0` a partir de `backend/VERSION`.
- VPS/Linux agora tem `install.sh` e `update.sh`; `install.sh` cobre instalacao automatica de Docker em Debian/Ubuntu. Para outras distros, o script falha com instrucao para instalar Docker Engine + Compose plugin manualmente.
- Context7 consultado para Docker; documentacao oficial confirma pacotes `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin` e `docker-compose-plugin` via APT.
- `bash -n` nao executou neste Windows porque o WSL nao possui distribuicao instalada; validacao estatica e gate Node confirmaram presenca dos comandos Docker esperados.
- PowerShell removido do projeto; instalacao passa a ser `install.bat` e update passa a ser `update.bat`.
- Validado que nao ha arquivos `.ps1` no workspace via `Get-ChildItem -Recurse -Filter *.ps1`.
- Validado `npm run build`, `npm test --prefix backend` e `npm run lint --prefix frontend` apos a remocao dos `.ps1`.
- `update.bat` validado no workspace atual ate a protecao esperada de pasta sem `.git`; ele orienta clonar `https://github.com/vektortechmind/NEXUSZAP-FREE.git`.
- Correcao pos-QA aplicada para o compose receber `ENCRYPTION_KEY` gerada na instalacao e `GITHUB_REPO` correto.
- Validado `docker compose config` com variaveis fortes de producao, `node dist/config/env` em modo production, `npm run build`, `npm test --prefix backend`, `npm run lint --prefix frontend` e `npm audit --omit=dev --json`.
- PostgreSQL ficou como caminho operacional exclusivo nos scripts e docs ativos.
- Fluxos produtivos usam migrations versionadas com `prisma migrate deploy`; `db:push` permanece apenas como comando explicito de desenvolvimento no `backend/package.json`.
- Adicionado teste de regressao `backend/scripts/ops-postgresql-cleanup.cjs` ao `npm test --prefix backend`.
- `npm run lint --prefix frontend` passou sem warnings.

### File List
- `CHATBOT-main/docker-compose.yml`
- `CHATBOT-main/README.md`
- `CHATBOT-main/install.bat`
- `CHATBOT-main/install.sh`
- `CHATBOT-main/update.bat`
- `CHATBOT-main/update.sh`
- `CHATBOT-main/clean-repo.ps1` (removido)
- `CHATBOT-main/setup.ps1` (removido)
- `CHATBOT-main/setup-env.ps1` (removido)
- `CHATBOT-main/start.ps1` (removido)
- `CHATBOT-main/start-backend-direct.ps1` (removido)
- `CHATBOT-main/scripts/setup-env.sh`
- `CHATBOT-main/backend/Dockerfile`
- `CHATBOT-main/backend/VERSION`
- `CHATBOT-main/backend/.env.example`
- `CHATBOT-main/backend/package.json`
- `CHATBOT-main/backend/prisma/migrations/migration_lock.toml`
- `CHATBOT-main/backend/prisma/migrations/20260527000000_init_postgresql/migration.sql`
- `CHATBOT-main/backend/scripts/backup-db.cjs`
- `CHATBOT-main/backend/scripts/ops-postgresql-cleanup.cjs`
- `CHATBOT-main/backend/scripts/smoke-api.cjs`
- `CHATBOT-main/backend/src/routes/stats.routes.ts` (removido)
- `CHATBOT-main/backend/src/utils/ai/memoryManager.ts`
- `CHATBOT-main/backend/src/utils/prismaErrorHandler.ts`
- `CHATBOT-main/frontend/.env.production.local` (removido)
- `CHATBOT-main/frontend/scripts/ensure-env.mjs`
- `CHATBOT-main/frontend/src/contexts/ThemeContext.ts`
- `CHATBOT-main/frontend/src/contexts/ThemeProvider.tsx`
- `CHATBOT-main/frontend/src/contexts/useTheme.ts`
- `CHATBOT-main/frontend/src/contexts/ThemeContext.tsx` (removido)
- `CHATBOT-main/frontend/src/App.tsx`
- `CHATBOT-main/frontend/src/components/ThemeToggle.tsx`
- `CHATBOT-main/frontend/src/contexts/ToastContext.tsx`
- `CHATBOT-main/frontend/src/lib/axios.ts`
- `docs/stories/story-ops-postgresql-quality-gates-cleanup.md`

### Change Log
- Adicionado `backend/VERSION` como arquivo versionado de versao; `.env` nao e mais fonte principal para versao da aplicacao.
- Adicionados scripts VPS/Linux `install.sh` e `update.sh`; instalacao VPS agora instala Docker automaticamente em Debian/Ubuntu.
- Removidos todos os arquivos PowerShell `.ps1`; criados `install.bat` e `update.bat` para instalacao/update em um comando.
- Gate operacional atualizado para validar ausencia de `.ps1` e os novos entrypoints `.bat`.
- Operacao alinhada para PostgreSQL exclusivo com migrations versionadas.
- Removidos residuos ativos de SQLite e `--accept-data-loss`.
- Smoke test, backup, memoria em runtime e lint do tema corrigidos.
- Adicionado gate automatizado de cleanup PostgreSQL.
- Corrigido bloqueio QA do Docker Compose para receber `ENCRYPTION_KEY` gerada na instalacao e `GITHUB_REPO=vektortechmind/NEXUSZAP-FREE`.
### QA Results

- **[GATE DECISION]: FAIL - Docker production env incomplete**
- **Reviewer:** Quinn (QA Agent)
- **Date:** 2026-05-27
- **Assessment:** A implementacao cobre a maior parte dos criterios funcionais e os gates locais passaram, mas a validacao operacional Docker ainda falha por incompatibilidade entre `docker-compose.yml` e a validacao de ambiente de producao do backend.
- **Blocking Finding:** `CHATBOT-main/docker-compose.yml` define `NODE_ENV: production` para o backend, mas nao declara `ENCRYPTION_KEY` nem `GITHUB_REPO`. O backend exige ambas em producao em `backend/src/config/env.ts`; validacao local com as variaveis do compose confirmou falha de parse para `GITHUB_REPO` e `ENCRYPTION_KEY`. Isso impede validar ambiente novo PostgreSQL via Docker e pode impedir o container de iniciar.
- **Evidence:** `docker compose config` com `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `CORS_ORIGINS` definidos mostra backend sem `ENCRYPTION_KEY`/`GITHUB_REPO`. `node -e "require('./dist/config/env')"` em `NODE_ENV=production` sem essas variaveis retorna erros de validacao para ambas.
- **Traceability:** ACs de limpeza SQLite, remocao de `accept-data-loss`, migrations, smoke test, memoria TTL/LRU, lint e audit estao cobertos por codigo/testes. AC de ambiente operacional PostgreSQL/Docker fica bloqueado ate corrigir o compose/env example.
- **Tests Executed:** `npm run build` PASS; `npm test --prefix backend` PASS; `npm run lint --prefix frontend` PASS; `npm audit --omit=dev --json` PASS com 0 vulnerabilidades; `npm exec prisma validate` PASS; `rg` para `sqlite`, `SQLite`, `file:./chatbot.db`, `chatbot.db`, `accept-data-loss` em arquivos ativos PASS.
- **CodeRabbit:** Nao executado; WSL sem distribuicoes instaladas.
- **Required Fix:** Atualizar `docker-compose.yml` para exigir/repassar `ENCRYPTION_KEY` e `GITHUB_REPO` no backend, e documentar esses valores no exemplo/README se necessario. Depois validar `docker compose config` e, idealmente, subida em PostgreSQL limpo.
- **Residual Risk:** `db:push` ainda existe como comando explicito no package, mas nao aparece como fluxo produtivo nem em docs/scripts ativos; nao bloqueia desde que permaneça restrito a desenvolvimento.
- **[GATE DECISION]: PASS - Story Ready for Planning**
- **Reviewer:** Quinn (QA Agent)
- **Date:** 2026-05-27
- **Assessment:** A story esta alinhada com a decisao de produto: SQLite esta obsoleto e nao deve ser suportado. O escopo cobre limpeza operacional, migrations PostgreSQL, smoke test, memoria e gates.
- **Traceability:** Rastreia diretamente os achados em `Dockerfile`, scripts PowerShell/shell, `backend/package.json`, `smoke-api.cjs`, `stats.routes.ts` e `memoryManager.ts`.
- **Testability:** Boa. Os gates finais estao claros e incluem build, smoke test, lint e audit.
- **NFR Coverage:** Reliability e operability fortes; security contemplada pela remocao de `accept-data-loss` e limpeza de configuracoes locais indevidas.
- **Required Before Dev:** Confirmar estrategia de migrations PostgreSQL para ambiente novo e producao antes de remover `db push` dos fluxos operacionais.
- **Residual Risk:** Trocar `db push` por migrations pode quebrar setup local se o README/scripts nao forem atualizados em conjunto.




