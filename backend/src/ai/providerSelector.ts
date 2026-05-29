import { prisma } from "../database/prisma";
import { getPrimaryInstance } from "../services/instance.service";
import { tryDecryptSecret } from "../services/crypto.service";
import { safeErrorMessage, safeLogError } from "../utils/redaction";
import { geminiChat } from "./gemini";
import { groqChat, groqWhisper } from "./groq";
import { isChatProviderId, type ChatProviderId } from "./chatRuntime";
import { normalizeMessagesForChatApi } from "./systemPrompt";
import type { ChatMessage } from "./systemPrompt";
import { openRouterChat } from "./openrouter";
import { sanitizeBotResponse } from "./promptGuard";

type ChatProviderFn = (key: string, messages: ChatMessage[]) => Promise<string>;

type EffectiveInstanceKeys = {
  chatProvider: string | null;
  groqKey: string | null | undefined;
  geminiKey: string | null | undefined;
  openrouterKey: string | null | undefined;
  openrouterModel: string | null;
  groqAudioKey: string | null | undefined;
  memoryLimit: number;
};

function isLikelyQuotaOrRateLimit(err: unknown): boolean {
  const s = err instanceof Error ? err.message : String(err);
  if (/\b429\b/.test(s)) return true;
  if (/resource_exhausted|rate_limit|too many requests|insufficient_quota|quota exceeded|capacity|billing/i.test(s))
    return true;
  if (/limit.*(requests|tokens|rate)|tokens per|requests per/i.test(s)) return true;
  return false;
}

const CHAT_FAILURE_MESSAGE_FOR_END_USER =
  "Desculpa, no momento não consigo te responder. Tenta de novo daqui a pouquinho, combinado?";

function logFailureForAdmin(noKeysConfigured: boolean, lastError: unknown) {
  if (noKeysConfigured) {
    console.error(
      "[askChat] ADMIN: nenhuma chave de IA configurada (Groq / Gemini / OpenRouter). Defina em Proteções & IA Global ou por instância."
    );
    return;
  }
  if (lastError && isLikelyQuotaOrRateLimit(lastError)) {
    console.error(
      "[askChat] ADMIN: provável limite de cota ou taxa (429 / quota). Verifique saldo e chaves no provedor.",
      safeLogError(lastError)
    );
    return;
  }
  if (lastError) {
    console.error(
      "[askChat] ADMIN: falha ao obter resposta da IA. Verifique chaves, rede e logs do provedor.",
      safeLogError(lastError)
    );
  }
}

function decryptNullableSecret(value: string | null | undefined) {
  return value ? tryDecryptSecret(value) : value;
}

function pickInstanceValue<T>(instanceValue: T | null | undefined, primaryValue: T | null | undefined) {
  return instanceValue ?? primaryValue;
}

function buildProviderSequence(selectedProvider: string | null | undefined) {
  const base: ChatProviderId[] = ["groq", "gemini", "openrouter"];
  if (!isChatProviderId(selectedProvider)) return base;
  return [selectedProvider, ...base.filter((provider) => provider !== selectedProvider)];
}

export async function getKeys(instanceId?: string): Promise<EffectiveInstanceKeys> {
  const primary = await getPrimaryInstance();
  const instance = instanceId
    ? await prisma.instance.findUnique({ where: { id: instanceId } })
    : primary;
  const agent = instanceId
    ? await prisma.agent.findFirst({
        where: { instanceId },
        select: { chatProvider: true, openrouterModel: true, memoryLimit: true },
      })
    : null;

  const current = instance ?? primary;

  return {
    chatProvider: agent?.chatProvider ?? current?.chatProvider ?? null,
    groqKey: decryptNullableSecret(pickInstanceValue(current?.groqKey, primary?.groqKey)),
    geminiKey: decryptNullableSecret(pickInstanceValue(current?.geminiKey, primary?.geminiKey)),
    openrouterKey: decryptNullableSecret(pickInstanceValue(current?.openrouterKey, primary?.openrouterKey)),
    openrouterModel: agent?.openrouterModel ?? current?.openrouterModel ?? null,
    groqAudioKey: decryptNullableSecret(pickInstanceValue(current?.groqAudioKey, primary?.groqAudioKey ?? primary?.groqKey)),
    memoryLimit: agent?.memoryLimit ?? current?.memoryLimit ?? 5,
  };
}

export async function isAudioTranscriptionEnabled(instanceId: string): Promise<boolean> {
  const agent = await prisma.agent.findUnique({
    where: { instanceId },
    select: {
      audioTranscriptionEnabled: true,
    },
  });

  return agent?.audioTranscriptionEnabled ?? false;
}

export async function askChat(instanceId: string, messages: unknown[]) {
  const normalized = normalizeMessagesForChatApi(
    messages.map((m: any) => ({
      role: String(m.role ?? ""),
      content: String(m.content ?? ""),
    }))
  );

  const keys = await getKeys(instanceId);

  const providers: Record<ChatProviderId, { key: string | null | undefined; fn: ChatProviderFn }> = {
    groq: { key: keys.groqKey, fn: groqChat },
    gemini: { key: keys.geminiKey, fn: geminiChat },
    openrouter: {
      key: keys.openrouterKey,
      fn: (k, msgs) => openRouterChat(k, msgs, keys.openrouterModel),
    },
  };

  const tried: string[] = [];
  let lastError: unknown;

  for (const providerName of buildProviderSequence(keys.chatProvider)) {
    const provider = providers[providerName];
    if (!provider.key) continue;

    tried.push(providerName);
    try {
      const response = await provider.fn(provider.key, normalized);
      if (response) return sanitizeBotResponse(response);
    } catch (err) {
      lastError = err;
      console.error(`[AI Fallback] Falha no provedor '${providerName}':`, safeLogError(err));
    }
  }

  logFailureForAdmin(tried.length === 0, lastError);
  return CHAT_FAILURE_MESSAGE_FOR_END_USER;
}

export async function transcribeAudio(
  instanceId: string,
  audioBuffer: Buffer,
  mimeType: string = "audio/ogg",
  language: string = "pt"
): Promise<string> {
  const keys = await getKeys(instanceId);
  const audioKey = keys.groqAudioKey || keys.groqKey;

  if (!audioKey) {
    throw new Error(
      "[transcribeAudio] ADMIN: nenhuma chave Groq configurada para áudio. " +
      "Defina groqKey ou groqAudioKey nas configurações da instância."
    );
  }

  try {
    return await groqWhisper(
      audioKey,
      audioBuffer,
      mimeType,
      language,
      undefined
    );
  } catch (err) {
    throw new Error(safeErrorMessage(err, "Falha ao transcrever audio"));
  }
}
