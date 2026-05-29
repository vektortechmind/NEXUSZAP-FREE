"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

function read(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
}

function assertInstanceServiceContracts() {
  const source = read("src/services/instance.service.ts");

  assert.ok(source.includes("export const TELEGRAM_INSTANCE_SLOT = 0;"), "service deve reservar slot 0 para Telegram singleton");
  assert.ok(source.includes("where: { slot: { gt: TELEGRAM_INSTANCE_SLOT } }"), "listagem primaria deve excluir Telegram do grid WhatsApp");
  assert.ok(source.includes("export async function getPrimaryInstance()"), "service deve expor lookup explicito da instancia primaria de WhatsApp");
  assert.ok(source.includes("export async function getTelegramInstance()"), "service deve expor lookup explicito de Telegram");
  assert.ok(source.includes("export async function getOrCreateTelegramInstance()"), "service deve criar Telegram apenas por fluxo explicito");
  assert.ok(source.includes("throw new InstanceLinkedAgentError();"), "exclusao deve bloquear instancias com agente vinculado");
}

function assertAgentRoutesContracts() {
  const source = read("src/routes/agent.routes.ts");

  assert.ok(source.includes("const instances = await listInstances();"), "rota /instances deve usar listagem filtrada do service");
  assert.ok(source.includes("if (err instanceof InstanceLinkedAgentError)"), "rota delete deve traduzir bloqueio de agente vinculado");
  assert.ok(source.includes("const instance = await getOrCreateTelegramInstance();"), "save-token deve persistir Telegram explicitamente");
  assert.ok(source.includes("const instance = await getTelegramInstance();"), "rotas Telegram nao devem bootstrapar instancia primaria");
  assert.ok(source.includes("instanceId: undefined"), "status Telegram vazio deve responder sem instanceId");
  assert.ok(source.includes("instanceName: null"), "status Telegram vazio deve responder sem instanceName");
  assert.ok(source.includes("async function getTelegramConfigState()"), "backend deve expor resolucao isolada de owner para Telegram");
  assert.ok(source.includes('fastify.get("/telegram/config"'), "backend deve expor leitura dedicada de config do Telegram");
  assert.ok(source.includes('fastify.put("/telegram/config"'), "backend deve expor gravacao dedicada de config do Telegram");
  assert.ok(source.includes("Vincule ou crie um agente para a instância Telegram antes de editar prompt ou arquivos."), "backend deve bloquear Telegram sem agente vinculado");
  assert.ok(source.includes("Use /agent/telegram/config para editar o prompt isolado do Telegram."), "rota global deve rejeitar escrita legado do prompt Telegram");
  assert.ok(source.includes("telegramSystemPrompt: null"), "rota global nao deve mais expor prompt Telegram do owner primario");
}

function assertTelegramManagerContracts() {
  const source = read("src/telegram/TelegramBotManager.ts");

  assert.ok(source.includes('import { getTelegramInstance } from "../services/instance.service";'), "manager Telegram deve usar instancia dedicada");
  assert.ok(source.includes("if (!instance) return;"), "manager Telegram deve abortar quando nao houver instancia persistida");
  assert.ok(!source.includes("getOrCreatePrimaryInstance"), "manager Telegram nao deve bootstrapar instancias WhatsApp");
}

function assertProviderFallbackIsolationContracts() {
  const providerSource = read("src/ai/providerSelector.ts");
  const runtimeSource = read("src/services/runtimeConfig.service.ts");
  const telegramFilesSource = read("src/routes/telegram-files.routes.ts");

  assert.ok(providerSource.includes('from "../services/runtimeConfig.service"'), "provider selector deve centralizar precedencia em runtimeConfig.service");
  assert.ok(runtimeSource.includes('import { getPrimaryInstance, TELEGRAM_INSTANCE_SLOT } from "./instance.service";'), "runtime config deve depender da instancia primaria de WhatsApp");
  assert.ok(runtimeSource.includes("current && current.slot > TELEGRAM_INSTANCE_SLOT"), "fallback global deve valer apenas para instancias WhatsApp");
  assert.ok(!providerSource.includes('findFirst({ orderBy: { slot: "asc" } })'), "fallback global nao deve usar a primeira instancia absoluta por slot");
  assert.ok(!telegramFilesSource.includes("getPrimaryAgent"), "upload Telegram por instancia nao deve mais depender do owner primario");
  assert.ok(telegramFilesSource.includes("if (!instance.agent)"), "upload Telegram por instancia deve bloquear quando nao houver agente vinculado");
  assert.ok(telegramFilesSource.includes("instanceId: instance.id"), "upload Telegram por instancia deve persistir no owner real da instancia");
}

function assertFrontendContracts() {
  const source = fs.readFileSync(path.resolve(__dirname, "..", "..", "frontend", "src", "pages", "Instancia.tsx"), "utf8");
  const telegramSource = fs.readFileSync(path.resolve(__dirname, "..", "..", "frontend", "src", "pages", "Telegram.tsx"), "utf8");
  const agenteSource = fs.readFileSync(path.resolve(__dirname, "..", "..", "frontend", "src", "pages", "Agente.tsx"), "utf8");

  assert.ok(source.includes("if (!telegramStatus?.instanceId) return whatsappCards;"), "card Telegram so pode existir com instanceId persistido");
  assert.ok(source.includes("markPairingIntent(instanceId);"), "fluxo deve marcar pareamento transitorio ao iniciar conexao");
  assert.ok(source.includes("await cancelWhatsappPairing(selectedCard.id);"), "fechar detalhes deve cancelar pareamento pendente");
  assert.ok(source.includes("await cancelWhatsappPairing(createModal.createdInstanceId);"), "fechar modal deve cancelar pareamento pendente");
  assert.ok(source.includes("Nenhum pareamento ativo"), "detalhes devem exibir estado neutro antes de conectar");
  assert.ok(!source.includes("QR ainda não disponível"), "UI nao deve exibir placeholder antigo de QR");
  assert.ok(!source.includes("Use Conectar para iniciar o pareamento desta instância."), "UI nao deve antecipar copy de pareamento");
  assert.ok(telegramSource.includes('api.get<TelegramConfig>("/agent/telegram/config")'), "pagina Telegram deve carregar config isolada");
  assert.ok(telegramSource.includes('api.put<TelegramConfig>("/agent/telegram/config"'), "pagina Telegram deve salvar config isolada");
  assert.ok(telegramSource.includes("cfg?.blockingReason"), "pagina Telegram deve exibir bloqueio quando nao houver agente vinculado");
  assert.ok(agenteSource.includes('api.get<TelegramAgentConfig>("/agent/telegram/config")'), "workspace do agente deve ler prompt Telegram pela rota isolada");
  assert.ok(agenteSource.includes('api.put("/agent/telegram/config"'), "workspace do agente deve salvar prompt Telegram pela rota isolada");
  assert.ok(agenteSource.includes("telegramWorkspaceEditable"), "workspace do agente deve bloquear edicao Telegram sem owner valido");
}

assertInstanceServiceContracts();
assertAgentRoutesContracts();
assertTelegramManagerContracts();
assertProviderFallbackIsolationContracts();
assertFrontendContracts();

console.log("instance-cards-api: OK");

