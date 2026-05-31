export type ProviderId = "gemini" | "groq" | "groq-audio" | "openrouter" | "openai";
export type ApiKeyField = "geminiKey" | "groqKey" | "groqAudioKey" | "openrouterKey" | "openaiKey";
export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

export type ProviderHealth = {
  preferredChatProvider: string | null;
  results: {
    provider: ProviderId;
    configured: boolean;
    ok: boolean;
    latencyMs?: number;
    error?: string;
  }[];
};

export type AgentConfig = {
  id: string;
  name: string;
  agentName: string | null;
  status: string;
  typing: boolean;
  delayMin: number;
  delayMax: number;
  systemPrompt: string | null;
  chatProvider: string | null;
  groqKey: string | null;
  groqAudioKey: string | null;
  geminiKey: string | null;
  openaiKey: string | null;
  openrouterKey: string | null;
  groqKeyConfigured?: boolean;
  groqKeyMasked?: string | null;
  groqAudioKeyConfigured?: boolean;
  groqAudioKeyMasked?: string | null;
  geminiKeyConfigured?: boolean;
  geminiKeyMasked?: string | null;
  openaiKeyConfigured?: boolean;
  openaiKeyMasked?: string | null;
  openrouterKeyConfigured?: boolean;
  openrouterKeyMasked?: string | null;
  openaiModel: string | null;
  openrouterModel: string | null;
};

export type OpenRouterModelRow = {
  id: string;
  name: string;
  contextLength: number | null;
  tier: "free" | "paid";
  pricingPrompt: string | null;
  pricingCompletion: string | null;
};

export type OpenRouterModelsResponse = {
  free: OpenRouterModelRow[];
  paid: OpenRouterModelRow[];
  totalFree: number;
  totalPaid: number;
};

export type ProviderMeta = {
  id: ProviderId;
  label: string;
  shortLabel: string;
  field: ApiKeyField;
  placeholder: string;
  description: string;
  canBePreferred: boolean;
};

export const providers: ProviderMeta[] = [
  { id: "gemini", label: "Google Gemini", shortLabel: "Gemini", field: "geminiKey", placeholder: "AIza...", description: "Modelo Google para respostas em texto.", canBePreferred: true },
  { id: "groq", label: "Groq Chat", shortLabel: "Groq", field: "groqKey", placeholder: "gsk_...", description: "Chat rápido para respostas operacionais.", canBePreferred: true },
  { id: "groq-audio", label: "Groq Audio", shortLabel: "Audio", field: "groqAudioKey", placeholder: "gsk_...", description: "Chave opcional para transcrição/áudio. Se vazio, mantém a chave salva.", canBePreferred: false },
  { id: "openrouter", label: "OpenRouter", shortLabel: "OpenRouter", field: "openrouterKey", placeholder: "sk-or-...", description: "Roteamento de modelos externos e seleção de modelo principal.", canBePreferred: true },
  { id: "openai", label: "OpenAI", shortLabel: "OpenAI", field: "openaiKey", placeholder: "sk-...", description: "Responses API oficial da OpenAI com modelo configurável.", canBePreferred: true },
];

export function buildConfigSavePayload(cfg: AgentConfig) {
  const openrouterModel = cfg.openrouterModel?.trim();
  const openaiModel = cfg.openaiModel?.trim();
  const payload: Record<string, unknown> = {
    name: cfg.name,
    agentName: cfg.agentName,
    typing: cfg.typing,
    delayMin: cfg.delayMin,
    delayMax: cfg.delayMax,
    systemPrompt: cfg.systemPrompt,
    chatProvider: cfg.chatProvider,
    openaiModel: openaiModel && openaiModel.length > 0 ? openaiModel : null,
    openrouterModel: openrouterModel && openrouterModel.length > 0 ? openrouterModel : null,
  };

  const keys: ApiKeyField[] = ["groqKey", "groqAudioKey", "geminiKey", "openrouterKey", "openaiKey"];
  for (const key of keys) {
    const value = cfg[key]?.trim();
    if (value) payload[key] = value;
  }
  return payload;
}

export function configuredLabel(cfg: AgentConfig, field: ApiKeyField): string | null {
  const masked = cfg[`${field}Masked` as keyof AgentConfig];
  const configured = cfg[`${field}Configured` as keyof AgentConfig];
  if (typeof masked === "string" && masked) return masked;
  if (configured) return "Chave salva";
  return null;
}

export function usdPerMillionTokens(perTokenUsd: string | null): string {
  if (perTokenUsd === null || perTokenUsd === "") return "-";
  const n = parseFloat(perTokenUsd);
  if (!Number.isFinite(n)) return perTokenUsd;
  if (n === 0) return "US$ 0";
  return `US$ ${(n * 1e6).toFixed(4)} / 1M`;
}

export function openRouterModelIdSet(models: OpenRouterModelsResponse | null): Set<string> {
  if (!models) return new Set();
  return new Set([...models.free.map((model) => model.id), ...models.paid.map((model) => model.id)]);
}

export function toneForHealth(result: ProviderHealth["results"][number] | null): StatusTone {
  if (!result) return "neutral";
  if (!result.configured) return "warning";
  return result.ok ? "success" : "danger";
}

export function labelForHealth(result: ProviderHealth["results"][number] | null) {
  if (!result) return "Aguardando teste";
  if (!result.configured) return "Sem chave";
  if (result.ok) return typeof result.latencyMs === "number" ? `Online · ${result.latencyMs}ms` : "Online";
  return result.error ? `Erro · ${result.error.slice(0, 72)}` : "Erro";
}
