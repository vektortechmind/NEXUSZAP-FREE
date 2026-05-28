import type { WASocket } from "@whiskeysockets/baileys";
import {
  isHostedLidUser,
  isHostedPnUser,
  isLidUser,
  isPnUser,
  jidDecode
} from "@whiskeysockets/baileys";
import { safeLogError } from "./redaction";

/** JID de identificador interno (LID) — não é número de telefone */
export function isWhatsAppInternalIdJid(jid: string): boolean {
  return !!isLidUser(jid) || !!isHostedLidUser(jid);
}

/**
 * Extrai dígitos do telefone a partir de um JID PN (@s.whatsapp.net / @hosted).
 * Não confunde o "user" de um LID (@lid / @hosted.lid) com número de telefone.
 */
export function jidToPhoneDigits(remoteJid: string): string | null {
  if (isWhatsAppInternalIdJid(remoteJid)) return null;

  const decoded = jidDecode(remoteJid);
  if (decoded) {
    const base = String(decoded.user).split(":")[0];
    if (/^\d{6,20}$/.test(base)) return base;
  }

  const m = remoteJid.match(/^(\d+)@/);
  return m ? m[1] : null;
}

/** Telefone legível E.164 (ex: +5511999999999) */
export function formatPhoneE164(remoteJid: string): string {
  const digits = jidToPhoneDigits(remoteJid);
  if (!digits) return remoteJid;
  return `+${digits}`;
}

const E164_RE = /^\+[1-9]\d{6,14}$/;

export function looksLikeRealPhoneE164(s: string | null | undefined): boolean {
  if (!s) return false;
  return E164_RE.test(String(s).trim());
}

function digitsFromPnJid(pnJid: string): string | null {
  const decoded = jidDecode(pnJid);
  if (!decoded) return null;
  const base = String(decoded.user).split(":")[0];
  return /^\d{6,20}$/.test(base) ? base : null;
}

/**
 * Baileys `getPNForLID` só aceita `@lid`. Chats podem vir como `@hosted.lid`;
 * o mapeamento no store usa o mesmo `user`, então consultamos com JID sintético `@lid`.
 */
export async function getPnJidForLidChat(
  sock: WASocket,
  lidJid: string
): Promise<string | null> {
  if (isLidUser(lidJid)) {
    return sock.signalRepository.lidMapping.getPNForLID(lidJid);
  }
  if (isHostedLidUser(lidJid)) {
    const d = jidDecode(lidJid);
    if (!d) return null;
    const synthetic = `${d.user}${d.device !== undefined ? `:${d.device}` : ""}@lid`;
    return sock.signalRepository.lidMapping.getPNForLID(synthetic);
  }
  return null;
}

/** Para `addOrEditContact`: devolve o JID PN (telefone) quando o chat é LID. */
export async function resolvePnJidForChat(
  sock: WASocket,
  remoteJid: string
): Promise<string | null> {
  if (isPnUser(remoteJid) || isHostedPnUser(remoteJid)) return remoteJid;
  return getPnJidForLidChat(sock, remoteJid);
}

/**
 * Resolve o número de telefone real para exibição/gravação:
 * 1) `remoteJidAlt` (PN alternativo quando o chat é LID)
 * 2) Mapeamento LID → PN (`getPnJidForLidChat`)
 * 3) fallback: `formatPhoneE164(remoteJid)` para JIDs PN já normais
 */
export async function resolveContactPhoneDisplay(
  sock: WASocket,
  remoteJid: string,
  remoteJidAlt?: string | null
): Promise<string> {
  if (remoteJidAlt && (isPnUser(remoteJidAlt) || isHostedPnUser(remoteJidAlt))) {
    const d = digitsFromPnJid(remoteJidAlt);
    if (d) return `+${d}`;
  }

  if (isWhatsAppInternalIdJid(remoteJid)) {
    try {
      const pnJid = await getPnJidForLidChat(sock, remoteJid);
      if (pnJid) {
        const d = digitsFromPnJid(pnJid);
        if (d) return `+${d}`;
      }
    } catch (e) {
      console.warn("[whatsappJid] getPnJidForLidChat:", safeLogError(e));
    }
  }

  return formatPhoneE164(remoteJid);
}
