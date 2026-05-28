import { defaultOpenRouterModelId } from "./openrouter";

export const CHAT_PROVIDER_IDS = ["groq", "gemini", "openrouter"] as const;

export type ChatProviderId = (typeof CHAT_PROVIDER_IDS)[number];

export const DEFAULT_INSTANCE_MEMORY_LIMIT = 5;
export const MAX_INSTANCE_MEMORY_LIMIT = 50;

export const CHAT_PROVIDER_OPTIONS: Array<{
  id: ChatProviderId;
  label: string;
  supportsModel: boolean;
  defaultModel?: string;
}> = [
  { id: "groq", label: "Groq", supportsModel: false },
  { id: "gemini", label: "Google Gemini", supportsModel: false },
  {
    id: "openrouter",
    label: "OpenRouter",
    supportsModel: true,
    defaultModel: defaultOpenRouterModelId(),
  },
];

export function isChatProviderId(value: unknown): value is ChatProviderId {
  return typeof value === "string" && (CHAT_PROVIDER_IDS as readonly string[]).includes(value);
}

export function normalizeMemoryLimit(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_INSTANCE_MEMORY_LIMIT;
  const rounded = Math.trunc(Number(value));
  return Math.max(1, Math.min(MAX_INSTANCE_MEMORY_LIMIT, rounded));
}

export function normalizeOpenRouterModel(model: string | null | undefined): string {
  const trimmed = typeof model === "string" ? model.trim() : "";
  return trimmed || defaultOpenRouterModelId();
}

export function describeRuntimeFallback(input: {
  chatProvider: string | null | undefined;
  openrouterModel: string | null | undefined;
}) {
  const providerSelected = isChatProviderId(input.chatProvider);
  const providerFallback = !providerSelected;
  const modelFallback = input.chatProvider === "openrouter" && !input.openrouterModel?.trim();

  return {
    providerFallback,
    modelFallback,
    providerFallbackLabel: providerFallback ? "Fallback automático: Groq -> Gemini -> OpenRouter" : null,
    modelFallbackLabel: modelFallback ? `Fallback de modelo: ${defaultOpenRouterModelId()}` : null,
  };
}
