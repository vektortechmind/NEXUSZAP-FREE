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

type MemoryLogger = {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
};

type MemoryStats = {
  expiredEntriesPruned: number;
  conversationsEvicted: number;
  messagesTrimmed: number;
  manualClears: number;
};

const DEFAULT_MAX_CONVERSATIONS = 500;
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createDefaultLogger(): MemoryLogger {
  return {
    info: (message, meta) => {
      console.info(`[MemoryManager] ${message}`, meta ?? {});
    },
    warn: (message, meta) => {
      console.warn(`[MemoryManager] ${message}`, meta ?? {});
    },
  };
}

export class MemoryManager {
  private memory = new Map<string, MemoryEntry>();
  private maxConversations: number;
  private ttlMs: number;
  private logger: MemoryLogger;
  private stats: MemoryStats = {
    expiredEntriesPruned: 0,
    conversationsEvicted: 0,
    messagesTrimmed: 0,
    manualClears: 0,
  };

  constructor(options?: { maxConversations?: number; ttlMs?: number; logger?: MemoryLogger }) {
    this.maxConversations = options?.maxConversations ?? readPositiveInt(
      process.env.CHAT_MEMORY_MAX_CONVERSATIONS,
      DEFAULT_MAX_CONVERSATIONS
    );
    this.ttlMs = options?.ttlMs ?? readPositiveInt(
      process.env.CHAT_MEMORY_TTL_MS,
      DEFAULT_TTL_MS
    );
    this.logger = options?.logger ?? createDefaultLogger();
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
      const trimmedCount = currentMemory.length - CHAT_MEMORY_STORAGE_MAX_MESSAGES;
      currentMemory = currentMemory.slice(currentMemory.length - CHAT_MEMORY_STORAGE_MAX_MESSAGES);
      this.stats.messagesTrimmed += trimmedCount;
      this.logger.warn("memoria truncada por limite maximo", {
        key,
        trimmedCount,
        storageLimit: CHAT_MEMORY_STORAGE_MAX_MESSAGES,
      });
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
    if (this.memory.delete(key)) {
      this.stats.manualClears += 1;
    }
  }

  public clearByPrefix(prefix: string): number {
    let cleared = 0;
    for (const key of this.memory.keys()) {
      if (!key.startsWith(prefix)) continue;
      if (this.memory.delete(key)) cleared += 1;
    }
    if (cleared > 0) {
      this.stats.manualClears += cleared;
      this.logger.info("memoria limpa por prefixo", { prefix, cleared });
    }
    return cleared;
  }

  public clearAll(): number {
    const cleared = this.memory.size;
    if (cleared > 0) {
      this.memory.clear();
      this.stats.manualClears += cleared;
      this.logger.info("memoria limpa integralmente", { cleared });
    }
    return cleared;
  }

  public pruneExpiredNow(): number {
    return this.pruneExpired();
  }

  public getDiagnostics() {
    this.pruneExpired();
    return {
      activeConversations: this.memory.size,
      maxConversations: this.maxConversations,
      ttlMs: this.ttlMs,
      storageLimitPerConversation: CHAT_MEMORY_STORAGE_MAX_MESSAGES,
      runtimeLimitDefault: CHAT_MEMORY_MAX_MESSAGES,
      stats: { ...this.stats },
    };
  }

  private pruneExpired(): number {
    const expiresBefore = Date.now() - this.ttlMs;
    let removed = 0;
    for (const [key, entry] of this.memory.entries()) {
      if (entry.lastAccessedAt < expiresBefore) {
        this.memory.delete(key);
        removed += 1;
      }
    }
    if (removed > 0) {
      this.stats.expiredEntriesPruned += removed;
      this.logger.info("memoria expirada removida", {
        removed,
        ttlMs: this.ttlMs,
        activeConversations: this.memory.size,
      });
    }
    return removed;
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
    this.stats.conversationsEvicted += removeCount;
    this.logger.warn("conversas descartadas por limite maximo", {
      removed: removeCount,
      maxConversations: this.maxConversations,
      activeConversations: this.memory.size,
    });
  }
}

export const globalMemoryManager = new MemoryManager();
