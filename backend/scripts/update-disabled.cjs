"use strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/testdb?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-with-more-than-32-characters";
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "local-test-password";
process.env.PORT = process.env.PORT || "0";
process.env.GITHUB_REPO = process.env.GITHUB_REPO || "vektortechmind/NEXUSZAP-FREE";
process.env.UPDATE_RUNNER_FAKE_RESULT = "success";
process.env.UPDATE_RUNNER_FAKE_DELAY_MS = "300";

require("ts-node/register");

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { buildServer } = require("../src/server");
const { prisma } = require("../src/database/prisma");

const versionFile = path.resolve(__dirname, "..", "VERSION");
const currentVersion = fs.readFileSync(versionFile, "utf8").trim().replace(/^v/, "") || "0.0.0";
const targetVersion = incrementPatch(currentVersion);

const originalFetch = global.fetch;
global.fetch = async (input) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input?.url || "");

  if (url.includes("/releases/latest")) {
    return jsonResponse(200, {
      tag_name: `v${targetVersion}`,
      html_url: "https://github.com/vektortechmind/NEXUSZAP-FREE/releases/tag/v-test",
      body: "Fake changelog for focused update job test.",
    });
  }

  if (url.includes("/contents/backend/VERSION")) {
    return jsonResponse(200, {
      type: "file",
      encoding: "base64",
      content: Buffer.from(`${targetVersion}\n`, "utf8").toString("base64"),
      html_url: "https://github.com/vektortechmind/NEXUSZAP-FREE/blob/main/backend/VERSION",
      path: "backend/VERSION",
    });
  }

  if (url === "https://api.github.com/user") {
    return jsonResponse(200, { login: "test-user" });
  }

  throw new Error(`Unexpected fetch in update-disabled.cjs: ${url}`);
};

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

function incrementPatch(version) {
  const parts = version.split(".").map((value) => Number.parseInt(value, 10) || 0);
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  return parts.slice(0, 3).join(".");
}

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

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

async function waitForJob(app, headers) {
  const timeoutAt = Date.now() + 8000;
  while (Date.now() < timeoutAt) {
    const response = await app.inject({ method: "GET", url: "/api/update/job", headers });
    assert.equal(response.statusCode, 200, response.body);
    const body = JSON.parse(response.body);
    if (body.job && (body.job.status === "success" || body.job.status === "failed")) {
      return body.job;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Timed out while waiting for update job to finish");
}

function cleanupUpdateArtifacts(backendRoot) {
  const updatesDir = path.resolve(backendRoot, "..", "updates");
  fs.rmSync(updatesDir, { recursive: true, force: true });
}

function assertStaticGuards(backendRoot, frontendRoot) {
  const routeSource = readFile(path.join(backendRoot, "src", "routes", "update.routes.ts"));
  const serviceSource = readFile(path.join(backendRoot, "src", "services", "update.service.ts"));
  const runnerSource = readFile(path.join(backendRoot, "scripts", "update-job-runner.cjs"));
  const frontendSource = readFile(path.join(frontendRoot, "src", "components", "UpdateSection.tsx"));

  assert.ok(routeSource.includes("fastify.post("), "rota de apply deve existir");
  assert.ok(routeSource.includes('"/update/apply"'), "rota /update/apply deve existir");
  assert.ok(routeSource.includes("async (_req: FastifyRequest, reply: FastifyReply)"), "rota nao deve depender de payload arbitrario");
  assert.ok(!routeSource.includes("req.body"), "rota nao deve aceitar comando via body");

  assert.ok(serviceSource.includes("OFFICIAL_UPDATE_SCRIPT"), "service deve apontar para script oficial controlado");
  assert.ok(serviceSource.includes("UPDATE_RUNNER_SCRIPT"), "service deve disparar runner controlado");
  assert.ok(serviceSource.includes("detached: true"), "worker deve ser destacado do request");
  assert.ok(serviceSource.includes("child.unref()"), "worker destacado deve usar unref");
  assert.ok(serviceSource.includes("dockerStackRecovered"), "service deve validar saude Docker antes de recuperar sucesso apos restart");
  assert.ok(serviceSource.includes("Consulta de release indisponível durante atualização"), "status deve acompanhar job local se consulta externa/banco falhar durante update");

  assert.ok(runnerSource.includes('path.basename(scriptPath) !== "update.sh"'), "runner deve restringir execucao ao update.sh");
  assert.ok(frontendSource.includes("Atualizar"), "UI deve expor o botao de execucao");
  assert.ok(frontendSource.includes("connectionIssue"), "UI deve representar reconexao durante update");
  assert.ok(frontendSource.includes("Backend reiniciando durante a atualização"), "UI deve explicar indisponibilidade temporaria durante restart");
}

(async () => {
  const backendRoot = path.resolve(__dirname, "..");
  const frontendRoot = path.resolve(backendRoot, "..", "frontend");
  cleanupUpdateArtifacts(backendRoot);
  assertStaticGuards(backendRoot, frontendRoot);
  prisma.settings.findUnique = async () => null;

  const app = await buildServer();
  try {
    await app.ready();

    const unauthorized = await app.inject({ method: "POST", url: "/api/update/apply" });
    assert.equal(unauthorized.statusCode, 403, unauthorized.body);

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
    });
    assert.equal(login.statusCode, 200, login.body);

    const setCookie = login.headers["set-cookie"];
    const csrfToken = getCookieValue(setCookie, "csrfToken");
    assert.ok(csrfToken, "login deve retornar token CSRF");

    const authHeaders = {
      cookie: cookieHeader(setCookie),
      "x-csrf-token": csrfToken,
    };

    const statusBefore = await app.inject({ method: "GET", url: "/api/update/status", headers: authHeaders });
    assert.equal(statusBefore.statusCode, 200, statusBefore.body);
    const statusPayload = JSON.parse(statusBefore.body);
    assert.equal(statusPayload.hasUpdate, true, statusBefore.body);
    assert.equal(statusPayload.job, null, "nao deve existir job antes do disparo");

    const apply = await app.inject({
      method: "POST",
      url: "/api/update/apply",
      headers: authHeaders,
      payload: { command: "rm -rf /", version: "v999.0.0" },
    });
    assert.equal(apply.statusCode, 202, apply.body);
    const applyBody = JSON.parse(apply.body);
    assert.equal(applyBody.success, true, apply.body);
    assert.ok(["queued", "running"].includes(applyBody.job.status), "job deve iniciar em queued/running");
    assert.equal(applyBody.job.targetVersion, targetVersion, "backend deve ignorar payload arbitrario e usar versao oficial");

    const concurrent = await app.inject({
      method: "POST",
      url: "/api/update/apply",
      headers: authHeaders,
      payload: { command: "echo hacked" },
    });
    assert.equal(concurrent.statusCode, 409, concurrent.body);
    const concurrentBody = JSON.parse(concurrent.body);
    assert.equal(concurrentBody.success, false, concurrent.body);
    assert.ok(concurrentBody.job, "resposta de conflito deve incluir job atual");
    assert.ok(["queued", "running"].includes(concurrentBody.job.status), "job concorrente deve estar ativo");

    const finishedJob = await waitForJob(app, authHeaders);
    assert.equal(finishedJob.status, "success", JSON.stringify(finishedJob));
    assert.ok(Array.isArray(finishedJob.logTail) && finishedJob.logTail.length > 0, "job final deve expor logs");
    assert.ok(finishedJob.logTail.some((line) => line.includes("Starting update job")), "logs devem registrar inicio do job");
    assert.ok(finishedJob.logTail.some((line) => line.includes("Fake update completed successfully.")), "logs devem registrar resultado final");

    const statusAfter = await app.inject({ method: "GET", url: "/api/update/status", headers: authHeaders });
    assert.equal(statusAfter.statusCode, 200, statusAfter.body);
    const statusAfterPayload = JSON.parse(statusAfter.body);
    assert.ok(statusAfterPayload.job, "status final deve incluir job");
    assert.equal(statusAfterPayload.job.status, "success", statusAfter.body);
    assert.equal(statusAfterPayload.job.active, false, statusAfter.body);

    console.log("update-disabled: OK");
  } finally {
    await app.close();
    cleanupUpdateArtifacts(backendRoot);
    global.fetch = originalFetch;
  }
})().catch((err) => {
  global.fetch = originalFetch;
  console.error("update-disabled:", err);
  process.exit(1);
});
