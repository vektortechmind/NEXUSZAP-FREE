import { prisma } from "../database/prisma";
import fs from "node:fs";
import path from "node:path";
import {
  decodeGitHubFileContent,
  getRepoFile,
  getLatestRelease,
  parseVersion,
  hasUpdate,
} from "./github.service";
import { encryptToken, maskToken, maskStoredSecret, tryDecryptSecret } from "./crypto.service";

function readVersionFile(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "VERSION"),
    path.resolve(__dirname, "..", "..", "VERSION"),
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    const version = fs.readFileSync(filePath, "utf8").trim();
    if (version) return version;
  }

  return null;
}

const CURRENT_VERSION = readVersionFile() || process.env.APP_VERSION || "v0.0.0";
const GITHUB_REPO = process.env.GITHUB_REPO || (process.env.NODE_ENV === "production" ? "" : "owner/repo");

function getRepoParts(): { owner: string; repo: string } {
  if (process.env.NODE_ENV === "production" && (!GITHUB_REPO || GITHUB_REPO === "owner/repo")) {
    throw new Error("GITHUB_REPO e obrigatorio em producao para consulta de versao.");
  }

  const [owner, repo] = GITHUB_REPO.split("/");
  if (!owner || !repo) {
    throw new Error(`GITHUB_REPO mal formatado: ${GITHUB_REPO}`);
  }
  return { owner, repo };
}

export type UpdateInfo = {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseUrl: string;
  changelog: string;
};

export async function checkForUpdate(): Promise<UpdateInfo> {
  const settings = await prisma.settings.findUnique({
    where: { id: "github_update_settings" },
  });

  const token = settings?.githubToken
    ? tryDecryptSecret(settings.githubToken)
    : undefined;

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

export async function validateGitHubToken(
  token: string
): Promise<{ valid: boolean; message: string }> {
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

    return {
      valid: false,
      message: `Erro na verificação: ${response.status}`,
    };
  } catch {
    return { valid: false, message: "Erro ao verificar token" };
  }
}

export async function saveGitHubToken(
  token: string
): Promise<{ success: boolean; tokenMasked: string; message?: string }> {
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

export async function getTokenStatus(): Promise<{
  configured: boolean;
  masked: string | null;
}> {
  const settings = await prisma.settings.findUnique({
    where: { id: "github_update_settings" },
  });
  if (!settings?.githubToken) {
    return { configured: false, masked: null };
  }
  return { configured: true, masked: maskStoredSecret(settings.githubToken) };
}

export { getRepoParts, CURRENT_VERSION, GITHUB_REPO };
