# Story 044 - Image-Aware WhatsApp Dispatch And Rich Event Messages

## Status

Ready for Review

## Objetivo

Como integrador e operação do NexusZAP,
quero que os eventos corretos enviem mensagens ricas com imagem do produto quando o plano assim exigir,
para que o comportamento do WhatsApp reflita o fluxo definido na referência funcional.

## Dependências explícitas desta fase

- esta story depende do contexto rico e do `getProductImage()` definidos na story 043
- o runtime desta fase deve continuar usando a instância correta via Baileys

## Problema atual

O dispatch atual trabalha de forma mais simples com `text`, `link` e `document`, mas ainda não implementa o comportamento com imagem do produto, caption rica e `externalAdReply` previsto no plano.

## Como esta story se encaixa no fluxo geral

- esta story consome o contexto rico e a resolução de imagem definidos na story 043
- esta story fecha o comportamento operacional do backend antes da consolidação documental da story 045
- a story 046 depende desta implementação para endurecer o fallback real em vez de um contrato hipotético

## Escopo

- adaptar o dispatch para eventos com imagem do produto
- baixar ou resolver a imagem para envio via Baileys
- usar caption adequada por evento
- usar `externalAdReply` quando o plano já o prevê
- manter texto e documento para eventos que não usam imagem

## Direção técnica obrigatória

- o runtime principal continua sendo `backend/src/services/integrations/integrationDispatchRuntime.service.ts`
- o renderer padrão continua pertencendo ao backend, sem entrada textual livre pelo endpoint
- a implementação deve manter compatibilidade com a resolução de instância, autenticação e destinatário já existente
- qualquer lógica de download, validação ou fallback da imagem deve ser encapsulada de modo testável no backend
- se Baileys exigir formato específico para imagem, caption ou `contextInfo`, esse contrato deve ser centralizado no payload builder do runtime

## Eventos com imagem obrigatória nesta fase

- `pedido_pago`
- `pix_gerado`
- `carrinho_abandonado`
- `envio_acesso`
- `assinatura_criada`
- `assinatura_em_atraso`

## Eventos sem imagem obrigatória nesta fase

- `pedido_pendente`
- `pagamento_recusado`
- `pedido_cancelado`
- `reembolso`
- `boleto_gerado`
- `assinatura_renovada`
- `assinatura_cancelada`

## Templates literais obrigatórios desta fase

Os templates abaixo devem ser tratados como referência textual padrão do sistema para a v1. O objetivo é reduzir margem de improviso na implementação.

### `pedido_pago`

Tipo: imagem + caption + `externalAdReply`

Caption base:

`✅ *Parabéns {{name}}!*\n\nSeu *{{productName}}* foi aprovado com sucesso!\n\n👉 Acesse agora sua área de membros e comece a aprender.`

`externalAdReply`:

- `title`: `{{productName}}`
- `body`: `Clique para acessar`
- `sourceUrl`: `{{checkoutLink}}`

### `pedido_pendente`

Tipo: texto

Texto base:

`⏳ *Olá {{name}}!*\n\nRecebemos seu pedido do *{{productName}}*.\nAssim que o pagamento for confirmado, você receberá o acesso automaticamente.\n\nQualquer dúvida, estamos à disposição.`

### `pagamento_recusado`

Tipo: texto + `externalAdReply`

Texto base:

`❌ *{{name}}*, o pagamento do *{{productName}}* foi recusado.\n\nIsso pode ter ocorrido por:\n• Cartão sem limite\n• Dados incorretos\n• Bloqueio da operadora\n\n👉 Tente novamente com outro cartão ou forma de pagamento:`

`externalAdReply`:

- `title`: `Tentar novamente`
- `body`: `{{productName}}`
- `sourceUrl`: `{{checkoutLink}}`

### `pedido_cancelado`

Tipo: texto

Texto base:

`⛔ *{{name}}*, seu pedido do *{{productName}}* foi cancelado conforme solicitado.\n\nSe precisar de ajuda, estamos aqui!`

### `reembolso`

Tipo: texto

Texto base:

`💰 *{{name}}*, o reembolso do *{{productName}}* foi processado com sucesso.\n\nO valor será estornado em até *5 dias úteis* na forma de pagamento original.`

### `pix_gerado`

Tipo: imagem + caption + `externalAdReply`

Caption base:

`💳 *{{name}}*, o PIX do *{{productName}}* foi gerado!\n\n📋 *Valor:* R$ {{total}}\n\n⚠️ *Pague até o vencimento para garantir sua vaga!*\n\n📌 *Código Pix (copia e cola):*\n\`\`\`{{pixCopyPaste}}\`\`\``

`externalAdReply`:

- `title`: `Visualizar pedido`
- `body`: `{{productName}}`
- `sourceUrl`: `{{checkoutLink}}`

### `boleto_gerado`

Tipo: texto + `externalAdReply` ou documento conforme a implementação consolidada

Texto base:

`📄 *{{name}}*, o boleto do *{{productName}}* foi gerado!\n\n📋 *Valor:* R$ {{boletoAmount}}\n📅 *Vencimento:* {{boletoExpire}}\n🔢 *Linha digitável:* {{boletoBarcode}}`

`externalAdReply` quando houver URL pública utilizável:

- `title`: `Baixar boleto`
- `body`: `{{productName}}`
- `sourceUrl`: `{{boletoUrl}}`

### `carrinho_abandonado`

Tipo: imagem + caption + `externalAdReply`

Caption base:

`🛒 *{{name}}*, você deixou o *{{productName}}* no carrinho!\n\n🔥 Não perca esta oportunidade!\n👉 Finalize sua compra agora e garanta seu acesso.`

`externalAdReply`:

- `title`: `Finalizar Compra`
- `body`: `{{productName}}`
- `sourceUrl`: `{{checkoutLink}}`

### `envio_acesso`

Tipo: imagem + caption + `externalAdReply`

Caption base:

`🔓 *Olá {{name}}!*\n\nSeu acesso ao *{{productName}}* foi liberado!\n\nJá pode assistir às aulas e começar sua jornada.`

`externalAdReply`:

- `title`: `Acessar agora`
- `body`: `{{productName}}`
- `sourceUrl`: `{{checkoutLink}}`

### `assinatura_criada`

Tipo: imagem + caption + `externalAdReply`

Caption base:

`🔄 *{{name}}*, sua assinatura do *{{productName}}* foi criada com sucesso!\n\nBem-vindo(a) à nossa plataforma! 🎉`

`externalAdReply`:

- `title`: `Acessar agora`
- `body`: `{{productName}}`
- `sourceUrl`: `{{checkoutLink}}`

### `assinatura_renovada`

Tipo: texto

Texto base:

`✅ *{{name}}*, sua assinatura do *{{productName}}* foi renovada com sucesso!\n\nSeu acesso continua ativo.`

### `assinatura_cancelada`

Tipo: texto

Texto base:

`⛔ *{{name}}*, sua assinatura do *{{productName}}* foi cancelada.\n\nSentiremos sua falta! Caso queira retornar, estaremos aqui.`

### `assinatura_em_atraso`

Tipo: imagem + caption + `externalAdReply`

Caption base:

`⚠️ *{{name}}*, sua assinatura do *{{productName}}* está *atrasada*!\n\nRegularize agora para não perder o acesso.`

`externalAdReply`:

- `title`: `Pagar agora`
- `body`: `{{productName}}`
- `sourceUrl`: `{{checkoutLink}}`

## Regras obrigatórias desta fase

- eventos com imagem devem tentar resolver a imagem do produto a partir do contexto rico
- quando o evento exigir link principal, o dispatch deve continuar expondo URL operacional consistente
- `externalAdReply` deve ser usado apenas quando fizer sentido para o evento e o tipo de mensagem
- o runtime não pode quebrar silenciosamente quando a imagem falhar; o comportamento de fallback precisa ser explícito e testado
- placeholders ausentes devem seguir a política de fallback já consolidada no backend, sem vazar `undefined`, `null` ou texto quebrado

Compatibilidade mínima esperada no runtime:

- eventos sem imagem continuam aceitando `text`, `link` e `document` conforme o contrato vigente
- eventos com imagem podem degradar para mensagem sem imagem quando a política da story 046 assim exigir
- `externalAdReply` não deve substituir o texto operacional principal; ele apenas enriquece a mensagem quando aplicável

Casos de borda que devem ser tratados:

- imagem ausente no payload para evento que normalmente usa imagem
- imagem presente, mas com URL inválida
- falha de download ou leitura da imagem antes do `sendMessage`
- presença de `checkoutLink` ausente em evento cujo `externalAdReply` dependeria de URL
- placeholders opcionais de Pix, boleto ou acesso ausentes sem quebrar render

## Critérios de aceitação

- os eventos marcados com imagem usam imagem do produto no dispatch
- `externalAdReply` é aplicado nos eventos em que o plano o prevê
- os templates literais da story são refletidos no renderer padrão do sistema
- eventos sem imagem continuam operando com seus tipos corretos de mensagem
- o dispatch continua respeitando instância, autenticação e destinatário já normalizado
- `npm test --prefix backend` continua passando

## Regras de negócio

- imagem do produto não substitui o texto operacional; ela enriquece a mensagem
- boleto continua sendo o caso oficial de documento desta fase, se a implementação consolidada mantiver esse comportamento; a documentação deve refletir exatamente o resultado real
- mensagens ricas devem continuar previsíveis por evento, sem customização livre pelo usuário

## Qualidade e testes obrigatórios

- teste de dispatch ou render para cada template literal definido nesta story
- teste de dispatch ou render para eventos com imagem
- teste de fallback quando a imagem estiver ausente ou inválida
- teste de fallback quando o download da imagem falhar
- teste de `externalAdReply` nos eventos aplicáveis
- teste de regressão para eventos `text`, `link` e `document`
- executar `npm test --prefix backend`

## Referências técnicas desta fase

- `checkout/plano-integracao-nexuszap.md` - usar as partes que descrevem eventos com imagem, captions ricas e `externalAdReply`
- `docs/integrations/diferencas-endpoint-vs-plano.md#6-construcao-de-mensagem-por-tipo-de-evento` - gap por evento que esta story fecha
- `docs/integrations/diferencas-endpoint-vs-plano.md#7-download-e-anexo-de-imagem-do-produto` - gap técnico de imagem e `externalAdReply`
- `backend/src/services/integrations/integrationDispatchRuntime.service.ts` - ponto principal de montagem do payload Baileys
- `backend/src/services/integrations/integrationDispatchTemplate.service.ts` - ponto principal de render por evento
- `backend/src/services/integrations/integrationEventCatalog.service.ts` - fonte do contexto normalizado enriquecido vindo da story 043

## Arquivos prováveis

- `backend/src/services/integrations/integrationDispatchRuntime.service.ts`
- `backend/src/services/integrations/integrationDispatchTemplate.service.ts`
- `backend/src/services/integrations/integrationEventCatalog.service.ts`
- `backend/src/services/integrations/**`
- `backend/src/whatsapp/**`
- `backend/scripts/**`

## Assunções explícitas

- o contrato público do endpoint permanece `event`, `payload`, `instanceId`, `timestamp` e `dedupKey`
- a implementação desta story não deve abrir edição manual de template no frontend
- conflito técnico real com Baileys sobre `externalAdReply` ou imagem pode exigir consulta ao `architect`, mas não muda as decisões de produto já fechadas

## CodeRabbit Integration

Disabled

## Checklist

- [x] templates literais por evento definidos
- [x] suporte a imagem no dispatch definido
- [x] eventos com imagem definidos
- [x] uso de `externalAdReply` definido
- [x] fallback de imagem previsto
- [x] testes focados previstos

## Dev Agent Record

### Agent Model Used

- GPT-5 Codex

### Debug Log References

- `Context7 CLI: /whiskeysockets/baileys - image messages with caption and contextInfo.externalAdReply`
- `npm run typecheck --prefix backend`
- `node scripts/integration-dispatch-template-api.cjs`
- `node scripts/integration-dispatch-runtime-api.cjs`
- `npm test --prefix backend`

### Completion Notes List

- O renderer padrão passou a refletir os templates literais da story 044, com captions ricas para eventos com imagem e textos específicos para os demais eventos.
- O runtime de dispatch agora suporta payload Baileys com `image`, `caption` e `contextInfo.externalAdReply`, centralizando o contrato no builder de payload.
- A resolução da mídia foi encapsulada em helper de download por URL HTTP/HTTPS, com fallback explícito para mensagem textual quando a imagem faltar ou falhar no carregamento.
- `boleto_gerado` permaneceu como documento, mas agora pode carregar `externalAdReply` com URL pública quando disponível, conforme a flexibilidade prevista na story.
- Os testes focados foram ampliados para cobrir templates literais, eventos com imagem, `externalAdReply`, regressão de documento/link e fallback sem quebra do dispatch.

### File List

- `docs/stories/044-image-aware-whatsapp-dispatch-and-rich-event-messages.md`
- `backend/src/services/integrations/integrationDispatchTemplate.service.ts`
- `backend/src/services/integrations/integrationDispatchRuntime.service.ts`
- `backend/scripts/integration-dispatch-template-api.cjs`
- `backend/scripts/integration-dispatch-runtime-api.cjs`

### Change Log

- 2026-05-29: story 044 implementada com mensagens ricas por evento, suporte a imagem no dispatch, `externalAdReply` e fallback operacional sem bloqueio do envio.

## QA Results

### 2026-05-29 - Quinn

Gate: PASS

Resumo:
- A implementação atende ao escopo da story 044 sem findings funcionais no contrato revisado.
- O renderer agora reflete os templates literais por evento e o runtime centraliza o payload Baileys com `image`, `caption` e `contextInfo.externalAdReply`.
- O fallback operacional para ausência ou falha de imagem foi exercitado sem bloquear o dispatch principal.

Evidências verificadas:
- `Context7 CLI: /whiskeysockets/baileys - image messages with caption and contextInfo.externalAdReply`
- `npm run typecheck --prefix backend`
- `node scripts/integration-dispatch-template-api.cjs`
- `node scripts/integration-dispatch-runtime-api.cjs`
- `npm test --prefix backend`

Cobertura vs critérios de aceitação:
- PASS: os eventos marcados com imagem usam imagem do produto no dispatch quando a mídia está disponível.
- PASS: `externalAdReply` é aplicado nos eventos previstos, inclusive em mensagens textuais e documento quando houver URL utilizável.
- PASS: os templates literais da story estão refletidos no renderer padrão do sistema.
- PASS: eventos sem imagem continuam operando com seus tipos corretos e o boleto permanece consolidado como documento.
- PASS: o dispatch continua respeitando instância, autenticação e destinatário normalizado, com fallback explícito para texto quando a imagem não puder ser enviada.

Riscos residuais:
- Baixo: o download de mídia depende de disponibilidade HTTP externa em runtime real; a story 046 ainda deve endurecer contratos de fallback e observabilidade desse caminho.
- Baixo: `npm run lint --prefix backend` não foi executado porque o pacote `backend` não expõe script `lint` neste repositório.
