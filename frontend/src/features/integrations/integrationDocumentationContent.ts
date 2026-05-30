export const INTEGRATION_DOCUMENTATION_ROUTE = "/integracoes/documentacao";
export const INTEGRATION_ENDPOINT_PATH = "/api/integrations/events";
export const INTEGRATION_ENDPOINT_URL_EXAMPLE = "https://painel.seudominio.com/api/integrations/events";

export const INTEGRATION_DOCUMENTATION_TOPICS = [
  { id: "visao-geral", label: "Visão geral" },
  { id: "credenciais", label: "Credenciais" },
  { id: "autenticacao-request", label: "Request" },
  { id: "eventos", label: "Eventos" },
  { id: "renderizacao", label: "Templates" },
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
  { name: "timestamp", description: "Timestamp aceito em formato ISO-8601 textual ou epoch numérico. A chamada entra na replay window operacional." },
  { name: "dedupKey", description: "Chave idempotente obrigatória por credencial. O valor é trimado pelo backend e aceita até 180 caracteres." },
  { name: "payload", description: "Objeto com os dados operacionais usados na normalização do destinatário, contexto do evento e render final da mensagem." },
] as const;

export const INTEGRATION_PHONE_FIELD_PRIORITY = [
  "customer.phone",
  "order.phone",
  "order.user.phone",
  "subscription.user.phone",
  "checkout_session.phone",
] as const;

export const INTEGRATION_CONTEXT_FIELDS = [
  {
    label: "Nome do cliente",
    paths: ["payload.customer.name", "payload.order.user.name", "payload.subscription.user.name", "payload.checkout_session.name"],
  },
  {
    label: "Telefone do destinatário",
    paths: ["payload.customer.phone", "payload.order.phone", "payload.order.user.phone", "payload.subscription.user.phone", "payload.checkout_session.phone"],
  },
  {
    label: "Produto",
    paths: ["payload.order.product.name", "payload.checkout_session.product.name", "payload.subscription.product.name"],
  },
  {
    label: "Oferta ou plano",
    paths: ["payload.order.product_offer.name", "payload.order.productOffer.name", "payload.order.subscription_plan.name", "payload.subscription.subscription_plan.name"],
  },
  {
    label: "Imagem do produto",
    paths: [
      "payload.order.product.thumbnail_url",
      "payload.order.product.thumbnailUrl",
      "payload.order.product.image",
      "payload.order.product.cover",
      "payload.checkout_session.product.thumbnail_url",
      "payload.subscription.product.image",
    ],
  },
  {
    label: "Link de checkout ou retomada",
    paths: ["payload.checkout_link", "payload.checkoutLink"],
  },
  {
    label: "Acesso do aluno",
    paths: ["payload.access.url", "payload.access.login", "payload.access.email", "payload.access.password", "payload.access.instructions"],
  },
  {
    label: "Pix copia e cola",
    paths: ["payload.pix.copy_paste", "payload.pix.copyPaste"],
  },
  {
    label: "Boleto",
    paths: ["payload.boleto.amount", "payload.boleto.expire_at", "payload.boleto.barcode", "payload.boleto.pdf_url", "payload.boleto.pdfUrl"],
  },
] as const;

export const INTEGRATION_TEMPLATE_FLOW = [
  "O sistema externo envia apenas o evento, a autenticação e o payload operacional. Não existe envio de template livre no request.",
  "O backend normaliza telefone, cliente, produto, links, Pix, boleto e acesso antes de escolher a mensagem padrão do evento.",
  "Cada evento já possui um template predefinido com tipo final de saída, texto base, caption e, quando aplicável, CTA com externalAdReply.",
  "A resposta HTTP 202 significa que o evento foi aceito para dispatch. O envio para o WhatsApp continua no runtime da instância conectada.",
] as const;

export const INTEGRATION_EVENT_TEMPLATE_MATRIX = [
  {
    event: "pedido_pago",
    messageType: "image",
    requiredFields: ["customer.phone", "customer.name ou order.user.name", "order.product.name ou equivalente"],
    optionalFields: ["checkout_link ou checkoutLink", "order.product.image ou cover"],
    generatedMessage: "Confirmação de pagamento com produto aprovado e CTA de acesso.",
    fallback: "Sem imagem válida, o runtime envia texto com o mesmo corpo. O CTA só aparece se houver checkoutLink.",
  },
  {
    event: "pedido_pendente",
    messageType: "text",
    requiredFields: ["customer.phone", "customer.name ou order.user.name", "order.product.name ou equivalente"],
    optionalFields: [],
    generatedMessage: "Aviso de pedido recebido e aguardando confirmação.",
    fallback: "Não depende de mídia.",
  },
  {
    event: "pagamento_recusado",
    messageType: "text",
    requiredFields: ["customer.phone", "customer.name ou order.user.name", "order.product.name ou equivalente"],
    optionalFields: ["checkout_link ou checkoutLink"],
    generatedMessage: "Mensagem de recusa com orientação para nova tentativa.",
    fallback: "Sem checkoutLink, o texto continua sendo enviado, mas sem URL de retomada.",
  },
  {
    event: "pedido_cancelado",
    messageType: "text",
    requiredFields: ["customer.phone", "customer.name ou order.user.name", "order.product.name ou equivalente"],
    optionalFields: [],
    generatedMessage: "Confirmação de cancelamento do pedido.",
    fallback: "Não depende de mídia.",
  },
  {
    event: "reembolso",
    messageType: "text",
    requiredFields: ["customer.phone", "customer.name ou order.user.name", "order.product.name ou equivalente"],
    optionalFields: [],
    generatedMessage: "Confirmação de reembolso processado.",
    fallback: "Não depende de mídia.",
  },
  {
    event: "pix_gerado",
    messageType: "image",
    requiredFields: ["customer.phone", "customer.name ou order.user.name", "order.product.name ou equivalente"],
    optionalFields: ["pix.copy_paste ou pix.copyPaste", "order.total ou amount equivalente", "checkout_link ou checkoutLink", "order.product.image ou cover"],
    generatedMessage: "Instrução de pagamento Pix com valor e código copia e cola quando presentes.",
    fallback: "Sem imagem válida, o runtime envia texto. Sem Pix copia e cola, a mensagem sai sem esse bloco.",
  },
  {
    event: "boleto_gerado",
    messageType: "document",
    requiredFields: ["customer.phone", "customer.name ou order.user.name", "order.product.name ou equivalente", "boleto.pdf_url ou boleto.pdfUrl"],
    optionalFields: ["boleto.amount", "boleto.expire_at ou expireAt", "boleto.barcode"],
    generatedMessage: "Envio do boleto em PDF com caption contendo valor, vencimento e linha digitável quando disponíveis.",
    fallback: "Sem URL válida do PDF, o template falha com erro 422 e o dispatch não é enviado.",
  },
  {
    event: "carrinho_abandonado",
    messageType: "image",
    requiredFields: ["customer.phone", "customer.name ou order.user.name", "order.product.name ou equivalente"],
    optionalFields: ["checkout_link ou checkoutLink", "order.product.image ou cover"],
    generatedMessage: "Recuperação de carrinho com CTA para finalizar a compra.",
    fallback: "Sem imagem válida, o runtime envia texto. Sem checkoutLink, o CTA de retomada não aparece.",
  },
  {
    event: "envio_acesso",
    messageType: "image",
    requiredFields: ["customer.phone", "customer.name ou order.user.name", "order.product.name ou equivalente"],
    optionalFields: ["access.url", "access.login", "access.email", "access.password", "access.instructions", "checkout_link ou checkoutLink", "order.product.image ou cover"],
    generatedMessage: "Aviso de acesso liberado com CTA principal apontando para checkoutLink quando informado.",
    fallback: "Sem imagem válida, o runtime envia texto. O objeto access é normalizado, mas o template atual não injeta todos os campos no corpo.",
  },
  {
    event: "assinatura_criada",
    messageType: "image",
    requiredFields: ["customer.phone", "customer.name ou subscription.user.name", "subscription.product.name ou equivalente"],
    optionalFields: ["checkout_link ou checkoutLink", "subscription.product.image"],
    generatedMessage: "Boas-vindas para assinatura criada.",
    fallback: "Sem imagem válida, o runtime envia texto.",
  },
  {
    event: "assinatura_renovada",
    messageType: "text",
    requiredFields: ["customer.phone", "customer.name ou subscription.user.name", "subscription.product.name ou equivalente"],
    optionalFields: [],
    generatedMessage: "Confirmação de renovação da assinatura.",
    fallback: "Não depende de mídia.",
  },
  {
    event: "assinatura_cancelada",
    messageType: "text",
    requiredFields: ["customer.phone", "customer.name ou subscription.user.name", "subscription.product.name ou equivalente"],
    optionalFields: [],
    generatedMessage: "Confirmação de cancelamento da assinatura.",
    fallback: "Não depende de mídia.",
  },
  {
    event: "assinatura_em_atraso",
    messageType: "image",
    requiredFields: ["customer.phone", "customer.name ou subscription.user.name", "subscription.product.name ou equivalente"],
    optionalFields: ["checkout_link ou checkoutLink", "subscription.product.image"],
    generatedMessage: "Lembrete de atraso com CTA para regularização.",
    fallback: "Sem imagem válida, o runtime envia texto.",
  },
] as const;

export const INTEGRATION_RENDER_RULES = [
  "O backend define a mensagem a partir do event e do payload normalizado; a ferramenta externa não escolhe corpo, caption nem tipo final manualmente.",
  "Eventos mapeados como image fazem download da imagem no runtime quando imageUrl for HTTP/HTTPS válida e acessível pelo backend.",
  "Quando a imagem estiver ausente, inválida ou falhar no download, o runtime troca o envio para texto sem interromper o dispatch.",
  "Eventos com checkoutLink podem anexar CTA via externalAdReply, mas o texto principal continua sendo renderizado pelo backend.",
  "Boleto é o caso oficial de document e exige URL válida em boleto.pdf_url ou boleto.pdfUrl.",
] as const;

export const INTEGRATION_IMAGE_RESOLUTION_RULES = [
  "A imagem pode vir como URL absoluta em thumbnail_url, thumbnailUrl, image ou cover do produto.",
  "Quando image ou cover forem caminhos relativos de storage, o backend tenta montar a URL pública a partir de uma base HTTP/HTTPS inferida do payload.",
  "O arquivo de imagem é baixado apenas no momento do dispatch para compor a mensagem e não faz parte do contrato persistido do request.",
] as const;

export const INTEGRATION_RESPONSE_CODES = [
  { status: "202", code: "accepted", meaning: "Evento aceito e dispatch operacional iniciado com sucesso." },
  { status: "400", code: "INTEGRATION_CONTRACT_INVALID", meaning: "Headers ou body fora do contrato esperado." },
  { status: "400", code: "UNSUPPORTED_INTEGRATION_EVENT", meaning: "Slug de evento não suportado pelo catálogo atual." },
  { status: "401", code: "INVALID_INTEGRATION_TOKEN", meaning: "Token Bearer inválido ou inexistente." },
  { status: "403", code: "INACTIVE_INTEGRATION_CREDENTIAL", meaning: "Credencial existe, mas não está ativa." },
  { status: "403", code: "INTEGRATION_INSTANCE_MISMATCH", meaning: "A credencial autenticada não autoriza o instanceId enviado." },
  { status: "409", code: "INTEGRATION_REPLAY_WINDOW_VIOLATION", meaning: "Timestamp fora da janela permitida ou acima do skew futuro tolerado." },
  { status: "409", code: "DUPLICATE_INTEGRATION_REQUEST", meaning: "dedupKey já usada dentro da janela da credencial." },
  { status: "409", code: "INTEGRATION_DISPATCH_INSTANCE_NOT_FOUND", meaning: "Instância inexistente no NexusZAP." },
  { status: "409", code: "INTEGRATION_DISPATCH_INSTANCE_OFFLINE", meaning: "Instância sem sessão ativa para envio." },
  { status: "409", code: "INTEGRATION_DISPATCH_SEND_FAILED", meaning: "Falha do runtime no sendMessage após o evento já ter sido aceito." },
  { status: "422", code: "INTEGRATION_DISPATCH_RECIPIENT_MISSING", meaning: "Nenhum telefone válido foi normalizado do payload." },
  { status: "422", code: "INTEGRATION_TEMPLATE_REQUIRED_URL_MISSING", meaning: "O template exigia URL obrigatória, como boleto.pdf_url, e ela não foi fornecida." },
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
    title: "Replay window ou deduplicação",
    steps: [
      "Sincronize o relógio do sistema externo em UTC. A janela padrão é 300000 ms com tolerância futura de 30000 ms.",
      "Garanta dedupKey única por evento. O backend recusa chave vazia, repetida ou maior que 180 caracteres.",
    ],
  },
  {
    title: "Destinatário ausente",
    steps: [
      "Envie telefone válido em um dos caminhos aceitos pelo normalizador.",
      "O backend converte telefones nacionais de 10 ou 11 dígitos para o formato com prefixo 55. Valores fora desse padrão são descartados.",
    ],
  },
  {
    title: "Imagem não enviada",
    steps: [
      "Confirme se a imagem do produto resolve para URL HTTP/HTTPS acessível pelo backend.",
      "Se a mídia falhar, o endpoint ainda pode concluir o dispatch em formato textual para eventos do tipo image.",
    ],
  },
  {
    title: "Boleto rejeitado",
    steps: [
      "Para boleto_gerado, envie boleto.pdf_url ou boleto.pdfUrl com URL pública válida do PDF.",
      "Sem essa URL, o template falha com erro 422 antes do envio ao WhatsApp.",
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
    "checkoutLink": "https://checkout.exemplo.com/pedido/abc123",
    "order": {
      "product": {
        "name": "Curso Premium",
        "image": "https://cdn.exemplo.com/produtos/curso-premium.jpg"
      },
      "total": "297.00"
    }
  }
}`;

export const INTEGRATION_CURL_EXAMPLE = `curl -X POST "$ENDPOINT_URL" \
  -H "Authorization: Bearer $SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "pedido_pago",
    "instanceId": "f9eb8d5c-9d2e-4dbf-9b97-1d2f0a4a7a80",
    "timestamp": "2026-05-30T14:30:00.000Z",
    "dedupKey": "pedido-123-pago-20260530",
    "payload": {
      "customer": { "name": "Maria Silva", "phone": "5511998765432" },
      "checkoutLink": "https://checkout.exemplo.com/pedido/abc123",
      "order": {
        "product": {
          "name": "Curso Premium",
          "image": "https://cdn.exemplo.com/produtos/curso-premium.jpg"
        },
        "total": "297.00"
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
