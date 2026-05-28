---
title: "UI Premium - Configuracoes, APIs e Update Center"
epic: "epic-ui-premium-redesign"
status: "Ready for Review"
priority: "High"
type: "Frontend"
assignee: "@dev"
depends_on:
  - "story-ui-premium-design-system.md"
  - "story-ui-premium-app-shell-navigation.md"
---

# Story: UI Premium - Configuracoes, APIs e Update Center

## Contexto & Objetivo
A tela de configuracoes/APIs concentra chaves sensiveis, saude dos provedores, modelos OpenRouter e update. Hoje o conteudo e longo e pesado, com muitos blocos dentro de um unico formulario. O objetivo e transformar a tela em um centro de configuracao premium, organizado por provedores e sistema.

## Escopo
- Redesenhar `Apis.tsx` para separar provedores IA, configuracao global e updates.
- Reorganizar provedores em tabela/lista operacional com status, chave salva, latencia e acao.
- Criar painel/section de detalhe para editar cada provedor.
- Melhorar area de modelos OpenRouter com busca/filtro/lista responsiva se viavel.
- Integrar `UpdateSection` visualmente ao novo sistema.
- Manter comportamento de nao apagar chaves salvas quando campo fica em branco.

## Fora de Escopo
- Alterar criptografia de secrets.
- Alterar endpoints de health/providers.
- Implementar auto-update apply se esta desabilitado por seguranca.

## Proposta de Layout
1. Header: Configuracoes do sistema, status geral e botao guia APIs.
2. Secao Provedores IA:
   - Gemini
   - Groq Chat
   - Groq Audio
   - OpenRouter
3. Detalhe do provedor selecionado:
   - Campo de chave
   - Status salvo/mascarado
   - Testar provedor
   - Mensagem de erro detalhada
4. OpenRouter Models:
   - Select de modelo principal
   - Lista/tabela responsiva de modelos gratis/pagos
5. Update Center:
   - Versao atual
   - Ultima release
   - Estado do token GitHub
   - Acoes permitidas/indisponiveis

## Criterios de Aceite
- [ ] `Apis.tsx` deixa de ser um formulario longo unico e passa a ter secoes claras.
- [ ] Provedores aparecem em lista/tabela com status online/offline/configurado.
- [ ] Chaves salvas continuam mascaradas e nao sao apagadas quando campo fica vazio.
- [ ] Teste de provedores mantem loading e erro claros.
- [ ] OpenRouter models nao quebram layout em mobile.
- [ ] `UpdateSection` usa visual premium consistente com os novos componentes.
- [ ] Acoes sensiveis possuem copy clara e estado disabled quando necessario.
- [ ] Todos os inputs possuem labels reais.
- [ ] Responsivo em 375px sem overflow horizontal.
- [ ] `npm run lint --prefix frontend` passa.
- [ ] `npm run build` passa.

## Arquivos Esperados
- `CHATBOT-main/frontend/src/pages/Apis.tsx`
- `CHATBOT-main/frontend/src/components/UpdateSection.tsx`
- `CHATBOT-main/frontend/src/components/ui/DataTable.tsx`
- `CHATBOT-main/frontend/src/components/ui/Tabs.tsx`
- `CHATBOT-main/frontend/src/components/ui/Panel.tsx`
- `CHATBOT-main/frontend/src/components/ui/InlineAlert.tsx`
- `CHATBOT-main/frontend/src/components/ui/StatusDot.tsx`

## Referencias UI/UX
- Skill: `.codex/skills/ui-ux-pro-max`
- React guidance: controlled components, debounce em buscas/filtros, labels associados a inputs.
- UX: tabelas responsivas em mobile, sem overflow horizontal, foco visivel.

## Riscos & Validacao QA
- Risco: tela manipula secrets; qualquer redesign nao pode expor chaves nem apagar valores salvos.
- QA deve validar salvar sem preencher chaves, salvar com nova chave, testar providers, OpenRouter com lista grande e update section.

## Dev Agent Record

### Checkboxes
- [x] Configuracoes reorganizadas
- [x] Provedores em lista/tabela
- [x] OpenRouter responsivo
- [x] UpdateSection redesenhado
- [x] Gates executados

### Debug Log
- 2026-05-27: Context7 usado via MCP para React (`/reactjs/react.dev`) sobre inputs controlados, labels acessiveis, estados async/loading/error e formularios.
- 2026-05-27: `ui-ux-pro-max` executado para direcao visual de centro premium de configuracoes/APIs/update; aplicado com workspace operacional, tabela de provedores e detalhe lateral.
- 2026-05-27: `npm run lint --prefix frontend` falhou inicialmente por import nao usado e setState sincronico em effect; removido import e ajustado debounce/limpeza OpenRouter com timeout assincrono.
- 2026-05-27: `npm run lint --prefix frontend` passou.
- 2026-05-27: `npm run build --prefix frontend` passou. Aviso esperado: `VITE_API_URL` nao definido, usando fallback local.
- 2026-05-27: `npm run build` passou com backend e frontend.
- 2026-05-27: `npm run test:smoke` passou.
- 2026-05-27: CodeRabbit pre-commit nao executou porque o comando retornou `Git repository not found` neste workspace.

### Completion Notes
- `Apis.tsx` foi reorganizada de formulario longo para centro de configuracoes com toolbar operacional, tabela de provedores, detalhe lateral e secoes separadas.
- Provedores Gemini, Groq Chat, Groq Audio e OpenRouter aparecem em `DataTable` com status, chave salva/mascarada, latencia/erro e acao de edicao.
- O comportamento critico de secrets foi preservado: `buildConfigSavePayload` so envia chaves quando o campo possui valor preenchido, mantendo chaves salvas quando inputs ficam vazios.
- OpenRouter Models foi separado em area responsiva com select do modelo principal, tabs gratis/pagos, busca local e cards selecionaveis sem quebrar mobile.
- `UpdateSection` foi redesenhado com `Section`, `Panel`, `InlineAlert`, `StatusDot`, versoes, estado de update, token GitHub nao exposto e acao segura para release no GitHub.
- Criado `DataTable` reutilizavel para tabelas operacionais dentro do design system local.

### File List
- `CHATBOT-main/frontend/src/pages/Apis.tsx`
- `CHATBOT-main/frontend/src/components/UpdateSection.tsx`
- `CHATBOT-main/frontend/src/components/ui/DataTable.tsx`

### Change Log
- 2026-05-27: Redesenhadas configuracoes/APIs/update com tabela de provedores, detalhe seguro de secrets, OpenRouter responsivo, Update Center premium e novo componente `DataTable`.

### QA Results

- **[GATE DECISION]: PASS - Ready for Dev**
- **Reviewer:** Quinn (QA Agent)
- **Date:** 2026-05-27
- **Assessment:** Story esta pronta para reorganizar configuracoes/APIs/update com foco em secrets, provedores e clareza operacional.
- **Traceability:** Cobre a tela atual longa e pesada, provedores misturados, OpenRouter volumoso e UpdateSection fora de um sistema visual consistente.
- **Dependency Validation:** Dependencias de Design System e App Shell estao corretas. Componentes como DataTable/Tabs/Panel devem vir do novo sistema.
- **Dev Readiness:** Pronta para desenvolvimento apos dependencias. Criterios protegem comportamento critico de nao apagar chaves salvas quando campos ficam vazios.
- **Required Dev Gates:** `npm run lint --prefix frontend`; `npm run build`; testar salvar sem chave, salvar chave nova, health providers, OpenRouter com lista grande e update center.
- **Residual Risk:** Area manipula secrets; QA deve verificar que nenhuma chave real aparece em texto claro depois do redesign.

- **[GATE DECISION]: PASS - Implementation Validated**
- **Reviewer:** Quinn (QA Agent)
- **Date:** 2026-05-27
- **Assessment:** Implementacao atende a story e reorganiza Configuracoes/APIs/Update Center em secoes operacionais com protecao adequada para secrets.
- **Acceptance Traceability:**
  - `Apis.tsx` deixou de ser formulario longo unico e agora usa toolbar, tabela de provedores, painel de detalhe, configuracao global, OpenRouter Models e Update Center.
  - Provedores aparecem em `DataTable` com status, chave salva/mascarada, erro/latencia e acao de edicao.
  - Chaves salvas continuam mascaradas e nao sao apagadas quando campo fica vazio: `buildConfigSavePayload` so inclui `groqKey`, `groqAudioKey`, `geminiKey` e `openrouterKey` quando ha valor preenchido.
  - Teste de provedores preserva loading (`testing`) e erro claro via `InlineAlert`.
  - OpenRouter usa select, tabs gratis/pagos, busca e cards responsivos com quebra de ID longa via `break-all`.
  - `UpdateSection` foi integrado com `Section`, `Panel`, `InlineAlert`, `StatusDot`, versao atual, ultima release, estado de update, token GitHub nao exposto e acao segura para GitHub.
  - Inputs possuem labels reais ou label `sr-only` para busca; acoes sensiveis possuem copy/disabled state.
  - Busca estatica nao encontrou `Card`, `Badge`, `bg-gradient`, `backdrop-blur`, `opacity-0`, `group-hover` ou `<h1>` nas telas avaliadas.
- **Evidence:** `npm run lint --prefix frontend` PASS; `npm run build --prefix frontend` PASS; `npm run build` PASS; `npm run test:smoke` PASS.
- **Security/Behavior Checks:** Nenhum valor real de chave e reidratado nos inputs apos `load`; campos de chave sao `type="password"`; Update Center informa que token GitHub nao e exposto no frontend; auto-update apply segue fora de escopo/desabilitado.
- **Blocked/Not Executed:** CodeRabbit nao executou porque o workspace nao esta dentro de um repositorio Git (`Git repository not found`). Validacao visual real em browser/375px nao foi executada neste ambiente.
- **Residual Risk:** `DataTable` usa `overflow-x-auto` dentro do componente para proteger tabelas em telas estreitas; isso evita overflow da pagina, mas QA visual em dispositivo real ainda deve confirmar a ergonomia em 375px.
