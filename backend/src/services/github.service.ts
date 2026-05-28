export type GitHubRelease = {
  url: string;
  assets_url: string;
  upload_url: string;
  html_url: string;
  id: number;
  node_id: string;
  tag_name: string;
  target_commitish: string;
  name: string | null;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string;
  body: string | null;
  zipball_url: string;
  tarball_url: string;
};

import { redactSensitiveText } from "../utils/redaction";

const GITHUB_API = "https://api.github.com";
const HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

function buildHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = { ...HEADERS };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function getLatestRelease(
  owner: string,
  repo: string,
  token?: string
): Promise<GitHubRelease> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/releases/latest`;
  const res = await fetch(url, { headers: buildHeaders(token) });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(
      `GitHub API error: ${res.status} - ${redactSensitiveText(JSON.stringify(error), 180)}`
    );
  }
  return res.json();
}

export async function getReleaseByTag(
  owner: string,
  repo: string,
  tag: string,
  token?: string
): Promise<GitHubRelease> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/releases/tags/${tag}`;
  const res = await fetch(url, { headers: buildHeaders(token) });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(
      `GitHub API error: ${res.status} - ${redactSensitiveText(JSON.stringify(error), 180)}`
    );
  }
  return res.json();
}

export function parseVersion(tag: string): string {
  return tag.replace(/^v/, "").trim();
}

export function compareVersions(v1: string, v2: string): number {
  const normalize = (v: string) =>
    v.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);

  const a = normalize(v1);
  const b = normalize(v2);
  const len = Math.max(a.length, b.length);

  for (let i = 0; i < len; i++) {
    const numA = a[i] ?? 0;
    const numB = b[i] ?? 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }
  return 0;
}

export function hasUpdate(current: string, latest: string): boolean {
  return compareVersions(current, latest) < 0;
}
