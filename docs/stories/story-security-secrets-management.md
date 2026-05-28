---
title: "Gestao Segura de Segredos e Sanitizacao de Logs"
epic: "epic-security-hardening"
status: "Ready for Review"
priority: "Critical"
type: "Security"
assignee: "@dev"
---

# Story: Gestao Segura de Segredos e Sanitizacao de Logs

## Contexto & Objetivo
A revisao QA/Pentest identificou que chaves de IA podem ser salvas e devolvidas em texto claro pela rota de configuracao, enquanto alguns logs e scripts de debug podem expor informacoes sensiveis. O objetivo e tornar segredos write-only no frontend/API, criptografados em repouso e sempre mascarados quando exibidos.

## Escopo
- Criptografar chaves de IA e tokens armazenados no banco.
- Mascarar dados sensiveis em respostas de API.
- Sanitizar logs de erros de provedores externos.
- Exigir `ENCRYPTION_KEY` segura em producao.
- Remover exposicao de segredos em scripts de debug.

## Fora de Escopo
- Rotacao automatica de chaves em provedores externos.
- Implementacao de secret manager cloud especifico.
- Suporte a SQLite; o banco oficial do projeto e exclusivamente PostgreSQL.

## Criterios de Aceite (Acceptance Criteria)
- [ ] `groqKey`, `groqAudioKey`, `geminiKey`, `openrouterKey`, `telegramBotToken` e `githubToken` nunca sao retornados em texto claro por nenhuma rota.
- [ ] `/api/agent/config` retorna apenas campos nao sensiveis e versoes mascaradas dos segredos quando necessario.
- [ ] Atualizacao de configuracao preserva segredos existentes quando o frontend envia campo vazio/omitido por nao querer alterar a chave.
- [ ] Segredos novos sao criptografados antes de persistir no PostgreSQL.
- [ ] `ENCRYPTION_KEY` e obrigatoria em `NODE_ENV=production`; fallback para `.encryption_key` so pode existir em desenvolvimento/teste.
- [ ] Logs de Groq, Gemini, OpenRouter, Telegram, GitHub e Prisma nao incluem tokens, Authorization headers, API keys, prompts completos ou payloads brutos sensiveis.
- [ ] `debug-start.cjs` redige `DATABASE_URL`, e-mail admin e qualquer variavel sensivel.
- [ ] Testes cobrem resposta de `/agent/config`, persistencia criptografada e preservacao de segredo omitido.
- [ ] `npm run build`, `npm test --prefix backend` e `npm run lint --prefix frontend` passam ou tem excecoes documentadas na story.

## Lista de Arquivos Afetados Esperada
1. `CHATBOT-main/backend/src/routes/agent.routes.ts`
2. `CHATBOT-main/backend/src/services/crypto.service.ts`
3. `CHATBOT-main/backend/src/services/update.service.ts`
4. `CHATBOT-main/backend/src/telegram/TelegramBotManager.ts`
5. `CHATBOT-main/backend/src/ai/providerSelector.ts`
6. `CHATBOT-main/backend/src/ai/groq.ts`
7. `CHATBOT-main/backend/src/ai/gemini.ts`
8. `CHATBOT-main/backend/src/ai/openrouter.ts`
9. `CHATBOT-main/backend/src/config/env.ts`
10. `CHATBOT-main/backend/debug-start.cjs`
11. `CHATBOT-main/frontend/src/pages/Apis.tsx`
12. `CHATBOT-main/frontend/src/pages/Instancia.tsx`

## Riscos & Validacao QA
- Risco principal: perder chaves ja cadastradas ao salvar configuracoes parciais.
- QA deve validar mascaramento no frontend e ausencia de segredo completo no trafego da API.
- QA deve validar que dados criptografados continuam utilizaveis pelos provedores.

## Dev Agent Record

### Checkboxes
- [x] Campos sensiveis criptografados
- [x] Respostas mascaradas/write-only
- [x] Logs sanitizados
- [x] `ENCRYPTION_KEY` obrigatoria em producao
- [x] Testes adicionados/atualizados
- [x] Gates executados

### Debug Log
- 2026-05-27: Implementado mascaramento/write-only para `/api/agent/config`, criptografia de novas chaves de IA e preservacao de segredos omitidos/vazios.
- 2026-05-27: Sanitizados logs de provedores IA, Telegram, GitHub, Prisma, WhatsApp/Baileys, update routes e `debug-start.cjs`.
- 2026-05-27: Context7 MCP consultado para padrao Prisma Client de transformacao/validacao de `data` antes de updates.
- 2026-05-27: Validacoes executadas: `npm test --prefix backend`, `npm run build`, `npm run lint --prefix frontend`, `npm audit --omit=dev --json`.
- 2026-05-27: CodeRabbit nao executado: projeto local nao possui `.git` e WSL nao possui distribuicao instalada.

### Completion Notes
- `/api/agent/config` nao retorna plaintext de `groqKey`, `groqAudioKey`, `geminiKey`, `openrouterKey` ou `telegramBotToken`; campos reais voltam `null` e metadados `Configured/Masked` sao retornados separadamente.
- Updates de configuracao criptografam apenas novos valores nao vazios e ignoram campos omitidos, vazios ou mascarados para preservar segredos existentes.
- Consumidores internos descriptografam segredos com fallback para valores legados em claro, evitando quebrar configuracoes existentes ate o proximo save.
- `ENCRYPTION_KEY` valida e obrigatoria em producao; fallback `.encryption_key` fica restrito a desenvolvimento/teste.
- Lint frontend passou com 2 warnings preexistentes em `frontend/src/contexts/ThemeContext.tsx` sobre Fast Refresh.

### File List
- `CHATBOT-main/backend/debug-start.cjs`
- `CHATBOT-main/backend/package.json`
- `CHATBOT-main/backend/scripts/secrets-api.cjs`
- `CHATBOT-main/backend/src/ai/gemini.ts`
- `CHATBOT-main/backend/src/ai/groq.ts`
- `CHATBOT-main/backend/src/ai/openrouter.ts`
- `CHATBOT-main/backend/src/ai/openrouterModels.ts`
- `CHATBOT-main/backend/src/ai/providerSelector.ts`
- `CHATBOT-main/backend/src/config/env.ts`
- `CHATBOT-main/backend/src/routes/agent.routes.ts`
- `CHATBOT-main/backend/src/routes/update.routes.ts`
- `CHATBOT-main/backend/src/server.ts`
- `CHATBOT-main/backend/src/services/agentConfigSecrets.ts`
- `CHATBOT-main/backend/src/services/crypto.service.ts`
- `CHATBOT-main/backend/src/services/github.service.ts`
- `CHATBOT-main/backend/src/services/update.service.ts`
- `CHATBOT-main/backend/src/telegram/TelegramBotManager.ts`
- `CHATBOT-main/backend/src/utils/prismaErrorHandler.ts`
- `CHATBOT-main/backend/src/utils/redaction.ts`
- `CHATBOT-main/backend/src/utils/whatsappJid.ts`
- `CHATBOT-main/backend/src/whatsapp/InstanceManager.ts`
- `CHATBOT-main/backend/src/whatsapp/messageHandler.ts`
- `CHATBOT-main/backend/src/whatsapp/prismaAuth.ts`
- `CHATBOT-main/frontend/src/pages/Apis.tsx`

### Change Log
- 2026-05-27: Story implementada e marcada como Ready for Review pelo @dev.

### QA Results
- **[GATE DECISION]: PASS - Story Ready for Planning**
- **Reviewer:** Quinn (QA Agent)
- **Date:** 2026-05-27
- **Assessment:** A story cobre corretamente os pontos criticos de exposicao de segredos: armazenamento em claro, retorno pela API, logs e fallback inseguro de chave de criptografia em producao.
- **Traceability:** Os acceptance criteria rastreiam os achados em `agent.routes.ts`, `crypto.service.ts`, provedores de IA, `update.service.ts` e `debug-start.cjs`.
- **Testability:** Boa. Deve incluir teste unitario/integração provando que `/agent/config` nao retorna segredo completo e que update parcial preserva chave existente.
- **NFR Coverage:** Security e operability fortes; maintainability melhora ao centralizar sanitizacao/mascara.
- **Required Before Dev:** Definir formato de resposta mascarada para cada segredo para evitar divergencia frontend/backend.
- **Residual Risk:** Migracao de segredos ja persistidos em texto claro precisa ser tratada com cuidado para nao inutilizar configuracoes existentes.

---

- **[GATE DECISION]: PASS - Implementation Approved**
- **Reviewer:** Quinn (QA Agent)
- **Date:** 2026-05-27
- **Scope:** Validacao da implementacao da story `Gestao Segura de Segredos e Sanitizacao de Logs`.
- **Findings:** Nenhum bloqueador, high ou medium encontrado na revisao manual.
- **Traceability:** ACs cobertos por `agentConfigSecrets.ts`, `crypto.service.ts`, `agent.routes.ts`, `providerSelector.ts`, provedores IA, `update.service.ts`, `debug-start.cjs`, frontend `Apis.tsx` e `secrets-api.cjs`.
- **Security Assessment:** PASS. `/api/agent/config` retorna segredos write-only com metadados mascarados, updates parciais preservam segredo existente, novos segredos sao criptografados, `ENCRYPTION_KEY` e exigida em producao e logs sensiveis foram sanitizados.
- **Test Evidence:** PASS em `npm test --prefix backend`; PASS em `npm run build`; PASS em `npm run lint --prefix frontend` com 2 warnings preexistentes em `ThemeContext.tsx`; PASS em `npm audit --omit=dev --json` com 0 vulnerabilidades.
- **Limitations:** CodeRabbit nao executado porque o workspace nao e um repositorio Git e o WSL nao possui distribuicao instalada.
- **Residual Risk:** Baixo. Recomendo validar manualmente em ambiente com banco real que chaves legadas em claro continuam funcionando e sao regravadas criptografadas no proximo save.
