"use strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-with-more-than-32-characters";
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "local-test-password";
process.env.PORT = process.env.PORT || "0";

require("ts-node/register");

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { buildServer } = require("../src/server");

function cookieHeader(setCookie) {
  const values = Array.isArray(setCookie) ? setCookie : [setCookie];
  return values.map((v) => String(v).split(";")[0]).join("; ");
}

function getCookieValue(setCookie, name) {
  const values = Array.isArray(setCookie) ? setCookie : [setCookie];
  const found = values.find((v) => String(v).startsWith(`${name}=`));
  if (!found) return undefined;
  return String(found).split(";")[0].slice(name.length + 1);
}

function assertSourceDoesNotContain(filePath, forbidden) {
  const content = fs.readFileSync(filePath, "utf8");
  for (const value of forbidden) {
    assert.ok(!content.includes(value), `${path.basename(filePath)} nao deve conter ${value}`);
  }
}

(async () => {
  const backendRoot = path.resolve(__dirname, "..");
  const frontendRoot = path.resolve(backendRoot, "..", "frontend");

  assertSourceDoesNotContain(path.join(frontendRoot, "src", "components", "UpdateSection.tsx"), [
    'api.post<{ success: boolean; message: string }>("/update/apply"',
    'api.post("/update/apply"',
    "applyUpdate",
    "Atualizar\n",
  ]);

  assertSourceDoesNotContain(path.join(backendRoot, "src", "services", "update.service.ts"), [
    "export async function applyUpdate",
    "downloadZipball",
    "extractZip",
    "moveContents",
    "restoreBackup",
    "createWriteStream",
    "unzipper",
    "fs.rmSync",
    "fs.renameSync",
    "fs.copyFileSync",
    "fs.unlinkSync",
  ]);

  const routeSource = fs.readFileSync(path.join(backendRoot, "src", "routes", "update.routes.ts"), "utf8");
  assert.ok(routeSource.includes("reply.status(410)"), "rota apply deve retornar 410 Gone");
  assert.ok(!routeSource.includes("applyUpdate"), "rota nao deve importar/chamar applyUpdate");

  const app = await buildServer();
  try {
    await app.ready();

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
    });
    assert.equal(login.statusCode, 200, login.body);
    const setCookie = login.headers["set-cookie"];
    const csrfToken = getCookieValue(setCookie, "csrfToken");
    assert.ok(csrfToken, "login deve retornar token CSRF");

    const apply = await app.inject({
      method: "POST",
      url: "/api/update/apply",
      headers: {
        cookie: cookieHeader(setCookie),
        "x-csrf-token": csrfToken,
      },
      payload: { version: "v9.9.9" },
    });

    assert.equal(apply.statusCode, 410, apply.body);
    const body = JSON.parse(apply.body);
    assert.equal(body.success, false);
    assert.match(body.error, /desativado por seguranca/i);

    console.log("update-disabled: OK");
  } finally {
    await app.close();
  }
})().catch((err) => {
  console.error("update-disabled:", err);
  process.exit(1);
});
