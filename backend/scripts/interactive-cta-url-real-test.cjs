"use strict";

const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

function loadRuntimeModules() {
  try {
    require("ts-node/register");
    return {
      InstanceManager: require("../src/whatsapp/InstanceManager.ts").InstanceManager,
      sendCtaUrlInteractiveMessage: require("../src/whatsapp/interactiveSender.ts").sendCtaUrlInteractiveMessage,
    };
  } catch (error) {
    if (error?.code !== "MODULE_NOT_FOUND" || !String(error.message || "").includes("ts-node/register")) {
      throw error;
    }

    return {
      InstanceManager: require("/app/dist/whatsapp/InstanceManager.js").InstanceManager,
      sendCtaUrlInteractiveMessage: require("/app/dist/whatsapp/interactiveSender.js").sendCtaUrlInteractiveMessage,
    };
  }
}

const { InstanceManager, sendCtaUrlInteractiveMessage } = loadRuntimeModules();

function readArg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

function readParam(name, envName) {
  return readArg(name) || process.env[envName];
}

function toJid(value) {
  if (!value) throw new Error("Informe TO ou --to com telefone completo ou JID.");
  const trimmed = String(value).trim();
  if (trimmed.includes("@")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (!/^\d{8,20}$/.test(digits)) {
    throw new Error("TO deve conter telefone completo com DDI ou um JID valido.");
  }
  return `${digits}@s.whatsapp.net`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSocket(instanceId, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const sock = InstanceManager.get(instanceId);
    if (sock?.user) return sock;
    if (sock) return sock;
    await sleep(1000);
  }
  throw new Error("Socket nao ficou disponivel dentro do tempo limite.");
}

async function main() {
  const instanceId = readParam("instance-id", "INSTANCE_ID");
  const to = readParam("to", "TO");
  const url = readParam("url", "CTA_URL");
  const body = readParam("body", "CTA_BODY") || "Teste de botao CTA URL experimental do NexusZAP.";
  const buttonText = readParam("button", "CTA_BUTTON_TEXT") || "Abrir link";
  const footer = readParam("footer", "CTA_FOOTER");

  if (!instanceId) throw new Error("Informe INSTANCE_ID ou --instance-id.");
  if (!url) throw new Error("Informe CTA_URL ou --url.");

  const jid = toJid(to);

  await InstanceManager.start(instanceId, undefined, { userInitiated: true });
  const sock = await waitForSocket(instanceId, 30000);

  const result = await sendCtaUrlInteractiveMessage(sock, jid, { body, buttonText, url, footer });

  console.log(JSON.stringify(
    {
      ok: true,
      instanceId,
      to: jid,
      deliveryPath: result.deliveryPath,
      providerMessageId: result.providerMessageId,
      fallbackProviderMessageId: result.fallbackProviderMessageId,
      interactiveError: result.interactiveError,
      summary: result.summary,
      manualValidation: "Confirme visualmente no aparelho se chegou e se o botao CTA URL renderizou.",
    },
    null,
    2
  ));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err?.message || "Falha no teste real de CTA URL." }, null, 2));
  process.exit(1);
});
