# Diferenças: Endpoint Atual vs Referência do Plano

Comparação contratual entre o endpoint implementado (`/api/integrations/events`) e o especificado no plano de referência (`checkout/plano-integracao-nexuszap.md`). Lista o que ainda diverge do plano legado e registra o que já foi aproximado nas stories 043 a 045.

---

## 1. Rota

| Referência | Atual | Status |
|---|---|---|
| `POST /api/webhooks/getfy` | `POST /api/integrations/events` | ❌ Rota diferente |

---

## 2. Campos do Body

| Campo | Referência | Atual | Status |
|---|---|---|---|
| `event` | string obrigatório | string obrigatório | ✅ |
| `event_label` | string presente (ex: `"Pedido pago"`) | ausente | ❌ FALTA |
| `payload` | objeto obrigatório | objeto obrigatório | ✅ |
| `instance` | string opcional (nome amigável, ex: `"Vendas"`) | não aceito | ❌ FALTA |
| `instanceId` | não existe no plano | UUID obrigatório | ➕ extra |
| `timestamp` | string ISO-8601 presente | string ISO-8601 obrigatório | ✅ |
| `dedupKey` | não existe no plano | string obrigatório | ➕ extra |

---

## 3. Resposta de Sucesso

| Aspecto | Referência | Atual | Status |
|---|---|---|---|
| Status HTTP | `200` | `202` | ❌ FALTA |
| Estrutura | `{ ok: true, event, phone }` | `{ success: true, data: { ingressId, dispatchId, providerMessageId, status, instanceId, event } }` | ❌ FALTA |
| `phone` na resposta | retorna o telefone extraído | não retorna | ❌ FALTA |
| `event` na resposta | presente | presente | ✅ |
| Forma do `ok` | `ok: true` | `success: true` | ❌ FALTA |

---

## 4. Tratamento de "Sem Telefone"

| Referência | Atual | Status |
|---|---|---|
| Retorna `200 { ok: false, reason: "sem telefone" }` | Rejeita com `422 INTEGRATION_DISPATCH_RECIPIENT_MISSING` | ❌ FALTA |
| Valida phone no próprio endpoint | Delegado ao dispatch runtime | ❌ FALTA |

---

## 5. Tratamento de Instância Desconectada

| Referência | Atual | Status |
|---|---|---|
| Retorna `503 { error: "WhatsApp desconectado" }` | Retorna `409 INTEGRATION_DISPATCH_INSTANCE_OFFLINE` | ❌ FALTA |

---

## 6. Construção de Mensagem por Tipo de Evento

As stories 043 e 044 fecharam a lacuna principal de templates específicos por evento. O backend agora possui render próprio por slug, mensagens com imagem para os eventos previstos, `externalAdReply` quando aplicável e fallback explícito de imagem para texto.

Estado consolidado atual:

| Evento | Referência (tipo de mensagem) | Atual | Status |
|---|---|---|---|
| `pedido_pago` | 🖼️ Imagem + botão com link | `image` com fallback `text` | ✅ aproximado |
| `pedido_pendente` | 💬 Texto simples | `text` | ✅ aproximado |
| `pagamento_recusado` | 💬 Texto + botão de link | `text` + `externalAdReply` | ✅ aproximado |
| `pedido_cancelado` | 💬 Texto simples | `text` | ✅ aproximado |
| `reembolso` | 💬 Texto simples | `text` | ✅ aproximado |
| `pix_gerado` | 🖼️ Imagem + QR Code + botão | `image` com fallback `text` | ✅ aproximado |
| `boleto_gerado` | 💬 Texto + botão de link | `document` + `externalAdReply` | ⚠️ divergência consolidada |
| `carrinho_abandonado` | 🖼️ Imagem + botão de finalizar | `image` com fallback `text` | ✅ aproximado |
| `envio_acesso` | 🖼️ Imagem + botão de acesso | `image` com fallback `text` | ✅ aproximado |
| `assinatura_criada` | 🖼️ Imagem + botão de acesso | `image` com fallback `text` | ✅ aproximado |
| `assinatura_renovada` | 💬 Texto simples | `text` | ✅ aproximado |
| `assinatura_cancelada` | 💬 Texto simples | `text` | ✅ aproximado |
| `assinatura_em_atraso` | 🖼️ Imagem + botão de pagamento | `image` com fallback `text` | ✅ aproximado |

Resumo desta seção:

- o backend já não usa mais templates genéricos por tipo para esses eventos
- o único desvio funcional ainda consolidado é `boleto_gerado`, que permanece como `document` no runtime atual
- o endpoint continua sem `default:` textual para eventos desconhecidos; eventos não suportados ainda são rejeitados com `400 UNSUPPORTED_INTEGRATION_EVENT`

---

## 7. Download e Anexo de Imagem do Produto

As stories 043 e 044 também fecharam a maior parte desta lacuna.

| Referência | Atual | Status |
|---|---|---|
| Faz download da imagem do produto e envia como `image` no `sendMessage` | implementado com download HTTP/HTTPS em memória antes do `sendMessage` | ✅ fechado |
| Usa `contextInfo.externalAdReply` com `thumbnail`, `sourceUrl`, `title` | implementado quando o evento e a URL do contexto permitem | ✅ fechado |
| Função `getProductImage()` para resolver URL da imagem nos payloads | implementada no catálogo de eventos | ✅ fechado |

Comportamento real consolidado:

- o runtime baixa a imagem somente para eventos do tipo `image`
- a mídia é usada em memória e não é persistida como arquivo do contrato público
- se a imagem estiver ausente, inválida ou inacessível, o backend degrada o envio para `text`
- a falha da imagem não bloqueia o dispatch principal

Divergência residual versus o plano:

- o plano legado descrevia download obrigatório para eventos com imagem, enquanto a implementação consolidada trabalha com fallback explícito para texto quando a mídia não puder ser enviada

---

## 8. Funções Auxiliares (messageBuilder.js)

| Função | Referência | Atual | Status |
|---|---|---|---|
| `extractPhone(payload)` | implementada | normalização existe no catálogo de eventos | ✅ |
| `extractContext(event, payload)` | implementada | implementada como `extractContext()` no backend | ✅ |
| `getProductImage(payload, baseUrl)` | implementada | implementada como `getProductImage()` com base inferida do payload ou base explícita interna | ✅ |

Observação importante:

- `baseUrl` não foi reintroduzido como credencial pública
- quando a imagem é relativa, a URL final só é montada se houver origem HTTP/HTTPS confiável no próprio payload ou base interna explícita do chamador

---

## 9. Fallback para Eventos Não Mapeados

| Referência | Atual | Status |
|---|---|---|
| Switch com `default:` que envia texto genérico | Rejeita com `400 UNSUPPORTED_INTEGRATION_EVENT` | ❌ FALTA |

---

## 10. Validação de Conteúdo do Payload (Campos Esperados)

O backend continua aceitando `payload` flexível, mas agora já consome mais campos do que na comparação inicial.

| Campo | Referência | Atual | Status |
|---|---|---|---|
| `customer.name` | esperado | usado no contexto e no render | ✅ |
| `customer.phone` | esperado | usado na resolução do destinatário | ✅ |
| `customer.email` | esperado | usado no contexto | ✅ |
| `order.product.name` | esperado | usado no contexto e no render | ✅ |
| `order.product.image` | esperado | usado na resolução de `productImage` | ✅ |
| `checkout_link` | esperado | usado em contexto, CTA e inferência de origem para imagem relativa | ✅ |
| `pix.qrcode` | esperado | suportado no contexto | ✅ |
| `pix.copy_paste` | esperado | suportado no contexto e no render | ✅ |
| `boleto.pdf_url` | esperado | suportado no contexto e no dispatch `document` | ✅ |
| `boleto.amount` | esperado | suportado no contexto e no render | ✅ |

Limitação remanescente:

- o endpoint não transforma esses campos em contrato público rigidamente validado por evento; ele continua operando com extração tolerante e fallback interno

---

## Resumo

| Item | Status |
|------|--------|
| Rota diferente | ❌ |
| `event_label` faltando | ❌ |
| `instance` (nome) não aceito | ❌ |
| Resposta `{ ok, event, phone }` não implementada | ❌ |
| `phone` não retornado na resposta | ❌ |
| Sem tratamento "sem telefone" como 200 | ❌ |
| Status `503` para instância offline não implementado | ❌ |
| Templates específicos por evento | ✅ fechado nas stories 043/044 |
| Download e anexo de imagem | ✅ fechado nas stories 043/044 |
| `externalAdReply` para CTA | ✅ fechado nas stories 044/045 |
| `getProductImage()` | ✅ fechado na story 043 |
| `extractContext()` | ✅ fechado na story 043 |
| Fallback para eventos desconhecidos | ❌ |
| Validação rígida de campos por evento | ⚠️ parcial |
