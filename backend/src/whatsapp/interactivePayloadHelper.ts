import { randomBytes } from "crypto";

type BinaryNode = {
  tag: string;
  attrs: Record<string, string>;
  content?: Array<BinaryNode | { tag: string; attrs: Record<string, string>; content: Buffer }>;
};

export type CtaUrlInteractiveInput = {
  body: string;
  buttonText: string;
  url: string;
  footer?: string | null;
  useWebview?: boolean;
};

export type CtaUrlInteractivePayload = {
  message: {
    interactiveMessage: {
      body: { text: string };
      footer?: { text: string };
      nativeFlowMessage: {
        buttons: [
          {
            name: "cta_url";
            buttonParamsJson: string;
          },
        ];
        messageParamsJson: string;
      };
    };
  };
  additionalNodes: BinaryNode[];
  summary: {
    deliveryPath: "interactive_cta_url";
    interactiveKind: "cta_url";
    buttonCount: 1;
    hasAdditionalNodes: true;
    reference: "itsliaaa/baileys";
  };
};

const CTA_INPUT_KEYS = new Set(["body", "buttonText", "url", "footer", "useWebview"]);
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
    attrs: {},
    content: [
      {
        tag: "qc_documentation",
        attrs: { decision_id: randomBytes(20).toString("hex") },
        content: [
          {
            tag: "decision",
            attrs: { source_type: "third_party" },
            content: [
              {
                tag: "decision_source",
                attrs: {},
                content: Buffer.from("df"),
              },
            ],
          },
        ],
      },
    ],
  };

  return {
    tag: "biz",
    attrs: {
      actual_actors: "2",
      host_storage: "2",
      privacy_mode_ts: String(now),
    },
    content: [nativeFlow, qualityControl],
  };
}

export function buildCtaUrlInteractivePayload(rawInput: CtaUrlInteractiveInput): CtaUrlInteractivePayload {
  assertAllowedKeys(rawInput as Record<string, unknown>);

  const body = normalizeText(rawInput.body, "body", MAX_BODY_LENGTH);
  const buttonText = normalizeText(rawInput.buttonText, "buttonText", MAX_BUTTON_TEXT_LENGTH);
  const url = normalizeHttpUrl(rawInput.url);
  const footer = normalizeOptionalText(rawInput.footer, "footer", MAX_FOOTER_LENGTH);
  const useWebview = rawInput.useWebview === true;

  const buttonParams: Record<string, unknown> = {
    display_text: buttonText,
    url,
    merchant_url: url,
  };

  if (useWebview) {
    buttonParams.webview_interaction = true;
  }

  const interactiveMessage: CtaUrlInteractivePayload["message"]["interactiveMessage"] = {
    body: { text: body },
    nativeFlowMessage: {
      buttons: [
        {
          name: "cta_url",
          buttonParamsJson: JSON.stringify(buttonParams),
        },
      ],
      messageParamsJson: JSON.stringify({ from: "nexuszap", templateId: "cta_url_experimental" }),
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
      buttonCount: 1,
      hasAdditionalNodes: true,
      reference: "itsliaaa/baileys",
    },
  };
}

export function buildCtaUrlFallbackText(input: CtaUrlInteractiveInput): string {
  const body = normalizeText(input.body, "body", MAX_BODY_LENGTH);
  const url = normalizeHttpUrl(input.url);
  return `${body}\n\n${url}`;
}

