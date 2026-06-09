"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const messageEventService = fs.readFileSync(path.join(root, "src", "services", "analytics", "messageEvent.service.ts"), "utf8");
const messageHandler = fs.readFileSync(path.join(root, "src", "whatsapp", "messageHandler.ts"), "utf8");

assert.equal(messageEventService.includes("prisma as any"), false, "messageEvent.service.ts must not cast prisma as any");
assert.equal(messageEventService.includes("prisma.messageEvent.create"), true, "messageEvent persistence must use typed prisma.messageEvent.create");
assert.equal(messageEventService.includes("Prisma.MessageEventWhereInput"), true, "dashboard filters must use Prisma.MessageEventWhereInput");

assert.equal(messageHandler.includes("as never"), false, "messageHandler.ts must not cast Baileys values as never");
assert.equal(messageHandler.includes("MediaDownloadContext"), true, "messageHandler.ts must type the media download context");
assert.equal(messageHandler.includes("hasRequiredMessageKey"), true, "messageHandler.ts must narrow messages before media download");
assert.equal(messageHandler.includes("WAMessageContent"), true, "messageHandler.ts must pass typed WhatsApp message content to Baileys helpers");
assert.equal(messageHandler.includes("!key || key.fromMe"), false, "messageHandler.ts must not drop phone-sent fromMe messages before chat persistence");
assert.equal(messageHandler.includes("persistOutboundMessage({ ...messageInput"), true, "messageHandler.ts must persist fromMe Baileys upserts as outbound chat messages");

console.log("message-event-type-contract: OK");
