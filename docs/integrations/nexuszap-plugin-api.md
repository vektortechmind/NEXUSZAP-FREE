# NexusZAP Plugin API

## Visão geral

Esta integração permite que um sistema externo envie eventos operacionais para o NexusZAP e acione disparos transacionais por instância.

O NexusZAP autentica cada chamada por token, valida a instância informada, normaliza o payload, extrai contexto operacional rico, renderiza a mensagem padrão do evento e tenta enviar a mensagem pelo runtime WhatsApp da instância correspondente.

Nesta fase, os templates são internos ao backend. O sistema externo não envia o texto final da mensagem e não escolhe manualmente o tipo de render.

## Pré-requisitos técnicos

- uma instância WhatsApp existente no NexusZAP
- credencial de integração emitida para a instância correta
- acesso ao valor final de `endpointUrl`
- capacidade de enviar `POST` com `Content-Type: application/json`
- relógio do sistema externo sincronizado, porque o endpoint valida `timestamp`
- payload capaz de informar telefone do cliente e, quando desejado, URL ou caminho de imagem do produto

## Credenciais necessárias

Cada integração usa exatamente estas credenciais operacionais:

- `endpointUrl`
- `instanceId`
- `secretToken`

`endpointUrl` já é a URL completa final da integração. Não concatene `baseUrl` manualmente.

Exemplo de `endpointUrl`:

```text
https://painel.seudominio.com/api/integrations/events
```

## Autenticação

Envie o token da integração no header `Authorization` usando Bearer token.

```http
Authorization: Bearer <secretToken>
```

O token autoriza apenas a instância à qual a credencial pertence. Se o `instanceId` do body não corresponder à credencial autenticada, o NexusZAP rejeita a chamada.

## Método HTTP e headers

- método: `POST`
- URL: `endpointUrl`
- header obrigatório: `Authorization: Bearer <secretToken>`
- header obrigatório: `Content-Type: application/json`

## Estrutura completa da requisição

```json
{
  "event": "pedido_pago",
  "instanceId": "f9eb8d5c-9d2e-4dbf-9b97-1d2f0a4a7a80",
  "timestamp": "2026-05-29T14:30:00.000Z",
  "dedupKey": "pedido-123-pago-20260529",
  "payload": {
    "customer": {
      "name": "Maria Silva",
      "phone": "(11) 99876-5432",
      "email": "maria@example.com"
    },
    "order": {
      "total": "199.90",
      "product": {
        "name": "Curso Premium",
        "image": "products/curso-premium/capa.jpg"
      }
    },
    "checkout_link": "https://checkout.example.com/c/123"
  }
}
```

## Campos obrigatórios do body

- `event`: slug do evento suportado
- `instanceId`: identificador da instância autorizada
- `timestamp`: data/hora ISO-8601 usada na replay window
- `dedupKey`: chave idempotente por credencial
- `payload`: objeto com os dados operacionais do evento

## Eventos suportados

O contrato atual aceita estes eventos:

- `pedido_pendente`
- `pedido_pago`
- `envio_acesso`
- `pagamento_recusado`
- `pedido_cancelado`
- `reembolso`
- `pix_gerado`
- `boleto_gerado`
- `carrinho_abandonado`
- `assinatura_criada`
- `assinatura_renovada`
- `assinatura_cancelada`
- `assinatura_em_atraso`

## Tipos reais de saída por evento

Os templates padrão desta fase usam estes tipos efetivos de mensagem:

- `text`
- `image`
- `document`

Mapeamento atual:

| Evento | Tipo real de saída | Usa imagem do produto | Usa `externalAdReply` | Observação principal |
|---|---|---:|---:|---|
| `pedido_pendente` | `text` | não | não | texto simples |
| `pedido_pago` | `image` ou fallback `text` | sim | sim | usa `checkout_link` no card enriquecido |
| `envio_acesso` | `image` ou fallback `text` | sim | sim | o card aponta para `checkout_link`, não para `access.url` |
| `pagamento_recusado` | `text` | não | sim quando `checkout_link` existir | inclui CTA de nova tentativa |
| `pedido_cancelado` | `text` | não | não | aviso simples |
| `reembolso` | `text` | não | não | aviso simples |
| `pix_gerado` | `image` ou fallback `text` | sim | sim | inclui valor e código Pix quando disponíveis |
| `boleto_gerado` | `document` | não | sim quando `boleto.pdf_url` existir | envia `boleto.pdf` |
| `carrinho_abandonado` | `image` ou fallback `text` | sim | sim | CTA de finalização |
| `assinatura_criada` | `image` ou fallback `text` | sim | sim | CTA de acesso |
| `assinatura_renovada` | `text` | não | não | confirmação simples |
| `assinatura_cancelada` | `text` | não | não | aviso simples |
| `assinatura_em_atraso` | `image` ou fallback `text` | sim | sim quando `checkout_link` existir | CTA de regularização |

## Mensagem padrão renderizada por evento

Os exemplos abaixo mostram o texto real padrão do sistema após render. O sistema externo não controla esses textos nesta fase.

### `pedido_pago`

Tipo final esperado: `image` com fallback para `text`

```text
✅ *Parabéns Maria Silva!*

Seu *Curso Premium* foi aprovado com sucesso!

👉 Acesse agora sua área de membros e comece a aprender.
```

Enriquecimento quando `checkout_link` existir:

- `externalAdReply.title`: nome do produto
- `externalAdReply.body`: `Clique para acessar`
- `externalAdReply.sourceUrl`: `checkout_link`

### `pedido_pendente`

Tipo final esperado: `text`

```text
⏳ *Olá Maria Silva!*

Recebemos seu pedido do *Curso Premium*.

Assim que o pagamento for confirmado, você receberá o acesso automaticamente.

Qualquer dúvida, estamos à disposição.
```

### `pagamento_recusado`

Tipo final esperado: `text`

```text
❌ *Maria Silva*, o pagamento do *Curso Premium* foi recusado.

Isso pode ter ocorrido por:
• Cartão sem limite
• Dados incorretos
• Bloqueio da operadora

👉 Tente novamente com outro cartão ou forma de pagamento:
```

Quando `checkout_link` existir, o card enriquecido usa:

- `title`: `Tentar novamente`
- `body`: nome do produto
- `sourceUrl`: `checkout_link`

### `pedido_cancelado`

Tipo final esperado: `text`

```text
⛔ *Maria Silva*, seu pedido do *Curso Premium* foi cancelado conforme solicitado.

Se precisar de ajuda, estamos aqui!
```

### `reembolso`

Tipo final esperado: `text`

```text
💰 *Maria Silva*, o reembolso do *Curso Premium* foi processado com sucesso.

O valor será estornado em até *5 dias úteis* na forma de pagamento original.
```

### `pix_gerado`

Tipo final esperado: `image` com fallback para `text`

````text
💳 *Maria Silva*, o PIX do *Curso Premium* foi gerado!

📋 *Valor:* R$ 199.90

⚠️ *Pague até o vencimento para garantir sua vaga!*

📌 *Código Pix (copia e cola):*
```000201PIX-COPIA-COLA```
````

Quando `checkout_link` existir, o card enriquecido usa:

- `title`: `Visualizar pedido`
- `body`: nome do produto
- `sourceUrl`: `checkout_link`

### `boleto_gerado`

Tipo final esperado: `document`

```text
📄 *Maria Silva*, o boleto do *Curso Premium* foi gerado!

📋 *Valor:* R$ 149.90

📅 *Vencimento:* 2026-06-15

🔢 *Linha digitável:* 1234567890
```

O envio usa:

- `document.url`: `boleto.pdf_url`
- `fileName`: `boleto.pdf`
- `mimetype`: `application/pdf`

Quando `boleto.pdf_url` existir, o card enriquecido usa:

- `title`: `Baixar boleto`
- `body`: nome do produto
- `sourceUrl`: `boleto.pdf_url`

### `carrinho_abandonado`

Tipo final esperado: `image` com fallback para `text`

```text
🛒 *Maria Silva*, você deixou o *Curso Premium* no carrinho!

🔥 Não perca esta oportunidade!

👉 Finalize sua compra agora e garanta seu acesso.
```

### `envio_acesso`

Tipo final esperado: `image` com fallback para `text`

```text
🔓 *Olá Maria Silva!*

Seu acesso ao *Curso Premium* foi liberado!

Já pode assistir às aulas e começar sua jornada.
```

### `assinatura_criada`

Tipo final esperado: `image` com fallback para `text`

```text
🔄 *Maria Silva*, sua assinatura do *Clube VIP* foi criada com sucesso!

Bem-vindo(a) à nossa plataforma! 🎉
```

### `assinatura_renovada`

Tipo final esperado: `text`

```text
✅ *Maria Silva*, sua assinatura do *Clube VIP* foi renovada com sucesso!

Seu acesso continua ativo.
```

### `assinatura_cancelada`

Tipo final esperado: `text`

```text
⛔ *Maria Silva*, sua assinatura do *Clube VIP* foi cancelada.

Sentiremos sua falta! Caso queira retornar, estaremos aqui.
```

### `assinatura_em_atraso`

Tipo final esperado: `image` com fallback para `text`

```text
⚠️ *Maria Silva*, sua assinatura do *Clube VIP* está *atrasada*!

Regularize agora para não perder o acesso.
```

## Estrutura e observações do payload

O payload varia por evento, mas alguns campos são reutilizados entre fluxos.

Campos frequentemente usados no contexto final:

- `customer.name`
- `customer.phone`
- `customer.email`
- `order.product.name`
- `checkout_session.product.name`
- `subscription.product.name`
- `order.total`
- `checkout_session.total`
- `subscription.next_billing`
- `checkout_link`
- `pix.qrcode`
- `pix.copy_paste`
- `pix.transaction_id`
- `boleto.amount`
- `boleto.expire_at`
- `boleto.barcode`
- `boleto.pdf_url`

O contrato aceita campos extras no `payload`, mas apenas os campos conhecidos entram no contexto normalizado oficial.

## Contrato da imagem do produto

### Eventos que tentam usar imagem

O backend tenta usar imagem do produto apenas nestes eventos:

- `pedido_pago`
- `pix_gerado`
- `carrinho_abandonado`
- `envio_acesso`
- `assinatura_criada`
- `assinatura_em_atraso`

### Ordem funcional de busca da imagem

A imagem é procurada nesta ordem de produto:

1. `payload.order.product`
2. `payload.checkout_session.product`
3. `payload.subscription.product`

Dentro do produto escolhido, a ordem de resolução é:

1. `thumbnail_url`
2. `cover` quando já for URL absoluta
3. `image` quando já for URL absoluta
4. `image` relativo com origem HTTP/HTTPS confiável
5. `cover` relativo com origem HTTP/HTTPS confiável

### Como caminhos relativos são montados

Se `cover` ou `image` vierem como caminho relativo, o backend só monta URL final quando consegue inferir uma origem HTTP/HTTPS confiável a partir do próprio payload, por exemplo:

- `checkout_link`
- `boleto.pdf_url`
- `access.url`
- outros campos absolutos do próprio payload já suportados pelo backend

Exemplo:

```json
{
  "payload": {
    "checkout_link": "https://checkout.example.com/c/123",
    "order": {
      "product": {
        "name": "Curso Premium",
        "image": "products/curso-premium/capa.jpg"
      }
    }
  }
}
```

Resultado esperado de `productImage`:

```text
https://checkout.example.com/storage/products/curso-premium/capa.jpg
```

### O que não faz parte do contrato público

- não existe credencial pública `baseUrl`
- o integrador não precisa enviar domínio extra fora do próprio payload
- o backend não usa domínio externo fixo ou hardcoded para completar imagem

## Fallback de imagem em runtime

A imagem do produto é um enriquecimento visual, não um requisito para concluir o dispatch.

Comportamento real:

1. o template do evento continua sendo classificado como `image`
2. o runtime tenta baixar a imagem via HTTP/HTTPS para montar o envio no Baileys
3. se o download funcionar, a mensagem é enviada com `image`, `caption` e `contextInfo.externalAdReply` quando aplicável
4. se a imagem estiver ausente, a URL for inválida ou o download falhar, o runtime envia a mesma mensagem como `text`
5. a falha da imagem não bloqueia o envio principal do evento

Em outras palavras: ausência ou erro de imagem degrada para texto, não para erro de integração.

## Política de `externalAdReply`

Quando aplicável, o backend enriquece a mensagem com `contextInfo.externalAdReply`.

Regras atuais:

- é usado nos eventos com CTA operacional claro
- não substitui o texto ou a caption principal
- depende de URL utilizável no contexto do evento
- em eventos com imagem, o runtime tenta enviar o thumbnail a partir do mesmo buffer baixado

Eventos que podem usar `externalAdReply`:

- `pedido_pago`
- `pagamento_recusado`
- `pix_gerado`
- `boleto_gerado`
- `carrinho_abandonado`
- `envio_acesso`
- `assinatura_criada`
- `assinatura_em_atraso`

## Política de normalização de destinatário

O integrador não precisa enviar `recipientJid`.

O NexusZAP resolve o destinatário a partir do payload seguindo esta ordem operacional de telefone:

1. `customer.phone`
2. `order.phone`
3. `order.user.phone`
4. `subscription.user.phone`
5. `checkout_session.phone`

Regras da normalização atual:

- remove caracteres não numéricos
- se o número já vier com prefixo `55` e tiver 12 ou 13 dígitos, ele é aceito
- se vier sem `55` e tiver 10 ou 11 dígitos, o prefixo `55` é adicionado
- qualquer outro formato resulta em destinatário inválido

Se o telefone não puder ser normalizado, a chamada falha com erro funcional de destinatário ausente.

## Comportamento do NexusZAP ao receber o evento

Fluxo operacional atual:

1. valida contrato básico de headers e body
2. valida se o evento é suportado
3. autentica o token e confere `instanceId`
4. valida replay window e deduplicação
5. persiste log de ingresso
6. normaliza o payload e extrai contexto rico
7. renderiza o template padrão do evento
8. resolve a instância e o runtime Baileys
9. quando o evento usa imagem, tenta baixar a mídia em memória antes do `sendMessage`
10. envia a mensagem para o `recipientJid` normalizado
11. persiste log de dispatch com sucesso ou falha

## Respostas HTTP previsíveis

| Status | Código operacional típico | Significado |
|---|---|---|
| `202` | `accepted` | disparo enviado com sucesso operacional |
| `400` | `INTEGRATION_CONTRACT_INVALID` | contrato inválido |
| `400` | `UNSUPPORTED_INTEGRATION_EVENT` | evento não suportado |
| `401` | `INVALID_INTEGRATION_TOKEN` | token inválido |
| `403` | `INACTIVE_INTEGRATION_CREDENTIAL` | credencial inativa |
| `403` | `INTEGRATION_INSTANCE_MISMATCH` | token não autoriza a instância informada |
| `409` | `INTEGRATION_REPLAY_WINDOW_VIOLATION` | timestamp fora da janela permitida |
| `409` | `DUPLICATE_INTEGRATION_REQUEST` | `dedupKey` já processada |
| `409` | `INTEGRATION_DISPATCH_INSTANCE_NOT_FOUND` | instância inexistente |
| `409` | `INTEGRATION_DISPATCH_INSTANCE_OFFLINE` | instância indisponível ou sem sessão ativa |
| `409` | `INTEGRATION_DISPATCH_SEND_FAILED` | falha no `sendMessage` |
| `422` | `INTEGRATION_DISPATCH_RECIPIENT_MISSING` | destinatário ausente após normalização |
| `422` | `INTEGRATION_DISPATCH_TEMPLATE_RENDER_ERROR` | template não pôde ser renderizado |
| `500` | `INTEGRATION_INGRESS_INTERNAL_ERROR` | erro interno inesperado |

## Exemplos de payload relevante

### Exemplo para evento com imagem e CTA

```json
{
  "event": "pedido_pago",
  "instanceId": "f9eb8d5c-9d2e-4dbf-9b97-1d2f0a4a7a80",
  "timestamp": "2026-05-29T14:30:00.000Z",
  "dedupKey": "pedido-123-pago-20260529",
  "payload": {
    "customer": {
      "name": "Maria Silva",
      "phone": "(11) 99876-5432"
    },
    "order": {
      "total": "199.90",
      "product": {
        "name": "Curso Premium",
        "image": "products/curso-premium/capa.jpg"
      }
    },
    "checkout_link": "https://checkout.example.com/c/123"
  }
}
```

### Exemplo para boleto como documento

```json
{
  "event": "boleto_gerado",
  "instanceId": "f9eb8d5c-9d2e-4dbf-9b97-1d2f0a4a7a80",
  "timestamp": "2026-05-29T14:40:00.000Z",
  "dedupKey": "boleto-125-gerado-20260529",
  "payload": {
    "customer": {
      "name": "Ana Costa",
      "phone": "+55 11 97654-3210"
    },
    "order": {
      "product": {
        "name": "Assinatura Pro"
      }
    },
    "boleto": {
      "pdf_url": "https://checkout.example.com/boleto-125.pdf",
      "amount": "149.90",
      "expire_at": "2026-06-15",
      "barcode": "1234567890"
    }
  }
}
```

## Troubleshooting técnico

### Token inválido

- verifique se `Authorization` usa `Bearer <secretToken>`
- confirme se o token ativo ainda não foi rotacionado

### Mismatch de instância

- confirme se o `instanceId` do body pertence à mesma credencial que gerou o `secretToken`

### Replay window violada

- confira se `timestamp` está em UTC correto
- sincronize o relógio do sistema externo

### Evento não suportado

- use apenas os slugs listados nesta documentação

### Destinatário ausente

- garanta que o payload envie um telefone válido em um dos caminhos aceitos
- evite formatos incompletos ou campos vazios

### Imagem não enviada

- confirme se o evento está na lista de eventos que usam imagem
- confirme se o payload contém imagem do produto em um dos caminhos suportados
- se a imagem for relativa, confirme que o payload contém origem HTTP/HTTPS confiável para montagem da URL final
- confirme se a URL final da imagem é acessível pelo backend em runtime
- se o download falhar, o backend envia a mesma mensagem como texto

### Instância offline

- verifique se a instância está `CONNECTED`
- confirme que existe sessão WhatsApp ativa em memória

### Falha de dispatch

- consulte o dashboard operacional de integrações para verificar o `dispatchStatus` e o `failureCode`

## Versionamento do contrato

Contrato atual: fase operacional consolidada das stories `031` a `045`.

Mudanças futuras podem ampliar a lista de eventos, o endurecimento de fallback e a observabilidade operacional sem preservar compatibilidade retroativa automática para payloads não documentados.

