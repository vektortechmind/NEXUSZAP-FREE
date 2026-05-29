import fs from "node:fs/promises";
import path from "node:path";
import { sanitizeFilename } from "../fileSecurity.service";

type KnowledgeChannel = "WHATSAPP" | "TELEGRAM";

function getStorageRoot() {
  const configured = process.env.FILE_STORAGE_ROOT?.trim();
  if (!configured) {
    return path.resolve(process.cwd(), "storage", "knowledge");
  }
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(process.cwd(), configured);
}

function toRelativeStoragePath(parts: string[]) {
  return parts.join("/");
}

export function buildKnowledgeStoragePath(input: {
  instanceId: string;
  channel: KnowledgeChannel;
  fileId: string;
  filename: string;
}) {
  const safeFilename = sanitizeFilename(input.filename);
  return toRelativeStoragePath([
    input.channel.toLowerCase(),
    input.instanceId,
    `${input.fileId}-${safeFilename}`,
  ]);
}

export function resolveKnowledgeStoragePath(storagePath: string) {
  const root = getStorageRoot();
  const absolute = path.resolve(root, storagePath);
  const normalizedRoot = `${root}${path.sep}`;
  if (absolute !== root && !absolute.startsWith(normalizedRoot)) {
    throw new Error("storagePath fora do diretório permitido");
  }
  return absolute;
}

export async function writeKnowledgeBinary(storagePath: string, buffer: Buffer) {
  const absolute = resolveKnowledgeStoragePath(storagePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, buffer);
  return absolute;
}

export async function readKnowledgeBinary(storagePath: string) {
  const absolute = resolveKnowledgeStoragePath(storagePath);
  return fs.readFile(absolute);
}

export async function deleteKnowledgeBinary(storagePath: string | null | undefined) {
  if (!storagePath) return false;
  try {
    await fs.unlink(resolveKnowledgeStoragePath(storagePath));
    return true;
  } catch (err: any) {
    if (err?.code === "ENOENT") return false;
    throw err;
  }
}

export async function storagePathExists(storagePath: string | null | undefined) {
  if (!storagePath) return false;
  try {
    await fs.access(resolveKnowledgeStoragePath(storagePath));
    return true;
  } catch {
    return false;
  }
}

export function getKnowledgeStorageDiagnostics() {
  return {
    root: getStorageRoot(),
  };
}
