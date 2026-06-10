import { tryDecryptSecret } from "../services/crypto.service";
import {
  loadRuntimeConfigSource,
  resolveChatProvider,
  resolveMemoryLimit,
  resolveOpenAiModel,
  resolveOpenRouterModel,
  resolveRawSecrets,
} from "../services/runtimeConfig.service";
import { safeErrorMessage, safeLogError } from "../utils/redaction";
import { geminiChat } from "./gemini";
import { groqChat, groqWhisper } from "./groq";
import { isChatProviderId, type ChatProviderId } from "./chatRuntime";
import { normalizeMessagesForChatApi } from "./systemPrompt";
import type { ChatMessage } from "./systemPrompt";
import { openAiChat } from "./openai";
import { openRouterChat } from "./openrouter";
import { sanitizeBotResponse } from "./promptGuard";

type ChatProviderFn = (key: string, messages: ChatMessage[]) => Promise<string>;

type EffectiveInstanceKeys = {
  chatProvider: string | null;
  groqKey: string | null | undefined;
  geminiKey: string | null | undefined;
  openaiKey: string | null | undefined;
  openaiModel: string | null;
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
      "[askChat] ADMIN: nenhuma chave de IA configurada (Groq / Gemini / OpenRouter / OpenAI). Defina em Proteções & IA Global ou por instância."
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

function buildProviderSequence(selectedProvider: string | null | undefined) {
  const base: ChatProviderId[] = ["groq", "gemini", "openrouter", "openai"];
  if (!isChatProviderId(selectedProvider)) return base;
  return [selectedProvider, ...base.filter((provider) => provider !== selectedProvider)];
}

export async function getKeys(instanceId?: string): Promise<EffectiveInstanceKeys> {
  const source = await loadRuntimeConfigSource(instanceId);
  const secrets = resolveRawSecrets(source);

  return {
    chatProvider: resolveChatProvider(source),
    groqKey: decryptNullableSecret(secrets.groqKey),
    geminiKey: decryptNullableSecret(secrets.geminiKey),
    openaiKey: decryptNullableSecret(secrets.openaiKey),
    openaiModel: resolveOpenAiModel(source),
    openrouterKey: decryptNullableSecret(secrets.openrouterKey),
    openrouterModel: resolveOpenRouterModel(source),
    groqAudioKey: decryptNullableSecret(secrets.groqAudioKey),
    memoryLimit: resolveMemoryLimit(source),
  };
}

export async function isAudioTranscriptionEnabled(instanceId: string): Promise<boolean> {
  const { prisma } = await import("../database/prisma");
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
    openai: {
      key: keys.openaiKey,
      fn: (k, msgs) => openAiChat(k, msgs, keys.openaiModel),
    },
  };

  const tried: string[] = [];
  let lastError: unknown;

  for (const providerName of buildProviderSequence(keys.chatProvider)) {
    const provider = providers[providerName];
    if (!provider.key) continue;

    tried.push(providerName);
    try {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- Provider fallback is intentionally sequential so only the next provider runs after the previous one fails or returns empty.
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
