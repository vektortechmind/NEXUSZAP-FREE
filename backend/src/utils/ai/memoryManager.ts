import { CHAT_MEMORY_MAX_MESSAGES, CHAT_MEMORY_STORAGE_MAX_MESSAGES } from "../../ai/chatMemory";

export type MemoryRole = "user" | "assistant" | "system";

export interface MemoryItem {
  role: MemoryRole;
  content: string;
}

type MemoryEntry = {
  messages: MemoryItem[];
  lastAccessedAt: number;
};

const DEFAULT_MAX_CONVERSATIONS = 500;
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export class MemoryManager {
  private memory = new Map<string, MemoryEntry>();
  private maxConversations: number;
  private ttlMs: number;

  constructor(options?: { maxConversations?: number; ttlMs?: number }) {
    this.maxConversations = options?.maxConversations ?? readPositiveInt(
      process.env.CHAT_MEMORY_MAX_CONVERSATIONS,
      DEFAULT_MAX_CONVERSATIONS
    );
    this.ttlMs = options?.ttlMs ?? readPositiveInt(
      process.env.CHAT_MEMORY_TTL_MS,
      DEFAULT_TTL_MS
    );
  }

  public getMemory(key: string, limit = CHAT_MEMORY_MAX_MESSAGES): MemoryItem[] {
    this.pruneExpired();
    const entry = this.memory.get(key);
    if (!entry) return [];
    entry.lastAccessedAt = Date.now();
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : CHAT_MEMORY_MAX_MESSAGES;
    if (entry.messages.length <= safeLimit) return [...entry.messages];
    return entry.messages.slice(entry.messages.length - safeLimit);
  }

  public addMessage(key: string, role: MemoryRole, content: string): void {
    this.pruneExpired();
    const entry = this.memory.get(key) ?? { messages: [], lastAccessedAt: Date.now() };
    let currentMemory = [...entry.messages, { role, content }];

    if (currentMemory.length > CHAT_MEMORY_STORAGE_MAX_MESSAGES) {
      currentMemory = currentMemory.slice(currentMemory.length - CHAT_MEMORY_STORAGE_MAX_MESSAGES);
    }

    this.memory.set(key, { messages: currentMemory, lastAccessedAt: Date.now() });
    this.enforceMaxConversations();
  }

  public getLastAssistantMessage(key: string): string | null {
    const currentMemory = this.getMemory(key);
    for (let i = currentMemory.length - 1; i >= 0; i--) {
      if (currentMemory[i].role === "assistant") {
        return currentMemory[i].content;
      }
    }
    return null;
  }

  public size(): number {
    this.pruneExpired();
    return this.memory.size;
  }

  public clear(key: string): void {
    this.memory.delete(key);
  }

  private pruneExpired(): void {
    const expiresBefore = Date.now() - this.ttlMs;
    for (const [key, entry] of this.memory.entries()) {
      if (entry.lastAccessedAt < expiresBefore) {
        this.memory.delete(key);
      }
    }
  }

  private enforceMaxConversations(): void {
    if (this.memory.size <= this.maxConversations) return;

    const entries = [...this.memory.entries()].sort(
      (a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt
    );
    const removeCount = this.memory.size - this.maxConversations;
    for (const [key] of entries.slice(0, removeCount)) {
      this.memory.delete(key);
    }
  }
}

export const globalMemoryManager = new MemoryManager();
