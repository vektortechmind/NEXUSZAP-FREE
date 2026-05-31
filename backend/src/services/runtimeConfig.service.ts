import { prisma } from "../database/prisma";
import { DEFAULT_INSTANCE_MEMORY_LIMIT } from "../ai/chatRuntime";
import { getPrimaryInstance, TELEGRAM_INSTANCE_SLOT } from "./instance.service";

type RuntimeAgent = {
  id?: string;
  chatProvider: string | null;
  openaiModel: string | null;
  openrouterModel: string | null;
  memoryLimit: number;
  systemPrompt: string | null;
  telegramSystemPrompt: string | null;
};

type RuntimeInstance = {
  id: string;
  slot: number;
  chatProvider: string | null;
  openaiModel: string | null;
  openrouterModel: string | null;
  memoryLimit: number;
  systemPrompt: string | null;
  telegramSystemPrompt: string | null;
  groqKey: string | null;
  groqAudioKey: string | null;
  geminiKey: string | null;
  openaiKey: string | null;
  openrouterKey: string | null;
  agent?: RuntimeAgent | null;
};

export type RuntimeConfigSource = {
  current: RuntimeInstance | null;
  primaryWhatsapp: RuntimeInstance | null;
  fallbackEligible: boolean;
};

const runtimeAgentSelect = {
  select: {
    id: true,
    chatProvider: true,
    openaiModel: true,
    openrouterModel: true,
    memoryLimit: true,
    systemPrompt: true,
    telegramSystemPrompt: true,
  },
} as const;

function normalizePrompt(value: string | null | undefined): string {
  return value?.trim() || "";
}

function pickScopedValue<T>(
  current: RuntimeInstance | null,
  agentValue: T | null | undefined,
  instanceValue: T | null | undefined,
  globalValue: T | null | undefined
): T | null | undefined {
  if (agentValue !== undefined && agentValue !== null) return agentValue;
  if (instanceValue !== undefined && instanceValue !== null) return instanceValue;
  if (current && current.slot > TELEGRAM_INSTANCE_SLOT) return globalValue;
  return undefined;
}

export async function loadRuntimeConfigSource(instanceId?: string): Promise<RuntimeConfigSource> {
  const primaryWhatsapp = (await getPrimaryInstance()) as RuntimeInstance | null;

  if (!instanceId) {
    return {
      current: primaryWhatsapp,
      primaryWhatsapp,
      fallbackEligible: Boolean(primaryWhatsapp && primaryWhatsapp.slot > TELEGRAM_INSTANCE_SLOT),
    };
  }

  const current = (await prisma.instance.findUnique({
    where: { id: instanceId },
    include: {
      agent: runtimeAgentSelect,
    },
  })) as RuntimeInstance | null;

  const resolvedCurrent = current ?? primaryWhatsapp;

  return {
    current: resolvedCurrent,
    primaryWhatsapp,
    fallbackEligible: Boolean(resolvedCurrent && resolvedCurrent.slot > TELEGRAM_INSTANCE_SLOT),
  };
}

export function resolveSystemPrompt(source: RuntimeConfigSource): string {
  const { current } = source;
  return normalizePrompt(current?.agent?.systemPrompt) || normalizePrompt(current?.systemPrompt);
}

export function resolveTelegramSystemPrompt(source: RuntimeConfigSource): string {
  const { current } = source;
  return normalizePrompt(current?.agent?.telegramSystemPrompt) || normalizePrompt(current?.telegramSystemPrompt);
}

export function resolveChatProvider(source: RuntimeConfigSource): string | null {
  const { current, primaryWhatsapp } = source;
  return pickScopedValue(
    current,
    current?.agent?.chatProvider,
    current?.chatProvider,
    primaryWhatsapp?.chatProvider
  ) ?? null;
}

export function resolveOpenRouterModel(source: RuntimeConfigSource): string | null {
  const { current, primaryWhatsapp } = source;
  return pickScopedValue(
    current,
    current?.agent?.openrouterModel,
    current?.openrouterModel,
    primaryWhatsapp?.openrouterModel
  ) ?? null;
}

export function resolveOpenAiModel(source: RuntimeConfigSource): string | null {
  const { current, primaryWhatsapp } = source;
  return pickScopedValue(
    current,
    current?.agent?.openaiModel,
    current?.openaiModel,
    primaryWhatsapp?.openaiModel
  ) ?? null;
}

export function resolveMemoryLimit(source: RuntimeConfigSource): number {
  const { current, primaryWhatsapp } = source;
  return pickScopedValue(
    current,
    current?.agent?.memoryLimit,
    current?.memoryLimit,
    primaryWhatsapp?.memoryLimit
  ) ?? DEFAULT_INSTANCE_MEMORY_LIMIT;
}

export function resolveRawSecrets(source: RuntimeConfigSource) {
  const { current, primaryWhatsapp } = source;

  return {
    groqKey: pickScopedValue(current, undefined, current?.groqKey, primaryWhatsapp?.groqKey) ?? null,
    groqAudioKey: pickScopedValue(
      current,
      undefined,
      current?.groqAudioKey,
      primaryWhatsapp?.groqAudioKey ?? primaryWhatsapp?.groqKey
    ) ?? null,
    geminiKey: pickScopedValue(current, undefined, current?.geminiKey, primaryWhatsapp?.geminiKey) ?? null,
    openaiKey: pickScopedValue(current, undefined, current?.openaiKey, primaryWhatsapp?.openaiKey) ?? null,
    openrouterKey: pickScopedValue(current, undefined, current?.openrouterKey, primaryWhatsapp?.openrouterKey) ?? null,
  };
}
