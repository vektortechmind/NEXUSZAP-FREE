import type { ChatMessage } from "./systemPrompt";
import { redactSensitiveText } from "../utils/redaction";

/**
 * Mensagens chegam como `ChatMessage[]` (system primeiro) via `askChat` → `normalizeMessagesForChatApi`.
 * @see ./systemPrompt.ts
 */
export type { ChatMessage } from "./systemPrompt";

/**
 * Gemini: exige alternância user/model em muitos modelos — mensagens user consecutivas quebram a API.
 */
function mergeConsecutiveRoles(messages: { role: string; content: string }[]) {
  const out: { role: string; content: string }[] = [];
  for (const m of messages) {
    const last = out[out.length - 1];
    if (last && last.role === m.role) {
      last.content = `${last.content}\n\n---\n\n${m.content}`;
    } else {
      out.push({ role: m.role, content: m.content });
    }
  }
  return out;
}

/**
 * Modelos Gemini disponíveis (atualizado 2026).
 * @see https://ai.google.dev/gemini-api/docs/models/gemini
 */
const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro"
];

export async function geminiChat(apiKey: string, messages: ChatMessage[]) {
  const systemText = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  let dialog = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as string, content: String(m.content ?? "") }));

  dialog = mergeConsecutiveRoles(dialog);

  const contents: { role: string; parts: { text: string }[] }[] = dialog.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  if (systemText.trim() && contents.length > 0) {
    contents[0].parts.unshift({ text: `[SYSTEM INSTRUCTION]: ${systemText}` });
  }

  const body: Record<string, unknown> = { contents };

  let lastErr = "";
  for (const model of GEMINI_MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify(body)
      }
    );

    const raw = await res.text();
    if (!res.ok) {
      lastErr = `Gemini ${model}: HTTP ${res.status} ${redactSensitiveText(raw, 180)}`;
      console.error("[geminiChat]", lastErr);
      continue;
    }

    let data: {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
      error?: { message?: string };
    };
    try {
      data = JSON.parse(raw);
    } catch {
      lastErr = "Gemini: resposta JSON inválida";
      continue;
    }

    if (data.promptFeedback?.blockReason) {
      lastErr = `Gemini bloqueou: ${data.promptFeedback.blockReason}`;
      console.error("[geminiChat]", lastErr);
      continue;
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text === "string" && text.trim()) {
      return text;
    }

    lastErr = `Gemini ${model}: sem texto (finish: ${data.candidates?.[0]?.finishReason ?? "?"})`;
    console.error("[geminiChat]", lastErr);
  }

  throw new Error(lastErr || "Gemini: falha em todos os modelos tentados.");
}
