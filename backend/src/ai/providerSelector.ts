import { prisma } from "../database/prisma";
import { groqChat, groqWhisper } from "./groq";
import { geminiChat } from "./gemini";
import { openRouterChat } from "./openrouter";
import { normalizeMessagesForChatApi } from "./systemPrompt";
import type { ChatMessage } from "./systemPrompt";
import { sanitizeBotResponse } from "./promptGuard";
import { tryDecryptSecret } from "../services/crypto.service";
import { safeErrorMessage, safeLogError } from "../utils/redaction";

type ChatProviderFn = (key: string, messages: ChatMessage[]) => Promise<string>;

/** Só para logs do admin — detecta cota/limite nos erros das APIs. */
function isLikelyQuotaOrRateLimit(err: unknown): boolean {
  const s = err instanceof Error ? err.message : String(err);
  if (/\b429\b/.test(s)) return true;
  if (/resource_exhausted|rate_limit|too many requests|insufficient_quota|quota exceeded|capacity|billing/i.test(s))
    return true;
  if (/limit.*(requests|tokens|rate)|tokens per|requests per/i.test(s)) return true;
  return false;
}

/** Mensagem única e neutra para quem fala no WhatsApp — detalhes técnicos vão só para os logs (admin). */
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

export async function getKeys(instanceId?: string) {
  const agent = instanceId
    ? await prisma.instance.findUnique({ where: { id: instanceId } })
    : await prisma.instance.findFirst();

  return {
    chatProvider: agent?.chatProvider,

    // Chat
    groqKey: decryptNullableSecret(agent?.groqKey),
    geminiKey: decryptNullableSecret(agent?.geminiKey),
    openrouterKey: decryptNullableSecret(agent?.openrouterKey),
    openrouterModel: agent?.openrouterModel,

    // Áudio/Whisper (chave separada opcional)
    groqAudioKey: decryptNullableSecret(agent?.groqAudioKey),
  };
}

export async function askChat(instanceId: string, messages: any[]) {
  const normalized = normalizeMessagesForChatApi(
    messages.map((m: any) => ({
      role: String(m.role ?? ""),
      content: String(m.content ?? "")
    }))
  );

  const keys = await getKeys(instanceId);

  // Pipeline Automático de Fallbacks
  const providers: {
    name: string;
    key: string | null | undefined;
    fn: ChatProviderFn;
  }[] = [
    { name: "groq", key: keys.groqKey, fn: groqChat },
    { name: "gemini", key: keys.geminiKey, fn: geminiChat },
    {
      name: "openrouter",
      key: keys.openrouterKey,
      fn: (k, msgs) => openRouterChat(k, msgs, keys.openrouterModel)
    }
  ];

  // Priorização baseada na escolha nativa
  providers.sort((a, b) => a.name === keys.chatProvider ? -1 : b.name === keys.chatProvider ? 1 : 0);

  const tried: string[] = [];
  let lastError: unknown;
  for (const p of providers) {
    if (p.key) {
      tried.push(p.name);
      try {
        const response = await p.fn(p.key, normalized);
        if (response) return sanitizeBotResponse(response);
      } catch (err) {
        lastError = err;
        console.error(`[AI Fallback] Falha no provedor '${p.name}':`, safeLogError(err));
      }
    }
  }

  logFailureForAdmin(tried.length === 0, lastError);
  return CHAT_FAILURE_MESSAGE_FOR_END_USER;
}

/**
 * Transcreve áudio usando Groq Whisper.
 * Usa groqAudioKey se configurada, senão fallback para groqKey.
 * @param instanceId - ID da instância
 * @param audioBuffer - Buffer do áudio
 * @param mimeType - MIME type do áudio
 * @param language - (Opcional) ISO-639-1 do idioma
 */
export async function transcribeAudio(
  instanceId: string,
  audioBuffer: Buffer,
  mimeType: string = "audio/ogg",
  language: string = "pt"
): Promise<string> {
  const keys = await getKeys(instanceId);

  // Usar chave de áudio dedicada se existir, senão usar chave do chat
  const audioKey = keys.groqAudioKey || keys.groqKey;

  if (!audioKey) {
    throw new Error(
      "[transcribeAudio] ADMIN: nenhuma chave Groq configurada para áudio. " +
      "Defina groqKey ou groqAudioKey nas configurações da instância."
    );
  }

  try {
    return await groqWhisper(audioKey, audioBuffer, mimeType, language);
  } catch (err) {
    throw new Error(safeErrorMessage(err, "Falha ao transcrever audio"));
  }
}
