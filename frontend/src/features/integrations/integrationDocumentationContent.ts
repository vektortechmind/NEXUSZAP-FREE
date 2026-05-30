export const INTEGRATION_DOCUMENTATION_ROUTE = "/integracoes/documentacao";
export const INTEGRATION_ENDPOINT_PATH = "/api/integrations/events";
export const INTEGRATION_ENDPOINT_URL_EXAMPLE = "https://painel.seudominio.com/api/integrations/events";

export const INTEGRATION_DOCUMENTATION_TOPICS = [
  { id: "visao-geral", label: "Visão geral" },
  { id: "credenciais", label: "Credenciais" },
  { id: "autenticacao-request", label: "Request" },
  { id: "eventos", label: "Eventos" },
  { id: "renderizacao", label: "Renderização" },
  { id: "respostas-http", label: "Respostas" },
  { id: "troubleshooting", label: "Troubleshooting" },
] as const;

export const INTEGRATION_CREDENTIAL_FIELDS = [
  {
    name: "endpointUrl",
    description: "URL final completa da integração. Copie exatamente o valor exibido no painel e envie requisições diretamente para ele.",
  },
  {
    name: "instanceId",
    description: "Identificador da instância autorizada. O valor enviado no body precisa pertencer à mesma credencial autenticada.",
  },
  {
    name: "secretToken",
    description: "Token Bearer emitido ou rotacionado na área de credenciais. Use sempre o token ativo no header Authorization.",
  },
] as const;

export const INTEGRATION_SUPPORTED_EVENTS = [
  "pedido_pendente",
  "pedido_pago",
  "envio_acesso",
  "pagamento_recusado",
  "pedido_cancelado",
  "reembolso",
  "pix_gerado",
  "boleto_gerado",
  "carrinho_abandonado",
  "assinatura_criada",
  "assinatura_renovada",
  "assinatura_cancelada",
  "assinatura_em_atraso",
] as const;

export const INTEGRATION_SUPPORTED_MESSAGE_TYPES = ["text", "link", "image", "document"] as const;

export const INTEGRATION_PAYLOAD_FIELDS = [
  { name: "event", description: "Slug do evento suportado pelo catálogo atual." },
  { name: "instanceId", description: "Identificador da instância autorizada pela credencial ativa." },
  { name: "timestamp", description: "Data/hora ISO-8601 validada na replay window operacional." },
  { name: "dedupKey", description: "Chave idempotente por credencial para evitar reprocessamento." },
  { name: "payload", description: "Objeto com os dados operacionais usados na normalização do destinatário, contexto do evento e render final da mensagem." },
] as const;

export const INTEGRATION_PHONE_FIELD_PRIORITY = [
  "customer.phone",
  "order.phone",
  "order.user.phone",
  "subscription.user.phone",
] as const;

export const INTEGRATION_CONTEXT_FIELDS = [
  { label: "Nome do cliente", paths: ["payload.customer.name", "payload.order.user.name", "payload.subscription.user.name"] },
  { label: "Produto", paths: ["payload.order.product.name", "payload.product.name", "payload.offer.name"] },
  { label: "Link principal", paths: ["payload.access.url", "payload.order.accessUrl", "payload.checkout.url"] },
  { label: "Linha digitável ou boleto", paths: ["payload.boleto.digitableLine", "payload.payment.boletoUrl"] },
  { label: "Pix copia e cola", paths: ["payload.pix.copyPaste", "payload.payment.pixCode"] },
  { label: "Imagem do produto", paths: ["payload.order.product.image", "payload.order.product.cover", "payload.product.image"] },
] as const;

export const INTEGRATION_EVENT_BEHAVIORS = [
  { event: "pedido_pago", summary: "Confirma o pagamento e prioriza envio de acesso ou link principal quando disponível.", messageType: "image ou link", fields: ["customer.name", "order.product.name", "access.url", "order.product.image"] },
  { event: "pix_gerado", summary: "Envia instrução de pagamento Pix com código copia e cola e contexto do produto.", messageType: "image ou text", fields: ["customer.name", "order.product.name", "pix.copyPaste", "order.product.image"] },
  { event: "boleto_gerado", summary: "Envia o boleto como documento quando a URL do arquivo está disponível.", messageType: "document", fields: ["customer.name", "order.product.name", "payment.boletoUrl"] },
  { event: "envio_acesso", summary: "Entrega acesso e reforça o link principal do produto ou da área do aluno.", messageType: "image ou link", fields: ["customer.name", "order.product.name", "access.url", "order.product.image"] },
  { event: "carrinho_abandonado", summary: "Recupera intenção de compra com mensagem curta, produto e link de retomada.", messageType: "image ou link", fields: ["customer.name", "order.product.name", "checkout.url", "order.product.image"] },
] as const;

export const INTEGRATION_RENDER_RULES = [
  "A mensagem é montada pelo backend a partir do evento e do payload normalizado; o sistema externo não envia template livre.",
  "Quando há imagem do produto com URL HTTP/HTTPS válida, o runtime pode enviar mensagem do tipo image com caption.",
  "Se a imagem falhar, o envio faz fallback para corpo textual sem interromper o fluxo do evento.",
  "Eventos com link priorizam o corpo textual com URL final quando não há mídia utilizável.",
  "Boleto continua sendo o caso oficial de envio como document quando a URL do arquivo está disponível.",
] as const;

export const INTEGRATION_RESPONSE_CODES = [
  { status: "202", code: "accepted", meaning: "Evento aceito e dispatch operacional iniciado com sucesso." },
  { status: "400", code: "INTEGRATION_CONTRACT_INVALID", meaning: "Headers ou body fora do contrato esperado." },
  { status: "400", code: "UNSUPPORTED_INTEGRATION_EVENT", meaning: "Slug de evento não suportado pelo catálogo atual." },
  { status: "401", code: "INVALID_INTEGRATION_TOKEN", meaning: "Token Bearer inválido ou inexistente." },
  { status: "403", code: "INACTIVE_INTEGRATION_CREDENTIAL", meaning: "Credencial existe, mas não está ativa." },
  { status: "403", code: "INTEGRATION_INSTANCE_MISMATCH", meaning: "A credencial autenticada não autoriza o instanceId enviado." },
  { status: "409", code: "INTEGRATION_REPLAY_WINDOW_VIOLATION", meaning: "Timestamp fora da janela permitida." },
  { status: "409", code: "DUPLICATE_INTEGRATION_REQUEST", meaning: "dedupKey já usada dentro da janela da credencial." },
  { status: "409", code: "INTEGRATION_DISPATCH_INSTANCE_NOT_FOUND", meaning: "Instância inexistente no NexusZAP." },
  { status: "409", code: "INTEGRATION_DISPATCH_INSTANCE_OFFLINE", meaning: "Instância sem sessão ativa para envio." },
  { status: "409", code: "INTEGRATION_DISPATCH_SEND_FAILED", meaning: "Falha do runtime no sendMessage." },
  { status: "422", code: "INTEGRATION_DISPATCH_RECIPIENT_MISSING", meaning: "Nenhum telefone válido foi normalizado do payload." },
  { status: "422", code: "INTEGRATION_DISPATCH_TEMPLATE_RENDER_ERROR", meaning: "O template do evento não pôde ser renderizado." },
  { status: "500", code: "INTEGRATION_INGRESS_INTERNAL_ERROR", meaning: "Erro interno inesperado no processamento." },
] as const;

export const INTEGRATION_TROUBLESHOOTING = [
  {
    title: "Token inválido",
    steps: [
      "Confirme o header Authorization no formato Bearer <secretToken>.",
      "Verifique se o token ativo não foi rotacionado depois da configuração do sistema externo.",
    ],
  },
  {
    title: "Mismatch de instância",
    steps: [
      "Confirme se o instanceId do body veio da mesma instância usada para emitir a credencial.",
      "Não reutilize secretToken emitido para outra instância.",
    ],
  },
  {
    title: "Replay window violada",
    steps: [
      "Sincronize o relógio do sistema externo em UTC.",
      "A janela operacional atual é 300000 ms com tolerância de 30000 ms para skew futuro.",
    ],
  },
  {
    title: "Destinatário ausente",
    steps: [
      "Envie telefone válido em um dos caminhos aceitos pelo normalizador.",
      "Evite campos vazios, formatos incompletos ou números sem DDI/DDDs aceitos.",
    ],
  },
  {
    title: "Imagem não enviada",
    steps: [
      "Confirme se o payload contém image ou cover com URL HTTP/HTTPS acessível pelo backend.",
      "Se a mídia falhar, o endpoint ainda pode enviar a mensagem em formato textual como fallback.",
    ],
  },
  {
    title: "Instância offline ou falha de dispatch",
    steps: [
      "Verifique se a instância está CONNECTED e com sessão ativa para envio.",
      "Use a área Operação para revisar dispatchStatus e failureCode recentes.",
    ],
  },
] as const;

export const INTEGRATION_REQUEST_EXAMPLE = `{
  "event": "pedido_pago",
  "instanceId": "f9eb8d5c-9d2e-4dbf-9b97-1d2f0a4a7a80",
  "timestamp": "2026-05-30T14:30:00.000Z",
  "dedupKey": "pedido-123-pago-20260530",
  "payload": {
    "customer": {
      "name": "Maria Silva",
      "phone": "5511998765432",
      "email": "maria@example.com"
    },
    "order": {
      "product": {
        "name": "Curso Premium",
        "image": "https://cdn.exemplo.com/produtos/curso-premium.jpg"
      },
      "accessUrl": "https://area.exemplo.com/acesso/abc123"
    }
  }
}`;

export const INTEGRATION_CURL_EXAMPLE = `curl -X POST "$ENDPOINT_URL" \\
  -H "Authorization: Bearer $SECRET_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event": "pedido_pago",
    "instanceId": "f9eb8d5c-9d2e-4dbf-9b97-1d2f0a4a7a80",
    "timestamp": "2026-05-30T14:30:00.000Z",
    "dedupKey": "pedido-123-pago-20260530",
    "payload": {
      "customer": { "name": "Maria Silva", "phone": "5511998765432" },
      "order": {
        "product": {
          "name": "Curso Premium",
          "image": "https://cdn.exemplo.com/produtos/curso-premium.jpg"
        },
        "accessUrl": "https://area.exemplo.com/acesso/abc123"
      }
    }
  }'`;

export const INTEGRATION_SUCCESS_RESPONSE_EXAMPLE = `{
  "success": true,
  "data": {
    "instanceId": "f9eb8d5c-9d2e-4dbf-9b97-1d2f0a4a7a80",
    "event": "pedido_pago",
    "status": "accepted"
  }
}`;
