import fs from "fs";
import path from "path";

type EnvUpdates = Record<string, string>;

const DEFAULT_ADMIN_EMAIL = "admin@nexuszap.com";

function resolveEnvPath(): string {
  const candidates = [
    process.env.NEXUS_ENV_FILE,
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), "backend", ".env")
  ].filter(Boolean) as string[];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

function quoteEnvValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/\"/g, '\\"').replace(/\$/g, "\\$").replace(/`/g, "\\`")}"`;
}

function parseEnvLine(line: string): { key: string; value: string } | null {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!match) return null;
  const raw = match[2].trim();
  const value = raw.replace(/^['\"]|['\"]$/g, "");
  return { key: match[1], value };
}

function readEnvFile(): string[] {
  const envPath = resolveEnvPath();
  if (!fs.existsSync(envPath)) return [];
  return fs.readFileSync(envPath, "utf8").split(/\r?\n/);
}

export function readEnvValue(key: string): string | undefined {
  if (process.env[key] !== undefined) return process.env[key];
  for (const line of readEnvFile()) {
    const parsed = parseEnvLine(line);
    if (parsed?.key === key) return parsed.value;
  }
  return undefined;
}

export function updateEnvFile(updates: EnvUpdates): void {
  const envPath = resolveEnvPath();
  const dir = path.dirname(envPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const lines = readEnvFile();
  const seen = new Set<string>();
  const next = lines.map((line) => {
    const parsed = parseEnvLine(line);
    if (!parsed || !(parsed.key in updates)) return line;
    seen.add(parsed.key);
    return `${parsed.key}=${quoteEnvValue(updates[parsed.key])}`;
  });

  for (const [key, value] of Object.entries(updates)) {
    process.env[key] = value;
    if (!seen.has(key)) next.push(`${key}=${quoteEnvValue(value)}`);
  }

  fs.writeFileSync(envPath, `${next.filter((line, index) => line.length > 0 || index < next.length - 1).join("\n")}\n`, {
    mode: 0o600
  });
}

export function getSetupToken(): string | undefined {
  return readEnvValue("SETUP_TOKEN") || process.env.SETUP_TOKEN;
}

export function isSetupTokenValid(token: string | undefined): boolean {
  const expected = getSetupToken();
  return Boolean(expected && token && token === expected);
}

export function isAdminSetupRequired(): boolean {
  const explicit = readEnvValue("ADMIN_SETUP_REQUIRED") ?? process.env.ADMIN_SETUP_REQUIRED;
  if (explicit !== undefined) return explicit !== "false";
  return (readEnvValue("ADMIN_EMAIL") ?? process.env.ADMIN_EMAIL) === DEFAULT_ADMIN_EMAIL;
}

export function getAdminCredentials() {
  return {
    email: readEnvValue("ADMIN_EMAIL") ?? process.env.ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL,
    password: readEnvValue("ADMIN_PASSWORD") ?? process.env.ADMIN_PASSWORD ?? ""
  };
}

export function getSetupStatus() {
  const appUrl = readEnvValue("APP_URL") ?? process.env.APP_URL ?? null;
  return {
    appUrl,
    dockerConfigured: Boolean(appUrl),
    adminSetupRequired: isAdminSetupRequired(),
    setupTokenRequired: Boolean(getSetupToken())
  };
}

export function normalizePublicUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, "");
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  if (!url.hostname || url.hostname === "localhost") {
    throw new Error("Informe um domínio público ou IP acessível externamente.");
  }
  return url.origin;
}

export function mergeCorsOrigins(current: string | undefined, origin: string): string {
  const values = new Set(
    (current ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
  values.add(origin);
  return Array.from(values).join(",");
}
