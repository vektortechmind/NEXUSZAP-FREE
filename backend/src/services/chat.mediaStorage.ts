import fs from "node:fs/promises";
import path from "node:path";
import { sanitizeFilename } from "./fileSecurity.service";

export type ChatMediaKind = "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";

const MB = 1024 * 1024;
const MAX_BYTES_BY_KIND: Record<ChatMediaKind, number> = {
  IMAGE: 10 * MB,
  VIDEO: 50 * MB,
  AUDIO: 20 * MB,
  DOCUMENT: 20 * MB,
};

const ALLOWED_MIME_BY_KIND: Record<ChatMediaKind, RegExp[]> = {
  IMAGE: [/^image\/(jpeg|png|webp|gif)$/i],
  VIDEO: [/^video\/(mp4|mpeg|quicktime|webm)$/i],
  AUDIO: [/^audio\/(mpeg|mp4|ogg|opus|webm|wav|aac)$/i, /^audio\/ogg;\s*codecs=opus$/i],
  DOCUMENT: [/^application\/pdf$/i, /^text\/plain$/i, /^application\/msword$/i, /^application\/vnd\.openxmlformats-officedocument\./i],
};

export class ChatMediaStorageValidationError extends Error {
  code = "CHAT_MEDIA_INVALID";

  constructor(message: string, public statusCode = 400) {
    super(message);
  }
}

function getChatMediaRoot() {
  const configured = process.env.CHAT_MEDIA_STORAGE_ROOT?.trim();
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
  }
  return path.resolve(process.cwd(), "storage", "chat-media");
}

export function buildChatMediaStoragePath(input: { instanceId: string; providerMessageId: string }) {
  const safeInstanceId = sanitizeFilename(input.instanceId).replace(/\s+/g, "_");
  const safeProviderMessageId = sanitizeFilename(input.providerMessageId).replace(/\s+/g, "_");
  return path.join(safeInstanceId, `${safeProviderMessageId}.bin`);
}

export function buildChatMediaUrl(input: { instanceId: string; providerMessageId: string }) {
  return `/api/chat/media/${encodeURIComponent(input.instanceId)}/${encodeURIComponent(input.providerMessageId)}`;
}

export function validateChatMedia(input: { messageType: ChatMediaKind; mimeType: string; sizeBytes: number }) {
  const maxBytes = MAX_BYTES_BY_KIND[input.messageType];
  if (input.sizeBytes > maxBytes) {
    throw new ChatMediaStorageValidationError("Arquivo excede o tamanho maximo permitido.", 413);
  }

  const allowed = ALLOWED_MIME_BY_KIND[input.messageType];
  if (!allowed.some((pattern) => pattern.test(input.mimeType))) {
    throw new ChatMediaStorageValidationError("Tipo de arquivo nao suportado.", 415);
  }
}

export function resolveChatMediaStoragePath(storagePath: string) {
  const root = getChatMediaRoot();
  const absolute = path.resolve(root, storagePath);
  const normalizedRoot = `${root}${path.sep}`;
  if (absolute !== root && !absolute.startsWith(normalizedRoot)) {
    throw new Error("chat media storagePath fora do diretorio permitido");
  }
  return absolute;
}

export async function writeChatMedia(input: { instanceId: string; providerMessageId: string; buffer: Buffer; messageType?: ChatMediaKind; mimeType?: string | null }) {
  if (input.messageType && input.mimeType) {
    validateChatMedia({ messageType: input.messageType, mimeType: input.mimeType, sizeBytes: input.buffer.length });
  }
  const storagePath = buildChatMediaStoragePath(input);
  const absolute = resolveChatMediaStoragePath(storagePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, input.buffer);
  return { storagePath, mediaUrl: buildChatMediaUrl(input) };
}

export async function readChatMedia(input: { instanceId: string; providerMessageId: string }) {
  const storagePath = buildChatMediaStoragePath(input);
  return fs.readFile(resolveChatMediaStoragePath(storagePath));
}

export async function cleanupOldChatMedia(input: { olderThanMs?: number; now?: Date } = {}) {
  const root = getChatMediaRoot();
  const cutoff = (input.now ?? new Date()).getTime() - (input.olderThanMs ?? 30 * 24 * 60 * 60 * 1000);
  let removed = 0;

  async function walk(dir: string) {
    let entries: Array<import("node:fs").Dirent> = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      throw err;
    }

    await Promise.all(entries.map(async (entry) => {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
        await fs.rmdir(absolute).catch(() => undefined);
        return;
      }
      if (!entry.isFile()) return;
      const stat = await fs.stat(absolute);
      if (stat.mtimeMs >= cutoff) return;
      await fs.unlink(absolute);
      removed += 1;
    }));
  }

  await walk(root);
  return { removed };
}

export function startChatMediaCleanupJob(input: { intervalMs?: number; olderThanMs?: number } = {}) {
  const intervalMs = input.intervalMs ?? 24 * 60 * 60 * 1000;
  const run = async () => {
    try {
      const result = await cleanupOldChatMedia({ olderThanMs: input.olderThanMs });
      if (result.removed > 0) console.info(`[ChatMedia] Cleanup removeu ${result.removed} arquivo(s).`);
    } catch (err) {
      console.error("[ChatMedia] Falha no cleanup de midias:", err instanceof Error ? err.message : err);
    }
  };
  const timer = setInterval(() => void run(), intervalMs);
  timer.unref?.();
  void run();
  return timer;
}
