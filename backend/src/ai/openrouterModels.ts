/**
 * Lista modelos OpenRouter e separa grátis vs pagos (via API pública /v1/models).
 * @see https://openrouter.ai/docs/api-reference/models
 */
import { redactSensitiveText } from "../utils/redaction";
import { env } from "../config/env";

export type OpenRouterModelPublic = {
  id: string;
  name: string;
  contextLength: number | null;
  tier: "free" | "paid";
  /** Valores brutos da API (USD por token, string). */
  pricingPrompt: string | null;
  pricingCompletion: string | null;
};

type RawModel = {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
};

function parseUsdPerToken(s: string | undefined): number | null {
  if (s === undefined || s === "") return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Modelo grátis: sufixo :free no id ou preços prompt/completion ambos 0. */
export function isOpenRouterModelFree(m: RawModel): boolean {
  const id = m.id.toLowerCase();
  if (id.includes(":free")) return true;
  const p = parseUsdPerToken(m.pricing?.prompt);
  const c = parseUsdPerToken(m.pricing?.completion);
  if (p !== null && c !== null && p === 0 && c === 0) return true;
  return false;
}

function toPublic(m: RawModel, tier: "free" | "paid"): OpenRouterModelPublic {
  return {
    id: m.id,
    name: (m.name && String(m.name).trim()) || m.id,
    contextLength: typeof m.context_length === "number" ? m.context_length : null,
    tier,
    pricingPrompt: m.pricing?.prompt ?? null,
    pricingCompletion: m.pricing?.completion ?? null
  };
}

function sortByName(a: OpenRouterModelPublic, b: OpenRouterModelPublic) {
  return a.name.localeCompare(b.name, "pt", { sensitivity: "base" });
}

export async function fetchOpenRouterModelsGrouped(apiKey: string): Promise<{
  free: OpenRouterModelPublic[];
  paid: OpenRouterModelPublic[];
}> {
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      "HTTP-Referer": env.OPENROUTER_REFERER,
      "X-Title": env.OPENROUTER_TITLE
    }
  });
  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${redactSensitiveText(rawText, 180)}`);
  }
  let json: { data?: RawModel[] };
  try {
    json = JSON.parse(rawText) as { data?: RawModel[] };
  } catch {
    throw new Error("OpenRouter: resposta JSON inválida");
  }
  const list = Array.isArray(json.data) ? json.data : [];
  const free: OpenRouterModelPublic[] = [];
  const paid: OpenRouterModelPublic[] = [];
  for (const m of list) {
    if (!m?.id) continue;
    if (isOpenRouterModelFree(m)) free.push(toPublic(m, "free"));
    else paid.push(toPublic(m, "paid"));
  }
  free.sort(sortByName);
  paid.sort(sortByName);
  return { free, paid };
}
