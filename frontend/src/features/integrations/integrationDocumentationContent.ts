export const INTEGRATION_DOCUMENTATION_ROUTE = "/integracoes/documentacao";
export const INTEGRATION_ENDPOINT_PATH = "/api/integrations/events";
export const INTEGRATION_ENDPOINT_URL_EXAMPLE = "https://painel.seudominio.com/api/integrations/events";

export const INTEGRATION_DOCUMENTATION_TOPICS = [
  { id: "visao-geral", label: "Visão geral" },
  { id: "credenciais", label: "Credenciais" },
  { id: "autenticacao-request", label: "Request" },
  { id: "eventos", label: "Eventos" },
  { id: "payloads-minimos", label: "Payloads" },
  { id: "renderizacao", label: "Templates" },
  { id: "texto-customizado", label: "Texto" },
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
  "Cada evento já possui um template predefinido com tipo final de saída, texto base, caption e, quando aplicável, links textuais ou enriquecimento contextual.",
  "A resposta HTTP 202 significa que o evento foi aceito para processamento e que o runtime tentou submeter a mensagem ao provider. Isso não é recibo de entrega, leitura ou confirmação do aparelho final.",
] as const;

export const INTEGRATION_EVENT_TEMPLATE_MATRIX = [
  {
    event: "pedido_pago",
    messageType: "text",
    requiredFields: ["customer.phone", "customer.name ou order.user.name", "order.product.name ou equivalente"],
    optionalFields: ["checkout_link ou checkoutLink", "order.product.image ou cover"],
    generatedMessage: "Confirmação de pagamento em texto com link visível no corpo da mensagem quando checkoutLink existir.",
    fallback: "Sem checkoutLink, o texto continua sendo enviado sem link complementar.",
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
    generatedMessage: "Primeira mensagem com instrução de pagamento Pix, valor e a chamada 'Codigo Pix copia e cola' no fechamento; quando houver pix.copy_paste, o runtime envia uma segunda mensagem textual contendo apenas o código bruto.",
    fallback: "Sem imagem válida, a primeira mensagem degrada para texto. Sem Pix copia e cola, o segundo envio é pulado e a primeira mensagem segue normalmente.",
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
    generatedMessage: "Recuperação de carrinho com link de retomada visível no corpo/caption quando checkoutLink existir.",
    fallback: "Sem imagem válida, o runtime envia texto preservando o link visível quando informado. Sem checkoutLink, a mensagem segue sem URL de retomada.",
  },
  {
    event: "envio_acesso",
    messageType: "image",
    requiredFields: ["customer.phone", "customer.name ou order.user.name", "order.product.name ou equivalente"],
    optionalFields: ["access.url", "access.login", "access.email", "access.password", "access.instructions", "checkout_link ou checkoutLink", "order.product.image ou cover"],
    generatedMessage: "Aviso de acesso liberado com dados do aluno no corpo e links textuais separados para acesso principal e link complementar quando disponíveis.",
    fallback: "Sem imagem válida, o runtime envia texto mantendo os dados normalizados de acesso e os links visíveis no corpo.",
  },
  {
    event: "assinatura_criada",
    messageType: "image",
    requiredFields: ["customer.phone", "customer.name ou subscription.user.name", "subscription.product.name ou equivalente"],
    optionalFields: ["checkout_link ou checkoutLink", "subscription.product.image"],
    generatedMessage: "Boas-vindas para assinatura criada com link de acesso visível no corpo/caption quando checkoutLink existir.",
    fallback: "Sem imagem válida, o runtime envia texto preservando o link visível quando informado. Sem checkoutLink, a mensagem segue sem URL de acesso.",
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
    generatedMessage: "Lembrete de atraso com link de regularização visível no corpo/caption quando checkoutLink existir.",
    fallback: "Sem imagem válida, o runtime envia texto preservando o link visível quando informado. Sem checkoutLink, a mensagem segue sem URL de regularização.",
  },
] as const;

export const INTEGRATION_RENDER_RULES = [
  "O backend define a mensagem a partir do event e do payload normalizado. A ferramenta externa pode enviar texto visível final em payload.message.body, mas não escolhe tipo final, mídia, provider ou payload técnico do WhatsApp.",
  "Eventos mapeados como image fazem download da imagem no runtime quando imageUrl for HTTP/HTTPS válida e acessível pelo backend.",
  "Quando a imagem estiver ausente, inválida ou falhar no download, o runtime troca o envio para texto sem interromper o dispatch e registra deliveryPath text_fallback_image.",
  "O status técnico SENT nos logs de dispatch significa que o sendMessage retornou e o provider aceitou a tentativa operacional; não significa entrega confirmada no WhatsApp.",
  "No evento pix_gerado, a primeira mensagem fecha com a chamada 'Codigo Pix copia e cola' e, quando pix.copy_paste ou pix.copyPaste estiver disponível, o runtime envia uma segunda mensagem textual contendo apenas o código bruto.",
  "pedido_pago usa texto com link visível no corpo como caminho oficial e confiável.",
  "carrinho_abandonado, assinatura_criada e assinatura_em_atraso mantêm messageType image, mas exibem checkoutLink no corpo/caption quando a URL é informada.",
  "Quando houver URL aplicável, o runtime mantém o link visível no corpo, caption ou fallback textual da mensagem.",
  "A telemetria do dispatch registra secondaryDispatchStatus para indicar se a segunda mensagem do Pix foi enviada, pulada por ausência do código ou falhou isoladamente.",
  "externalAdReply continua restrito aos fluxos text, document e aos fallbacks textuais dos eventos ricos; ele não é usado no caminho de imagem limpa nem substitui botão real.",
  "Boleto é o caso oficial de document e exige URL válida em boleto.pdf_url ou boleto.pdfUrl.",
] as const;

export const INTEGRATION_CUSTOM_MESSAGE_RULES = [
  "payload.message é opcional. Se ele não for enviado, o NexusZAP usa o template padrão do evento.",
  "payload.message.body e payload.message.pix_followup_body, quando enviados, devem ser strings não vazias com até 4000 caracteres cada. Esse limite vale só para o texto customizado visível, não para o payload inteiro.",
  "O backend não processa placeholders como {{nome}}; envie o texto final já renderizado pela ferramenta externa.",
  "Em eventos image, payload.message.body substitui o corpo visível e também vira a caption da imagem. Se a imagem falhar, o mesmo texto segue no fallback textual.",
  "Em boleto_gerado, o texto customizado substitui o body/caption visível, mas não altera document.url, fileName ou mimetype do PDF.",
  "payload.message.pix_followup_body só é aceito em pix_gerado e personaliza apenas a segunda mensagem textual do Pix copia e cola.",
  "Campos técnicos dentro de payload.message são rejeitados. Não envie caption, messageType, providerPayload, relayMessage, buttons, templateMessage ou interactiveMessage.",
  "O conteúdo customizado não é salvo nos summaries de auditoria; o painel registra apenas flags e tamanhos, como customBodyUsed e customBodyLength.",
] as const;

export const INTEGRATION_CUSTOM_MESSAGE_EXAMPLE = `{
  "event": "pedido_pago",
  "instanceId": "$INSTANCE_ID",
  "timestamp": "2026-05-30T14:30:00.000Z",
  "dedupKey": "pedido-123-pago-20260530",
  "payload": {
    "customer": { "name": "Maria Silva", "phone": "+5511998765432" },
    "checkoutLink": "https://checkout.exemplo.com/pedido/abc123",
    "order": {
      "product": { "name": "Curso Premium" },
      "total": "297.00"
    },
    "message": {
      "body": "Olá Maria, seu pagamento foi aprovado. Acesse seu produto em https://checkout.exemplo.com/pedido/abc123"
    }
  }
}`;

export const INTEGRATION_CUSTOM_PIX_FOLLOWUP_EXAMPLE = `{
  "event": "pix_gerado",
  "instanceId": "$INSTANCE_ID",
  "timestamp": "2026-05-30T14:35:00.000Z",
  "dedupKey": "pix-456-gerado-20260530",
  "payload": {
    "customer": { "name": "João Lima", "phone": "+5511987654321" },
    "order": {
      "product": { "name": "Curso Premium" },
      "total": "199.90"
    },
    "pix": {
      "copy_paste": "00020126580014BR.GOV.BCB.PIX0136pix-456-chave-dinamica"
    },
    "message": {
      "body": "João, seu Pix foi gerado. Pague até o vencimento para garantir o acesso.",
      "pix_followup_body": "Pix copia e cola:\n00020126580014BR.GOV.BCB.PIX0136pix-456-chave-dinamica"
    }
  }
}`;

export const INTEGRATION_MINIMAL_PAYLOAD_EXAMPLES = [
  {
    event: "pedido_pendente",
    description: "Pedido criado ou aguardando confirmação de pagamento.",
    code: `{
  "event": "pedido_pendente",
  "instanceId": "$INSTANCE_ID",
  "timestamp": "2026-05-30T14:00:00.000Z",
  "dedupKey": "pedido-100-pendente-20260530",
  "payload": {
    "customer": { "name": "Maria Silva", "phone": "+5511998765432" },
    "order": {
      "total": "297.00",
      "product": { "name": "Curso Premium" }
    }
  }
}`,
  },
  {
    event: "pedido_pago",
    description: "Pagamento aprovado; use checkoutLink quando quiser mostrar link de acesso/checkout no corpo.",
    code: `{
  "event": "pedido_pago",
  "instanceId": "$INSTANCE_ID",
  "timestamp": "2026-05-30T14:10:00.000Z",
  "dedupKey": "pedido-100-pago-20260530",
  "payload": {
    "customer": { "name": "Maria Silva", "phone": "+5511998765432" },
    "checkoutLink": "https://checkout.exemplo.com/pedido/100",
    "order": {
      "total": "297.00",
      "product": { "name": "Curso Premium" }
    }
  }
}`,
  },
  {
    event: "envio_acesso",
    description: "Acesso liberado; access pode trazer URL, login, senha ou instruções visíveis.",
    code: `{
  "event": "envio_acesso",
  "instanceId": "$INSTANCE_ID",
  "timestamp": "2026-05-30T14:20:00.000Z",
  "dedupKey": "acesso-100-enviado-20260530",
  "payload": {
    "customer": { "name": "Maria Silva", "phone": "+5511998765432" },
    "order": { "product": { "name": "Curso Premium" } },
    "access": {
      "url": "https://portal.exemplo.com/aluno/100",
      "login": "maria@example.com",
      "password": "senha-temporaria"
    }
  }
}`,
  },
  {
    event: "pagamento_recusado",
    description: "Pagamento recusado; checkoutLink permite orientar nova tentativa.",
    code: `{
  "event": "pagamento_recusado",
  "instanceId": "$INSTANCE_ID",
  "timestamp": "2026-05-30T14:30:00.000Z",
  "dedupKey": "pedido-100-recusado-20260530",
  "payload": {
    "customer": { "name": "Maria Silva", "phone": "+5511998765432" },
    "checkoutLink": "https://checkout.exemplo.com/pedido/100/tentar-novamente",
    "order": { "product": { "name": "Curso Premium" } }
  }
}`,
  },
  {
    event: "pedido_cancelado",
    description: "Pedido cancelado; payload mínimo usa cliente e produto.",
    code: `{
  "event": "pedido_cancelado",
  "instanceId": "$INSTANCE_ID",
  "timestamp": "2026-05-30T14:40:00.000Z",
  "dedupKey": "pedido-100-cancelado-20260530",
  "payload": {
    "customer": { "name": "Maria Silva", "phone": "+5511998765432" },
    "order": { "product": { "name": "Curso Premium" } }
  }
}`,
  },
  {
    event: "reembolso",
    description: "Reembolso processado; payload mínimo usa cliente e produto.",
    code: `{
  "event": "reembolso",
  "instanceId": "$INSTANCE_ID",
  "timestamp": "2026-05-30T14:50:00.000Z",
  "dedupKey": "pedido-100-reembolso-20260530",
  "payload": {
    "customer": { "name": "Maria Silva", "phone": "+5511998765432" },
    "order": { "product": { "name": "Curso Premium" } }
  }
}`,
  },
  {
    event: "pix_gerado",
    description: "Pix gerado; copy_paste habilita a segunda mensagem com código copia e cola.",
    code: `{
  "event": "pix_gerado",
  "instanceId": "$INSTANCE_ID",
  "timestamp": "2026-05-30T15:00:00.000Z",
  "dedupKey": "pix-100-gerado-20260530",
  "payload": {
    "customer": { "name": "Maria Silva", "phone": "+5511998765432" },
    "order": {
      "total": "297.00",
      "product": { "name": "Curso Premium" }
    },
    "pix": {
      "copy_paste": "00020126580014BR.GOV.BCB.PIX0136pix-100-chave-dinamica"
    }
  }
}`,
  },
  {
    event: "boleto_gerado",
    description: "Boleto gerado; boleto.pdf_url ou boleto.pdfUrl é obrigatório para enviar o documento.",
    code: `{
  "event": "boleto_gerado",
  "instanceId": "$INSTANCE_ID",
  "timestamp": "2026-05-30T15:10:00.000Z",
  "dedupKey": "boleto-100-gerado-20260530",
  "payload": {
    "customer": { "name": "Maria Silva", "phone": "+5511998765432" },
    "order": { "product": { "name": "Curso Premium" } },
    "boleto": {
      "pdf_url": "https://cdn.exemplo.com/boletos/boleto-100.pdf",
      "amount": "297.00",
      "expire_at": "2026-06-05",
      "barcode": "23793381286008200009301000012304570660000029700"
    }
  }
}`,
  },
  {
    event: "carrinho_abandonado",
    description: "Carrinho abandonado; checkout_session.product é a origem principal do produto neste fluxo.",
    code: `{
  "event": "carrinho_abandonado",
  "instanceId": "$INSTANCE_ID",
  "timestamp": "2026-05-30T15:20:00.000Z",
  "dedupKey": "carrinho-100-abandonado-20260530",
  "payload": {
    "customer": { "name": "Maria Silva", "phone": "+5511998765432" },
    "checkoutLink": "https://checkout.exemplo.com/retomar/100",
    "checkout_session": {
      "product": { "name": "Curso Premium" }
    }
  }
}`,
  },
  {
    event: "assinatura_criada",
    description: "Assinatura criada; subscription.product é a origem principal do produto/plano.",
    code: `{
  "event": "assinatura_criada",
  "instanceId": "$INSTANCE_ID",
  "timestamp": "2026-05-30T15:30:00.000Z",
  "dedupKey": "assinatura-100-criada-20260530",
  "payload": {
    "customer": { "name": "Maria Silva", "phone": "+5511998765432" },
    "checkoutLink": "https://checkout.exemplo.com/assinaturas/100",
    "subscription": {
      "status": "active",
      "next_billing": "2026-06-30",
      "product": { "name": "Plano Premium" }
    }
  }
}`,
  },
  {
    event: "assinatura_renovada",
    description: "Assinatura renovada; payload mínimo usa cliente e subscription.product.",
    code: `{
  "event": "assinatura_renovada",
  "instanceId": "$INSTANCE_ID",
  "timestamp": "2026-05-30T15:40:00.000Z",
  "dedupKey": "assinatura-100-renovada-20260530",
  "payload": {
    "customer": { "name": "Maria Silva", "phone": "+5511998765432" },
    "subscription": {
      "status": "active",
      "next_billing": "2026-07-30",
      "product": { "name": "Plano Premium" }
    }
  }
}`,
  },
  {
    event: "assinatura_cancelada",
    description: "Assinatura cancelada; payload mínimo usa cliente e subscription.product.",
    code: `{
  "event": "assinatura_cancelada",
  "instanceId": "$INSTANCE_ID",
  "timestamp": "2026-05-30T15:50:00.000Z",
  "dedupKey": "assinatura-100-cancelada-20260530",
  "payload": {
    "customer": { "name": "Maria Silva", "phone": "+5511998765432" },
    "subscription": {
      "status": "canceled",
      "product": { "name": "Plano Premium" }
    }
  }
}`,
  },
  {
    event: "assinatura_em_atraso",
    description: "Assinatura em atraso; checkoutLink pode apontar para regularização.",
    code: `{
  "event": "assinatura_em_atraso",
  "instanceId": "$INSTANCE_ID",
  "timestamp": "2026-05-30T16:00:00.000Z",
  "dedupKey": "assinatura-100-atraso-20260530",
  "payload": {
    "customer": { "name": "Maria Silva", "phone": "+5511998765432" },
    "checkoutLink": "https://checkout.exemplo.com/assinaturas/100/regularizar",
    "subscription": {
      "status": "past_due",
      "next_billing": "2026-05-30",
      "product": { "name": "Plano Premium" }
    }
  }
}`,
  },
] as const;

export const INTEGRATION_IMAGE_RESOLUTION_RULES = [
  "A imagem pode vir como URL absoluta em thumbnail_url, thumbnailUrl, image ou cover do produto.",
  "Quando image ou cover forem caminhos relativos de storage, o backend tenta montar a URL pública a partir de uma base HTTP/HTTPS inferida do payload.",
  "O arquivo de imagem é baixado apenas no momento do dispatch para compor a mensagem e não faz parte do contrato persistido do request.",
] as const;

export const INTEGRATION_OPERATION_LIMITS = [
  "Rate limit atual: 120 requisições por minuto por IP.",
  "Replay window padrão: 300000 ms com tolerância futura de 30000 ms.",
  "dedupKey é obrigatória por credencial e aceita até 180 caracteres.",
  "Para payload JSON, mantenha o corpo compacto e evite enviar blobs inline grandes; prefira URLs públicas para PDFs e imagens.",
] as const;

export const INTEGRATION_RESPONSE_CODES = [
  { status: "202", code: "accepted", meaning: "Evento aceito e tentativa de dispatch submetida ao runtime/provider; não confirma entrega final no WhatsApp." },
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
  { status: "422", code: "INTEGRATION_CUSTOM_MESSAGE_INVALID", meaning: "payload.message trouxe texto inválido, vazio, longo demais, pix_followup_body fora de pix_gerado ou campo técnico não permitido." },
  { status: "500", code: "INTEGRATION_INGRESS_INTERNAL_ERROR", meaning: "Erro interno inesperado no processamento." },
] as const;

export const INTEGRATION_RESPONSE_FIELDS = [
  { name: "ingressId", description: "UUID do log de ingresso persistido no recebimento do evento." },
  { name: "dispatchId", description: "UUID do log operacional do dispatch gerado para a tentativa de envio." },
  { name: "providerMessageId", description: "Identificador devolvido pelo provider quando o sendMessage retorna com sucesso operacional. Não é recibo de entrega, leitura ou confirmação do aparelho final." },
  { name: "status", description: "Hoje o valor esperado na aceitação é accepted." },
  { name: "instanceId", description: "Instância efetivamente autorizada e usada no processamento do evento." },
  { name: "event", description: "Slug do evento aceito e normalizado pelo catálogo público atual." },
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
      "Envie telefone válido em um dos caminhos aceitos pelo normalizador, preferencialmente em E.164 com DDI, como +14155552671 ou +5511998765432.",
      "O backend aceita números internacionais com DDI explícito e mantém compatibilidade com telefones brasileiros locais de 10 ou 11 dígitos, adicionando o prefixo 55 nesses casos legados.",
      "Valores com letras, ramais, zero inicial internacional, comprimento inválido ou sem DDI claro fora da exceção BR legada são descartados.",
    ],
  },
  {
    title: "Imagem não enviada",
    steps: [
      "Confirme se a imagem do produto resolve para URL HTTP/HTTPS acessível pelo backend.",
      "Se a mídia falhar, o endpoint ainda pode concluir o dispatch em formato textual para eventos do tipo image e registrar deliveryPath text_fallback_image.",
    ],
  },
  {
    title: "Segunda mensagem do Pix não saiu",
    steps: [
      "Confirme se payload.pix.copy_paste ou payload.pix.copyPaste foi enviado com valor textual válido.",
      "Revise a auditoria do dispatch para secondaryDispatchStatus: sent, skipped_missing_pix_code ou failed_send.",
    ],
  },
  {
    title: "CTA real indisponível",
    steps: [
      "No evento pedido_pago, o comportamento oficial é mensagem textual com link visível no corpo quando checkoutLink existir.",
      "Nos eventos carrinho_abandonado, assinatura_criada e assinatura_em_atraso, o checkoutLink aparece no corpo/caption quando informado.",
      "Sem checkoutLink, a mensagem continua sendo enviada sem link complementar.",
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
    title: "Texto customizado rejeitado",
    steps: [
      "Use apenas payload.message.body e, no evento pix_gerado, payload.message.pix_followup_body.",
      "Garanta que os valores sejam strings não vazias com até 4000 caracteres cada; esse limite vale apenas para cada texto customizado.",
      "Não envie campos técnicos em payload.message, como caption, messageType, providerPayload, buttons ou relayMessage.",
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
      "phone": "+5511998765432",
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

export const INTEGRATION_CURL_EXAMPLE = `curl -X POST "$ENDPOINT_URL" \\
  -H "Authorization: Bearer $SECRET_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event": "pedido_pago",
    "instanceId": "f9eb8d5c-9d2e-4dbf-9b97-1d2f0a4a7a80",
    "timestamp": "2026-05-30T14:30:00.000Z",
    "dedupKey": "pedido-123-pago-20260530",
    "payload": {
      "customer": { "name": "Maria Silva", "phone": "+5511998765432" },
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

export const INTEGRATION_CURL_EVENT_EXAMPLES = [
  {
    title: "pedido_pago",
    description: "Pagamento aprovado com texto e link visível no corpo.",
    code: `curl -X POST "$ENDPOINT_URL" \\
  -H "Authorization: Bearer $SECRET_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event": "pedido_pago",
    "instanceId": "$INSTANCE_ID",
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
  }'`,
  },
  {
    title: "pix_gerado",
    description: "Pagamento Pix com primeira mensagem principal e segunda mensagem dedicada ao código copia e cola quando disponível.",
    code: `curl -X POST "$ENDPOINT_URL" \\
  -H "Authorization: Bearer $SECRET_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event": "pix_gerado",
    "instanceId": "$INSTANCE_ID",
    "timestamp": "2026-05-30T14:35:00.000Z",
    "dedupKey": "pix-456-gerado-20260530",
    "payload": {
      "customer": { "name": "João Lima", "phone": "5511987654321" },
      "checkoutLink": "https://checkout.exemplo.com/pedido/pix-456",
      "order": {
        "product": {
          "name": "Curso Premium",
          "image": "https://cdn.exemplo.com/produtos/curso-premium.jpg"
        },
        "total": "199.90"
      },
      "pix": {
        "copy_paste": "00020126580014BR.GOV.BCB.PIX0136pix-456-chave-dinamica"
      }
    }
  }'`,
  },
  {
    title: "boleto_gerado",
    description: "Boleto com PDF obrigatório, valor, vencimento e linha digitável.",
    code: `curl -X POST "$ENDPOINT_URL" \\
  -H "Authorization: Bearer $SECRET_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event": "boleto_gerado",
    "instanceId": "$INSTANCE_ID",
    "timestamp": "2026-05-30T15:00:00.000Z",
    "dedupKey": "boleto-789-gerado-20260530",
    "payload": {
      "customer": { "name": "Ana Costa", "phone": "5511999998888" },
      "order": {
        "product": { "name": "Mentoria VIP" }
      },
      "boleto": {
        "amount": "149.90",
        "expire_at": "2026-06-05",
        "barcode": "23793381286008200009301000012304570660000014990",
        "pdf_url": "https://cdn.exemplo.com/boletos/boleto-789.pdf"
      }
    }
  }'`,
  },
  {
    title: "envio_acesso",
    description: "Acesso liberado com dados do aluno no corpo e links textuais separados.",
    code: `curl -X POST "$ENDPOINT_URL" \\
  -H "Authorization: Bearer $SECRET_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event": "envio_acesso",
    "instanceId": "$INSTANCE_ID",
    "timestamp": "2026-05-30T15:20:00.000Z",
    "dedupKey": "acesso-321-enviado-20260530",
    "payload": {
      "customer": { "name": "Paula Rocha", "phone": "5511977776666" },
      "checkoutLink": "https://comunidade.exemplo.com/grupo/321",
      "order": {
        "product": {
          "name": "Comunidade Premium",
          "image": "https://cdn.exemplo.com/produtos/comunidade-premium.jpg"
        }
      },
      "access": {
        "url": "https://portal.exemplo.com/aluno/321",
        "login": "paula@example.com",
        "password": "senha-temporaria",
        "instructions": "Troque a senha no primeiro acesso."
      }
    }
  }'`,
  },
  {
    title: "carrinho_abandonado",
    description: "Recuperação de carrinho com produto, telefone e link de retomada visível no corpo/caption.",
    code: `curl -X POST "$ENDPOINT_URL" \\
  -H "Authorization: Bearer $SECRET_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event": "carrinho_abandonado",
    "instanceId": "$INSTANCE_ID",
    "timestamp": "2026-05-30T16:00:00.000Z",
    "dedupKey": "carrinho-654-abandonado-20260530",
    "payload": {
      "customer": { "name": "Marina Rocha", "phone": "5511966665555" },
      "checkoutLink": "https://checkout.exemplo.com/retomar/654",
      "checkout_session": {
        "product": {
          "name": "Curso de Fotografia",
          "thumbnail_url": "https://cdn.exemplo.com/produtos/fotografia.jpg"
        }
      }
    }
  }'`,
  },
  {
    title: "assinatura_criada",
    description: "Entrada de assinatura com produto recorrente, próxima cobrança opcional e link de acesso visível no corpo/caption.",
    code: `curl -X POST "$ENDPOINT_URL" \\
  -H "Authorization: Bearer $SECRET_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event": "assinatura_criada",
    "instanceId": "$INSTANCE_ID",
    "timestamp": "2026-05-30T16:20:00.000Z",
    "dedupKey": "assinatura-987-criada-20260530",
    "payload": {
      "customer": { "name": "Carlos Souza", "phone": "5511955554444" },
      "checkoutLink": "https://checkout.exemplo.com/assinaturas/987",
      "subscription": {
        "status": "active",
        "next_billing": "2026-06-30",
        "product": {
          "name": "Plano Anual Premium",
          "image": "https://cdn.exemplo.com/produtos/plano-anual.jpg"
        }
      }
    }
  }'`,
  },
  {
    title: "assinatura_em_atraso",
    description: "Regularização de assinatura com produto recorrente e link de pagamento visível no corpo/caption.",
    code: `curl -X POST "$ENDPOINT_URL" \\
  -H "Authorization: Bearer $SECRET_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event": "assinatura_em_atraso",
    "instanceId": "$INSTANCE_ID",
    "timestamp": "2026-05-30T16:40:00.000Z",
    "dedupKey": "assinatura-987-atraso-20260530",
    "payload": {
      "customer": { "name": "Carlos Souza", "phone": "5511955554444" },
      "checkoutLink": "https://checkout.exemplo.com/assinaturas/987/regularizar",
      "subscription": {
        "status": "past_due",
        "next_billing": "2026-06-30",
        "product": {
          "name": "Plano Anual Premium",
          "image": "https://cdn.exemplo.com/produtos/plano-anual.jpg"
        }
      }
    }
  }'`,
  },
] as const;

export const INTEGRATION_SUCCESS_RESPONSE_EXAMPLE = `{
  "success": true,
  "data": {
    "ingressId": "8f3b52d5-95d8-45c7-8b75-07b7b71d3b21",
    "dispatchId": "1d4b23dd-4474-44f9-90c8-0fe2f731ec92",
    "providerMessageId": "wamid.HBgNNTUxMTk5ODc2NTQzMhUCABIYIDc1QkI2QzY4QzA1QjM4QkYwAA==",
    "status": "accepted",
    "instanceId": "f9eb8d5c-9d2e-4dbf-9b97-1d2f0a4a7a80",
    "event": "pedido_pago"
  }
}`;

export const INTEGRATION_ERROR_RESPONSE_EXAMPLE = `{
  "success": false,
  "error": {
    "code": "INTEGRATION_CONTRACT_INVALID",
    "message": "Payload ou headers inválidos para o contrato de integração."
  }
}`;

