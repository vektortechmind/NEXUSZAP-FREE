import type { Instance, Prisma } from "@prisma/client";
import { encryptSecret, maskStoredSecret } from "./crypto.service";

export const AGENT_SECRET_FIELDS = [
  "groqKey",
  "groqAudioKey",
  "geminiKey",
  "openrouterKey"
] as const;

type AgentSecretField = (typeof AGENT_SECRET_FIELDS)[number];
type AgentConfigUpdate = Partial<Record<keyof Instance, unknown>>;

function isSecretField(field: string): field is AgentSecretField {
  return (AGENT_SECRET_FIELDS as readonly string[]).includes(field);
}

function shouldStoreSecret(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !value.includes("****");
}

export function sanitizeAgentConfigForResponse(agent: Instance) {
  const publicConfig: Record<string, unknown> = {
    ...agent,
    telegramBotToken: undefined
  };

  for (const field of AGENT_SECRET_FIELDS) {
    const stored = agent[field];
    publicConfig[field] = null;
    publicConfig[`${field}Configured`] = !!stored;
    publicConfig[`${field}Masked`] = stored ? maskStoredSecret(stored) : null;
  }

  publicConfig.telegramBotTokenConfigured = !!agent.telegramBotToken;
  publicConfig.telegramBotTokenMasked = agent.telegramBotToken
    ? maskStoredSecret(agent.telegramBotToken)
    : null;

  delete publicConfig.telegramBotToken;
  return publicConfig;
}

export function buildAgentConfigUpdateData(input: AgentConfigUpdate): Prisma.InstanceUpdateInput {
  const data: Record<string, unknown> = {};

  for (const [field, value] of Object.entries(input)) {
    if (isSecretField(field)) {
      if (shouldStoreSecret(value)) {
        data[field] = encryptSecret(value.trim());
      }
      continue;
    }
    data[field] = value;
  }

  return data as Prisma.InstanceUpdateInput;
}
