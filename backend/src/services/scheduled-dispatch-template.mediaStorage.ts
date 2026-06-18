import fs from "node:fs/promises";
import path from "node:path";
import { sanitizeFilename } from "./fileSecurity.service";
import { validateChatMedia, type ChatMediaKind } from "./chat.mediaStorage";

export type ScheduledDispatchTemplateMediaKind = "IMAGE" | "VIDEO";

function getScheduledDispatchTemplateMediaRoot() {
  const configured = process.env.SCHEDULED_DISPATCH_TEMPLATE_MEDIA_STORAGE_ROOT?.trim();
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
  }
  return path.resolve(process.cwd(), "storage", "scheduled-dispatch-template-media");
}

function normalizePathToken(value: string) {
  return sanitizeFilename(value).replace(/\s+/g, "_");
}

function toChatMediaKind(kind: ScheduledDispatchTemplateMediaKind): ChatMediaKind {
  return kind;
}

export function buildScheduledDispatchTemplateMediaStoragePath(input: { mediaId: string; fileName: string }) {
  const safeMediaId = normalizePathToken(input.mediaId);
  const safeFileName = normalizePathToken(input.fileName);
  return path.join(safeMediaId, safeFileName);
}

export function buildScheduledDispatchTemplateMediaUrl(input: { mediaId: string; fileName: string }) {
  return `/api/scheduled-dispatch-templates/media/${encodeURIComponent(normalizePathToken(input.mediaId))}/${encodeURIComponent(normalizePathToken(input.fileName))}`;
}

export function resolveScheduledDispatchTemplateMediaStoragePath(storagePath: string) {
  const root = getScheduledDispatchTemplateMediaRoot();
  const absolute = path.resolve(root, storagePath);
  const normalizedRoot = `${root}${path.sep}`;
  if (absolute !== root && !absolute.startsWith(normalizedRoot)) {
    throw new Error("scheduled dispatch template media storagePath fora do diretorio permitido");
  }
  return absolute;
}

export function resolveScheduledDispatchTemplateMediaKind(contentType: "image" | "video"): ScheduledDispatchTemplateMediaKind {
  return contentType === "video" ? "VIDEO" : "IMAGE";
}

export function inferScheduledDispatchTemplateMediaMimeType(fileName: string, fallbackMimeType: string | null, kind: ScheduledDispatchTemplateMediaKind) {
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

export async function writeScheduledDispatchTemplateMedia(input: {
  mediaId: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
  kind: ScheduledDispatchTemplateMediaKind;
}) {
  validateChatMedia({
    messageType: toChatMediaKind(input.kind),
    mimeType: input.mimeType,
    sizeBytes: input.buffer.length,
  });

  const storagePath = buildScheduledDispatchTemplateMediaStoragePath(input);
  const absolute = resolveScheduledDispatchTemplateMediaStoragePath(storagePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, input.buffer);

  return {
    storagePath,
    mediaUrl: buildScheduledDispatchTemplateMediaUrl(input),
  };
}

export async function readScheduledDispatchTemplateMedia(input: { mediaId: string; fileName: string }) {
  const storagePath = buildScheduledDispatchTemplateMediaStoragePath(input);
  const buffer = await fs.readFile(resolveScheduledDispatchTemplateMediaStoragePath(storagePath));
  const kind = resolveScheduledDispatchTemplateMediaKind(/\.(mp4|m4v|mov|webm|3gp)$/i.test(input.fileName) ? "video" : "image");
  return {
    buffer,
    mimeType: inferScheduledDispatchTemplateMediaMimeType(input.fileName, null, kind),
    fileName: normalizePathToken(input.fileName),
  };
}

export function parseScheduledDispatchTemplateMediaUrl(mediaUrl: string) {
  const pathname = mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")
    ? new URL(mediaUrl).pathname
    : mediaUrl;
  const match = pathname.match(/^\/api\/scheduled-dispatch-templates\/media\/([^/]+)\/([^/]+)$/i);
  if (!match) return null;
  return {
    mediaId: decodeURIComponent(match[1]),
    fileName: decodeURIComponent(match[2]),
  };
}

export function isScheduledDispatchTemplateMediaUrl(mediaUrl: string) {
  return parseScheduledDispatchTemplateMediaUrl(mediaUrl) !== null;
}
