# Story 041 - Integrations Workspace Compaction And Documentation Sidebar

## Status

Fechada

## Objetivo

Como operador do NexusZAP,
quero uma área `Integrações` mais compacta e direta,
para acessar operação e documentação sem redundância visual nem ações desnecessárias.

## Problema atual

A área `Integrações` ainda apresenta fricções de UX para operação rápida:

1. os cards superiores exibem ações `Ver seção` que pouco agregam porque `Credenciais` e `Operação` já estão na mesma página
2. existe redundância entre ações de navegação local e o botão real de abrir documentação
3. o resumo operacional ainda pode destacar contagens de baixo valor, como ausência de credencial, gerando ruído visual
4. a página de documentação já existe, mas ainda não usa navegação lateral por tópicos para leitura técnica mais eficiente

## Dependências explícitas desta fase

- esta story depende da arquitetura da área `Integrações` criada na story 038
- esta story depende da página pública de documentação criada na story 040
- esta story não deve alterar o contrato técnico do endpoint `/api/integrations/events`
- esta story prepara a superfície para o redesign compacto de credenciais da story seguinte

## Escopo

- simplificar o topo da área `Integrações`
- remover ações redundantes como `Ver seção` dos cards que não levam a uma navegação realmente distinta
- manter apenas a ação principal útil de documentação, por exemplo `Abrir documentação`
- compactar a leitura visual da página sem perder separação entre `Credenciais`, `Operação` e `Documentação`
- remover do resumo operacional a contagem `Sem credencial` sempre que ela estiver presente no backend ou na UI atual como KPI principal
- reorganizar a página de documentação para usar navegação lateral por tópicos
- manter a documentação em página própria, com conteúdo principal à direita e lista de seções à esquerda

## Fora de escopo

- redesign completo do fluxo de emissão de credenciais por instância
- criação de CMS ou markdown remoto
- alteração do endpoint técnico de integração
- analytics novos de operação

## Critérios de aceitação

- a página `Integrações` deixa de exibir ações redundantes de navegação local nos cards superiores
- a área mantém apenas a ação principal de abrir a documentação em página própria
- o KPI `Sem credencial` deixa de ser exibido como contagem operacional principal no resumo da área `Integrações`
- a documentação continua abrindo em rota própria do frontend
- a página de documentação passa a exibir tópicos organizados em barra lateral
- os tópicos laterais permitem navegação rápida entre seções do conteúdo
- a experiência continua funcional em desktop e mobile
- `npm run build --prefix frontend` continua passando

## Regras de negócio

- a área `Integrações` deve priorizar densidade operacional e não navegação ornamental
- ações visíveis no topo precisam ter utilidade direta e distinta
- ausência de credencial não deve ser tratada como KPI principal de operação
- documentação técnica deve continuar separada da superfície de credenciais
- a página de documentação deve ser escaneável e próxima de uma documentação técnica real

## Estrutura mínima obrigatória da UX desta fase

1. topo mais enxuto em `Integrações`
2. apenas CTA principal de documentação
3. remoção de links locais redundantes
4. documentação em página própria
5. sidebar lateral com tópicos da documentação
6. conteúdo principal organizado por seções ancoradas

## Sugestão técnica

- revisar `frontend/src/features/integrations/IntegrationWorkspacePage.tsx` para reduzir ações e densidade de texto
- ajustar resumo operacional, payloads e helpers que ainda exponham `Sem credencial` como métrica principal
- evoluir `frontend/src/pages/IntegracoesDocumentacao.tsx` para layout em duas colunas com sidebar sticky
- centralizar a lista de tópicos da documentação em `frontend/src/features/integrations/**`

## Qualidade e testes obrigatórios

- adicionar teste focado para garantir remoção de ações redundantes no topo de `Integrações`
- adicionar teste focado para garantir ausência da contagem `Sem credencial` no resumo principal, se ela existir hoje no payload ou na renderização
- adicionar teste focado para validar presença da sidebar lateral na documentação
- validar que a rota de documentação continua acessível
- executar pelo menos:
  - `npm run build --prefix frontend`
  - `npm run lint`

## Referências técnicas desta fase

- `frontend/src/features/integrations/IntegrationWorkspacePage.tsx`
- `frontend/src/pages/IntegracoesDocumentacao.tsx`
- `frontend/src/features/integrations/integrationDocumentationContent.ts`
- `frontend/scripts/integration-workspace-state.test.tsx`
- `frontend/scripts/integration-documentation-state.test.tsx`

## Arquivos prováveis

- `frontend/src/features/integrations/IntegrationWorkspacePage.tsx`
- `frontend/src/pages/IntegracoesDocumentacao.tsx`
- `frontend/src/features/integrations/**`
- `frontend/scripts/integration-workspace-state.test.tsx`
- `frontend/scripts/integration-documentation-state.test.tsx`

## Checklist

- [x] topo de `Integrações` simplificado
- [x] ações `Ver seção` redundantes removidas
- [x] CTA principal de documentação preservado
- [x] contagem `Sem credencial` removida do resumo principal
- [x] documentação reorganizada com sidebar lateral
- [x] testes focados adicionados

## Dev Agent Record

### Agent Model Used

- GPT-5 Codex

### Debug Log References

- `npx tsx frontend/scripts/integration-dashboard-state.test.ts`
- `npx tsx frontend/scripts/integration-workspace-state.test.tsx`
- `npx tsx frontend/scripts/integration-documentation-state.test.tsx`
- `npm run lint`
- `npm run typecheck`
- `npm run build --prefix frontend`
- `npm test`

### Completion Notes List

- O topo da área `Integrações` foi simplificado com remoção dos links redundantes `Ver seção`, mantendo o CTA útil apenas no card de documentação.
- O resumo operacional deixou de exibir `Sem credencial` como KPI principal, reduzindo ruído visual e priorizando métricas de operação real.
- A página de documentação foi reorganizada em layout de duas colunas com sidebar lateral sticky e navegação rápida por tópicos ancorados.
- O CTA redundante `Ir para resumo` foi removido da página de documentação, preservando apenas ações realmente distintas.
- Os testes focados da workspace, documentação e métricas compactas foram atualizados para proteger a nova UX contra regressão.

### File List

- `frontend/scripts/integration-dashboard-state.test.ts`
- `frontend/scripts/integration-documentation-state.test.tsx`
- `frontend/scripts/integration-workspace-state.test.tsx`
- `frontend/src/features/dashboard/integrationDashboard.ts`
- `frontend/src/features/integrations/IntegrationOperationsOverview.tsx`
- `frontend/src/features/integrations/IntegrationWorkspacePage.tsx`
- `frontend/src/features/integrations/integrationDocumentationContent.ts`
- `frontend/src/pages/IntegracoesDocumentacao.tsx`

### Change Log

- 2026-05-29: story 041 implementada, validada e encerrada com compatação da workspace de integrações, remoção do KPI `Sem credencial` do resumo principal e documentação com sidebar lateral por tópicos.
