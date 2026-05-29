# Story 040 - Public Integration Documentation Page And Access Flow

## Status

Fechada

## Objetivo

Como operador ou integrador do NexusZAP,
quero abrir uma página própria de documentação técnica da integração a partir do painel,
para consultar o contrato real do endpoint sem depender de um caminho local de arquivo que não existe em produção.

## Problema atual

A entrega atual expõe na UI um path local de repositório:

- `docs/integrations/nexuszap-plugin-api.md`

Esse caminho não resolve o problema do usuário final porque:

1. não é uma URL navegável do produto
2. não pode ser usado como documentação pública operacional real
3. não explica, dentro do fluxo do painel, onde obter `instanceId` e `secretToken`
4. mistura documentação técnica com artefato local do repositório

## Dependências explícitas desta fase

- esta story depende da arquitetura de navegação criada na story 038
- esta story depende da superfície de credenciais por instância criada na story 039
- esta story deve refletir o comportamento real já implementado no endpoint `/api/integrations/events`
- esta story não deve alterar o contrato técnico consolidado nas stories 032 a 037, apenas a forma de apresentação ao usuário

## Escopo

- criar uma página própria de documentação técnica dentro do frontend
- adicionar botão explícito, por exemplo `Abrir documentação`, a partir da área de integrações
- remover da UI pública a exposição do path local `docs/integrations/nexuszap-plugin-api.md`
- apresentar a documentação como conteúdo navegável e copiável no painel
- explicar claramente onde o operador obtém `instanceId`, `endpointUrl` e `secretToken`
- manter coerência com o contrato real do endpoint e com a seção de credenciais

## Fora de escopo

- publicar a documentação em site externo separado
- criar editor markdown no painel
- suportar internacionalização completa da documentação
- alterar o contrato técnico do endpoint

## Critérios de aceitação

- existe uma página própria de documentação técnica acessível pelo frontend
- o layout possui botão ou ação explícita para abrir essa página
- o painel deixa de exibir um caminho local de arquivo como se fosse documentação utilizável
- a página documenta `endpointUrl`, `instanceId`, `secretToken`, auth, body, eventos e troubleshooting
- a página explica de forma objetiva que `instanceId` e `secretToken` são obtidos na seção `Credenciais`
- a documentação é legível e copiável sem depender de acesso ao repositório
- `npm run build --prefix frontend` continua passando

## Regras de negócio

- documentação técnica pública do painel não deve depender de path local do repositório
- a UI deve distinguir claramente `Credenciais` de `Documentação`
- a documentação deve refletir o endpoint real implementado, não uma variante hipotética
- a documentação deve orientar o fluxo correto do operador: selecionar instância, obter credenciais e só então integrar o sistema externo

## Estrutura mínima obrigatória da página

A página de documentação deve conter, no mínimo:

1. visão geral da integração
2. pré-requisitos
3. onde obter credenciais no próprio painel
4. autenticação por Bearer token
5. `endpointUrl` final
6. estrutura do request
7. eventos suportados
8. exemplos de requisição
9. respostas HTTP previsíveis
10. troubleshooting técnico

## Sugestão técnica

- criar uma rota dedicada no frontend, por exemplo `frontend/src/pages/IntegracoesDocumentacao.tsx`
- adicionar ação de navegação a partir da página de integrações
- transformar o conteúdo do markdown local em estrutura React renderizável ou conteúdo equivalente versionado no frontend
- se o markdown local for mantido como referência interna, ele não deve mais ser exposto diretamente como path de UI pública

## Qualidade e testes obrigatórios

- adicionar teste focado de frontend para navegação da área `Integrações` para a página de documentação
- validar que o path local deixou de ser exibido como ação principal da UI
- revisar manualmente a documentação renderizada contra o contrato real do endpoint
- executar pelo menos:
  - `npm run build --prefix frontend`
  - `npm run lint`

## Referências técnicas desta fase

- `docs/integrations/nexuszap-plugin-api.md` como fonte local de referência
- `frontend/src/pages/Dashboard.tsx` para remover a exposição atual do path local
- futura página `frontend/src/pages/Integracoes.tsx`
- contrato real em `backend/src/routes/integration.routes.ts`

## Arquivos prováveis

- `frontend/src/App.tsx`
- `frontend/src/pages/Integracoes.tsx`
- `frontend/src/pages/IntegracoesDocumentacao.tsx`
- `frontend/src/features/integrations/**`
- `docs/integrations/nexuszap-plugin-api.md`

## Checklist

- [x] página própria de documentação criada
- [x] botão ou ação explícita para abrir documentação implementado
- [x] path local `docs/integrations/nexuszap-plugin-api.md` removido da UI pública
- [x] documentação orienta corretamente obtenção de `instanceId` e `secretToken`
- [x] conteúdo alinhado ao endpoint real
- [x] testes focados adicionados

## Dev Agent Record

### Agent Model Used

- GPT-5 Codex

### Debug Log References

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build --prefix frontend`
- `npx tsx frontend/scripts/integration-workspace-state.test.tsx`
- `npx tsx frontend/scripts/integration-documentation-state.test.tsx`

### Completion Notes List

- Criada a rota pública `/integracoes/documentacao` com página própria de documentação técnica dentro do frontend, sem depender de path local do repositório.
- A área `Integrações` agora expõe a ação explícita `Abrir documentação`, mantendo a distinção operacional entre `Credenciais`, `Operação` e `Documentação`.
- O conteúdo da documentação foi transformado em estrutura React renderizável, cobrindo `endpointUrl`, `instanceId`, `secretToken`, autenticação Bearer, request, eventos suportados, respostas HTTP e troubleshooting.
- A orientação operacional foi explicitada no painel: o operador deve selecionar a instância e obter `instanceId`, `endpointUrl` e `secretToken` na seção `Credenciais` antes de integrar o sistema externo.
- O payload do dashboard de integrações passou a publicar a rota `/integracoes/documentacao` como caminho de documentação em vez de `docs/integrations/nexuszap-plugin-api.md`, evitando regressão de UI pública.

### File List

- `backend/scripts/integration-dashboard-api.cjs`
- `backend/src/services/integrations/integrationDashboard.service.ts`
- `frontend/scripts/integration-documentation-state.test.tsx`
- `frontend/scripts/integration-workspace-state.test.tsx`
- `frontend/src/App.tsx`
- `frontend/src/features/integrations/integrationDocumentationContent.ts`
- `frontend/src/features/integrations/IntegrationWorkspacePage.tsx`
- `frontend/src/features/integrations/workspace.ts`
- `frontend/src/pages/IntegracoesDocumentacao.tsx`

### Change Log

- 2026-05-29: story 040 implementada, validada e encerrada com página pública de documentação, navegação dedicada no workspace de integrações e remoção da exposição do path local do repositório na UI.
