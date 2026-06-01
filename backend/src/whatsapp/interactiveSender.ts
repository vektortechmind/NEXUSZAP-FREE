import { randomUUID } from "crypto";
import { prepareWAMessageMedia, proto, type MessageRelayOptions, type WAMediaUploadFunction } from "@whiskeysockets/baileys";
import { safeErrorMessage } from "../utils/redaction";
import {
  buildCtaUrlFallbackText,
  buildCtaUrlInteractivePayload,
  buildNativeInteractiveFallbackText,
  buildNativeInteractivePayload,
  type CtaUrlInteractiveInput,
  type NativeInteractiveInput,
} from "./interactivePayloadHelper";

type SendMessageResult = { key?: { id?: string | null } } | string | void;

export type NativeInteractiveRelaySocket = {
  relayMessage?: (jid: string, message: proto.IMessage, options: MessageRelayOptions) => Promise<string>;
  sendMessage?: (jid: string, content: { text: string }) => Promise<SendMessageResult>;
  waUploadToServer?: WAMediaUploadFunction;
};

export type CtaUrlRelaySocket = NativeInteractiveRelaySocket;

export type SendNativeInteractiveOptions = {
  enabled?: boolean;
  messageId?: string;
  fallbackText?: string;
  sendFallbackAfterInteractiveSuccess?: boolean;
  headerImageBuffer?: Buffer | null;
  headerImageMimeType?: string | null;
};

export type SendCtaUrlInteractiveOptions = SendNativeInteractiveOptions;

export type SendNativeInteractiveResult = {
  deliveryPath: "interactive_native" | "text_fallback_interactive_native";
  providerMessageId?: string;
  fallbackProviderMessageId?: string;
  interactiveError?: string;
  summary: {
    interactiveKind: "native_flow";
    interactiveButtonKinds: Array<"cta_url" | "cta_copy">;
    interactiveButtonCount: number;
    attemptedInteractive: boolean;
    fallbackUsed: boolean;
    hasAdditionalNodes: boolean;
  };
};

export type SendCtaUrlInteractiveResult = {
  deliveryPath: "interactive_cta_url" | "text_fallback_interactive_cta_url";
  providerMessageId?: string;
  fallbackProviderMessageId?: string;
  interactiveError?: string;
  summary: {
    interactiveKind: "cta_url";
    interactiveButtonKinds: Array<"cta_url">;
    interactiveButtonCount: number;
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
  sock: NativeInteractiveRelaySocket,
  jid: string,
  text: string,
): Promise<string | undefined> {
  if (typeof sock.sendMessage !== "function") {
    throw new Error("Socket nao suporta sendMessage para fallback textual.");
  }
  const sent = await sock.sendMessage(jid, { text });
  return extractMessageId(sent);
}

export async function sendNativeInteractiveMessage(
  sock: NativeInteractiveRelaySocket,
  jid: string,
  input: NativeInteractiveInput,
  options: SendNativeInteractiveOptions = {},
): Promise<SendNativeInteractiveResult> {
  const payload = buildNativeInteractivePayload(input);
  const messageId = options.messageId || randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase();
  const fallbackText = options.fallbackText?.trim() || buildNativeInteractiveFallbackText(input);

  if (options.enabled === false || typeof sock.relayMessage !== "function") {
    const fallbackProviderMessageId = await sendFallbackText(sock, jid, fallbackText);
    return {
      deliveryPath: "text_fallback_interactive_native",
      fallbackProviderMessageId,
      summary: {
        interactiveKind: "native_flow",
        interactiveButtonKinds: payload.summary.buttonKinds,
        interactiveButtonCount: payload.summary.buttonCount,
        attemptedInteractive: false,
        fallbackUsed: true,
        hasAdditionalNodes: false,
      },
    };
  }

  try {
    // Payload shape adapted from MIT-licensed native flow/additionalNodes patterns in itsliaaa/baileys.
    if (options.headerImageBuffer && typeof sock.waUploadToServer === "function") {
      const media = await prepareWAMessageMedia({
        image: options.headerImageBuffer,
        mimetype: options.headerImageMimeType ?? undefined,
      }, { upload: sock.waUploadToServer });
      if (media.imageMessage) {
        payload.message.interactiveMessage.header = {
          hasMediaAttachment: true,
          imageMessage: media.imageMessage,
        };
      }
    }

    const message = proto.Message.create(payload.message);
    const providerMessageId = await sock.relayMessage(jid, message, {
      messageId,
      additionalNodes: payload.additionalNodes,
    });

    if (options.sendFallbackAfterInteractiveSuccess) {
      const fallbackProviderMessageId = await sendFallbackText(sock, jid, fallbackText);
      return {
        deliveryPath: "text_fallback_interactive_native",
        providerMessageId: providerMessageId || messageId,
        fallbackProviderMessageId,
        summary: {
          interactiveKind: "native_flow",
          interactiveButtonKinds: payload.summary.buttonKinds,
          interactiveButtonCount: payload.summary.buttonCount,
          attemptedInteractive: true,
          fallbackUsed: true,
          hasAdditionalNodes: true,
        },
      };
    }

    return {
      deliveryPath: "interactive_native",
      providerMessageId: providerMessageId || messageId,
      summary: {
        interactiveKind: "native_flow",
        interactiveButtonKinds: payload.summary.buttonKinds,
        interactiveButtonCount: payload.summary.buttonCount,
        attemptedInteractive: true,
        fallbackUsed: false,
        hasAdditionalNodes: true,
      },
    };
  } catch (error) {
    const fallbackProviderMessageId = await sendFallbackText(sock, jid, fallbackText);
    return {
      deliveryPath: "text_fallback_interactive_native",
      fallbackProviderMessageId,
      interactiveError: safeErrorMessage(error, "Falha ao enviar mensagem interativa nativa."),
      summary: {
        interactiveKind: "native_flow",
        interactiveButtonKinds: payload.summary.buttonKinds,
        interactiveButtonCount: payload.summary.buttonCount,
        attemptedInteractive: true,
        fallbackUsed: true,
        hasAdditionalNodes: true,
      },
    };
  }
}

export async function sendCtaUrlInteractiveMessage(
  sock: CtaUrlRelaySocket,
  jid: string,
  input: CtaUrlInteractiveInput,
  options: SendCtaUrlInteractiveOptions = {},
): Promise<SendCtaUrlInteractiveResult> {
  const payload = buildCtaUrlInteractivePayload(input);
  const messageId = options.messageId || randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase();
  const fallbackText = options.fallbackText?.trim() || buildCtaUrlFallbackText(input);

  if (options.enabled === false || typeof sock.relayMessage !== "function") {
    const fallbackProviderMessageId = await sendFallbackText(sock, jid, fallbackText);
    return {
      deliveryPath: "text_fallback_interactive_cta_url",
      fallbackProviderMessageId,
      summary: {
        interactiveKind: "cta_url",
        interactiveButtonKinds: ["cta_url"],
        interactiveButtonCount: payload.summary.buttonCount,
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

    if (options.sendFallbackAfterInteractiveSuccess) {
      const fallbackProviderMessageId = await sendFallbackText(sock, jid, fallbackText);
      return {
        deliveryPath: "text_fallback_interactive_cta_url",
        providerMessageId: providerMessageId || messageId,
        fallbackProviderMessageId,
        summary: {
          interactiveKind: "cta_url",
          interactiveButtonKinds: ["cta_url"],
          interactiveButtonCount: payload.summary.buttonCount,
          attemptedInteractive: true,
          fallbackUsed: true,
          hasAdditionalNodes: true,
        },
      };
    }

    return {
      deliveryPath: "interactive_cta_url",
      providerMessageId: providerMessageId || messageId,
      summary: {
        interactiveKind: "cta_url",
        interactiveButtonKinds: ["cta_url"],
        interactiveButtonCount: payload.summary.buttonCount,
        attemptedInteractive: true,
        fallbackUsed: false,
        hasAdditionalNodes: true,
      },
    };
  } catch (error) {
    const fallbackProviderMessageId = await sendFallbackText(sock, jid, fallbackText);
    return {
      deliveryPath: "text_fallback_interactive_cta_url",
      fallbackProviderMessageId,
      interactiveError: safeErrorMessage(error, "Falha ao enviar CTA URL interativo."),
      summary: {
        interactiveKind: "cta_url",
        interactiveButtonKinds: ["cta_url"],
        interactiveButtonCount: payload.summary.buttonCount,
        attemptedInteractive: true,
        fallbackUsed: true,
        hasAdditionalNodes: true,
      },
    };
  }
}
