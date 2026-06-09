import type { ChatMessage } from "./types";

export function upsertMessage(list: ChatMessage[], next: ChatMessage) {
  const exists = list.some((message) => message.id === next.id);
  const merged = exists ? list.map((message) => message.id === next.id ? { ...message, ...next } : message) : [...list, next];
  return merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
