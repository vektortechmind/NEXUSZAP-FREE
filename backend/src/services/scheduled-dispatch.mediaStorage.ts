import fs from "node:fs/promises";
import path from "node:path";
import { sanitizeFilename } from "./fileSecurity.service";
import { validateChatMedia, type ChatMediaKind } from "./chat.mediaStorage";

export type ScheduledDispatchMediaKind = "IMAGE" | "VIDEO";

function getScheduledDispatchMediaRoot() {
  const configured = process.env.SCHEDULED_DISPATCH_MEDIA_STORAGE_ROOT?.trim();
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
  }
  return path.resolve(process.cwd(), "storage", "scheduled-dispatch-media");
}

function normalizePathToken(value: string) {
  return sanitizeFilename(value).replace(/\s+/g, "_");
}

export function buildScheduledDispatchMediaStoragePath(input: { instanceId: string; mediaId: string; fileName: string }) {
  const safeInstanceId = normalizePathToken(input.instanceId);
  const safeMediaId = normalizePathToken(input.mediaId);
  const safeFileName = normalizePathToken(input.fileName);
  return path.join(safeInstanceId, `${safeMediaId}--${safeFileName}`);
}

export function buildScheduledDispatchMediaUrl(input: { instanceId: string; mediaId: string; fileName: string }) {
  return `/api/scheduled-dispatches/media/${encodeURIComponent(normalizePathToken(input.instanceId))}/${encodeURIComponent(normalizePathToken(input.mediaId))}/${encodeURIComponent(normalizePathToken(input.fileName))}`;
}

export function resolveScheduledDispatchMediaStoragePath(storagePath: string) {
  const root = getScheduledDispatchMediaRoot();
  const absolute = path.resolve(root, storagePath);
  const normalizedRoot = `${root}${path.sep}`;
  if (absolute !== root && !absolute.startsWith(normalizedRoot)) {
    throw new Error("scheduled dispatch media storagePath fora do diretorio permitido");
  }
  return absolute;
}

export function resolveScheduledDispatchMediaKind(contentType: "image" | "video"): ScheduledDispatchMediaKind {
  return contentType === "video" ? "VIDEO" : "IMAGE";
}

function toChatMediaKind(kind: ScheduledDispatchMediaKind): ChatMediaKind {
  return kind;
}

export function inferScheduledDispatchMediaMimeType(fileName: string, fallbackMimeType: string | null, kind: ScheduledDispatchMediaKind) {
  const lowerMime = fallbackMimeType?.toLowerCase() ?? "";
  if (lowerMime && lowerMime !== "application/octet-stream") return fallbackMimeType;

  const lowerName = fileName.toLowerCase();
  if (kind === "IMAGE") {
    if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
    if (lowerName.endsWith(".webp")) return "image/webp";
    if (lowerName.endsWith(".gif")) return "image/gif";
    if (lowerName.endsWith(".heic")) return "image/heic";
    if (lowerName.endsWith(".heif")) return "image/heif";
    return "image/png";
  }

  if (lowerName.endsWith(".mov")) return "video/quicktime";
  if (lowerName.endsWith(".webm")) return "video/webm";
  if (lowerName.endsWith(".3gp")) return "video/3gpp";
  return "video/mp4";
}

export async function writeScheduledDispatchMedia(input: {
  instanceId: string;
  mediaId: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
  kind: ScheduledDispatchMediaKind;
}) {
  validateChatMedia({
    messageType: toChatMediaKind(input.kind),
    mimeType: input.mimeType,
    sizeBytes: input.buffer.length,
  });

  const storagePath = buildScheduledDispatchMediaStoragePath(input);
  const absolute = resolveScheduledDispatchMediaStoragePath(storagePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, input.buffer);

  return {
    storagePath,
    mediaUrl: buildScheduledDispatchMediaUrl(input),
  };
}

export async function readScheduledDispatchMedia(input: { instanceId: string; mediaId: string; fileName: string }) {
  const storagePath = buildScheduledDispatchMediaStoragePath(input);
  const buffer = await fs.readFile(resolveScheduledDispatchMediaStoragePath(storagePath));
  const kind = resolveScheduledDispatchMediaKind(/\.(mp4|m4v|mov|webm|3gp)$/i.test(input.fileName) ? "video" : "image");
  return {
    buffer,
    mimeType: inferScheduledDispatchMediaMimeType(input.fileName, null, kind),
    fileName: normalizePathToken(input.fileName),
  };
}

export function parseScheduledDispatchMediaUrl(mediaUrl: string) {
  const pathname = mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")
    ? new URL(mediaUrl).pathname
    : mediaUrl;
  const match = pathname.match(/^\/api\/scheduled-dispatches\/media\/([^/]+)\/([^/]+)\/([^/]+)$/i);
  if (!match) return null;
  return {
    instanceId: decodeURIComponent(match[1]),
    mediaId: decodeURIComponent(match[2]),
    fileName: decodeURIComponent(match[3]),
  };
}

export function isScheduledDispatchMediaUrl(mediaUrl: string) {
  return parseScheduledDispatchMediaUrl(mediaUrl) !== null;
}
