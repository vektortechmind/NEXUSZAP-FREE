"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const appRoot = path.resolve(__dirname, "..", "..");
const updateScript = fs.readFileSync(path.join(appRoot, "update.sh"), "utf8");

function sectionBetween(source, startName, endName) {
  const marker = `${startName}() {`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `${startName} deve existir`);
  const end = source.indexOf(`${endName}() {`, start);
  assert.ok(end > start, `${endName} deve existir apos ${startName}`);
  return source.slice(start, end);
}

const helpers = sectionBetween(updateScript, "is_prisma_status_blocking_failure", "update_panel_job_state");

function extractGrepPattern(functionName) {
  const body = sectionBetween(updateScript, functionName, functionName === "is_prisma_status_blocking_failure" ? "is_prisma_status_pending_only" : "handle_prisma_status_failure");
  const match = body.match(/grep -Eqi "([^"]+)"/);
  assert.ok(match, `${functionName} deve usar grep -Eqi com padrao explicito`);
  return new RegExp(match[1], "i");
}

const blockingPattern = extractGrepPattern("is_prisma_status_blocking_failure");
const pendingPattern = extractGrepPattern("is_prisma_status_pending_only");

function classify(output) {
  if (blockingPattern.test(output)) return "blocked";
  if (pendingPattern.test(output)) return "allowed";
  return "blocked";
}

assert.ok(helpers.includes("if is_prisma_status_blocking_failure \"$status_output\"; then"), "pendencias so podem passar depois da checagem bloqueante");

assert.equal(
  classify("Database schema is not up to date. The following migration(s) have not yet been applied."),
  "allowed",
  "migrations pendentes devem seguir para migrate deploy"
);

assert.equal(
  classify("Error: P1001: Can't reach database server at postgres:5432"),
  "blocked",
  "erro de conexao deve continuar bloqueante"
);

assert.equal(
  classify("Drift detected: Your database schema is not in sync with your migration history."),
  "blocked",
  "drift deve continuar bloqueante"
);

assert.equal(
  classify("The migration 20260618000000_example failed."),
  "blocked",
  "migration falhada deve continuar bloqueante"
);

console.log("update-prisma-status-classification: OK");
