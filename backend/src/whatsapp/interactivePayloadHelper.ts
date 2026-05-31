import { randomBytes } from "crypto";
import type { BinaryNode } from "@whiskeysockets/baileys";

export type CtaUrlInteractiveInput = {
  body: string;
  buttonText?: string;
  url?: string;
  buttons?: Array<{
    text: string;
    url: string;
    useWebview?: boolean;
  }>;
  footer?: string | null;
  useWebview?: boolean;
};

export type CtaUrlInteractivePayload = {
  message: {
    interactiveMessage: {
      body: { text: string };
      footer?: { text: string };
      nativeFlowMessage: {
        buttons: Array<{
          name: "cta_url";
          buttonParamsJson: string;
        }>;
        messageParamsJson: string;
      };
    };
  };
  additionalNodes: BinaryNode[];
  summary: {
    deliveryPath: "interactive_cta_url";
    interactiveKind: "cta_url";
    buttonCount: number;
    hasAdditionalNodes: true;
    reference: "itsliaaa/baileys";
  };
};

const CTA_INPUT_KEYS = new Set(["body", "buttonText", "url", "buttons", "footer", "useWebview"]);
const MAX_BODY_LENGTH = 4000;
const MAX_BUTTON_TEXT_LENGTH = 60;
const MAX_FOOTER_LENGTH = 300;

function assertAllowedKeys(input: Record<string, unknown>) {
  for (const key of Object.keys(input)) {
    if (!CTA_INPUT_KEYS.has(key)) {
      throw new Error(`Campo nao permitido para CTA URL: ${key}`);
    }
  }
}

function normalizeText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`${field} deve ser texto.`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} e obrigatorio.`);
  if (trimmed.length > maxLength) throw new Error(`${field} excede ${maxLength} caracteres.`);
  return trimmed;
}

function normalizeOptionalText(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  return normalizeText(value, field, maxLength);
}

function normalizeHttpUrl(value: unknown): string {
  if (typeof value !== "string") throw new Error("url deve ser texto.");
  const trimmed = value.trim();
  if (!trimmed) throw new Error("url e obrigatoria.");

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("url deve ser uma URL valida.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("url deve usar http ou https.");
  }

  return parsed.toString();
}

function normalizeButtons(rawInput: CtaUrlInteractiveInput): Array<{ text: string; url: string; useWebview?: boolean }> {
  const rawButtons = rawInput.buttons?.length
    ? rawInput.buttons
    : rawInput.buttonText && rawInput.url
      ? [{ text: rawInput.buttonText, url: rawInput.url, useWebview: rawInput.useWebview }]
      : [];

  if (rawButtons.length === 0) throw new Error("Ao menos um botao CTA URL e obrigatorio.");
  if (rawButtons.length > 3) throw new Error("CTA URL aceita no maximo 3 botoes.");

  return rawButtons.map((button, index) => ({
    text: normalizeText(button.text, `buttons.${index}.text`, MAX_BUTTON_TEXT_LENGTH),
    url: normalizeHttpUrl(button.url),
    useWebview: button.useWebview === true,
  }));
}

function buildBizAdditionalNode(now = Date.now()): BinaryNode {
  const nativeFlow = {
    tag: "interactive",
    attrs: { type: "native_flow", v: "1" },
    content: [
      {
        tag: "native_flow",
        attrs: { v: "9", name: "mixed" },
      },
    ],
  };

  const qualityControl = {
    tag: "quality_control",
    attrs: {
      decision_id: randomBytes(20).toString("hex"),
      source_type: "third_party",
    },
    content: [
      {
        tag: "decision_source",
        attrs: { value: "df" },
      },
    ],
  };

  return {
    tag: "biz",
    attrs: {
      actual_actors: "2",
      host_storage: "2",
      privacy_mode_ts: String(Math.floor(now / 1000)),
    },
    content: [nativeFlow, qualityControl],
  };
}

export function buildCtaUrlInteractivePayload(rawInput: CtaUrlInteractiveInput): CtaUrlInteractivePayload {
  assertAllowedKeys(rawInput as Record<string, unknown>);

  const body = normalizeText(rawInput.body, "body", MAX_BODY_LENGTH);
  const buttons = normalizeButtons(rawInput);
  const footer = normalizeOptionalText(rawInput.footer, "footer", MAX_FOOTER_LENGTH);

  const interactiveMessage: CtaUrlInteractivePayload["message"]["interactiveMessage"] = {
    body: { text: body },
    nativeFlowMessage: {
      buttons: buttons.map((button) => {
        const buttonParams: Record<string, unknown> = {
          display_text: button.text,
          url: button.url,
          merchant_url: button.url,
        };

        if (button.useWebview) {
          buttonParams.webview_interaction = true;
        }

        return {
          name: "cta_url",
          buttonParamsJson: JSON.stringify(buttonParams),
        };
      }),
      messageParamsJson: JSON.stringify({}),
    },
  };

  if (footer) {
    interactiveMessage.footer = { text: footer };
  }

  return {
    message: { interactiveMessage },
    additionalNodes: [buildBizAdditionalNode()],
    summary: {
      deliveryPath: "interactive_cta_url",
      interactiveKind: "cta_url",
      buttonCount: buttons.length,
      hasAdditionalNodes: true,
      reference: "itsliaaa/baileys",
    },
  };
}

export function buildCtaUrlFallbackText(input: CtaUrlInteractiveInput): string {
  const body = normalizeText(input.body, "body", MAX_BODY_LENGTH);
  const buttons = normalizeButtons(input);
  const missingLinks = buttons
    .map((button) => button.url)
    .filter((url) => !body.includes(url));
  return [body, ...missingLinks].join("\n\n");
}
