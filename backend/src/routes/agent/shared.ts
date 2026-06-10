import { z } from "zod";
import {
  CHAT_PROVIDER_OPTIONS,
  describeRuntimeFallback,
  isChatProviderId,
  MAX_INSTANCE_MEMORY_LIMIT,
  normalizeMemoryLimit,
} from "../../ai/chatRuntime";
import { InstanceManager } from "../../whatsapp/InstanceManager";

export const emptyToNull = (v: unknown) => {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  return v;
};

export const updateSchema = z.object({
  name: z.string().min(1).optional(),
  agentName: z.preprocess(emptyToNull, z.string().nullable().optional()),
  aiWhatsappEnabled: z.coerce.boolean().optional(),
  aiTelegramEnabled: z.coerce.boolean().optional(),
  typing: z.coerce.boolean().optional(),
  delayMin: z.coerce.number().int().min(0).optional(),
  delayMax: z.coerce.number().int().min(0).optional(),
  systemPrompt: z.preprocess(emptyToNull, z.string().nullable().optional()),
  telegramSystemPrompt: z.preprocess(emptyToNull, z.string().nullable().optional()),
  chatProvider: z.preprocess(emptyToNull, z.string().nullable().optional()),
  groqKey: z.preprocess(emptyToNull, z.string().nullable().optional()),
  groqAudioKey: z.preprocess(emptyToNull, z.string().nullable().optional()),
  geminiKey: z.preprocess(emptyToNull, z.string().nullable().optional()),
  openaiKey: z.preprocess(emptyToNull, z.string().nullable().optional()),
  openaiModel: z.preprocess(emptyToNull, z.string().nullable().optional()),
  openrouterKey: z.preprocess(emptyToNull, z.string().nullable().optional()),
  openrouterModel: z.preprocess(emptyToNull, z.string().nullable().optional()),
}).superRefine((val, ctx) => {
  if (typeof val.delayMin === "number" && typeof val.delayMax === "number" && val.delayMax < val.delayMin) {
    ctx.addIssue({
      code: "custom",
      path: ["delayMax"],
      message: "delayMax não pode ser menor que delayMin",
    });
  }
});

export const createInstanceSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const updateInstanceSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  aiWhatsappEnabled: z.coerce.boolean().optional(),
  chatProvider: z.preprocess(emptyToNull, z.string().nullable().optional()),
  openaiModel: z.preprocess(emptyToNull, z.string().nullable().optional()),
  openrouterModel: z.preprocess(emptyToNull, z.string().nullable().optional()),
  memoryLimit: z.coerce.number().int().min(1).max(MAX_INSTANCE_MEMORY_LIMIT).optional(),
});

export const createAgentSchema = z.object({
  name: z.string().trim().min(1).max(80),
  instanceId: z.string().uuid("Instância inválida"),
});

export const updateAgentWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  systemPrompt: z.preprocess(emptyToNull, z.string().nullable().optional()),
  chatProvider: z.preprocess(emptyToNull, z.string().nullable().optional()),
  openaiModel: z.preprocess(emptyToNull, z.string().nullable().optional()),
  openrouterModel: z.preprocess(emptyToNull, z.string().nullable().optional()),
  memoryLimit: z.coerce.number().int().min(1).max(MAX_INSTANCE_MEMORY_LIMIT).optional(),
  audioTranscriptionEnabled: z.coerce.boolean().optional(),
}).superRefine((val, ctx) => {
  if (val.chatProvider !== undefined && val.chatProvider !== null && !isChatProviderId(val.chatProvider)) {
    ctx.addIssue({
      code: "custom",
      path: ["chatProvider"],
      message: "Provider de IA inválido",
    });
  }
});

export function serializeInstanceStatus(instance: {
  id: string;
  slot: number;
  name: string;
  status: string;
  aiWhatsappEnabled: boolean;
  chatProvider?: string | null;
  openaiModel?: string | null;
  openrouterModel?: string | null;
  memoryLimit?: number;
  agent?: { id: string; name: string; chatProvider?: string | null; openaiModel?: string | null; openrouterModel?: string | null; memoryLimit?: number } | null;
}) {
  const active = InstanceManager.isRunning(instance.id);
  const connected = instance.status === "CONNECTED";
  const occupied = connected && !!instance.agent;

  const fallback = describeRuntimeFallback({
    chatProvider: instance.agent?.chatProvider ?? instance.chatProvider,
    openaiModel: instance.agent?.openaiModel ?? instance.openaiModel,
    openrouterModel: instance.agent?.openrouterModel ?? instance.openrouterModel,
  });

  return {
    id: instance.id,
    channel: "WHATSAPP" as const,
    slot: instance.slot,
    name: instance.name,
    status: instance.status,
    qr: InstanceManager.getLastQr(instance.id),
    active,
    connected,
    available: connected && !occupied,
    occupied,
    agent: instance.agent
      ? {
          id: instance.agent.id,
          name: instance.agent.name,
        }
      : null,
    aiWhatsappEnabled: instance.aiWhatsappEnabled,
    chatProvider: isChatProviderId(instance.agent?.chatProvider ?? instance.chatProvider) ? (instance.agent?.chatProvider ?? instance.chatProvider ?? null) : null,
    openaiModel: instance.agent?.openaiModel ?? instance.openaiModel ?? null,
    openrouterModel: instance.agent?.openrouterModel ?? instance.openrouterModel ?? null,
    memoryLimit: normalizeMemoryLimit(instance.agent?.memoryLimit ?? instance.memoryLimit),
    providerFallback: fallback.providerFallback,
    providerFallbackLabel: fallback.providerFallbackLabel,
    modelFallback: fallback.modelFallback,
    modelFallbackLabel: fallback.modelFallbackLabel,
  };
}

export function serializeAgent(agent: {
  id: string;
  name: string;
  telegramEnabled: boolean;
  systemPrompt?: string | null;
  chatProvider?: string | null;
  openaiModel?: string | null;
  openrouterModel?: string | null;
  memoryLimit?: number;
  audioTranscriptionEnabled?: boolean;
  createdAt: Date;
  instance: {
    id: string;
    slot: number;
    name: string;
    status: string;
    chatProvider?: string | null;
    openaiModel?: string | null;
    openrouterModel?: string | null;
  };
}) {
  return {
    id: agent.id,
    name: agent.name,
    telegramEnabled: agent.telegramEnabled,
    audioTranscriptionEnabled: agent.audioTranscriptionEnabled ?? false,
    chatProvider: isChatProviderId(agent.chatProvider) ? agent.chatProvider : null,
    openaiModel: agent.openaiModel ?? null,
    openrouterModel: agent.openrouterModel ?? null,
    memoryLimit: normalizeMemoryLimit(agent.memoryLimit),
    createdAt: agent.createdAt,
    instanceId: agent.instance.id,
    instanceName: agent.instance.name,
    instanceSlot: agent.instance.slot,
    instanceStatus: agent.instance.status,
    instanceChatProvider: isChatProviderId(agent.chatProvider) ? agent.chatProvider : null,
    instanceOpenaiModel: agent.openaiModel ?? null,
    instanceOpenrouterModel: agent.openrouterModel ?? null,
    systemPrompt: agent.systemPrompt ?? null,
  };
}

export function buildEmptyConfigResponse() {
  return {
    id: "",
    slot: 0,
    name: "",
    agentName: null,
    status: "DISCONNECTED",
    aiWhatsappEnabled: true,
    aiTelegramEnabled: true,
    typing: true,
    delayMin: 4000,
    delayMax: 7000,
    systemPrompt: null,
    telegramSystemPrompt: null,
    chatProvider: null,
    groqKey: null,
    groqAudioKey: null,
    geminiKey: null,
    openaiKey: null,
    openaiModel: null,
    openrouterKey: null,
    openrouterModel: null,
    memoryLimit: 5,
    createdAt: null,
    updatedAt: null,
    groqKeyConfigured: false,
    groqKeyMasked: null,
    groqAudioKeyConfigured: false,
    groqAudioKeyMasked: null,
    geminiKeyConfigured: false,
    geminiKeyMasked: null,
    openaiKeyConfigured: false,
    openaiKeyMasked: null,
    openrouterKeyConfigured: false,
    openrouterKeyMasked: null,
    telegramBotTokenConfigured: false,
    telegramBotTokenMasked: null,
    agentWorkspaceId: null,
  };
}

export async function waitForQr(instanceId: string) {
  let finalQr = "";
  const deadline = Date.now() + 3500;

  while (Date.now() < deadline) {
    const q = InstanceManager.getLastQr(instanceId);
    if (q) {
      finalQr = q;
      break;
    }
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- QR polling must wait between reads until Baileys publishes the next runtime value or the deadline expires.
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return finalQr || InstanceManager.getLastQr(instanceId) || "";
}

export { CHAT_PROVIDER_OPTIONS, isChatProviderId, normalizeMemoryLimit };
