"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const stateFile = process.env.UPDATE_JOB_FILE;
const logFile = process.env.UPDATE_JOB_LOG_FILE;
const jobId = process.env.UPDATE_JOB_ID;
const scriptPath = process.env.UPDATE_SCRIPT_PATH;
const fakeResult = process.env.UPDATE_RUNNER_FAKE_RESULT;
const fakeDelayMs = Number(process.env.UPDATE_RUNNER_FAKE_DELAY_MS || "0");

function readState() {
  return JSON.parse(fs.readFileSync(stateFile, "utf8"));
}

function writeState(next) {
  fs.writeFileSync(stateFile, `${JSON.stringify(next, null, 2)}\n`);
}

function appendLog(message) {
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${message}\n`);
}

function updateState(patch) {
  const current = readState();
  if (current.id !== jobId) {
    throw new Error("Job id mismatch while updating state");
  }
  const next = { ...current, ...patch };
  writeState(next);
  return next;
}

async function main() {
  if (!stateFile || !logFile || !jobId || !scriptPath) {
    throw new Error("Missing update runner environment");
  }

  updateState({
    status: "running",
    startedAt: new Date().toISOString(),
    summary: "Executando script oficial de update.",
    error: null,
  });

  appendLog(`Starting update job ${jobId}`);

  if (fakeResult) {
    if (fakeDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, fakeDelayMs));
    }
    if (fakeResult === "success") {
      appendLog("Fake update completed successfully.");
      updateState({
        status: "success",
        finishedAt: new Date().toISOString(),
        summary: "Atualização concluída com sucesso.",
      });
      return;
    }

    appendLog("Fake update failed.");
    updateState({
      status: "failed",
      finishedAt: new Date().toISOString(),
      summary: "Atualização falhou.",
      error: "Falha simulada para teste focado.",
    });
    return;
  }

  if (process.platform === "win32") {
    appendLog("Remote update is only supported on VPS/Linux.");
    updateState({
      status: "failed",
      finishedAt: new Date().toISOString(),
      summary: "Ambiente incompatível com update remoto.",
      error: "Update remoto suportado apenas em VPS/Linux.",
    });
    return;
  }

  if (path.basename(scriptPath) !== "update.sh" || !fs.existsSync(scriptPath)) {
    appendLog("Official update script not found or invalid.");
    updateState({
      status: "failed",
      finishedAt: new Date().toISOString(),
      summary: "Script oficial de update inválido.",
      error: "Somente update.sh é permitido para execução remota.",
    });
    return;
  }

  await new Promise((resolve) => {
    const out = fs.openSync(logFile, "a");
    const err = fs.openSync(logFile, "a");
    const child = spawn("bash", [scriptPath], {
      cwd: path.dirname(scriptPath),
      env: process.env,
      stdio: ["ignore", out, err],
    });

    appendLog(`Spawned update.sh with pid ${child.pid}`);

    child.on("close", (code) => {
      if (code === 0) {
        appendLog("Update script completed successfully.");
        updateState({
          status: "success",
          finishedAt: new Date().toISOString(),
          summary: "Atualização concluída com sucesso.",
          error: null,
        });
      } else {
        appendLog(`Update script exited with code ${code}.`);
        updateState({
          status: "failed",
          finishedAt: new Date().toISOString(),
          summary: "Atualização falhou.",
          error: `update.sh finalizou com código ${code}.`,
        });
      }
      resolve();
    });

    child.on("error", (error) => {
      appendLog(`Update script failed to start: ${error.message}`);
      updateState({
        status: "failed",
        finishedAt: new Date().toISOString(),
        summary: "Falha ao iniciar script oficial.",
        error: error.message,
      });
      resolve();
    });
  });
}

main().catch((error) => {
  try {
    appendLog(`Runner fatal error: ${error.message}`);
    updateState({
      status: "failed",
      finishedAt: new Date().toISOString(),
      summary: "Falha fatal no worker de update.",
      error: error.message,
    });
  } catch {
    // ignore secondary failure in detached worker
  }
  process.exit(1);
});
