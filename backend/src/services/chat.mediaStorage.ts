import fs from "node:fs/promises";
import path from "node:path";
import { sanitizeFilename } from "./fileSecurity.service";

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

export function resolveChatMediaStoragePath(storagePath: string) {
  const root = getChatMediaRoot();
  const absolute = path.resolve(root, storagePath);
  const normalizedRoot = `${root}${path.sep}`;
  if (absolute !== root && !absolute.startsWith(normalizedRoot)) {
    throw new Error("chat media storagePath fora do diretorio permitido");
  }
  return absolute;
}

export async function writeChatMedia(input: { instanceId: string; providerMessageId: string; buffer: Buffer }) {
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
