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
const os = require("os");
const path = require("path");
const { buildServer } = require("../src/server");
const { buildAllowedOrigins, createOriginGuard } = require("../src/security/middlewares");

const originalAdminPassword = process.env.ADMIN_PASSWORD;
const tempEnvDir = fs.mkdtempSync(path.join(os.tmpdir(), "nexuszap-security-"));
process.env.NEXUS_ENV_FILE = path.join(tempEnvDir, ".env");
fs.writeFileSync(process.env.NEXUS_ENV_FILE, `ADMIN_EMAIL="${process.env.ADMIN_EMAIL}"\nADMIN_PASSWORD="${process.env.ADMIN_PASSWORD}"\nADMIN_SETUP_REQUIRED="false"\n`, { mode: 0o600 });

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

async function login(app, email = process.env.ADMIN_EMAIL, password = process.env.ADMIN_PASSWORD) {
  return app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password }
  });
}

(async () => {
  const app = await buildServer();
  try {
    await app.ready();

    const okLogin = await login(app);
    assert.equal(okLogin.statusCode, 200, okLogin.body);
    const setCookie = okLogin.headers["set-cookie"];
    const csrfToken = getCookieValue(setCookie, "csrfToken");
    assert.ok(getCookieValue(setCookie, "token"), "login deve setar cookie de sessao");
    assert.ok(csrfToken, "login deve setar cookie CSRF legivel pelo browser");
    assert.equal(JSON.parse(okLogin.body).csrfToken, csrfToken, "body e cookie CSRF devem coincidir");

    const cookies = cookieHeader(setCookie);

    const noCsrfLogout = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { cookie: cookies }
    });
    assert.equal(noCsrfLogout.statusCode, 403, noCsrfLogout.body);

    const validLogout = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: {
        cookie: cookies,
        "x-csrf-token": csrfToken
      }
    });
    assert.equal(validLogout.statusCode, 200, validLogout.body);

    const unchangedPassword = process.env.ADMIN_PASSWORD;
    const noSessionChange = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      payload: {
        currentPassword: unchangedPassword,
        newPassword: "ChangedPassword1!",
        confirmPassword: "ChangedPassword1!"
      }
    });
    assert.equal(noSessionChange.statusCode, 401, noSessionChange.body);
    assert.equal(process.env.ADMIN_PASSWORD, unchangedPassword, "rota sem sessao nao deve alterar senha");

    const passwordLogin = await login(app);
    assert.equal(passwordLogin.statusCode, 200, passwordLogin.body);
    const passwordCookies = cookieHeader(passwordLogin.headers["set-cookie"]);
    const passwordCsrfToken = getCookieValue(passwordLogin.headers["set-cookie"], "csrfToken");
    assert.ok(passwordCsrfToken, "login para troca de senha deve retornar CSRF");

    const missingCsrfChange = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      headers: { cookie: passwordCookies },
      payload: {
        currentPassword: unchangedPassword,
        newPassword: "ChangedPassword1!",
        confirmPassword: "ChangedPassword1!"
      }
    });
    assert.equal(missingCsrfChange.statusCode, 403, missingCsrfChange.body);
    assert.equal(process.env.ADMIN_PASSWORD, unchangedPassword, "rota sem CSRF nao deve alterar senha");

    const wrongCurrentChange = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      headers: { cookie: passwordCookies, "x-csrf-token": passwordCsrfToken },
      payload: {
        currentPassword: "wrong-current-password",
        newPassword: "ChangedPassword1!",
        confirmPassword: "ChangedPassword1!"
      }
    });
    assert.equal(wrongCurrentChange.statusCode, 401, wrongCurrentChange.body);

    const weakChange = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      headers: { cookie: passwordCookies, "x-csrf-token": passwordCsrfToken },
      payload: {
        currentPassword: unchangedPassword,
        newPassword: "weak-password",
        confirmPassword: "weak-password"
      }
    });
    assert.equal(weakChange.statusCode, 400, weakChange.body);

    const mismatchChange = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      headers: { cookie: passwordCookies, "x-csrf-token": passwordCsrfToken },
      payload: {
        currentPassword: unchangedPassword,
        newPassword: "ChangedPassword1!",
        confirmPassword: "ChangedPassword2!"
      }
    });
    assert.equal(mismatchChange.statusCode, 400, mismatchChange.body);

    const samePasswordChange = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      headers: { cookie: passwordCookies, "x-csrf-token": passwordCsrfToken },
      payload: {
        currentPassword: unchangedPassword,
        newPassword: unchangedPassword,
        confirmPassword: unchangedPassword
      }
    });
    assert.equal(samePasswordChange.statusCode, 400, samePasswordChange.body);

    const changedPassword = "ChangedPassword1!";
    const validChange = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      headers: { cookie: passwordCookies, "x-csrf-token": passwordCsrfToken },
      payload: {
        currentPassword: unchangedPassword,
        newPassword: changedPassword,
        confirmPassword: changedPassword
      }
    });
    assert.equal(validChange.statusCode, 200, validChange.body);
    assert.equal(process.env.ADMIN_PASSWORD, changedPassword, "troca valida deve atualizar ADMIN_PASSWORD em runtime");
    assert.match(fs.readFileSync(process.env.NEXUS_ENV_FILE, "utf8"), /ADMIN_PASSWORD="ChangedPassword1!"/, "troca valida deve persistir no env temporario");
    const clearedCookies = validChange.headers["set-cookie"];
    assert.ok(String(clearedCookies).includes("token="), "troca valida deve limpar cookie de sessao");
    assert.ok(String(clearedCookies).includes("csrfToken="), "troca valida deve limpar cookie CSRF");

    const oldPasswordLogin = await login(app, process.env.ADMIN_EMAIL, unchangedPassword);
    assert.equal(oldPasswordLogin.statusCode, 401, oldPasswordLogin.body);
    const newPasswordLogin = await login(app, process.env.ADMIN_EMAIL, changedPassword);
    assert.equal(newPasswordLogin.statusCode, 200, newPasswordLogin.body);

    const attempts = [];
    for (let i = 0; i < 11; i++) {
      attempts.push(await login(app, "admin@example.com", `wrong-${i}`));
    }
    assert.equal(attempts.at(-1).statusCode, 429, "login deve limitar brute force por IP");

    const originGuard = createOriginGuard(
      buildAllowedOrigins(["https://app.example.com"], "production"),
      "production"
    );
    async function runOriginGuard(url, headers) {
      let status = "not-called";
      await originGuard(
        { method: "POST", url, headers },
        {
          status(code) {
            status = code;
            return this;
          },
          send(payload) {
            return payload;
          }
        }
      );
      return status;
    }

    assert.equal(
      await runOriginGuard("/api/agent/start", { origin: "https://evil.example.com", host: "api.example.com" }),
      403,
      "origem fora da allowlist deve ser rejeitada em producao"
    );
    assert.equal(
      await runOriginGuard("/api/auth/login", { origin: "https://evil.example.com", host: "api.example.com" }),
      403,
      "login tambem deve validar origem invalida em producao"
    );
    assert.equal(
      await runOriginGuard("/api/auth/login", { host: "api.example.com" }),
      403,
      "login tambem deve rejeitar origem ausente em producao"
    );

    console.log("security-api: OK");
  } finally {
    await app.close();
    process.env.ADMIN_PASSWORD = originalAdminPassword;
    fs.rmSync(tempEnvDir, { recursive: true, force: true });
  }
})().catch((err) => {
  console.error("security-api:", err);
  process.exit(1);
});
