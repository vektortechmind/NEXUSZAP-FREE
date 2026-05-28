"use strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-with-more-than-32-characters";
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "local-test-password";
process.env.PORT = process.env.PORT || "0";

require("ts-node/register");

const assert = require("assert");
const { buildServer } = require("../src/server");
const { buildAllowedOrigins, createOriginGuard } = require("../src/security/middlewares");

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
  }
})().catch((err) => {
  console.error("security-api:", err);
  process.exit(1);
});
