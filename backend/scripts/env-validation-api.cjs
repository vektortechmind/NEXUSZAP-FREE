"use strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-with-more-than-32-characters";
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "local-test-password";
process.env.PORT = process.env.PORT || "0";
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || Buffer.alloc(32, 7).toString("base64");

require("ts-node/register");

const assert = require("assert");
const { parseRuntimeEnv, DIRECT_ENV_READ_JUSTIFICATIONS } = require("../src/config/env.ts");

const validProductionEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://nexus:secret@db.example.com:5432/nexus",
  JWT_SECRET: "production-jwt-secret-with-more-than-32-chars",
  ADMIN_EMAIL: "admin@example.com",
  ADMIN_PASSWORD: "StrongPassword1!",
  APP_URL: "https://app.example.com",
  GITHUB_REPO: "acme/nexuszap",
  ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
};

{
  assert.equal(parseRuntimeEnv(validProductionEnv).DATABASE_URL, validProductionEnv.DATABASE_URL);
  assert.equal(parseRuntimeEnv(validProductionEnv).OPENROUTER_REFERER, "http://localhost:5173");
}

{
  assert.throws(
    () => parseRuntimeEnv({ ...validProductionEnv, DATABASE_URL: "not-a-url" }),
    /DATABASE_URL/,
    "DATABASE_URL invalido deve falhar na validacao central",
  );
}

{
  assert.throws(
    () => parseRuntimeEnv({ ...validProductionEnv, ENCRYPTION_KEY: Buffer.alloc(16, 1).toString("base64") }),
    /ENCRYPTION_KEY/,
    "ENCRYPTION_KEY de producao deve exigir 32 bytes base64",
  );
}

{
  assert.throws(
    () => parseRuntimeEnv({ ...validProductionEnv, GITHUB_REPO: "owner-repo" }),
    /GITHUB_REPO/,
    "GITHUB_REPO de producao deve exigir formato owner\/repo",
  );
}

assert.ok(DIRECT_ENV_READ_JUSTIFICATIONS.setupService);
assert.ok(DIRECT_ENV_READ_JUSTIFICATIONS.updateServicePaths);
assert.ok(DIRECT_ENV_READ_JUSTIFICATIONS.scripts);

console.log("env-validation-api: OK");
