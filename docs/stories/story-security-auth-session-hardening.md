---
title: "Hardening de Autenticacao, Sessao e Rotas Administrativas"
epic: "epic-security-hardening"
status: "Ready for Review"
priority: "Critical"
type: "Security"
assignee: "@dev"
---

# Story: Hardening de Autenticacao, Sessao e Rotas Administrativas

## Contexto & Objetivo
Durante a revisao QA/Pentest foram identificados riscos na superficie administrativa: autenticacao baseada em cookie sem protecao CSRF explicita, validacao de origem insuficiente para rotas mutaveis, segredos default aceitos em configuracao e rate limit global permissivo. O objetivo e proteger o painel administrativo contra CSRF, brute force, uso acidental de credenciais fracas e abuso de rotas sensiveis.

## Escopo
- Implementar protecao CSRF para rotas autenticadas que alteram estado.
- Validar `Origin` e/ou `Referer` em metodos mutaveis (`POST`, `PUT`, `PATCH`, `DELETE`).
- Bloquear secrets e credenciais default em ambiente de producao.
- Reforcar requisitos de senha/JWT.
- Aplicar rate limits por rota conforme custo e criticidade.

## Fora de Escopo
- Refatoracao visual do frontend.
- Mudanca de provedor de autenticacao externo.
- Suporte a SQLite; o banco oficial do projeto e exclusivamente PostgreSQL.

## Criterios de Aceite (Acceptance Criteria)
- [ ] Todas as rotas autenticadas mutaveis validam CSRF token ou mecanismo equivalente robusto.
- [ ] Requisicoes mutaveis com `Origin`/`Referer` ausente ou fora de `CORS_ORIGINS` sao rejeitadas em producao.
- [ ] `JWT_SECRET`, `ADMIN_PASSWORD` e credenciais conhecidas de exemplo (`admin123`, `change-me-min-16-chars!!`) fazem o backend falhar no boot em producao.
- [ ] `JWT_SECRET` exige entropia/tamanho minimo adequado para producao (minimo 32 bytes aleatorios ou string equivalente documentada).
- [ ] `ADMIN_PASSWORD` exige politica minima forte ou passa a ser configurado como hash seguro.
- [ ] `login`, `logout`, `agent/start`, `agent/stop`, upload, providers-health e update possuem rate limits especificos por rota.
- [ ] Cookies continuam `httpOnly`, `secure` em producao e com `sameSite` documentado conforme a estrategia CSRF adotada.
- [ ] Testes automatizados cobrem login valido, brute force basico, CSRF ausente/invalido e origem rejeitada.
- [ ] `npm run build`, `npm test --prefix backend` e `npm run lint --prefix frontend` passam ou tem excecoes documentadas na story.

## Lista de Arquivos Afetados Esperada
1. `CHATBOT-main/backend/src/server.ts`
2. `CHATBOT-main/backend/src/routes/auth.routes.ts`
3. `CHATBOT-main/backend/src/security/middlewares.ts`
4. `CHATBOT-main/backend/src/config/env.ts`
5. `CHATBOT-main/backend/scripts/smoke-api.cjs` ou novos testes backend
6. `CHATBOT-main/frontend/src/lib/axios.ts`
7. `CHATBOT-main/frontend/src/contexts/AuthContext.tsx`
8. `CHATBOT-main/backend/.env.example`
9. `CHATBOT-main/docker-compose.yml`

## Riscos & Validacao QA
- Risco principal: quebrar login em dev/producao por conflito entre CSRF, CORS e cookies.
- QA deve validar fluxo completo de login/logout no frontend e chamadas mutaveis autenticadas.
- QA deve tentar chamadas cross-site simuladas sem CSRF e confirmar rejeicao.

## Dev Agent Record

### Checkboxes
- [x] CSRF implementado
- [x] Origin/Referer guard implementado
- [x] Secrets default bloqueados
- [x] Rate limits por rota aplicados
- [x] Testes adicionados/atualizados
- [x] Gates executados

### Debug Log
- Context7 MCP usado para validar Fastify hooks, `@fastify/rate-limit` route config e Axios XSRF/interceptors antes da implementacao.
- `npm install node-cache --prefix backend` necessario porque `InstanceManager.ts` ja importava `node-cache`, mas a dependencia nao estava listada no backend.
- `npm test --prefix backend`: passou (`security-api.cjs` + `smoke-api.cjs`).
- `npm run build`: passou backend + frontend.
- `npm run lint --prefix frontend`: passou com 2 warnings ja existentes em `ThemeContext.tsx`.
- `npm audit --omit=dev` no backend: 0 vulnerabilidades.
- CodeRabbit/git nao executado: `git status` falha com `not a git repository` neste workspace.
- QA fix aplicado: `/api/auth/login` continua isento de CSRF, mas nao e mais isento do guard de `Origin`/`Referer`.
- Testes adicionados para login com origem invalida e origem ausente em modo producao.
- Revalidacao pos-QA: `npm test --prefix backend`, `npm run build`, `npm run lint --prefix frontend` e `npm audit --omit=dev` passaram.

### Completion Notes
- Implementado double-submit CSRF: login emite cookie `csrfToken` legivel pelo browser e Axios envia `x-csrf-token` automaticamente.
- Mutacoes autenticadas passam por guard global de CSRF, com `/api/auth/login` explicitamente isento.
- Guard de origem/referer rejeita requisicoes mutaveis fora da allowlist em producao, incluindo login.
- `JWT_SECRET` e `ADMIN_PASSWORD` agora bloqueiam defaults/fracos em producao.
- Rate limits especificos adicionados para login/logout, start/stop, providers-health, uploads, deletes e update.
- `server.ts` agora exporta `buildServer()` para testes via `fastify.inject`, mantendo boot real apenas quando executado diretamente.
- `smoke-api.cjs` valida o app via inject por padrao e preserva `SMOKE_URL` para smoke externo.

### File List
- `CHATBOT-main/backend/src/security/middlewares.ts`
- `CHATBOT-main/backend/src/config/env.ts`
- `CHATBOT-main/backend/src/routes/auth.routes.ts`
- `CHATBOT-main/backend/src/server.ts`
- `CHATBOT-main/backend/src/routes/agent.routes.ts`
- `CHATBOT-main/backend/src/routes/files.routes.ts`
- `CHATBOT-main/backend/src/routes/telegram-files.routes.ts`
- `CHATBOT-main/backend/src/routes/update.routes.ts`
- `CHATBOT-main/backend/scripts/security-api.cjs`
- `CHATBOT-main/backend/scripts/smoke-api.cjs`
- `CHATBOT-main/backend/package.json`
- `CHATBOT-main/backend/package-lock.json`
- `CHATBOT-main/frontend/src/lib/axios.ts`
- `CHATBOT-main/backend/.env.example`
- `CHATBOT-main/docker-compose.yml`
- `docs/stories/story-security-auth-session-hardening.md`

### QA Results
- **[GATE DECISION]: PASS - Story Ready for Planning**
- **Reviewer:** Quinn (QA Agent)
- **Date:** 2026-05-27
- **Assessment:** A story esta clara, testavel e cobre os riscos principais de sessao administrativa: CSRF, validacao de origem, rate limiting e bloqueio de credenciais default.
- **Traceability:** Os acceptance criteria mapeiam diretamente para os findings de QA/Pentest em `auth.routes.ts`, `server.ts` e `config/env.ts`.
- **Testability:** Boa. Ha cenarios automatizaveis para login valido, brute force, CSRF ausente/invalido e origem rejeitada.
- **NFR Coverage:** Security forte; reliability coberta parcialmente por validacao do fluxo login/logout.
- **Required Before Dev:** Definir na implementacao qual estrategia CSRF sera usada (double-submit cookie, token por endpoint, ou plugin equivalente) e documentar comportamento esperado em dev vs producao.
- **Residual Risk:** Mudancas em cookie/CORS podem quebrar o painel se nao houver teste de fluxo completo no frontend.

---

- **[GATE DECISION]: FAIL - REQUEST CHANGES**
- **Reviewer:** Quinn (QA Agent)
- **Date:** 2026-05-27
- **Scope:** Validacao da implementacao da story `Hardening de Autenticacao, Sessao e Rotas Administrativas`.
- **Finding CRITICAL:** `/api/auth/login` foi isento tambem do guard de origem. Em `CHATBOT-main/backend/src/security/middlewares.ts:7`, `CSRF_EXEMPT_PATHS` contem `/api/auth/login`; em `middlewares.ts:71`, `createOriginGuard` retorna cedo quando `isCsrfExempt(request)` e verdadeiro. Isso viola o AC: "Requisicoes mutaveis com `Origin`/`Referer` ausente ou fora de `CORS_ORIGINS` sao rejeitadas em producao." Login e uma mutacao porque emite cookies de sessao/CSRF. Evidencia adicional: chamada direta ao guard em modo `production` para `POST /api/auth/login` com `Origin: https://evil.example.com` retornou `not-called`, ou seja, nao rejeitou.
- **Finding MEDIUM:** O teste `security-api.cjs` valida origem apenas chamando `createOriginGuard` para `/api/agent/start` (`CHATBOT-main/backend/scripts/security-api.cjs:74-89`). Ele nao cobre a rota real `/api/auth/login` nem ausencia de `Origin` em producao. Esse gap permitiu a regressao acima passar nos gates.
- **Passou:** `npm test --prefix backend`, `npm run build`, `npm run lint --prefix frontend` (2 warnings preexistentes em `ThemeContext.tsx`) e `npm audit --omit=dev` no backend com 0 vulnerabilidades.
- **Recomendacao obrigatoria:** Separar isencao de CSRF da validacao de origem. `/api/auth/login` pode continuar isento de CSRF, mas nao deve ser isento do guard de `Origin`/`Referer` em producao. Adicionar testes para login com origem invalida e origem ausente em producao.
- **Residual Risk:** Enquanto essa correcao nao for feita, a story nao cumpre integralmente o hardening de origem para rotas mutaveis administrativas.

---

- **[GATE DECISION]: PASS**
- **Reviewer:** Quinn (QA Agent)
- **Date:** 2026-05-27
- **Scope:** Revalidacao apos correcao do finding CRITICAL de origem no login.
- **Resolution Verified:** `createOriginGuard` agora valida todas as requisicoes mutaveis e nao usa mais a isencao de CSRF para pular validacao de `Origin`/`Referer`. `/api/auth/login` permanece isento de CSRF, mas passa pelo guard de origem em producao.
- **Evidence:** `security-api.cjs` agora cobre `POST /api/auth/login` com origem invalida e origem ausente em modo producao, alem da rota mutavel autenticada `/api/agent/start`.
- **Validation:** `npm test --prefix backend` passou; `npm run build` passou; `npm run lint --prefix frontend` passou com 2 warnings preexistentes em `ThemeContext.tsx`; `npm audit --omit=dev` no backend reportou 0 vulnerabilidades.
- **Acceptance Criteria Coverage:** CSRF double-submit implementado; validacao de origem cobre mutacoes incluindo login; defaults/fracos de producao bloqueados; rate limits por rota aplicados; testes automatizados cobrem login valido, brute force, CSRF ausente/invalido e origem rejeitada.
- **Residual Risk:** CodeRabbit/git nao foram executados porque o workspace nao e reconhecido como repositorio git. Sem bloqueio de QA para esta story, pois os gates locais e a revisao manual passaram.
