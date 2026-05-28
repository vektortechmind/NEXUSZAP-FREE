"use strict";

/**
 * Teste rápido: GET /api/ping.
 * Por padrão usa fastify.inject para validar este app sem depender de servidor externo.
 * Override: SMOKE_URL=http://127.0.0.1:3000/api/ping
 */
const http = require("http");
const https = require("https");
const { URL } = require("url");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const port = process.env.SMOKE_PORT || process.env.PORT || "3000";
const defaultUrl = `http://127.0.0.1:${port}/api/ping`;
const target = process.env.SMOKE_URL || defaultUrl;

async function injectPing() {
  process.env.NODE_ENV = process.env.NODE_ENV || "test";
  process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb?schema=public";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-with-more-than-32-characters";
  process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
  process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "local-test-password";
  require("ts-node/register");
  const { buildServer } = require("../src/server");
  const app = await buildServer();
  try {
    await app.ready();
    return app.inject({ method: "GET", url: "/api/ping" });
  } finally {
    await app.close();
  }
}

function get(urlString) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlString);
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.get(
      urlString,
      { timeout: 8000 },
      (res) => {
        let body = "";
        res.on("data", (c) => {
          body += c;
        });
        res.on("end", () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

(async () => {
  try {
    const result = process.env.SMOKE_URL
      ? await get(target)
      : await injectPing().then((res) => ({ status: res.statusCode, body: res.body }));
    const { status, body } = result;
    if (status !== 200) {
      console.error(`smoke-api: HTTP ${status} em ${target}`);
      process.exit(1);
    }
    const json = JSON.parse(body);
    if (json.pong !== true) {
      console.error(`smoke-api: resposta inesperada de ${target}. Esperado { pong: true }; recebido:`, json);
      process.exit(1);
    }
    console.log(`smoke-api: OK ${target}`);
  } catch (e) {
    console.error("smoke-api:", e.message || e);
    process.exit(1);
  }
})();
