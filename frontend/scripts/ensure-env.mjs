import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.join(__dirname, "..");

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
const resolved = fromEnv || fromProd;

if (!resolved) {
  console.warn(
    "VITE_API_URL nao definido; build usara fallback relativo /api para operar atras do Nginx/Docker."
  );
} else {
  console.log("Env check OK (VITE_API_URL definido).");
}
