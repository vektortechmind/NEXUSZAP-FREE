process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-with-more-than-32-characters";
process.env.ADMIN_EMAIL = "admin@nexuszap.com";
process.env.ADMIN_PASSWORD = "TempPassword1!";
process.env.ADMIN_SETUP_REQUIRED = "true";
process.env.SETUP_TOKEN = "test-setup-token-with-enough-length";
process.env.PORT = process.env.PORT || "0";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-setup-"));
const envPath = path.join(tempDir, ".env");
process.env.NEXUS_ENV_FILE = envPath;

fs.writeFileSync(envPath, [
  'NODE_ENV="test"',
  'DATABASE_URL="postgresql://user:pass@localhost:5432/testdb?schema=public"',
  'JWT_SECRET="test-secret-with-more-than-32-characters"',
  'ADMIN_EMAIL="admin@nexuszap.com"',
  'ADMIN_PASSWORD="TempPassword1!"',
  'ADMIN_SETUP_REQUIRED="true"',
  'SETUP_TOKEN="test-setup-token-with-enough-length"',
  'CORS_ORIGINS="http://localhost"',
  ''
].join("\n"));

require("ts-node/register");

const { buildServer } = require("../src/server");

(async () => {
  const app = await buildServer();
  await app.ready();

  const forbidden = await app.inject({ method: "POST", url: "/api/setup/docker", payload: { apiDomain: "api.example.com" } });
  assert.equal(forbidden.statusCode, 403);

  const docker = await app.inject({
    method: "POST",
    url: "/api/setup/docker",
    payload: { apiDomain: "api.example.com", panelDomain: "app.example.com", token: "test-setup-token-with-enough-length" }
  });
  assert.equal(docker.statusCode, 200, docker.body);
  const envContent = fs.readFileSync(envPath, "utf8");
  assert.ok(envContent.includes('APP_URL="https://api.example.com"'));
  assert.ok(envContent.includes('OPENROUTER_REFERER="https://app.example.com"'));
  assert.ok(envContent.includes('CORS_ORIGINS="http://localhost,https://app.example.com"'));
  assert.equal(JSON.parse(docker.body).nextUrl, "https://app.example.com/criar-admin?token=test-setup-token-with-enough-length");

  const admin = await app.inject({
    method: "POST",
    url: "/api/setup/admin",
    payload: {
      email: "owner@example.com",
      password: "StrongPassword1!",
      confirmPassword: "StrongPassword1!",
      token: "test-setup-token-with-enough-length"
    }
  });
  assert.equal(admin.statusCode, 200, admin.body);

  const secondAdmin = await app.inject({
    method: "POST",
    url: "/api/setup/admin",
    payload: {
      email: "owner2@example.com",
      password: "StrongPassword1!",
      confirmPassword: "StrongPassword1!",
      token: "test-setup-token-with-enough-length"
    }
  });
  assert.equal(secondAdmin.statusCode, 409);

  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "owner@example.com", password: "StrongPassword1!" }
  });
  assert.equal(login.statusCode, 200, login.body);

  await app.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log("setup-api: OK");
})().catch((error) => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  console.error("setup-api:", error);
  process.exit(1);
});
