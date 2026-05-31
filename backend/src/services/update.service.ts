import { openSync, closeSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../database/prisma";
import { env } from "../config/env";
import {
  decodeGitHubFileContent,
  getRepoFile,
  getLatestRelease,
  hasUpdate,
  parseVersion,
} from "./github.service";
import { encryptToken, maskStoredSecret, maskToken, tryDecryptSecret } from "./crypto.service";

export type UpdateJobStatus = "queued" | "running" | "success" | "failed";

type StoredUpdateJob = {
  id: string;
  status: UpdateJobStatus;
  currentVersion: string;
  targetVersion: string;
  releaseUrl: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  pid: number | null;
  summary: string | null;
  error: string | null;
  logPath: string;
};

export type UpdateJobView = Omit<StoredUpdateJob, "logPath"> & {
  logTail: string[];
  active: boolean;
};

export type UpdateInfo = {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseUrl: string;
  changelog: string;
};

type UpdateStatusPayload = UpdateInfo & {
  job: UpdateJobView | null;
};

function readVersionFile(): string | null {
  const candidates = [
    process.env.UPDATE_VERSION_FILE,
    process.env.UPDATE_WORKSPACE_DIR ? path.resolve(process.env.UPDATE_WORKSPACE_DIR, "backend", "VERSION") : null,
    path.resolve(process.cwd(), "VERSION"),
    path.resolve(__dirname, "..", "..", "VERSION"),
  ];

  for (const filePath of candidates) {
    if (!filePath || !existsSync(filePath)) continue;
    const version = readFileSync(filePath, "utf8").trim();
    if (version) return version;
  }

  return null;
}

function resolveUpdateWorkspaceDir() {
  const candidates = [
    process.env.UPDATE_WORKSPACE_DIR,
    process.cwd(),
    path.resolve(process.cwd(), ".."),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = path.resolve(candidate);
    if (existsSync(path.join(resolved, "update.sh"))) {
      return resolved;
    }
  }

  return path.resolve(process.cwd(), "..");
}

function writeStoredJob(job: StoredUpdateJob) {
  ensureUpdateStorage();
  writeFileSync(UPDATE_JOB_FILE, JSON.stringify(job, null, 2));
}

function reconcileRecoveredJob(job: StoredUpdateJob | null): StoredUpdateJob | null {
  if (!job || !isActiveJob(job.status)) return job;

  const currentVersion = parseVersion(readVersionFile() || process.env.APP_VERSION || CURRENT_VERSION);
  const targetVersion = parseVersion(job.targetVersion);

  if (hasUpdate(currentVersion, targetVersion)) {
    return job;
  }

  const recovered: StoredUpdateJob = {
    ...job,
    status: "success",
    finishedAt: job.finishedAt ?? new Date().toISOString(),
    summary: "Atualização concluída após reinício do serviço.",
    error: null,
  };

  writeStoredJob(recovered);
  return recovered;
}

const CURRENT_VERSION = readVersionFile() || process.env.APP_VERSION || "v0.0.0";
const GITHUB_REPO = env.GITHUB_REPO || (env.NODE_ENV === "production" ? "" : "owner/repo");
const UPDATE_WORKSPACE_DIR = resolveUpdateWorkspaceDir();
const UPDATE_STORAGE_DIR = process.env.UPDATE_STORAGE_DIR
  ? path.resolve(process.env.UPDATE_STORAGE_DIR)
  : path.join(UPDATE_WORKSPACE_DIR, "updates");
const UPDATE_JOB_FILE = path.join(UPDATE_STORAGE_DIR, "update-job.json");
const UPDATE_JOB_LOG_FILE = path.join(UPDATE_STORAGE_DIR, "update-job.log");
const UPDATE_JOB_LOCK_FILE = path.join(UPDATE_STORAGE_DIR, "update-job.lock");
const UPDATE_RUNNER_SCRIPT = path.resolve(process.cwd(), "scripts", "update-job-runner.cjs");
const OFFICIAL_UPDATE_SCRIPT = process.env.UPDATE_SCRIPT_PATH
  ? path.resolve(process.env.UPDATE_SCRIPT_PATH)
  : path.join(UPDATE_WORKSPACE_DIR, "update.sh");

function ensureUpdateStorage() {
  mkdirSync(UPDATE_STORAGE_DIR, { recursive: true });
}

function getRepoParts(): { owner: string; repo: string } {
  if (env.NODE_ENV === "production" && (!GITHUB_REPO || GITHUB_REPO === "owner/repo")) {
    throw new Error("GITHUB_REPO e obrigatorio em producao para consulta de versao.");
  }

  const [owner, repo] = GITHUB_REPO.split("/");
  if (!owner || !repo) {
    throw new Error(`GITHUB_REPO mal formatado: ${GITHUB_REPO}`);
  }

  return { owner, repo };
}

function acquireUpdateLock() {
  ensureUpdateStorage();
  return openSync(UPDATE_JOB_LOCK_FILE, "wx");
}

function releaseUpdateLock(fd: number) {
  closeSync(fd);
  if (existsSync(UPDATE_JOB_LOCK_FILE)) {
    unlinkSync(UPDATE_JOB_LOCK_FILE);
  }
}

function readStoredJob(): StoredUpdateJob | null {
  ensureUpdateStorage();
  if (!existsSync(UPDATE_JOB_FILE)) return null;

  try {
    const stored = JSON.parse(readFileSync(UPDATE_JOB_FILE, "utf8")) as StoredUpdateJob;
    return reconcileRecoveredJob(stored);
  } catch {
    return null;
  }
}

function readLogTail(limit = 40): string[] {
  ensureUpdateStorage();
  if (!existsSync(UPDATE_JOB_LOG_FILE)) return [];
  const content = readFileSync(UPDATE_JOB_LOG_FILE, "utf8");
  return content.split(/\r?\n/).map((line) => line.trimEnd()).filter(Boolean).slice(-limit);
}

function isActiveJob(status: UpdateJobStatus) {
  return status === "queued" || status === "running";
}

function toJobView(job: StoredUpdateJob | null): UpdateJobView | null {
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    currentVersion: job.currentVersion,
    targetVersion: job.targetVersion,
    releaseUrl: job.releaseUrl,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    pid: job.pid,
    summary: job.summary,
    error: job.error,
    logTail: readLogTail(),
    active: isActiveJob(job.status),
  };
}

export function getCurrentUpdateJob(): UpdateJobView | null {
  return toJobView(readStoredJob());
}

function createJobId() {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readGitHubToken() {
  const settings = await prisma.settings.findUnique({ where: { id: "github_update_settings" } });
  return settings?.githubToken ? tryDecryptSecret(settings.githubToken) : undefined;
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  const token = await readGitHubToken();
  const { owner, repo } = getRepoParts();
  const currentVersion = parseVersion(CURRENT_VERSION);

  try {
    const release = await getLatestRelease(owner, repo, token);
    const latestVersion = parseVersion(release.tag_name);

    return {
      currentVersion,
      latestVersion,
      hasUpdate: hasUpdate(currentVersion, latestVersion),
      releaseUrl: release.html_url,
      changelog: release.body || "Sem changelog disponivel.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("GitHub API error: 404")) {
      throw error;
    }

    const versionFile = await getRepoFile(owner, repo, "backend/VERSION", "main", token);
    const latestVersion = parseVersion(decodeGitHubFileContent(versionFile));

    return {
      currentVersion,
      latestVersion,
      hasUpdate: hasUpdate(currentVersion, latestVersion),
      releaseUrl: `https://github.com/${owner}/${repo}`,
      changelog: "Repositorio sem GitHub Release publicada. Comparacao feita pelo arquivo backend/VERSION no branch main.",
    };
  }
}

export async function getUpdateStatusPayload(): Promise<UpdateStatusPayload> {
  const updateInfo = await checkForUpdate();
  return {
    ...updateInfo,
    job: getCurrentUpdateJob(),
  };
}

export class UpdateConflictError extends Error {
  statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = "UPDATE_CONFLICT_ERROR";
  }
}

export async function startUpdateJob() {
  const updateInfo = await checkForUpdate();
  if (!updateInfo.hasUpdate) {
    throw new UpdateConflictError("Nenhuma atualização nova está disponível no momento.");
  }

  let lockFd: number | null = null;
  try {
    lockFd = acquireUpdateLock();
  } catch {
    throw new UpdateConflictError("Já existe uma operação de atualização sendo preparada. Tente novamente em instantes.");
  }

  try {
    const current = readStoredJob();
    if (current && isActiveJob(current.status)) {
      throw new UpdateConflictError("Já existe uma atualização em andamento.");
    }

    const job: StoredUpdateJob = {
      id: createJobId(),
      status: "queued",
      currentVersion: updateInfo.currentVersion,
      targetVersion: updateInfo.latestVersion,
      releaseUrl: updateInfo.releaseUrl,
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      pid: null,
      summary: "Job criado e aguardando worker de update.",
      error: null,
      logPath: UPDATE_JOB_LOG_FILE,
    };

    ensureUpdateStorage();
    writeFileSync(UPDATE_JOB_LOG_FILE, "");
    writeStoredJob(job);

    const { spawn } = await import("node:child_process");
    const out = openSync(UPDATE_JOB_LOG_FILE, "a");
    const err = openSync(UPDATE_JOB_LOG_FILE, "a");
    const child = spawn(process.execPath, [UPDATE_RUNNER_SCRIPT], {
      cwd: process.cwd(),
      detached: true,
      stdio: ["ignore", out, err],
      env: {
        ...process.env,
        UPDATE_JOB_FILE,
        UPDATE_JOB_LOG_FILE,
        UPDATE_JOB_ID: job.id,
        UPDATE_SCRIPT_PATH: OFFICIAL_UPDATE_SCRIPT,
        UPDATE_TARGET_VERSION: job.targetVersion,
        UPDATE_CURRENT_VERSION: job.currentVersion,
      },
    });
    child.unref();

    const persisted: StoredUpdateJob = {
      ...job,
      pid: child.pid ?? null,
      summary: child.pid ? `Worker de update iniciado (pid ${child.pid}).` : "Worker de update iniciado.",
    };
    writeStoredJob(persisted);

    return toJobView(persisted);
  } finally {
    if (lockFd !== null) {
      releaseUpdateLock(lockFd);
    }
  }
}

export async function validateGitHubToken(token: string): Promise<{ valid: boolean; message: string }> {
  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (response.ok) {
      return { valid: true, message: "Token válido" };
    }

    if (response.status === 401) {
      return { valid: false, message: "Token inválido ou expirado" };
    }

    if (response.status === 403) {
      return { valid: false, message: "Token sem permissão (verifique scopes)" };
    }

    return { valid: false, message: `Erro na verificação: ${response.status}` };
  } catch {
    return { valid: false, message: "Erro ao verificar token" };
  }
}

export async function saveGitHubToken(token: string): Promise<{ success: boolean; tokenMasked: string; message?: string }> {
  const validation = await validateGitHubToken(token);
  if (!validation.valid) {
    return { success: false, tokenMasked: maskToken(token), message: validation.message };
  }

  const encrypted = encryptToken(token);
  await prisma.settings.upsert({
    where: { id: "github_update_settings" },
    update: { githubToken: encrypted },
    create: { id: "github_update_settings", githubToken: encrypted },
  });
  return { success: true, tokenMasked: maskToken(token) };
}

export async function removeGitHubToken(): Promise<void> {
  await prisma.settings.upsert({
    where: { id: "github_update_settings" },
    update: { githubToken: null },
    create: { id: "github_update_settings", githubToken: null },
  });
}

export async function getTokenStatus(): Promise<{ configured: boolean; masked: string | null }> {
  const settings = await prisma.settings.findUnique({ where: { id: "github_update_settings" } });
  if (!settings?.githubToken) {
    return { configured: false, masked: null };
  }
  return { configured: true, masked: maskStoredSecret(settings.githubToken) };
}

export {
  CURRENT_VERSION,
  GITHUB_REPO,
  getRepoParts,
  OFFICIAL_UPDATE_SCRIPT,
  UPDATE_JOB_FILE,
  UPDATE_JOB_LOG_FILE,
  UPDATE_STORAGE_DIR,
  UPDATE_WORKSPACE_DIR,
};
