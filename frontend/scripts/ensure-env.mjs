import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.join(__dirname, "..");
const backendEnvPath = path.join(frontendRoot, "..", "backend", ".env");

function readEnvValue(filePath, key) {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(new RegExp(`^${key}\\s*=\\s*(.+)$`));
    if (!m) continue;
    let v = m[1].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    return v.trim() || null;
  }
  return null;
}

/** Porta da API local: override explícito > PORT em backend/.env > 3000 */
function resolveLocalApiPort() {
  const fromShell = process.env.VITE_LOCAL_API_PORT?.trim();
  if (fromShell && /^\d+$/.test(fromShell)) return fromShell;
  const portFromBackend = readEnvValue(backendEnvPath, "PORT");
  if (portFromBackend && /^\d+$/.test(portFromBackend)) return portFromBackend;
  return "3000";
}

function readViteApiUrl(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^VITE_API_URL\s*=\s*(.+)$/);
    if (!m) continue;
    let v = m[1].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (v) return v;
  }
  return null;
}

const fromEnv = process.env.VITE_API_URL?.trim();
const fromProd = readViteApiUrl(path.join(frontendRoot, ".env.production"));
const fromLocal = readViteApiUrl(path.join(frontendRoot, ".env.production.local"));
const resolved = fromEnv || fromProd || fromLocal;

const isCi = process.env.CI === "true";
const localPort = resolveLocalApiPort();
const defaultLocal = `http://127.0.0.1:${localPort}/api`;

if (!resolved) {
  if (isCi) {
    console.error(
      "Erro: VITE_API_URL é obrigatório no build (CI). Defina a variável ou crie frontend/.env.production."
    );
    process.exit(1);
  }
  const target = path.join(frontendRoot, ".env.production.local");
  fs.writeFileSync(target, `VITE_API_URL=${defaultLocal}\n`, "utf8");
  console.warn(
    `VITE_API_URL não definido: criado ${path.relative(frontendRoot, target)} com ${defaultLocal} (porta: ${localPort} — lida de backend/.env PORT ou VITE_LOCAL_API_PORT; padrão 3000). Na VPS use install-vps.sh ou defina VITE_API_URL.`
  );
} else {
  console.log("Env check OK (VITE_API_URL definido).");
}
