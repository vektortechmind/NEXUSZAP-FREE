import { redactSensitiveText } from "../utils/redaction";
import type { ChatMessage } from "./systemPrompt";

const DEFAULT_OPENAI_MODEL = "gpt-5";

export function defaultOpenAiModelId(): string {
  return DEFAULT_OPENAI_MODEL;
}

function splitInstructions(messages: ChatMessage[]) {
  const instructions = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join("\n\n");

  const input = messages
    .filter((message) => message.role !== "system")
    .map((message) => `${message.role === "assistant" ? "ASSISTANT" : "USER"}: ${message.content}`)
    .join("\n");

  return { instructions, input };
}

function extractOutputText(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const response = data as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ text?: unknown; type?: unknown }> }>;
  };

  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  const parts = response.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter((text): text is string => typeof text === "string" && text.trim().length > 0);

  return parts && parts.length > 0 ? parts.join("\n") : null;
}

export async function openAiChat(apiKey: string, messages: ChatMessage[], modelId?: string | null) {
  const key = apiKey.trim();
  const model = typeof modelId === "string" && modelId.trim().length > 0 ? modelId.trim() : DEFAULT_OPENAI_MODEL;
  const { instructions, input } = splitInstructions(messages);

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      ...(instructions ? { instructions } : {}),
      input: input || "Responda com uma mensagem útil e breve.",
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    const safeBody = redactSensitiveText(raw, 180);
    console.error("[openAiChat] HTTP", res.status, safeBody);
    throw new Error(`OpenAI HTTP error: ${res.status} ${safeBody}`);
  }

  const data = JSON.parse(raw) as unknown;
  const text = extractOutputText(data);
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("OpenAI: resposta vazia");
  }
  return text;
}
