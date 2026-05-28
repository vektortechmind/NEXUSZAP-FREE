export const GROQ_DEFAULT_VOICE_MODEL = "whisper-large-v3-turbo";

export const VOICE_PROVIDER_IDS = ["groq"] as const;

export type VoiceProviderId = (typeof VOICE_PROVIDER_IDS)[number];

export const VOICE_PROVIDER_OPTIONS: Array<{
  id: VoiceProviderId;
  label: string;
  description: string;
  supportsModel: boolean;
  defaultModel: string;
  models: Array<{
    id: string;
    label: string;
    description: string;
  }>;
}> = [
  {
    id: "groq",
    label: "Groq Audio",
    description: "Transcricao de audio com Whisper via endpoint compativel OpenAI da Groq.",
    supportsModel: true,
    defaultModel: GROQ_DEFAULT_VOICE_MODEL,
    models: [
      {
        id: GROQ_DEFAULT_VOICE_MODEL,
        label: "Whisper Large v3 Turbo",
        description: "Modelo atual suportado no projeto para speech-to-text.",
      },
    ],
  },
];

export function isVoiceProviderId(value: unknown): value is VoiceProviderId {
  return typeof value === "string" && (VOICE_PROVIDER_IDS as readonly string[]).includes(value);
}

export function normalizeVoiceModel(provider: string | null | undefined, model: string | null | undefined): string | null {
  if (!isVoiceProviderId(provider)) return null;
  const trimmed = typeof model === "string" ? model.trim() : "";
  if (!trimmed) return VOICE_PROVIDER_OPTIONS.find((option) => option.id === provider)?.defaultModel ?? null;

  const option = VOICE_PROVIDER_OPTIONS.find((entry) => entry.id === provider);
  if (!option) return null;

  const supported = option.models.some((entry) => entry.id === trimmed);
  return supported ? trimmed : option.defaultModel;
}

export function describeVoiceSelection(input: {
  voiceEnabled: boolean;
  voiceProvider: string | null | undefined;
  voiceModel: string | null | undefined;
}) {
  const providerSelected = isVoiceProviderId(input.voiceProvider);
  const modelFallback = providerSelected && input.voiceProvider === "groq" && normalizeVoiceModel(input.voiceProvider, input.voiceModel) !== (input.voiceModel?.trim() || null);

  return {
    providerSelected,
    effectiveModel: normalizeVoiceModel(input.voiceProvider, input.voiceModel),
    modelFallback,
  };
}
