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
}

function assertTelegramManagerContracts() {
  const source = read("src/telegram/TelegramBotManager.ts");

  assert.ok(source.includes('import { getTelegramInstance } from "../services/instance.service";'), "manager Telegram deve usar instancia dedicada");
  assert.ok(source.includes("if (!instance) return;"), "manager Telegram deve abortar quando nao houver instancia persistida");
  assert.ok(!source.includes("getOrCreatePrimaryInstance"), "manager Telegram nao deve bootstrapar instancias WhatsApp");
}

function assertFrontendContracts() {
  const source = fs.readFileSync(path.resolve(__dirname, "..", "..", "frontend", "src", "pages", "Instancia.tsx"), "utf8");

  assert.ok(source.includes("if (!telegramStatus?.instanceId) return whatsappCards;"), "card Telegram so pode existir com instanceId persistido");
  assert.ok(source.includes("markPairingIntent(instanceId);"), "fluxo deve marcar pareamento transitorio ao iniciar conexao");
  assert.ok(source.includes("await cancelWhatsappPairing(selectedCard.id);"), "fechar detalhes deve cancelar pareamento pendente");
  assert.ok(source.includes("await cancelWhatsappPairing(createModal.createdInstanceId);"), "fechar modal deve cancelar pareamento pendente");
  assert.ok(source.includes("Nenhum pareamento ativo"), "detalhes devem exibir estado neutro antes de conectar");
  assert.ok(!source.includes("QR ainda não disponível"), "UI nao deve exibir placeholder antigo de QR");
  assert.ok(!source.includes("Use Conectar para iniciar o pareamento desta instância."), "UI nao deve antecipar copy de pareamento");
}

assertInstanceServiceContracts();
assertAgentRoutesContracts();
assertTelegramManagerContracts();
assertFrontendContracts();

console.log("instance-cards-api: OK");
