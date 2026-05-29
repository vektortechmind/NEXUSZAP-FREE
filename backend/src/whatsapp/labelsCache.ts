import type { Label } from "@whiskeysockets/baileys/lib/Types/Label.js";

const LABEL_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

type LabelCacheEntry = {
  labels: Map<string, Label>;
  updatedAt: number;
};

const byInstance = new Map<string, LabelCacheEntry>();

function ensureEntry(instanceId: string) {
  const existing = byInstance.get(instanceId);
  if (existing) return existing;

  const created: LabelCacheEntry = {
    labels: new Map(),
    updatedAt: Date.now(),
  };
  byInstance.set(instanceId, created);
  return created;
}

function pruneExpired() {
  const expiresBefore = Date.now() - LABEL_CACHE_TTL_MS;
  let removed = 0;
  for (const [instanceId, entry] of byInstance.entries()) {
    if (entry.updatedAt >= expiresBefore) continue;
    byInstance.delete(instanceId);
    removed += 1;
  }
  if (removed > 0) {
    console.info("[LabelsCache] caches expirados removidos", { removed, ttlMs: LABEL_CACHE_TTL_MS });
  }
  return removed;
}

export function onInstanceLabelEdit(instanceId: string, label: Label) {
  pruneExpired();
  const entry = ensureEntry(instanceId);
  entry.updatedAt = Date.now();
  if (label.deleted) {
    entry.labels.delete(label.id);
  } else {
    entry.labels.set(label.id, label);
  }
}

export function getLabelsForInstance(instanceId: string): Label[] {
  pruneExpired();
  const entry = byInstance.get(instanceId);
  if (!entry) return [];
  entry.updatedAt = Date.now();
  return Array.from(entry.labels.values()).filter((l) => !l.deleted);
}

export function getLabelsCacheDiagnostics() {
  pruneExpired();
  return {
    ttlMs: LABEL_CACHE_TTL_MS,
    activeInstances: byInstance.size,
    totalLabels: Array.from(byInstance.values()).reduce((sum, entry) => sum + entry.labels.size, 0),
  };
}

export function clearLabelsForInstance(instanceId: string) {
  const existed = byInstance.delete(instanceId);
  if (existed) {
    console.info("[LabelsCache] cache limpo para instancia", { instanceId });
  }
}
