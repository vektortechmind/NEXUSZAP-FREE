import { buildPromptInjectionGuardrailBlock, wrapUntrustedUserMessage } from "./promptGuard";

/**
 * Identidade fixa do atendente (sempre role=system, sempre primeiro).
 * {{agent_name}} vem do campo **agentName** da instância (instruções do agente), não do nome interno da instância.
 */
export const SYSTEM_IDENTITY_TEMPLATE = `
Você é um atendente humano do WhatsApp.

Seu nome é {{agent_name}}

Nunca diga que é IA.
Nunca diga que é assistente virtual.
Nunca diga que não tem nome.

Responda curto e natural.
Estilo WhatsApp.
`.trim();

export function formatIdentityBlock(agentName: string): string {
  const name = (agentName || "Atendente").trim() || "Atendente";
  return SYSTEM_IDENTITY_TEMPLATE.replace(/\{\{\s*agent_name\s*\}\}/g, name);
}

/** Nome exibido no chat: definido em "Nome do atendente" (`agentName`). Se vazio, "Atendente" (não usa o rótulo interno `name`). */
export function resolveAgentDisplayName(instance: { agentName: string | null; name: string }): string {
  const n = instance.agentName?.trim();
  if (n) return n;
  return "Atendente";
}

/**
 * System completo: identidade obrigatória + instruções do painel (global/instância) + arquivos.
 */
export function buildCompleteSystemPrompt(params: {
  agentName: string;
  /** Texto de getResolvedAgentPrompt (global ou instância); pode ser vazio */
  behavioralPrompt: string;
  /** Sufixo com contexto de PDFs/arquivos */
  fileContextSuffix?: string;
}): string {
  const identity = formatIdentityBlock(params.agentName);
  const parts: string[] = [identity, `\n\n${buildPromptInjectionGuardrailBlock()}`];

  const extra = params.behavioralPrompt?.trim();
  if (extra) {
    parts.push(`\n\n[Instruções adicionais]\n${extra}`);
  }

  const files = params.fileContextSuffix?.trim();
  if (files) {
    parts.push(files.startsWith("\n") ? files : `\n\n${files}`);
  }

  return parts.join("").trim();
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * Garante exatamente uma mensagem system no índice 0 e o restante só user/assistant.
 * Qualquer outro role vira user. Vários system no array são fundidos em um só.
 */
export function normalizeMessagesForChatApi(
  messages: { role: string; content: string }[]
): ChatMessage[] {
  const systemChunks: string[] = [];
  const rest: { role: "user" | "assistant"; content: string }[] = [];

  for (const m of messages) {
    const role = String(m.role ?? "").toLowerCase();
    const content = String(m.content ?? "");
    if (role === "system") {
      if (content.trim()) systemChunks.push(content.trim());
    } else if (role === "assistant") {
      rest.push({ role: "assistant", content: content.slice(0, 4000) });
    } else {
      rest.push({ role: "user", content: wrapUntrustedUserMessage(content) });
    }
  }

  const mergedSystem = systemChunks.join("\n\n").trim();
  if (!mergedSystem) {
    throw new Error(
      "[normalizeMessagesForChatApi] Falta role=system. A identidade fixa deve ser enviada como system."
    );
  }

  return [{ role: "system", content: mergedSystem }, ...rest];
}
