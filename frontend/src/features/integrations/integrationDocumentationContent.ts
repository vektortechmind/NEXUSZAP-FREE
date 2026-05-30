export const INTEGRATION_DOCUMENTATION_ROUTE = "/integracoes/documentacao";
export const INTEGRATION_ENDPOINT_PATH = "/api/integrations/events";
export const INTEGRATION_ENDPOINT_URL_EXAMPLE = "https://painel.seudominio.com/api/integrations/events";

export const INTEGRATION_DOCUMENTATION_TOPICS = [
  { id: "visao-geral", label: "Visão geral" },
  { id: "credenciais", label: "Credenciais" },
  { id: "autenticacao-request", label: "Autenticação e request" },
  { id: "eventos", label: "Eventos e regras" },
  { id: "respostas-http", label: "Respostas HTTP" },
  { id: "troubleshooting", label: "Troubleshooting" },
] as const;

export const INTEGRATION_CREDENTIAL_FIELDS = [
  {
    name: "endpointUrl",
    description: "URL final completa da integração. Copie exatamente o valor exibido no painel sem concatenar baseUrl manualmente.",
  },
  {
    name: "instanceId",
    description: "Identificador da instância autorizada. O valor é exibido na seção Credenciais quando você seleciona a instância correta.",
  },
  {
    name: "secretToken",
    description: "Token Bearer emitido ou rotacionado na seção Credenciais. Use o token ativo no header Authorization.",
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

export const INTEGRATION_SUPPORTED_MESSAGE_TYPES = ["text", "link", "document"] as const;

export const INTEGRATION_PAYLOAD_FIELDS = [
  { name: "event", description: "Slug do evento suportado pelo catálogo atual." },
  { name: "instanceId", description: "Identificador da instância autorizada pela credencial ativa." },
  { name: "timestamp", description: "Data/hora ISO-8601 validada na replay window operacional." },
  { name: "dedupKey", description: "Chave idempotente por credencial para evitar reprocessamento." },
  { name: "payload", description: "Objeto com os dados operacionais usados na normalização e no template do evento." },
] as const;

export const INTEGRATION_PHONE_FIELD_PRIORITY = [
  "customer.phone",
  "order.phone",
  "order.user.phone",
  "subscription.user.phone",
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
      "Verifique na seção Credenciais se o token ativo não foi rotacionado depois da integração externa.",
    ],
  },
  {
    title: "Mismatch de instância",
    steps: [
      "Confirme se o instanceId do body veio da mesma instância selecionada na seção Credenciais.",
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
    title: "Instância offline ou falha de dispatch",
    steps: [
      "Verifique se a instância está CONNECTED e possui sessão ativa em memória.",
      "Use a área Operação para revisar dispatchStatus e failureCode recentes.",
    ],
  },
] as const;

export const INTEGRATION_REQUEST_EXAMPLE = `{
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
      "product": {
        "name": "Curso Premium"
      }
    }
  }
}`;

export const INTEGRATION_CURL_EXAMPLE = `curl -X POST "$ENDPOINT_URL" \\
  -H "Authorization: Bearer $SECRET_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event": "pedido_pago",
    "instanceId": "f9eb8d5c-9d2e-4dbf-9b97-1d2f0a4a7a80",
    "timestamp": "2026-05-29T14:30:00.000Z",
    "dedupKey": "pedido-123-pago-20260529",
    "payload": {
      "customer": { "name": "Maria Silva", "phone": "(11) 99876-5432" },
      "order": { "product": { "name": "Curso Premium" } }
    }
  }'`;
