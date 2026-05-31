import { randomUUID } from "crypto";
import { proto } from "@whiskeysockets/baileys";
import { safeErrorMessage } from "../utils/redaction";
import {
  buildCtaUrlFallbackText,
  buildCtaUrlInteractivePayload,
  type CtaUrlInteractiveInput,
} from "./interactivePayloadHelper";

type SendMessageResult = { key?: { id?: string | null } } | string | void;

export type CtaUrlRelaySocket = {
  relayMessage?: (jid: string, message: proto.IMessage, options: { messageId?: string; additionalNodes?: unknown[] }) => Promise<string>;
  sendMessage?: (jid: string, content: { text: string }) => Promise<SendMessageResult>;
};

export type SendCtaUrlInteractiveOptions = {
  enabled?: boolean;
  messageId?: string;
  fallbackText?: string;
};

export type SendCtaUrlInteractiveResult = {
  deliveryPath: "interactive_cta_url" | "text_fallback_interactive_cta_url";
  providerMessageId?: string;
  fallbackProviderMessageId?: string;
  interactiveError?: string;
  summary: {
    interactiveKind: "cta_url";
    attemptedInteractive: boolean;
    fallbackUsed: boolean;
    hasAdditionalNodes: boolean;
  };
};

function extractMessageId(result: SendMessageResult): string | undefined {
  if (typeof result === "string" && result.trim()) return result;
  if (result && typeof result === "object") {
    const id = result.key?.id;
    if (typeof id === "string" && id.trim()) return id;
  }
  return undefined;
}

async function sendFallbackText(
  sock: CtaUrlRelaySocket,
  jid: string,
  input: CtaUrlInteractiveInput,
  fallbackText?: string
): Promise<string | undefined> {
  if (typeof sock.sendMessage !== "function") {
    throw new Error("Socket nao suporta sendMessage para fallback textual.");
  }
  const text = fallbackText?.trim() || buildCtaUrlFallbackText(input);
  const sent = await sock.sendMessage(jid, { text });
  return extractMessageId(sent);
}

export async function sendCtaUrlInteractiveMessage(
  sock: CtaUrlRelaySocket,
  jid: string,
  input: CtaUrlInteractiveInput,
  options: SendCtaUrlInteractiveOptions = {}
): Promise<SendCtaUrlInteractiveResult> {
  const payload = buildCtaUrlInteractivePayload(input);
  const messageId = options.messageId || randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase();

  if (options.enabled === false || typeof sock.relayMessage !== "function") {
    const fallbackProviderMessageId = await sendFallbackText(sock, jid, input, options.fallbackText);
    return {
      deliveryPath: "text_fallback_interactive_cta_url",
      fallbackProviderMessageId,
      summary: {
        interactiveKind: "cta_url",
        attemptedInteractive: false,
        fallbackUsed: true,
        hasAdditionalNodes: false,
      },
    };
  }

  try {
    // Payload shape adapted from MIT-licensed native flow/additionalNodes patterns in itsliaaa/baileys.
    const message = proto.Message.create(payload.message);
    const providerMessageId = await sock.relayMessage(jid, message, {
      messageId,
      additionalNodes: payload.additionalNodes,
    });

    return {
      deliveryPath: "interactive_cta_url",
      providerMessageId: providerMessageId || messageId,
      summary: {
        interactiveKind: "cta_url",
        attemptedInteractive: true,
        fallbackUsed: false,
        hasAdditionalNodes: true,
      },
    };
  } catch (error) {
    const fallbackProviderMessageId = await sendFallbackText(sock, jid, input, options.fallbackText);
    return {
      deliveryPath: "text_fallback_interactive_cta_url",
      fallbackProviderMessageId,
      interactiveError: safeErrorMessage(error, "Falha ao enviar CTA URL interativo."),
      summary: {
        interactiveKind: "cta_url",
        attemptedInteractive: true,
        fallbackUsed: true,
        hasAdditionalNodes: true,
      },
    };
  }
}

