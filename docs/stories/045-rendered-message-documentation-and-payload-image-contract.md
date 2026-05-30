# Story 045 - Rendered Message Documentation And Payload Image Contract

## Status

Ready for Review

## Objetivo

Como operador ou integrador do NexusZAP,
quero uma documentação que mostre a mensagem real enviada por evento e o contrato da imagem do produto,
para configurar o sistema externo sem adivinhar o resultado final no WhatsApp.

## Dependências explícitas desta fase

- esta story depende do contexto rico da story 043
- esta story depende do dispatch com imagem da story 044
- a documentação desta fase deve refletir o comportamento real implementado, não um exemplo hipotético

## Problema atual

A documentação atual explica endpoint, credenciais, eventos e tipos de mensagem, mas ainda não mostra claramente o texto real enviado por evento, o uso da imagem do produto nem o contrato detalhado dos campos do payload que alimentam esse comportamento.

## Como esta story se encaixa no fluxo geral

- esta story consolida o comportamento que as stories 043 e 044 tornam real no backend
- ela é a ponte entre implementação e operação, reduzindo ambiguidade para integradores e QA
- sem esta story, o backend pode estar correto e ainda assim o contrato público continuar enganoso ou incompleto

## Escopo

- documentar a mensagem padrão enviada por evento
- documentar quais eventos usam imagem do produto
- documentar de onde a imagem é extraída no payload
- documentar o comportamento de fallback quando a imagem não vier ou vier inválida
- documentar exemplos renderizados de payload para mensagem final
- manter a documentação no artefato técnico existente, sem criar tela nova de edição no frontend

## Direção técnica obrigatória

- a fonte primária da documentação é o comportamento real implementado no backend, não rascunhos antigos do plano
- atualizar o artefato existente em `docs/integrations/nexuszap-plugin-api.md`, evitando espalhar o contrato em múltiplos documentos concorrentes
- se houver diferença entre o plano legado e a implementação consolidada das stories 043 e 044, a documentação desta fase deve descrever o resultado real e registrar o fallback real
- a documentação deve permanecer técnica, voltada a payload, resposta, render e comportamento operacional

## Estrutura mínima obrigatória da documentação desta fase

1. tabela de eventos com tipo real de saída
2. indicação de quais eventos usam imagem
3. exemplos de mensagem renderizada por evento relevante
4. explicação de `getProductImage()` em nível contratual
5. origem da imagem no payload
6. comportamento de fallback quando a imagem faltar
7. observações sobre `externalAdReply` quando aplicável

Formato mínimo esperado para os exemplos:

- um exemplo de payload relevante por grupo de evento quando isso reduzir redundância
- um exemplo da mensagem final efetivamente renderizada, com texto e indicação de imagem quando aplicável
- indicação clara de quando o evento envia `text`, `document` ou mensagem com imagem

## Critérios de aceitação

- a documentação mostra a mensagem padrão por evento em vez de apenas listar `text`, `link` ou `document`
- a documentação explica claramente o contrato da imagem do produto
- a documentação indica quais campos do payload alimentam a mensagem final
- a documentação explica o fallback de imagem
- a documentação continua exclusivamente técnica

## Regras de negócio

- a documentação deve descrever o comportamento real do backend
- a documentação não deve sugerir edição pelo usuário quando essa capacidade não existir nesta fase
- mensagem padrão do sistema e contrato de payload precisam ficar explícitos para o integrador

Restrições explícitas desta fase:

- não reintroduzir `baseUrl` como credencial pública
- não ensinar construção de UI, builder ou painel da ferramenta externa
- não documentar imagem como obrigatória para todos os eventos; a política precisa refletir o fallback fechado no handoff

## Qualidade e testes obrigatórios

- revisão manual da documentação contra o comportamento real implementado
- validação de consistência entre exemplos documentados e templates reais
- executar os testes relevantes do backend antes de encerrar a story

Pontos mínimos de revisão manual:

- a tabela de eventos bate com os tipos efetivos de mensagem realmente enviados
- os exemplos renderizados não divergem dos templates atuais do backend
- a origem da imagem no payload está documentada na mesma ordem funcional implementada
- o fallback descrito na doc é o mesmo que o backend aplica em tempo de dispatch

## Referências técnicas desta fase

- `checkout/plano-integracao-nexuszap.md` - referência funcional de origem para comparar intenção versus comportamento final
- `docs/integrations/nexuszap-plugin-api.md` - artefato principal que deve ser atualizado nesta story
- `docs/integrations/diferencas-endpoint-vs-plano.md#6-construcao-de-mensagem-por-tipo-de-evento` - base para explicar o que foi aproximado do plano
- `docs/integrations/diferencas-endpoint-vs-plano.md#7-download-e-anexo-de-imagem-do-produto` - base para explicar imagem e `externalAdReply`
- `backend/src/services/integrations/integrationDispatchTemplate.service.ts` - fonte do texto renderizado por evento
- `backend/src/services/integrations/integrationDispatchRuntime.service.ts` - fonte do tipo final de dispatch e das regras de fallback operacional

## Arquivos prováveis

- `docs/integrations/nexuszap-plugin-api.md`
- `docs/integrations/diferencas-endpoint-vs-plano.md`
- `docs/integrations/**`
- `docs/stories/**`

## Assunções explícitas

- a documentação desta story só deve ser consolidada depois de 043 e 044 efetivamente implementadas
- não há necessidade de tela nova no frontend para cumprir este escopo
- exemplos documentados podem usar payloads reduzidos, desde que preservem fidelidade contratual ao comportamento real

## CodeRabbit Integration

Disabled

## Checklist

- [x] mensagens reais por evento previstas na doc
- [x] contrato da imagem previsto na doc
- [x] fallback de imagem previsto na doc
- [x] exemplos renderizados previstos

## Dev Agent Record

### Agent Model Used

- GPT-5 Codex

### Debug Log References

- `Get-Content docs/integrations/nexuszap-plugin-api.md`
- `Get-Content docs/integrations/diferencas-endpoint-vs-plano.md`
- `npm run typecheck --prefix backend`
- `npm test --prefix backend`

### Completion Notes List

- A documentação pública principal foi atualizada para refletir o comportamento real pós-stories 043 e 044, incluindo textos renderizados, eventos com imagem, `externalAdReply` e fallback operacional.
- O contrato da imagem passou a documentar a ordem real de busca em `order.product`, `checkout_session.product` e `subscription.product`, sem reintroduzir `baseUrl` como credencial pública.
- A documentação comparativa com o plano legado foi revisada para registrar quais lacunas já foram fechadas e quais divergências ainda permanecem no endpoint atual.

### File List

- `docs/stories/045-rendered-message-documentation-and-payload-image-contract.md`
- `docs/integrations/nexuszap-plugin-api.md`
- `docs/integrations/diferencas-endpoint-vs-plano.md`

### Change Log

- 2026-05-29: story 045 implementada com documentação técnica do render real por evento, contrato da imagem do produto e fallback operacional consolidado.

## QA Results

### 2026-05-29 - Quinn

Gate: PASS

Resumo:
- A documentação da story 045 reflete o comportamento real consolidado nas stories 043 e 044, sem findings funcionais de contrato.
- O artefato principal passou a mostrar mensagens renderizadas por evento, uso real de imagem do produto, `externalAdReply` e fallback para texto quando a mídia não puder ser enviada.
- O comparativo com o plano legado foi atualizado para separar claramente gaps já fechados de divergências que ainda permanecem no endpoint.

Evidências verificadas:
- `Get-Content docs/integrations/nexuszap-plugin-api.md`
- `Get-Content docs/integrations/diferencas-endpoint-vs-plano.md`
- `npm run typecheck --prefix backend`
- `npm test --prefix backend`

Cobertura vs critérios de aceitação:
- PASS: a documentação mostra a mensagem padrão por evento em vez de apenas listar tipos genéricos.
- PASS: o contrato da imagem do produto está descrito com ordem real de resolução e sem reintroduzir `baseUrl` público.
- PASS: os campos do payload que alimentam a mensagem final estão explicitados na documentação principal.
- PASS: o fallback de imagem documentado corresponde ao comportamento real do runtime.
- PASS: a documentação permaneceu exclusivamente técnica, sem sugerir edição manual de template.

Riscos residuais:
- Baixo: `docs/` continua ignorado pelo repositório, então alterações documentais exigem `git add -f` no fluxo de commit.
- Baixo: o comparativo com o plano legado ainda registra divergências abertas fora do escopo da 045, como resposta HTTP e fallback para eventos desconhecidos.
