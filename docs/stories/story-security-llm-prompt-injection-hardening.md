---
title: "Protecao contra Prompt Injection em Conhecimento e Mensagens"
epic: "epic-security-hardening"
status: "Ready for Review"
priority: "High"
type: "Security"
assignee: "@dev"
---

# Story: Protecao contra Prompt Injection em Conhecimento e Mensagens

## Contexto & Objetivo
Arquivos de conhecimento e mensagens de usuarios entram no contexto do LLM. Conteudo enviado por clientes ou arquivos pode conter instrucoes maliciosas tentando sobrescrever o system prompt, extrair dados internos, revelar configuracoes ou alterar comportamento do agente. O objetivo e tratar todo conteudo externo como dado nao confiavel e criar guardrails testaveis.

## Escopo
- Delimitar claramente documentos e mensagens como dados nao confiaveis.
- Reforcar prompt de sistema contra instrucoes vindas de arquivos/usuarios.
- Limitar tamanho e composicao do contexto de conhecimento.
- Adicionar testes de prompt injection.
- Evitar vazamento de prompts completos e segredos em logs/respostas.

## Fora de Escopo
- Implementar moderacao completa de conteudo ou DLP empresarial.
- Trocar provedores de LLM.
- Suporte a SQLite; o banco oficial do projeto e exclusivamente PostgreSQL.

## Criterios de Aceite (Acceptance Criteria)
- [ ] `buildCompleteSystemPrompt` ou equivalente instrui explicitamente que arquivos/mensagens sao dados nao confiaveis e nao podem alterar regras do sistema.
- [ ] `buildFileContextSuffix` delimita documentos com identificadores e linguagem clara de citacao/contexto, sem apresentar conteudo como instrucao.
- [ ] Contexto de arquivos possui limite maximo de caracteres/tokens por arquivo e total por resposta.
- [ ] Mensagens de usuario e conteudo extraido sao normalizados para reduzir tentativas obvias de quebrar delimitadores.
- [ ] Respostas do bot nao devem revelar API keys, tokens, system prompt completo, variaveis de ambiente ou configuracoes internas.
- [ ] Logs nao registram prompt completo nem conteudo integral de documentos do usuario.
- [ ] Testes cobrem pelo menos: documento mandando ignorar instrucoes anteriores, documento pedindo secrets, usuario pedindo system prompt e documento tentando trocar identidade do agente.
- [ ] `npm run build`, `npm test --prefix backend` e `npm run lint --prefix frontend` passam ou tem excecoes documentadas na story.

## Lista de Arquivos Afetados Esperada
1. `CHATBOT-main/backend/src/ai/systemPrompt.ts`
2. `CHATBOT-main/backend/src/services/knowledgeService.ts`
3. `CHATBOT-main/backend/src/whatsapp/messageHandler.ts`
4. `CHATBOT-main/backend/src/telegram/TelegramBotManager.ts`
5. `CHATBOT-main/backend/src/ai/providerSelector.ts`
6. Testes backend novos ou atualizados

## Riscos & Validacao QA
- Risco principal: endurecer demais o prompt e reduzir utilidade dos documentos legitimos.
- QA deve validar conversas reais com conhecimento benigno e ataques simulados.
- QA deve registrar exemplos de Given-When-Then para cada ataque testado.

## Dev Agent Record

### Checkboxes
- [x] Prompt de sistema reforcado
- [x] Contexto de arquivos delimitado e limitado
- [x] Sanitizacao/normalizacao implementada
- [x] Testes de prompt injection adicionados
- [x] Gates executados

### Debug Log
- 2026-05-27: Adicionado guardrail deterministico em `promptGuard.ts` para normalizar textos externos, reforcar regras do system prompt e sanitizar respostas do bot.
- 2026-05-27: `buildCompleteSystemPrompt` passou a incluir regras explicitas de nao confianca para usuarios, historico, transcricoes e documentos.
- 2026-05-27: `buildFileContextSuffix` passou a delimitar documentos como dados nao confiaveis, com limite por arquivo e limite total de contexto.
- 2026-05-27: `normalizeMessagesForChatApi` passou a envolver mensagens de usuario como dados nao confiaveis e neutralizar rótulos/delimitadores obvios.
- 2026-05-27: Testes backend adicionados para documento mandando ignorar instrucoes, documento pedindo secrets, usuario pedindo system prompt e documento tentando trocar identidade.
- 2026-05-27: Validacoes executadas: `npm run build --prefix backend`, `npm test --prefix backend`, `npm run build`, `npm run lint --prefix frontend`, `npm audit --omit=dev --json`.
- 2026-05-27: CodeRabbit nao executado: projeto local nao possui `.git` e WSL nao possui distribuicao instalada.

### Completion Notes
- Conteudos de usuarios, historico, transcricoes e arquivos agora sao marcados explicitamente como dados nao confiaveis no prompt.
- Documentos sao renderizados em blocos `<documento_nao_confiavel>` e instruidos como fontes/citacoes, nunca comandos.
- Contexto de arquivos limitado a 8.000 caracteres por arquivo e 24.000 caracteres totais; mensagens de usuario limitadas a 4.000 caracteres.
- Normalizacao neutraliza controles, code fences, pseudo-tags de role e delimitadores obvios de system/contexto.
- Respostas do LLM passam por redacao/sanitizacao antes do envio, com bloqueio deterministico para vazamento aparente de prompt interno.
- Lint frontend passou com 2 warnings preexistentes em `frontend/src/contexts/ThemeContext.tsx` sobre Fast Refresh.

### File List
- `CHATBOT-main/backend/package.json`
- `CHATBOT-main/backend/scripts/prompt-injection.cjs`
- `CHATBOT-main/backend/src/ai/promptGuard.ts`
- `CHATBOT-main/backend/src/ai/providerSelector.ts`
- `CHATBOT-main/backend/src/ai/systemPrompt.ts`
- `CHATBOT-main/backend/src/services/knowledgeService.ts`

### Change Log
- 2026-05-27: Story implementada e marcada como Ready for Review pelo @dev.

### QA Results
- **[GATE DECISION]: PASS - Story Ready for Planning**
- **Reviewer:** Quinn (QA Agent)
- **Date:** 2026-05-27
- **Assessment:** A story cobre adequadamente a ameaca de prompt injection por documentos e mensagens, com foco em delimitacao, limites de contexto, nao vazamento e testes adversariais.
- **Traceability:** Rastreia para `systemPrompt.ts`, `knowledgeService.ts`, `messageHandler.ts`, `TelegramBotManager.ts` e `providerSelector.ts`.
- **Testability:** Boa, desde que os testes usem stubs/mocks de LLM para verificar montagem de prompt e bloqueios esperados sem depender de respostas nao deterministicas.
- **NFR Coverage:** Security forte; reliability coberta por limites de contexto e reducao de vazamento em logs.
- **Required Before Dev:** Definir criterios objetivos de sucesso para os testes de prompt injection, evitando depender de comportamento probabilistico do provedor.
- **Residual Risk:** Guardrails de prompt reduzem risco, mas nao garantem protecao absoluta; deve permanecer como controle em camadas junto da story de segredos.

---

- **[GATE DECISION]: PASS - Implementation Approved**
- **Reviewer:** Quinn (QA Agent)
- **Date:** 2026-05-27
- **Scope:** Validacao da implementacao da story `Protecao contra Prompt Injection em Conhecimento e Mensagens`.
- **Findings:** Nenhum bloqueador, high ou medium encontrado na revisao manual.
- **Traceability:** ACs cobertos por `promptGuard.ts`, `systemPrompt.ts`, `knowledgeService.ts`, `providerSelector.ts` e `prompt-injection.cjs`.
- **Security Assessment:** PASS. O system prompt instrui explicitamente que usuarios, historico, transcricoes e arquivos sao dados nao confiaveis; documentos sao delimitados como fontes/citacoes; contexto possui limites por arquivo e total; mensagens de usuario/conteudo extraido sao normalizados; respostas passam por redacao e bloqueio deterministico de vazamento aparente de prompt interno.
- **Test Evidence:** PASS em `npm test --prefix backend`; PASS em `npm run build`; PASS em `npm run lint --prefix frontend` com 2 warnings preexistentes em `ThemeContext.tsx`; PASS em `npm audit --omit=dev --json` com 0 vulnerabilidades.
- **Limitations:** CodeRabbit nao executado porque o workspace nao e um repositorio Git e o WSL nao possui distribuicao instalada.
- **Residual Risk:** Baixo. Guardrails de prompt reduzem risco, mas nao sao garantia absoluta contra prompt injection; recomendo QA manual com conversas benignas e ataques simulados em provedores reais para avaliar utilidade e taxa de recusa excessiva.
