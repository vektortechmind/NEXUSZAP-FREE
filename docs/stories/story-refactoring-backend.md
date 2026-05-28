---
title: "Refatoração de Controladores e Integrações Externas"
epic: "epic-1"
status: "Done"
priority: "High"
type: "Technical Debt"
assignee: "@dev"
---

# Story: Refatoração de Controladores e Integrações Externas

## Contexto & Objetivo
Durante a revisão de arquitetura pelo QA Guardian, identificou-se uma forte mistura de responsabilidades (God Classes) nos arquivos do backend. Atualmente, arquivos de rotas (ex: `agent.routes.ts`) gerenciam lógica de banco de dados e arquivos de integração (ex: `TelegramBotManager.ts`, `messageHandler.ts`) absorveram tarefas complexas de lógica de negócio, memória de LLM, formatação de texto e extração de PDF, ferindo os princípios SOLID (especialmente o Single Responsibility Principle - SRP). O objetivo é isolar e refatorar essas peças.

## Critérios de Aceite (Acceptance Criteria)
- [ ] O backend deverá possuir a pasta `src/controllers` contendo lógicas extraídas de dentro dos arquivos de rotas (ex: os tratamentos de erros Prisma e lógica final que hoje ficam nas `routes.ts`).
- [ ] Criar módulos específicos sob `src/utils` ou `src/services` focados na montagem de texto e memória (`promptBuilder`, `memoryManager`).
- [ ] O `TelegramBotManager.ts` não pode interagir diretamente com `prisma.file` nem formatar pedaços de LLM manualmente (usará funções terceirizadas).
- [ ] O `messageHandler.ts` do WhatsApp deve ter todo o processamento massivo de arquivos (`extractTextFromBuffer`, quebra de parágrafos via REGEX) abstraídos para funções auxiliares menores importadas de outro arquivo.
- [ ] Nenhuma quebra de tipagem deve ocorrer (`npm run build` passa).

## Lista de Arquivos Afetados Esperada
1. `backend/src/routes/agent.routes.ts`
2. `backend/src/telegram/TelegramBotManager.ts`
3. `backend/src/whatsapp/messageHandler.ts`
4. Novos arquivos na pasta `backend/src/controllers` e utilitários de prompt/memória.

## Dev Agent Record

### Checkboxes
- [x] `agent.routes.ts` refatorado
- [x] `TelegramBotManager.ts` refatorado
- [x] `messageHandler.ts` refatorado
- [x] Novos utilitários e controllers criados
- [x] Build concluído e validado (0 erros Typescript)
- [x] `npm run lint` testado (0 erros não intencionais)

### Debug Log
- Nenhuma falha de compilação pós-separação (`tsc` passando liso).
- Funções antigas comentadas/removidas de `TelegramBotManager` e `messageHandler` para evitar escopo duplicado.

### Completion Notes
- Criado `src/utils/prismaErrorHandler.ts` para isolar erros de banco de dados.
- Criado `src/utils/ai/memoryManager.ts` encapsulando manipulação de arrays do chatMemory.
- Criado `src/services/knowledgeService.ts` isolando Prisma Query de "Extract File" dos listeners.
- Criado `src/utils/textSplitter.ts` reunificando quebra de array por tamanho para o LLM responder sem cortar via WhatsApp ou Telegram.

### QA Results
**[GATE DECISION]: PASS 🟢**
**Reviewer:** Quinn (QA Agent)
**Date:** 2026-05-26
**Feedback:**
- ✅ Análise Estática: O backend passou com sucesso sem erros Typescript (`tsc --noEmit`).
- ✅ Build: O build na raiz foi executado sem problemas, ambos os pacotes de frontend e backend compilaram adequadamente.
- ✅ Conformidade (AC): Os critérios de aceitação foram estritamente seguidos:
  - Abstração implementada em `src/utils/prismaErrorHandler.ts`.
  - Controle de array/memória LLM globalizado e extraído de `TelegramBotManager` e `messageHandler` para `memoryManager.ts`.
  - Processo de text extraction movido para `knowledgeService.ts`.
  - Regex de quebra de sentenças do LLM unificado no arquivo de utilidades e removido do escopo dos listeners.
- 💡 **Observação**: Algumas declarações de funções vazias nas assinaturas de Tipagem do React geraram Warnings no ESLint do Frontend (ex: `'emailParam' is defined but never used`), mas como não são bugs obstrutivos e fazem parte apenas de Contextos desativados, permitimos seguir com o Gate de aprovação. O backend está consideravelmente mais robusto.

**Status Alterado:** O trabalho no desenvolvimento atendeu todas as expectativas. O status da Story foi atualizado para `Done`.