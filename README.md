# NexusZAP - Chatbot com IA v1.0.11

<div align="center">

![GitHub repo size](https://img.shields.io/github/repo-size/vektortechmind/NEXUSZAP-FREE?style=flat-square)
![GitHub stars](https://img.shields.io/github/stars/vektortechmind/NEXUSZAP-FREE?style=flat-square)
![GitHub forks](https://img.shields.io/github/forks/vektortechmind/NEXUSZAP-FREE?style=flat-square)
![GitHub issues](https://img.shields.io/github/issues/vektortechmind/NEXUSZAP-FREE?style=flat-square)
![License: Source-Available](https://img.shields.io/badge/license-source--available-orange?style=flat-square)

<a href="https://livepix.gg/vektortechmind01" target="_blank">
  <img src="https://img.shields.io/badge/Apoie%20o%20projeto-LivePix-FFB000?style=for-the-badge" alt="Apoie o projeto via LivePix" />
</a>

</div>

NexusZAP e uma plataforma gratuita para automacao de atendimento no WhatsApp e Telegram com IA, base de conhecimento, painel administrativo e endpoint publico para integracoes externas.

## O que o NexusZAP entrega

- Conexao e gestao de instancias WhatsApp via Baileys e Telegram.
- Agentes com IA, prompt principal, memoria e base de conhecimento.
- Providers de IA: Gemini, Groq, OpenRouter e OpenAI.
- Endpoint publico para receber eventos externos e disparar mensagens.
- Templates prontos para pedidos, pagamentos, acesso, assinaturas e recuperacao.
- Auditoria de eventos recebidos, envios, falhas, retries e provider.
- Instalacao e atualizacao por scripts em VPS Debian/Ubuntu com Docker.

## Requisitos

Ambiente recomendado:

- VPS Linux Debian ou Ubuntu.
- Acesso root ou usuario com sudo.
- Dominio/subdominio apontando para a VPS.
- Docker, Docker Compose, Git e Node.js 20 LTS.

O `install.sh` instala automaticamente dependencias basicas em Debian/Ubuntu quando elas estiverem ausentes ou desatualizadas.

## Instalacao rapida

Em uma VPS limpa Debian/Ubuntu:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/vektortechmind/NEXUSZAP-FREE/main/install.sh)"
```

Se preferir auditar antes:

```bash
curl -fsSL https://raw.githubusercontent.com/vektortechmind/NEXUSZAP-FREE/main/install.sh -o install.sh
chmod +x install.sh
sudo ./install.sh
```

O instalador clona o repositorio quando necessario, prepara `backend/.env`, gera segredos, instala dependencias, executa build e sobe os containers `postgres`, `backend` e `frontend`.

## Instalação assistida

Quer usar o NexusZAP sem lidar com a parte técnica da instalação?

O projeto é gratuito e pode ser instalado por conta própria seguindo este README. Para quem prefere ajuda, ofereço um serviço opcional de instalação assistida e orientação inicial de uso.

Serviço opcional a partir de **R$ 29,99**.

<div align="center">

<a href="https://wa.me/447308028362?text=Ol%C3%A1%2C%20tenho%20interesse%20na%20instala%C3%A7%C3%A3o%20assistida%20do%20NexusZAP%20a%20partir%20de%20R%24%2029%2C99.%20Pode%20me%20passar%20mais%20informa%C3%A7%C3%B5es%3F" target="_blank">
  <img src="https://img.shields.io/badge/Solicitar%20instala%C3%A7%C3%A3o%20assistida-WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="Solicitar instalação assistida pelo WhatsApp" />
</a>

</div>

## Primeiro acesso

Ao final da instalacao, acesse a URL exibida no terminal:

```text
http://SEU_IP/docker-setup?token=SEU_TOKEN
```

Informe o dominio publico do painel/API. Essa etapa ajusta `APP_URL`, `CORS_ORIGINS` e finaliza a configuracao inicial.

Depois crie o primeiro administrador:

```text
http://SEU_DOMINIO/criar-admin?token=SEU_TOKEN
```

Enquanto o primeiro administrador nao for criado, o login normal fica bloqueado por seguranca.

## URLs importantes

Em uma instalacao padrao com Docker:

- Painel: `https://SEU_DOMINIO`
- API publica: `https://SEU_DOMINIO/api`
- Backend direto para suporte: `http://SEU_IP:3001/api`
- Endpoint de integracoes: `https://SEU_DOMINIO/api/integrations/events`

`APP_URL` deve apontar para a URL publica real da API. Sem isso, o painel pode exibir endpoint interno ou IP local em integracoes.

## Configuracao basica

No painel voce configura:

- instancias WhatsApp e Telegram;
- IA por agente e por instancia;
- provider/modelo de IA;
- base de conhecimento;
- credenciais de integracao externa;
- auditoria e acompanhamento de envios.

A IA pode ser habilitada ou desabilitada por instancia WhatsApp. Isso permite manter a instancia conectada sem responder automaticamente.

## Integracoes externas

O NexusZAP recebe eventos externos em:

```text
POST /api/integrations/events
```

Autenticacao:

```text
Authorization: Bearer <secretToken>
Content-Type: application/json
```

Campos principais:

- `event`: tipo do evento.
- `instanceId`: instancia autorizada para a credencial.
- `timestamp`: usado na protecao contra replay.
- `dedupKey`: chave idempotente para evitar duplicidade.
- `payload`: dados do cliente, pedido, produto, links, Pix, boleto ou acesso.

Eventos suportados:

- pedidos: pendente, pago, cancelado, recusado e reembolso;
- pagamentos: Pix gerado e boleto gerado;
- acesso: envio de acesso ao cliente;
- assinatura: criada, renovada, cancelada e em atraso;
- recuperacao: carrinho abandonado.

A documentacao tecnica completa do endpoint fica no proprio painel em `Integracoes -> Documentacao`.

## Templates e mensagens

Cada evento possui template padrao. Quando o payload contem imagem, link, Pix ou boleto, o NexusZAP escolhe automaticamente o melhor formato disponivel.

No WhatsApp, o envio e a conexao das instancias usam Baileys. O NexusZAP controla o contrato publico, templates, fallback, auditoria e seguranca; detalhes internos do Baileys nao fazem parte da API publica de integracoes.

O runtime pode usar:

- texto simples;
- link com preview;
- imagem com legenda;
- documento;
- botoes nativos quando suportado, como abrir link ou copiar codigo Pix/boleto.

Sistemas externos podem enviar `payload.message.body` para personalizar o texto visivel do evento. Campos tecnicos de WhatsApp/Baileys nao sao aceitos pelo endpoint publico.

## Atualizacao

Dentro da pasta do projeto na VPS:

```bash
./update.sh
```

O update busca o repositorio oficial, aplica mudancas com Git, reinstala dependencias quando necessario, executa build e recria os containers afetados.

Tambem e possivel usar o painel quando a instalacao estiver preparada para atualizacao controlada.

## Docker

Subir manualmente:

```bash
docker compose up -d --build
```

Ver logs:

```bash
docker compose logs -f
```

Parar:

```bash
docker compose down
```

## Desenvolvimento local

```bash
npm install
npm run dev
```

Comandos uteis:

```bash
npm run build
npm run lint
npm run typecheck
npm test
```

## Estrutura

```text
NEXUSZAP-FREE/
├── backend/
├── frontend/
├── scripts/
├── docker-compose.yml
├── install.sh
└── update.sh
```

## Apoie o projeto

<div align="center">

### 💛 NexusZAP e gratuito e feito para a comunidade.

Se o NexusZAP economizou seu tempo, ajudou sua operacao ou serviu como base para uma integracao real, considere apoiar o desenvolvimento com uma contribuicao voluntaria.

As doacoes ajudam a manter:

🚀 evolucao continua do projeto  
🛠️ correcoes, melhorias e novas funcionalidades  
☁️ infraestrutura de testes, demonstracoes e validacao em ambiente real  
📚 documentacao, exemplos e suporte para a comunidade  

<br />

<a href="https://livepix.gg/vektortechmind01" target="_blank">
  <img src="https://img.shields.io/badge/Apoiar%20via%20LivePix-FFB000?style=for-the-badge&logo=pix&logoColor=white" alt="Apoiar via LivePix" />
</a>

<br />
<br />

<a href="https://livepix.gg/vektortechmind01" target="_blank">
  <strong>Fazer uma contribuicao voluntaria</strong>
</a>

</div>

## Gostou do NexusZAP?

<div align="center">

Se o projeto foi util para voce, deixe uma estrela no repositorio.

Isso ajuda o NexusZAP a chegar em mais pessoas, aumenta a confianca da comunidade e incentiva a continuidade do desenvolvimento.

<br />

<a href="https://github.com/vektortechmind/NEXUSZAP-FREE/stargazers" target="_blank">
  <img src="https://img.shields.io/github/stars/vektortechmind/NEXUSZAP-FREE?style=for-the-badge&logo=github&label=Dar%20uma%20estrela&color=181717" alt="Dar uma estrela no GitHub" />
</a>

<br />
<br />

<strong>⭐ Sua estrela fortalece o projeto.</strong>

</div>

## Seguranca operacional

Nunca commite arquivos locais ou sensiveis, como:

- `backend/.env`
- `node_modules`
- `dist`
- tokens, segredos ou credenciais exportadas do painel

## Licenca

Este projeto usa a [Licenca Source-Available NexusZAP](./LICENSE.md). A versao em ingles esta disponivel apenas como traducao auxiliar em [LICENSE.en.md](./LICENSE.en.md).

Resumo pratico:

- voce pode usar o sistema para uso proprio, interno ou comercial dentro da sua operacao;
- voce pode modificar o codigo para sua propria operacao;
- agencias e equipes tecnicas podem operar/customizar o sistema para atender clientes sem entregar o codigo;
- voce nao pode vender, revender, sublicenciar, publicar, redistribuir, empacotar, vender fork, vender imagem Docker, oferecer white-label ou transformar o codigo em produto concorrente sem autorizacao comercial por escrito.

Esta licenca nao e uma licenca open source OSI, porque restringe venda e redistribuicao do codigo.
