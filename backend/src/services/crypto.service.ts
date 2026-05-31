import * as fs from "fs";
import * as path from "path";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { env } from "../config/env";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_FILE = path.join(__dirname, "../../.encryption_key");

function getOrCreateKey(): Buffer {
  if (fs.existsSync(KEY_FILE)) {
    const storedKey = fs.readFileSync(KEY_FILE, "utf8").trim();
    const key = Buffer.from(storedKey, "base64");
    if (key.length === KEY_LENGTH) {
      return key;
    }
  }

  const newKey = randomBytes(KEY_LENGTH);
  fs.writeFileSync(KEY_FILE, newKey.toString("base64"), { mode: 0o600 });
  return newKey;
}

function getKey(): Buffer {
  const envKey = env.ENCRYPTION_KEY;
  if (envKey) {
    const key = Buffer.from(envKey, "base64");
    if (key.length === KEY_LENGTH) {
      return key;
    }
  }
  if (env.NODE_ENV === "production") {
    throw new Error("ENCRYPTION_KEY valida e obrigatoria em producao.");
  }
  return getOrCreateKey();
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptSecret(encrypted: string): string {
  const key = getKey();
  const data = Buffer.from(encrypted, "base64");
  if (data.length <= IV_LENGTH + TAG_LENGTH) {
    throw new Error("Segredo criptografado invalido.");
  }
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encryptedText = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(encryptedText),
    decipher.final(),
  ]).toString("utf8");
}

export function tryDecryptSecret(value: string): string {
  try {
    return decryptSecret(value);
  } catch {
    return value;
  }
}

export function maskSecret(token: string): string {
  if (!token || token.length < 8) return "****";
  return token.slice(0, 4) + "****" + token.slice(-4);
}

export function maskStoredSecret(value: string): string {
  return maskSecret(tryDecryptSecret(value));
}

export function encryptToken(plaintext: string): string {
  return encryptSecret(plaintext);
}

export function decryptToken(encrypted: string): string {
  return decryptSecret(encrypted);
}

export function maskToken(token: string): string {
  return maskSecret(token);
}
