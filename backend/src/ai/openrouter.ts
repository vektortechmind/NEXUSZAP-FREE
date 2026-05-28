import type { ChatMessage } from "./systemPrompt";
import { redactSensitiveText } from "../utils/redaction";

/**
 * Mensagens chegam como `ChatMessage[]` (system primeiro) via `askChat` → `normalizeMessagesForChatApi`.
 * @see ./systemPrompt.ts
 */
export type { ChatMessage } from "./systemPrompt";

const DEFAULT_OPENROUTER_MODEL = "meta-llama/llama-3-8b-instruct:free";

export function defaultOpenRouterModelId(): string {
  return DEFAULT_OPENROUTER_MODEL;
}

export async function openRouterChat(
  apiKey: string,
  messages: ChatMessage[],
  modelId?: string | null
) {
  const model =
    typeof modelId === "string" && modelId.trim().length > 0
      ? modelId.trim()
      : DEFAULT_OPENROUTER_MODEL;
  const key = apiKey.trim();
  const referer = process.env.OPENROUTER_REFERER ?? "http://localhost:5173";
  const title = process.env.OPENROUTER_TITLE ?? "Chatbot Multi-IA Guard";
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": referer,
      "X-Title": title
    },
    body: JSON.stringify({ model, messages })
  });
  const raw = await res.text();
  if (!res.ok) {
    const safeBody = redactSensitiveText(raw, 180);
    console.error("[openRouterChat] HTTP", res.status, safeBody);
    throw new Error(`OpenRouter HTTP error: ${res.status} ${safeBody}`);
  }
  const data = JSON.parse(raw) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("OpenRouter: resposta vazia");
  }
  return text;
}
