---
title: "Revisao Segura do Auto-Update e Supply Chain"
epic: "epic-security-hardening"
status: "Ready for Review"
priority: "Critical"
type: "Security"
assignee: "@dev"
---

# Story: Revisao Segura do Auto-Update e Supply Chain

## Contexto & Objetivo
O recurso de auto-update baixa um zipball do GitHub e substitui arquivos da aplicacao em runtime. Esse desenho cria risco elevado de supply-chain e execucao remota pos-restart caso repo, token, tag ou release sejam comprometidos. A decisao de produto para esta story e **remover/desativar o apply remoto do painel** e manter apenas recursos seguros de consulta/status de versao.

## Escopo
- Remover ou desativar `/api/update/apply` no backend.
- Remover do frontend qualquer acao que aplique update remoto sobre os arquivos da aplicacao.
- Manter, se util, apenas `/api/update/status` como consulta segura de versao/release.
- Remover codigo morto de download/extracao/movimentacao de zipball quando nao for mais usado.
- Documentar runbook seguro de atualizacao manual/operacional.

## Fora de Escopo
- Criar pipeline completo de CI/CD cloud.
- Criar releases/tags no GitHub; autoridade de release e de push pertence a @devops.
- Implementar qualquer caminho alternativo que mantenha apply remoto, mesmo com assinatura/hash, nesta etapa.
- Suporte a SQLite; o banco oficial do projeto e exclusivamente PostgreSQL.

## Criterios de Aceite (Acceptance Criteria)
- [x] `/api/update/apply` deixa de existir ou retorna `410 Gone` com mensagem clara de que apply remoto foi desativado por seguranca.
- [x] O frontend nao oferece botao, formulario ou chamada de apply remoto.
- [x] Codigo nao usado de download de zipball, extracao, `moveContents`, backup/restore automatico e limpeza de zip e removido ou tornado inacessivel.
- [x] `/api/update/status`, se mantido, continua apenas consultivo e nao altera arquivos locais.
- [x] `GITHUB_REPO` deve ser obrigatorio em producao se `/api/update/status` continuar ativo e nao pode usar `owner/repo` default.
- [x] Token GitHub, se usado, permanece criptografado e nunca aparece em logs/respostas.
- [x] Runbook de atualizacao segura e rollback manual/operacional documentado.
- [x] Testes cobrem apply remoto desativado, ausencia de chamada pelo frontend e status consultivo sem efeito colateral.
- [x] `npm run build`, `npm test --prefix backend` e `npm run lint --prefix frontend` passam ou tem excecoes documentadas na story.

## Lista de Arquivos Afetados Esperada
1. `CHATBOT-main/backend/src/routes/update.routes.ts`
2. `CHATBOT-main/backend/src/services/update.service.ts`
3. `CHATBOT-main/backend/src/services/github.service.ts`
4. `CHATBOT-main/frontend/src/components/UpdateSection.tsx`
5. `CHATBOT-main/backend/src/config/env.ts`
6. Documentacao em `CHATBOT-main/README.md` ou `docs/`
7. Testes backend novos ou atualizados

## Riscos & Validacao QA
- Risco principal: deixar algum caminho residual capaz de alterar arquivos locais.
- QA deve classificar gate como FAIL se qualquer rota ou acao de frontend ainda permitir apply remoto.
- QA deve validar que `/api/update/status`, se mantido, e somente leitura.

## PM Resolution
- Decisao fechada para desenvolvimento: **remover/desativar apply remoto**.
- A ressalva anterior de arquitetura fica resolvida por escopo: nao sera mantido fluxo de download/extracao/aplicacao de zipball.
- A story esta pronta para @dev implementar sem etapa previa de @architect.

## Dev Agent Record

### Checkboxes
- [x] Apply remoto removido/desativado
- [x] Acao de apply remoto removida do frontend
- [x] Codigo morto de zip/extracao removido ou tornado inacessivel
- [x] Runbook documentado
- [x] Testes adicionados/atualizados
- [x] Gates executados

### Debug Log
- 2026-05-27: `/api/update/apply` alterado para retornar `410 Gone` com mensagem de seguranca; rota nao importa nem chama `applyUpdate`.
- 2026-05-27: `update.service.ts` reduzido a consulta de versao/status e gestao segura de token GitHub; removido codigo de download de zipball, extracao, backup/restore, move de arquivos e limpeza de zip.
- 2026-05-27: `GITHUB_REPO` passa a ser obrigatorio em producao para status de update e nao aceita o default `owner/repo`.
- 2026-05-27: Frontend `UpdateSection` ficou somente consultivo; removidos botao, estado e chamada de apply remoto.
- 2026-05-27: Dependencias `unzipper` e `@types/unzipper` removidas do backend.
- 2026-05-27: `git status --short` nao executou porque o workspace nao contem `.git`: `fatal: not a git repository (or any of the parent directories): .git`.

### Completion Notes
- Implementado bloqueio definitivo do apply remoto com resposta `410 Gone` autenticada.
- Mantido `/api/update/status` apenas como consulta de release, sem operacoes de filesystem.
- Adicionado runbook manual em `docs/runbooks/manual-update.md`.
- Adicionado teste `backend/scripts/update-disabled.cjs` cobrindo rota desativada, ausencia de chamada no frontend e ausencia de codigo mutante no servico.
- Validacoes executadas: `node scripts/update-disabled.cjs`, `npm run build`, `npm test --prefix backend`, `npm run lint --prefix frontend`, `npm audit --omit=dev --json`.
- `npm run lint --prefix frontend` passou com 2 warnings preexistentes em `frontend/src/contexts/ThemeContext.tsx` sobre Fast Refresh.

### File List
- `CHATBOT-main/backend/src/routes/update.routes.ts`
- `CHATBOT-main/backend/src/services/update.service.ts`
- `CHATBOT-main/backend/src/config/env.ts`
- `CHATBOT-main/backend/scripts/update-disabled.cjs`
- `CHATBOT-main/backend/package.json`
- `CHATBOT-main/backend/package-lock.json`
- `CHATBOT-main/frontend/src/components/UpdateSection.tsx`
- `docs/runbooks/manual-update.md`
- `docs/stories/story-security-auto-update-supply-chain.md`

### Change Log
- Desativado apply remoto de update e removido caminho de mutacao de arquivos por zipball.
- Frontend alterado para consulta de versao e abertura do release no GitHub, sem aplicar update.
- Reforcada validacao de `GITHUB_REPO` em producao.
- Incluido runbook de atualizacao/rollback manual e teste de regressao de supply chain.

### QA Results
- **[GATE DECISION]: CONCERNS - Needs Architecture Split/Clarification**
- **Reviewer:** Quinn (QA Agent)
- **Date:** 2026-05-27
- **Assessment:** A story captura o risco correto e tem criterios fortes para supply chain, mas mistura decisao arquitetural e implementacao no mesmo backlog item. Isso pode atrasar o desenvolvimento ou gerar escopo ambiguo.
- **Traceability:** Rastreia bem os achados em `update.routes.ts`, `update.service.ts`, `github.service.ts` e `UpdateSection.tsx`.
- **Testability:** Boa se a decisao for tomada antes do dev. Os testes de tag invalida, path traversal, hash/assinatura e rollback sao verificaveis.
- **NFR Coverage:** Security critica; operability coberta por runbook e rollback.
- **Required Before Dev:** @architect deve registrar a decisao antes da implementacao: remover `/api/update/apply` ou manter com assinatura/hash, temp dir isolado e path containment. Depois disso, a story pode seguir para @dev ou ser quebrada em ADR + story de implementacao.
- **Residual Risk:** QA deve manter gate FAIL se o apply remoto permanecer sem verificacao criptografica e isolamento forte.



