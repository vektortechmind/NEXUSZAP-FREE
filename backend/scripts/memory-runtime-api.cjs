"use strict";

const assert = require("assert");

process.env.NODE_ENV = process.env.NODE_ENV || "test";

require("ts-node/register");

const { MemoryManager } = require("../src/utils/ai/memoryManager.ts");
const { CHAT_MEMORY_STORAGE_MAX_MESSAGES } = require("../src/ai/chatMemory.ts");

function createLogger() {
  const events = [];
  return {
    events,
    logger: {
      info(message, meta) {
        events.push({ level: "info", message, meta });
      },
      warn(message, meta) {
        events.push({ level: "warn", message, meta });
      },
    },
  };
}

(function testExpiration() {
  const { logger, events } = createLogger();
  const manager = new MemoryManager({ maxConversations: 10, ttlMs: 20, logger });
  manager.addMessage("instance-a:chat-1", "user", "ola");

  setTimeout(() => {
    const removed = manager.pruneExpiredNow();
    assert.equal(removed, 1, "memoria expirada deve ser removida");
    assert.equal(manager.size(), 0, "memoria expirada nao deve permanecer ativa");
    assert.ok(events.some((event) => event.message === "memoria expirada removida"), "expiracao deve ser observavel em log");
  }, 25);
})();

(async () => {
  await new Promise((resolve) => setTimeout(resolve, 30));

  const truncation = createLogger();
  const managerTruncation = new MemoryManager({ maxConversations: 20, ttlMs: 1000, logger: truncation.logger });
  for (let i = 0; i < CHAT_MEMORY_STORAGE_MAX_MESSAGES + 3; i++) {
    managerTruncation.addMessage("instance-a:chat-2", "user", `msg-${i}`);
  }
  const memory = managerTruncation.getMemory("instance-a:chat-2", CHAT_MEMORY_STORAGE_MAX_MESSAGES + 10);
  assert.equal(memory.length, CHAT_MEMORY_STORAGE_MAX_MESSAGES, "memoria deve truncar no limite de armazenamento");
  assert.equal(memory[0].content, "msg-3", "truncamento deve preservar mensagens mais recentes");
  assert.ok(truncation.events.some((event) => event.message === "memoria truncada por limite maximo"), "truncamento deve ser observavel em log");

  const eviction = createLogger();
  const managerEviction = new MemoryManager({ maxConversations: 2, ttlMs: 1000, logger: eviction.logger });
  managerEviction.addMessage("instance-a:chat-old", "user", "1");
  await new Promise((resolve) => setTimeout(resolve, 5));
  managerEviction.addMessage("instance-b:chat-new", "user", "2");
  await new Promise((resolve) => setTimeout(resolve, 5));
  managerEviction.addMessage("instance-c:chat-overflow", "user", "3");
  assert.equal(managerEviction.getMemory("instance-a:chat-old").length, 0, "conversa mais antiga deve ser descartada por LRU");
  assert.equal(managerEviction.size(), 2, "limite maximo de conversas deve ser respeitado");
  assert.ok(eviction.events.some((event) => event.message === "conversas descartadas por limite maximo"), "descarte por limite deve ser observavel em log");

  const isolation = createLogger();
  const managerIsolation = new MemoryManager({ maxConversations: 10, ttlMs: 1000, logger: isolation.logger });
  managerIsolation.addMessage("instance-a:chat-iso", "user", "memoria-a");
  managerIsolation.addMessage("instance-b:chat-iso", "user", "memoria-b");
  assert.deepEqual(
    managerIsolation.getMemory("instance-a:chat-iso").map((item) => item.content),
    ["memoria-a"],
    "memoria deve permanecer isolada por chave de instancia"
  );
  assert.deepEqual(
    managerIsolation.getMemory("instance-b:chat-iso").map((item) => item.content),
    ["memoria-b"],
    "memoria de outra instancia nao pode contaminar a conversa atual"
  );

  const diagnostics = managerIsolation.getDiagnostics();
  assert.equal(diagnostics.ttlMs, 1000, "diagnostico deve expor TTL configurado");
  assert.equal(diagnostics.activeConversations, 2, "diagnostico deve expor total atual de conversas");

  console.log("memory-runtime-api: OK");
})().catch((error) => {
  console.error("memory-runtime-api:", error.message || error);
  process.exit(1);
});
