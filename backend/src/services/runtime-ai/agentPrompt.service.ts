import { loadRuntimeConfigSource, resolveSystemPrompt, resolveTelegramSystemPrompt } from "./runtimeConfig.service";

const DEFAULT_BEHAVIORAL = "";

export async function getResolvedAgentPrompt(instanceId: string): Promise<string> {
  const source = await loadRuntimeConfigSource(instanceId);
  return resolveSystemPrompt(source) || DEFAULT_BEHAVIORAL;
}

export async function getResolvedTelegramPrompt(instanceId: string): Promise<string> {
  const source = await loadRuntimeConfigSource(instanceId);
  return resolveTelegramSystemPrompt(source) || DEFAULT_BEHAVIORAL;
}
