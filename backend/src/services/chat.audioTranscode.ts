import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ChatMediaStorageValidationError } from "./chat.mediaStorage";

const OGG_OPUS_MIME_TYPE = "audio/ogg; codecs=opus";

function extensionForMimeType(mimeType: string) {
  const lower = mimeType.toLowerCase();
  if (lower.includes("webm")) return ".webm";
  if (lower.includes("ogg") || lower.includes("opus")) return ".ogg";
  if (lower.includes("wav")) return ".wav";
  if (lower.includes("mpeg") || lower.includes("mp3")) return ".mp3";
  if (lower.includes("mp4") || lower.includes("aac")) return ".m4a";
  return ".audio";
}

function runFfmpeg(args: string[]) {
  const binary = process.env.FFMPEG_PATH?.trim() || "ffmpeg";
  return new Promise<void>((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "ignore", "pipe"] });
    const stderr: Buffer[] = [];
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(Buffer.concat(stderr).toString("utf8") || `ffmpeg saiu com codigo ${code}`));
    });
  });
}

export async function transcodeAudioToOggOpus(input: { buffer: Buffer; mimeType: string }) {
  const token = randomUUID();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-chat-audio-"));
  const source = path.join(root, `source-${token}${extensionForMimeType(input.mimeType)}`);
  const output = path.join(root, `voice-${token}.ogg`);

  try {
    await fs.writeFile(source, input.buffer);
    await runFfmpeg([
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-i", source,
      "-vn",
      "-ac", "1",
      "-ar", "48000",
      "-c:a", "libopus",
      "-b:a", "32k",
      "-application", "voip",
      "-f", "ogg",
      output,
    ]);
    return { buffer: await fs.readFile(output), mimeType: OGG_OPUS_MIME_TYPE };
  } catch (err) {
    throw new ChatMediaStorageValidationError(
      err instanceof Error && err.message.includes("ENOENT")
        ? "ffmpeg nao esta disponivel para processar audio."
        : "Nao foi possivel processar a gravacao de audio.",
      422,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true }).catch(() => undefined);
  }
}
