---
title: "Hardening de Upload, Download e Extracao de Arquivos"
epic: "epic-security-hardening"
status: "Ready for Review"
priority: "High"
type: "Security"
assignee: "@dev"
---

# Story: Hardening de Upload, Download e Extracao de Arquivos

## Contexto & Objetivo
As rotas de upload aceitam arquivos de conhecimento para WhatsApp e Telegram. Hoje a validacao depende fortemente de extensao e MIME informado pelo cliente, e a extracao de PDF/DOCX ocorre no fluxo da requisicao. O objetivo e reduzir riscos de upload malicioso, parser bombs, content sniffing e abuso de armazenamento/processamento.

## Escopo
- Validar tipo real do arquivo por assinatura/magic bytes.
- Normalizar MIME e extensao aceitos.
- Limitar custo de extracao de texto.
- Proteger downloads contra renderizacao perigosa.
- Criar cotas por instancia/canal.

## Fora de Escopo
- Armazenamento externo S3/MinIO.
- OCR avancado ou pipeline assíncrono completo, salvo se necessario para cumprir limites de seguranca.
- Suporte a SQLite; o banco oficial do projeto e exclusivamente PostgreSQL.

## Criterios de Aceite (Acceptance Criteria)
- [ ] Upload rejeita arquivos cujo conteudo real nao bate com os tipos permitidos, mesmo que extensao/MIME sejam validos.
- [ ] Tipos permitidos ficam centralizados em um helper/servico compartilhado por WhatsApp e Telegram.
- [ ] PDF/DOCX/TXT/JSON possuem limite de texto extraido, limite de tempo ou protecao equivalente contra parser bombs.
- [ ] Imagens aceitas nao sao enviadas para extracao textual e sao armazenadas com MIME validado.
- [ ] Download usa `Content-Disposition: attachment` para arquivos de conhecimento, exceto se houver justificativa documentada.
- [ ] Respostas de download incluem `X-Content-Type-Options: nosniff`.
- [ ] Nomes de arquivos sao sanitizados para headers e exibicao.
- [ ] Existe cota por instancia/canal para quantidade total e tamanho total de arquivos armazenados.
- [ ] Erros de extracao sao observaveis em logs sanitizados, sem payload bruto.
- [ ] Testes cobrem extensao falsa, MIME falso, arquivo acima da cota, download seguro e arquivo valido.
- [ ] `npm run build`, `npm test --prefix backend` e `npm run lint --prefix frontend` passam ou tem excecoes documentadas na story.

## Lista de Arquivos Afetados Esperada
1. `CHATBOT-main/backend/src/routes/files.routes.ts`
2. `CHATBOT-main/backend/src/routes/telegram-files.routes.ts`
3. `CHATBOT-main/backend/src/services/fileExtractor.ts`
4. `CHATBOT-main/backend/src/services/knowledgeService.ts`
5. Novo helper em `CHATBOT-main/backend/src/security/` ou `CHATBOT-main/backend/src/services/`
6. `CHATBOT-main/backend/prisma/schema.prisma` se forem adicionados metadados/cotas
7. Testes backend novos ou atualizados

## Riscos & Validacao QA
- Risco principal: bloquear arquivos validos usados pelos clientes atuais.
- QA deve validar uploads reais de PDF, DOCX, TXT, JSON, PNG, JPG e WEBP.
- QA deve validar arquivos maliciosos simulados com extensao trocada.

## Dev Agent Record

### Checkboxes
- [x] Magic-byte sniffing implementado
- [x] Download seguro implementado
- [x] Limites de extracao/cotas aplicados
- [x] Log sanitizado de falha de extracao
- [x] Testes adicionados/atualizados
- [x] Gates executados

### Debug Log
- 2026-05-27: Context7 MCP consultado para confirmar uso atual de `request.parts()` do `@fastify/multipart`.
- 2026-05-27: Criado helper compartilhado de seguranca de arquivos com magic-byte sniffing, normalizacao de MIME/extensao, sanitizacao de filename, headers seguros, limites de extracao e cotas.
- 2026-05-27: Rotas WhatsApp e Telegram migradas para helper compartilhado; imagens validas sao armazenadas sem extracao textual.
- 2026-05-27: Testes backend adicionados para extensao falsa, MIME falso, cota, download seguro, arquivo valido e truncamento de texto extraido.
- 2026-05-27: Validacoes executadas: `npm run build --prefix backend`, `npm test --prefix backend`, `npm run build`, `npm run lint --prefix frontend`, `npm audit --omit=dev --json`.
- 2026-05-27: CodeRabbit nao executado: projeto local nao possui `.git` e WSL nao possui distribuicao instalada.

### Completion Notes
- Uploads agora validam extensao, MIME informado e assinatura/magic bytes real para PDF, DOCX, TXT, JSON, PNG, JPG/JPEG e WEBP.
- `files.routes.ts` e `telegram-files.routes.ts` usam a mesma politica centralizada em `fileSecurity.service.ts`.
- Downloads de conhecimento usam `Content-Disposition: attachment` e `X-Content-Type-Options: nosniff`, com nomes sanitizados.
- Extracao textual possui timeout e truncamento; falhas de extracao sao registradas com erro sanitizado.
- Cotas por instancia/canal aplicadas: 30 arquivos e 25MB totais armazenados.
- Lint frontend passou com 2 warnings preexistentes em `frontend/src/contexts/ThemeContext.tsx` sobre Fast Refresh.

### File List
- `CHATBOT-main/backend/package.json`
- `CHATBOT-main/backend/scripts/file-security.cjs`
- `CHATBOT-main/backend/src/routes/files.routes.ts`
- `CHATBOT-main/backend/src/routes/telegram-files.routes.ts`
- `CHATBOT-main/backend/src/services/fileExtractor.ts`
- `CHATBOT-main/backend/src/services/fileSecurity.service.ts`
- `CHATBOT-main/backend/src/services/knowledgeService.ts`

### Change Log
- 2026-05-27: Story implementada e marcada como Ready for Review pelo @dev.

### QA Results
- **[GATE DECISION]: PASS - Story Ready for Planning**
- **Reviewer:** Quinn (QA Agent)
- **Date:** 2026-05-27
- **Assessment:** A story esta bem delimitada e cobre os riscos principais da superficie de upload: spoofing de MIME/extensao, parser bombs, download inline e abuso de armazenamento.
- **Traceability:** Mapeia diretamente para `files.routes.ts`, `telegram-files.routes.ts`, `fileExtractor.ts` e `knowledgeService.ts`.
- **Testability:** Boa. Os cenarios de extensao falsa, MIME falso, cota, download seguro e arquivo valido sao objetivos.
- **NFR Coverage:** Security, performance e reliability adequadamente contemplados.
- **Required Before Dev:** Escolher e documentar biblioteca/estrategia de magic-byte sniffing e limites maximos de extracao por tipo de arquivo.
- **Residual Risk:** Validacao muito restritiva pode bloquear arquivos legitimos; QA deve manter fixtures reais de PDF/DOCX/TXT/JSON/imagens.

---

- **[GATE DECISION]: PASS - Implementation Approved**
- **Reviewer:** Quinn (QA Agent)
- **Date:** 2026-05-27
- **Scope:** Validacao da implementacao da story `Hardening de Upload, Download e Extracao de Arquivos`.
- **Findings:** Nenhum bloqueador, high ou medium encontrado na revisao manual.
- **Traceability:** ACs cobertos por `fileSecurity.service.ts`, `files.routes.ts`, `telegram-files.routes.ts`, `fileExtractor.ts`, `knowledgeService.ts` e `file-security.cjs`.
- **Security Assessment:** PASS. Upload valida extensao, MIME declarado e assinatura real; tipos permitidos estao centralizados; imagens nao passam por extracao textual; downloads usam attachment + nosniff; nomes sao sanitizados; cotas por instancia/canal e limites de extracao foram aplicados.
- **Test Evidence:** PASS em `npm test --prefix backend`; PASS em `npm run build`; PASS em `npm run lint --prefix frontend` com 2 warnings preexistentes em `ThemeContext.tsx`; PASS em `npm audit --omit=dev --json` com 0 vulnerabilidades.
- **Limitations:** CodeRabbit nao executado porque o workspace nao e um repositorio Git e o WSL nao possui distribuicao instalada.
- **Residual Risk:** Baixo. Recomendo complementar QA manual com fixtures reais de PDF, DOCX, TXT, JSON, PNG, JPG e WEBP, pois os testes automatizados focam a politica central e usam fixtures sinteticas pequenas.
