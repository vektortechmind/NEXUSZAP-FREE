"use strict";

const assert = require("assert");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-with-more-than-32-characters";
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "local-test-password";
process.env.FILE_STORAGE_ROOT = path.join(os.tmpdir(), "nexuszap-storage-test");

require("ts-node/register");

const {
  buildKnowledgeStoragePath,
  deleteKnowledgeBinary,
  readKnowledgeBinary,
  writeKnowledgeBinary,
} = require("../src/services/knowledge/fileStorage.service.ts");
const {
  loadKnowledgeFileBuffer,
  getKnowledgeFileSize,
} = require("../src/services/knowledge/knowledge.service.ts");

(async () => {
  const storagePathA = buildKnowledgeStoragePath({
    instanceId: "instance-a",
    channel: "WHATSAPP",
    fileId: "file-1",
    filename: "manual.pdf",
  });
  const storagePathB = buildKnowledgeStoragePath({
    instanceId: "instance-b",
    channel: "WHATSAPP",
    fileId: "file-2",
    filename: "manual.pdf",
  });

  assert.notEqual(storagePathA, storagePathB, "instancias diferentes devem gerar paths diferentes");
  assert.ok(storagePathA.includes("instance-a"), "path deve segregar por instanceId");

  const buffer = Buffer.from("conteudo de teste", "utf8");
  await writeKnowledgeBinary(storagePathA, buffer);
  const readBack = await readKnowledgeBinary(storagePathA);
  assert.deepEqual(readBack, buffer, "storage local deve preservar o binario gravado");

  const loadedFromStorage = await loadKnowledgeFileBuffer({
    id: "file-1",
    mimetype: "text/plain",
    storagePath: storagePathA,
    data: Buffer.alloc(0),
    extracted: null,
  });
  assert.deepEqual(loadedFromStorage, buffer, "knowledge service deve ler do filesystem quando houver storagePath");

  const legacyBuffer = await loadKnowledgeFileBuffer({
    id: "legacy-file",
    mimetype: "text/plain",
    storagePath: null,
    data: Buffer.from("legado", "utf8"),
    extracted: null,
  });
  assert.equal(legacyBuffer.toString("utf8"), "legado", "knowledge service deve manter fallback para registros legados no banco");

  assert.equal(getKnowledgeFileSize({ sizeBytes: 42, data: Buffer.alloc(0) }), 42, "quota deve priorizar sizeBytes");
  assert.equal(getKnowledgeFileSize({ data: Buffer.from("1234") }), 4, "quota deve cair para data quando sizeBytes nao existir");

  const deleted = await deleteKnowledgeBinary(storagePathA);
  assert.equal(deleted, true, "exclusao deve remover o arquivo do filesystem");

  await fs.rm(process.env.FILE_STORAGE_ROOT, { recursive: true, force: true });
  console.log("local-file-storage-api: OK");
})().catch(async (error) => {
  await fs.rm(process.env.FILE_STORAGE_ROOT, { recursive: true, force: true });
  console.error("local-file-storage-api:", error.message || error);
  process.exit(1);
});
