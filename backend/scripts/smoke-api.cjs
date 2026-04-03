"use strict";

/**
 * Teste rápido: GET /api/ping no backend local (servidor precisa estar no ar).
 * Override: SMOKE_URL=http://127.0.0.1:3000/api/ping
 */
const http = require("http");
const https = require("https");
const { URL } = require("url");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const port = process.env.PORT || "3000";
const defaultUrl = `http://127.0.0.1:${port}/api/ping`;
const target = process.env.SMOKE_URL || defaultUrl;

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
    const { status, body } = await get(target);
    if (status !== 200) {
      console.error(`smoke-api: HTTP ${status} em ${target}`);
      process.exit(1);
    }
    const json = JSON.parse(body);
    if (!json.pong) {
      console.error("smoke-api: resposta inesperada", json);
      process.exit(1);
    }
    console.log(`smoke-api: OK ${target}`);
  } catch (e) {
    console.error("smoke-api:", e.message || e);
    process.exit(1);
  }
})();
