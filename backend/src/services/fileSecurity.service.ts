import path from "path";
import { safeLogError } from "../utils/redaction";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_EXTRACTED_TEXT_CHARS = 60_000;
export const EXTRACTION_TIMEOUT_MS = 5_000;
export const MAX_FILES_PER_INSTANCE_CHANNEL = 30;
export const MAX_TOTAL_BYTES_PER_INSTANCE_CHANNEL = 25 * 1024 * 1024;

export const ALLOWED_FILE_TYPES = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
} as const;

export type KnowledgeChannel = "WHATSAPP" | "TELEGRAM";
export type AllowedMime = (typeof ALLOWED_FILE_TYPES)[keyof typeof ALLOWED_FILE_TYPES];

const EXTRACTABLE_MIMES = new Set<AllowedMime>([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/json",
  "text/plain"
]);

const IMAGE_MIMES = new Set<AllowedMime>([
  "image/png",
  "image/jpeg",
  "image/webp"
]);

export class FileSecurityError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "FileSecurityError";
  }
}

export async function streamToLimitedBuffer(stream: NodeJS.ReadableStream, maxBytes = MAX_UPLOAD_BYTES) {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream as any) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > maxBytes) {
      throw new FileSecurityError("Arquivo excede o limite permitido.", "FILE_TOO_LARGE");
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

export function sanitizeFilename(filename: string): string {
  const basename = path.basename(String(filename || "arquivo"));
  const cleaned = basename
    .normalize("NFKC")
    .replace(/[\x00-\x1F\x7F"\\/<>:|?*]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
  return cleaned || "arquivo";
}

export function getExpectedMimeFromFilename(filename: string): AllowedMime | null {
  const ext = path.extname(filename).toLowerCase() as keyof typeof ALLOWED_FILE_TYPES;
  return ALLOWED_FILE_TYPES[ext] ?? null;
}

export function normalizeIncomingMime(mime?: string | null): string | null {
  const normalized = String(mime ?? "").split(";")[0].trim().toLowerCase();
  if (!normalized || normalized === "application/octet-stream") return null;
  if (normalized === "text/json") return "application/json";
  return normalized;
}

function isProbablyUtf8Text(buffer: Buffer): boolean {
  if (buffer.includes(0)) return false;
  const text = buffer.toString("utf8");
  return !text.includes("\uFFFD");
}

function isDocxZip(buffer: Buffer): boolean {
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) return false;
  const sample = buffer.subarray(0, Math.min(buffer.length, 512_000)).toString("latin1");
  return sample.includes("[Content_Types].xml") && sample.includes("word/");
}

export function detectMimeByMagicBytes(buffer: Buffer, expectedMime: AllowedMime): AllowedMime | null {
  if (buffer.length === 0) return null;

  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (isDocxZip(buffer)) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";

  if (expectedMime === "application/json") {
    if (!isProbablyUtf8Text(buffer)) return null;
    try {
      JSON.parse(buffer.toString("utf8"));
      return "application/json";
    } catch {
      return null;
    }
  }

  if (expectedMime === "text/plain" && isProbablyUtf8Text(buffer)) return "text/plain";
  return null;
}

export function validateAndNormalizeUpload(input: {
  filename: string;
  incomingMime?: string | null;
  buffer: Buffer;
}) {
  const filename = sanitizeFilename(input.filename);
  const expectedMime = getExpectedMimeFromFilename(filename);
  if (!expectedMime) {
    throw new FileSecurityError("Tipo de arquivo não permitido.", "EXTENSION_NOT_ALLOWED");
  }

  const incomingMime = normalizeIncomingMime(input.incomingMime);
  if (incomingMime && incomingMime !== expectedMime) {
    throw new FileSecurityError("MIME informado não corresponde à extensão permitida.", "MIME_MISMATCH");
  }

  const detectedMime = detectMimeByMagicBytes(input.buffer, expectedMime);
  if (detectedMime !== expectedMime) {
    throw new FileSecurityError("Conteúdo real do arquivo não corresponde ao tipo permitido.", "MAGIC_BYTES_MISMATCH");
  }

  return {
    filename,
    mimetype: detectedMime,
    canExtract: EXTRACTABLE_MIMES.has(detectedMime),
    isImage: IMAGE_MIMES.has(detectedMime)
  };
}

export function truncateExtractedText(text: string): string {
  return text.length > MAX_EXTRACTED_TEXT_CHARS ? text.slice(0, MAX_EXTRACTED_TEXT_CHARS) : text;
}

export function withExtractionTimeout<T>(work: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new FileSecurityError("Tempo limite de extração excedido.", "EXTRACTION_TIMEOUT")), EXTRACTION_TIMEOUT_MS);
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export function buildSafeDownloadHeaders(filename: string, mimetype: string) {
  const safeName = sanitizeFilename(filename);
  const asciiFallback = safeName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "_") || "arquivo";
  return {
    "Content-Type": mimetype,
    "Content-Disposition": `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
    "X-Content-Type-Options": "nosniff"
  };
}

export async function assertStorageQuota(input: {
  existingFiles: Array<{ sizeBytes?: number | null; data?: Buffer | Uint8Array | null }>;
  nextBytes: number;
}) {
  if (input.existingFiles.length >= MAX_FILES_PER_INSTANCE_CHANNEL) {
    throw new FileSecurityError("Cota de quantidade de arquivos atingida.", "FILE_COUNT_QUOTA_EXCEEDED");
  }
  const currentBytes = input.existingFiles.reduce((sum, file) => {
    if (typeof file.sizeBytes === "number" && file.sizeBytes > 0) return sum + file.sizeBytes;
    if (file.data) return sum + Buffer.from(file.data).length;
    return sum;
  }, 0);
  if (currentBytes + input.nextBytes > MAX_TOTAL_BYTES_PER_INSTANCE_CHANNEL) {
    throw new FileSecurityError("Cota de armazenamento de arquivos atingida.", "FILE_SIZE_QUOTA_EXCEEDED");
  }
}

export function logExtractionFailure(logger: { warn: (obj: unknown, msg?: string) => void } | undefined, err: unknown, context: { channel: KnowledgeChannel; fileId?: string; mimetype?: string }) {
  const payload = { err: safeLogError(err), context };
  if (logger) {
    logger.warn(payload, "[file-extraction]");
    return;
  }
  console.warn("[file-extraction]", payload);
}
