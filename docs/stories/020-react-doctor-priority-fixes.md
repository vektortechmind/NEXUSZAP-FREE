# Story 020 - React Doctor Priority Fixes

## Status

Implementada

## Objetivo

Como administrador do NexusZAP,
quero corrigir os apontamentos prioritários do `react-doctor` que têm impacto real em comportamento, acessibilidade e re-renderização,
para reduzir dívida técnica sem abrir uma refatoração ampla fora de contexto.

## Escopo

- ajustar o fluxo de estado transitório em `Instancia` para evitar re-renderizações desnecessárias causadas por estado não renderizado
- garantir que todos os `<button>` próprios do projeto tenham `type` explícito
- corrigir acessibilidade do `ToastContext` onde hoje existe elemento clicável não semântico sem suporte de teclado adequado
- memoizar valores de contexto construídos inline quando isso evitar re-render em cascata
- validar se `clsx` está realmente sem uso e remover a dependência caso o código confirme isso

## Fora de escopo

- refatoração ampla de páginas grandes como `Apis` e `Dashboard`
- migração geral de `useContext` para `use()` por recomendação de React 19
- ajustes puramente cosméticos do `react-doctor` como `size-*`, `p-*` e troca de `...` por `…`
- remoção de arquivos marcados como unused sem confirmação manual de alcance real

## Critérios de aceitação

- `pairingIntentIds` em `Instancia` deixa de usar `useState` e passa a usar `useRef` ou estrutura equivalente que não participe do render final
- botões próprios do projeto possuem `type` explícito, evitando submit acidental em formulários
- o elemento interativo do `ToastContext` passa a usar semântica correta ou recebe suporte completo de teclado e papel acessível
- os contexts em escopo desta story (`AuthContext`, `ThemeProvider`, `ThemeContext` e `ToastContext`) deixam de expor `value` inline não memoizado
- se `clsx` não estiver em uso no frontend, a dependência é removida de `package.json` e o projeto continua compilando
- `npm run lint` continua passando
- `npm run build` do frontend continua passando

## Regras de negócio

- a story deve focar apenas em correções de baixo risco e alto valor apontadas pelo `react-doctor`
- não deve haver mudança de fluxo funcional do produto além do endurecimento de acessibilidade e previsibilidade técnica
- sugestões do `react-doctor` só devem ser aplicadas quando fizerem sentido técnico para o projeto atual

## Sugestão técnica

- revisar `frontend/src/pages/Instancia.tsx` para migrar o estado transitório não renderizado para `useRef` ou estrutura equivalente
- revisar `frontend/src/components/ui/Button.tsx`, `frontend/src/components/Sidebar.tsx` e `frontend/src/contexts/ToastContext.tsx` para padronizar `type="button"`
- revisar `frontend/src/contexts/ToastContext.tsx` para trocar elemento estático clicável por botão semântico ou adicionar acessibilidade completa
- revisar `frontend/src/contexts/AuthContext.tsx`, `frontend/src/contexts/ThemeProvider.tsx`, `frontend/src/contexts/ThemeContext.tsx` e `frontend/src/contexts/ToastContext.tsx` para memoização do `value`
- validar uso de `clsx` com busca real no código antes de remover a dependência

## Arquivos prováveis

- `frontend/src/pages/Instancia.tsx`
- `frontend/src/components/ui/Button.tsx`
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/contexts/ToastContext.tsx`
- `frontend/src/contexts/AuthContext.tsx`
- `frontend/src/contexts/ThemeProvider.tsx`
- `frontend/src/contexts/ThemeContext.tsx`
- `frontend/package.json`

## Checklist

- [x] estado transitório de `Instancia` ajustado para evitar re-render desnecessário
- [x] botões próprios com `type` explícito
- [x] acessibilidade interativa do `ToastContext` corrigida
- [x] valores de contexto inline memoizados onde aplicável
- [x] dependência `clsx` validada e removida se estiver sem uso
- [x] lint do frontend validado
- [x] build do frontend validado
