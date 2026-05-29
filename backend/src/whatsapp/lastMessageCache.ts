import type { proto, WAMessage } from "@whiskeysockets/baileys";

const LAST_MESSAGE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type LastMessageEntry = {
  key: proto.IMessageKey;
  messageTimestamp: number;
  updatedAt: number;
};

const cache = new Map<string, LastMessageEntry>();

function key(instanceId: string, remoteJid: string) {
  return `${instanceId}\0${remoteJid}`;
}

function toTimestamp(v: proto.IWebMessageInfo["messageTimestamp"] | unknown): number {
  if (v == null) return Math.floor(Date.now() / 1000);
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "toNumber" in v && typeof (v as { toNumber: () => number }).toNumber === "function") {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Math.floor(Date.now() / 1000);
}

function pruneExpired() {
  const expiresBefore = Date.now() - LAST_MESSAGE_CACHE_TTL_MS;
  let removed = 0;
  for (const [cacheKey, entry] of cache.entries()) {
    if (entry.updatedAt >= expiresBefore) continue;
    cache.delete(cacheKey);
    removed += 1;
  }
  if (removed > 0) {
    console.info("[LastMessageCache] entradas expiradas removidas", { removed, ttlMs: LAST_MESSAGE_CACHE_TTL_MS });
  }
  return removed;
}

export function recordLastMessageForChat(
  instanceId: string,
  remoteJid: string,
  msg: WAMessage | proto.IWebMessageInfo
) {
  pruneExpired();
  const k = msg.key;
  if (!k?.id || !remoteJid) return;
  cache.set(key(instanceId, remoteJid), {
    key: k,
    messageTimestamp: toTimestamp((msg as proto.IWebMessageInfo).messageTimestamp),
    updatedAt: Date.now(),
  });
}

export function getLastMessagesForChatModify(
  instanceId: string,
  remoteJid: string
): { key: proto.IMessageKey; messageTimestamp: number }[] | null {
  pruneExpired();
  const v = cache.get(key(instanceId, remoteJid));
  if (!v?.key?.id) return null;
  v.updatedAt = Date.now();
  return [
    {
      key: v.key,
      messageTimestamp: toTimestamp(v.messageTimestamp)
    }
  ];
}

export function clearLastMessagesForInstance(instanceId: string): number {
  let removed = 0;
  for (const cacheKey of cache.keys()) {
    if (!cacheKey.startsWith(`${instanceId}\0`)) continue;
    if (cache.delete(cacheKey)) removed += 1;
  }
  if (removed > 0) {
    console.info("[LastMessageCache] cache limpo para instancia", { instanceId, removed });
  }
  return removed;
}

export function getLastMessageCacheDiagnostics() {
  pruneExpired();
  return {
    ttlMs: LAST_MESSAGE_CACHE_TTL_MS,
    entries: cache.size,
  };
}
