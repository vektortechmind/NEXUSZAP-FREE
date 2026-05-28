process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb?schema=public";

require("ts-node/register/transpile-only");
const assert = require("node:assert/strict");

const {
  assertStorageQuota,
  buildSafeDownloadHeaders,
  FileSecurityError,
  MAX_FILES_PER_INSTANCE_CHANNEL,
  MAX_TOTAL_BYTES_PER_INSTANCE_CHANNEL,
  sanitizeFilename,
  truncateExtractedText,
  validateAndNormalizeUpload,
} = require("../src/services/fileSecurity.service");

const PNG_1X1 = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000154a24f5d0000000049454e44ae426082",
  "hex"
);

async function main() {
  const validText = validateAndNormalizeUpload({
    filename: "notes.txt",
    incomingMime: "text/plain",
    buffer: Buffer.from("conteudo seguro", "utf8"),
  });
  assert.equal(validText.filename, "notes.txt");
  assert.equal(validText.mimetype, "text/plain");
  assert.equal(validText.canExtract, true);
  assert.equal(validText.isImage, false);

  const validImage = validateAndNormalizeUpload({
    filename: "pixel.png",
    incomingMime: "image/png",
    buffer: PNG_1X1,
  });
  assert.equal(validImage.mimetype, "image/png");
  assert.equal(validImage.canExtract, false);
  assert.equal(validImage.isImage, true);

  assert.throws(
    () => validateAndNormalizeUpload({
      filename: "fake.pdf",
      incomingMime: "application/pdf",
      buffer: Buffer.from("not a real pdf", "utf8"),
    }),
    (err) => err instanceof FileSecurityError && err.code === "MAGIC_BYTES_MISMATCH"
  );

  assert.throws(
    () => validateAndNormalizeUpload({
      filename: "notes.txt",
      incomingMime: "application/pdf",
      buffer: Buffer.from("conteudo seguro", "utf8"),
    }),
    (err) => err instanceof FileSecurityError && err.code === "MIME_MISMATCH"
  );

  await assert.rejects(
    () => assertStorageQuota({
      existingFiles: Array.from({ length: MAX_FILES_PER_INSTANCE_CHANNEL }, () => ({ data: Buffer.from("x") })),
      nextBytes: 1,
    }),
    (err) => err instanceof FileSecurityError && err.code === "FILE_COUNT_QUOTA_EXCEEDED"
  );

  await assert.rejects(
    () => assertStorageQuota({
      existingFiles: [{ data: Buffer.alloc(MAX_TOTAL_BYTES_PER_INSTANCE_CHANNEL) }],
      nextBytes: 1,
    }),
    (err) => err instanceof FileSecurityError && err.code === "FILE_SIZE_QUOTA_EXCEEDED"
  );

  const headers = buildSafeDownloadHeaders('..\\evil"name.pdf', "application/pdf");
  assert.equal(headers["Content-Type"], "application/pdf");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.match(headers["Content-Disposition"], /^attachment;/);
  assert.equal(headers["Content-Disposition"].includes("..\\"), false);
  assert.equal(sanitizeFilename('..\\evil"name.pdf').includes('"'), false);

  assert.equal(truncateExtractedText("a".repeat(70_000)).length, 60_000);

  console.log("file-security: OK");
}

main().catch((err) => {
  console.error("file-security:", err);
  process.exit(1);
});
