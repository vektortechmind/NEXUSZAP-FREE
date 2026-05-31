export type CreateChannel = "WHATSAPP" | "TELEGRAM";
export type WorkspaceTab = "agent" | "ai" | "files" | "integrations";
export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";
export type ChatProvider = "groq" | "gemini" | "openrouter" | "openai";

export type AgentSummary = {
  id: string;
  name: string;
  telegramEnabled: boolean;
  audioTranscriptionEnabled: boolean;
  createdAt: string;
  instanceId: string;
  instanceName: string;
  instanceSlot: number;
  instanceStatus: string;
  instanceChatProvider: ChatProvider | null;
  instanceOpenaiModel: string | null;
  instanceOpenrouterModel: string | null;
  chatProvider?: ChatProvider | null;
  openaiModel?: string | null;
  openrouterModel?: string | null;
  memoryLimit?: number;
  systemPrompt?: string | null;
};

export type AgentWorkspace = AgentSummary & {
  systemPrompt: string | null;
};

export type EligibleInstance = {
  id: string;
  slot: number;
  name: string;
  status: string;
  available: boolean;
  occupied: boolean;
};

export type RuntimeProviderOption = {
  id: ChatProvider;
  label: string;
  supportsModel: boolean;
  defaultModel?: string;
};

export type RuntimeOptionsResponse = {
  providers: RuntimeProviderOption[];
  defaults: { memoryLimit: number };
};

export type TelegramStatus = {
  configured: boolean;
  online: boolean;
  label: string | null;
  instanceId?: string;
  instanceName?: string | null;
};

export type TelegramAgentConfig = {
  instanceId: string | null;
  instanceName: string | null;
  agentWorkspaceId: string | null;
  agentWorkspaceName: string | null;
  telegramSystemPrompt: string | null;
  canEdit: boolean;
  blockingReason: string | null;
};

export type KnowledgeFile = {
  id: string;
  filename: string;
  mimetype: string;
  createdAt: string;
};

export type AgentEditor = {
  id: string;
  name: string;
  systemPrompt: string;
  audioTranscriptionEnabled: boolean;
  instanceId: string;
  instanceName: string;
  instanceSlot: number;
  instanceStatus: string;
  runtime: {
    chatProvider: ChatProvider | "";
    openaiModel: string;
    openrouterModel: string;
    memoryLimit: number;
    providerFallback: boolean;
    providerFallbackLabel: string | null;
    modelFallback: boolean;
    modelFallbackLabel: string | null;
  };
  telegramPrompt: string;
};

export type CreateModalState = {
  open: boolean;
  channel: CreateChannel;
  name: string;
  instanceId: string;
  submitting: boolean;
  error: string | null;
};

export const initialCreateModalState: CreateModalState = {
  open: false,
  channel: "WHATSAPP",
  name: "",
  instanceId: "",
  submitting: false,
  error: null,
};
