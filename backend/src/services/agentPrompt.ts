import { loadRuntimeConfigSource, resolveSystemPrompt, resolveTelegramSystemPrompt } from "./runtimeConfig.service";

/** Instruções extras (opcional). A identidade fixa vem de `ai/systemPrompt.ts`. */
const DEFAULT_BEHAVIORAL = "";

/**
 * Texto adicional de comportamento/negócio (só na instância). Não substitui a identidade fixa.
 */
export async function getResolvedAgentPrompt(instanceId: string): Promise<string> {
  const source = await loadRuntimeConfigSource(instanceId);
  return resolveSystemPrompt(source) || DEFAULT_BEHAVIORAL;
}

/**
 * Texto de comportamento exclusivo do Telegram.
 */
export async function getResolvedTelegramPrompt(instanceId: string): Promise<string> {
  const source = await loadRuntimeConfigSource(instanceId);
  return resolveTelegramSystemPrompt(source) || DEFAULT_BEHAVIORAL;
}
