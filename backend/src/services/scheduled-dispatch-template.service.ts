import { type ScheduledDispatchContentType, type ScheduledDispatchTemplate } from "@prisma/client";
import { prisma } from "../database/prisma";
import { isScheduledDispatchTemplateMediaUrl } from "./scheduled-dispatch-template.mediaStorage";

export type ScheduledDispatchTemplateRecord = ScheduledDispatchTemplate;
export type ScheduledDispatchTemplateUrlButton = {
  text: string;
  url: string;
};
export type ScheduledDispatchTemplateViewRecord = Omit<ScheduledDispatchTemplateRecord, "buttonsJson"> & {
  buttons: ScheduledDispatchTemplateUrlButton[];
};

type ScheduledDispatchTemplateInput = {
  name: string;
  contentType: "text" | "image" | "video";
  body?: string | null;
  mediaUrl?: string | null;
  mediaFileName?: string | null;
  buttons?: ScheduledDispatchTemplateUrlButton[] | null;
};

export type ScheduledDispatchTemplateStore = {
  createTemplate(input: {
    name: string;
    contentType: ScheduledDispatchContentType;
    body?: string | null;
    mediaUrl?: string | null;
    mediaFileName?: string | null;
    buttonsJson?: string | null;
  }): Promise<ScheduledDispatchTemplateRecord>;
  listTemplates(): Promise<ScheduledDispatchTemplateRecord[]>;
  findTemplateById(id: string): Promise<ScheduledDispatchTemplateRecord | null>;
  updateTemplate(id: string, input: {
    name: string;
    contentType: ScheduledDispatchContentType;
    body?: string | null;
    mediaUrl?: string | null;
    mediaFileName?: string | null;
    buttonsJson?: string | null;
  }): Promise<ScheduledDispatchTemplateRecord | null>;
  deleteTemplate(id: string): Promise<boolean>;
};

export class ScheduledDispatchTemplateValidationError extends Error {
  code = "SCHEDULED_DISPATCH_TEMPLATE_VALIDATION_ERROR";

  constructor(message: string, public statusCode = 400) {
    super(message);
  }
}

export class ScheduledDispatchTemplateNotFoundError extends Error {
  code = "SCHEDULED_DISPATCH_TEMPLATE_NOT_FOUND";

  constructor(templateId: string) {
    super(`Template de disparo ${templateId} nao encontrado.`);
  }
}

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeOptionalText(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeRequiredName(value: string) {
  const name = normalizeOptionalText(value);
  if (!name) throw new ScheduledDispatchTemplateValidationError("Nome do template e obrigatorio.");
  if (name.length > 120) throw new ScheduledDispatchTemplateValidationError("Nome do template deve ter no maximo 120 caracteres.");
  return name;
}

function normalizeUrl(value: string, field: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new ScheduledDispatchTemplateValidationError(`${field} invalida.`);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ScheduledDispatchTemplateValidationError(`${field} deve usar http ou https.`);
  }

  return parsed.toString();
}

const MAX_TEMPLATE_BUTTONS = 3;
const MAX_TEMPLATE_BUTTON_TEXT_LENGTH = 60;

function normalizeTemplateButtons(buttons?: ScheduledDispatchTemplateUrlButton[] | null): ScheduledDispatchTemplateUrlButton[] {
  if (!buttons?.length) return [];
  if (buttons.length > MAX_TEMPLATE_BUTTONS) {
    throw new ScheduledDispatchTemplateValidationError(`Template aceita no maximo ${MAX_TEMPLATE_BUTTONS} botoes URL.`);
  }

  return buttons.map((button, index) => {
    const text = normalizeOptionalText(button.text);
    if (!text) throw new ScheduledDispatchTemplateValidationError(`buttons.${index}.text e obrigatorio.`);
    if (text.length > MAX_TEMPLATE_BUTTON_TEXT_LENGTH) {
      throw new ScheduledDispatchTemplateValidationError(`buttons.${index}.text excede ${MAX_TEMPLATE_BUTTON_TEXT_LENGTH} caracteres.`);
    }

    const url = normalizeOptionalText(button.url);
    if (!url) throw new ScheduledDispatchTemplateValidationError(`buttons.${index}.url e obrigatoria.`);

    return { text, url: normalizeUrl(url, `buttons.${index}.url`) };
  });
}

function serializeTemplateButtons(buttons: ScheduledDispatchTemplateUrlButton[]): string | null {
  return buttons.length ? JSON.stringify(buttons) : null;
}

export function parseScheduledDispatchTemplateButtons(buttonsJson: string | null): ScheduledDispatchTemplateUrlButton[] {
  if (!buttonsJson) return [];
  try {
    const parsed = JSON.parse(buttonsJson) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const text = normalizeOptionalText((item as { text?: string }).text);
      const url = normalizeOptionalText((item as { url?: string }).url);
      if (!text || !url) return [];
      return [{ text, url }];
    });
  } catch {
    return [];
  }
}

function mapContentType(value: ScheduledDispatchTemplateInput["contentType"]): ScheduledDispatchContentType {
  if (value === "image") return "IMAGE";
  if (value === "video") return "VIDEO";
  return "TEXT";
}

function toTemplateView(record: ScheduledDispatchTemplateRecord): ScheduledDispatchTemplateViewRecord {
  const { buttonsJson, ...rest } = record;
  return {
    ...rest,
    buttons: parseScheduledDispatchTemplateButtons(buttonsJson),
  };
}

function normalizeTemplateInput(input: ScheduledDispatchTemplateInput) {
  const name = normalizeRequiredName(input.name);
  const contentType = mapContentType(input.contentType);
  const body = normalizeOptionalText(input.body);
  const mediaUrl = normalizeOptionalText(input.mediaUrl);
  const mediaFileName = normalizeOptionalText(input.mediaFileName);
  const buttons = normalizeTemplateButtons(input.buttons);

  if (contentType === "TEXT") {
    if (!body) throw new ScheduledDispatchTemplateValidationError("Template de texto exige body.");
    if (mediaUrl) throw new ScheduledDispatchTemplateValidationError("Template de texto nao aceita mediaUrl.");
  }

  if ((contentType === "IMAGE" || contentType === "VIDEO") && !mediaUrl) {
    throw new ScheduledDispatchTemplateValidationError("Template com midia exige mediaUrl.");
  }

  if (mediaUrl && !isScheduledDispatchTemplateMediaUrl(mediaUrl)) {
    throw new ScheduledDispatchTemplateValidationError("mediaUrl deve apontar para midia de template.");
  }

  return {
    name,
    contentType,
    body,
    mediaUrl,
    mediaFileName,
    buttonsJson: serializeTemplateButtons(buttons),
  };
}

export const prismaScheduledDispatchTemplateStore: ScheduledDispatchTemplateStore = {
  async createTemplate(input) {
    return prisma.scheduledDispatchTemplate.create({ data: input });
  },

  async listTemplates() {
    return prisma.scheduledDispatchTemplate.findMany({ orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }, { name: "asc" }] });
  },

  async findTemplateById(id) {
    return prisma.scheduledDispatchTemplate.findUnique({ where: { id } });
  },

  async updateTemplate(id, input) {
    try {
      return await prisma.scheduledDispatchTemplate.update({ where: { id }, data: input });
    } catch (err) {
      if (err instanceof Error && err.message.includes("Record to update not found")) return null;
      throw err;
    }
  },

  async deleteTemplate(id) {
    const result = await prisma.scheduledDispatchTemplate.deleteMany({ where: { id } });
    return result.count === 1;
  },
};

export function createInMemoryScheduledDispatchTemplateStore(seed: ScheduledDispatchTemplateRecord[] = []): ScheduledDispatchTemplateStore & {
  templates: Map<string, ScheduledDispatchTemplateRecord>;
} {
  const templates = new Map(seed.map((template) => [template.id, template]));

  return {
    templates,
    async createTemplate(input) {
      const now = new Date();
      const record: ScheduledDispatchTemplateRecord = {
        id: newId("scheduled-dispatch-template"),
        name: input.name,
        contentType: input.contentType,
        body: input.body ?? null,
        mediaUrl: input.mediaUrl ?? null,
        mediaFileName: input.mediaFileName ?? null,
        buttonsJson: input.buttonsJson ?? null,
        createdAt: now,
        updatedAt: now,
      };
      templates.set(record.id, record);
      return record;
    },
    async listTemplates() {
      return Array.from(templates.values()).sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
    },
    async findTemplateById(id) {
      return templates.get(id) ?? null;
    },
    async updateTemplate(id, input) {
      const current = templates.get(id);
      if (!current) return null;
      const updated: ScheduledDispatchTemplateRecord = {
        ...current,
        name: input.name,
        contentType: input.contentType,
        body: input.body ?? null,
        mediaUrl: input.mediaUrl ?? null,
        mediaFileName: input.mediaFileName ?? null,
        buttonsJson: input.buttonsJson ?? null,
        updatedAt: new Date(),
      };
      templates.set(id, updated);
      return updated;
    },
    async deleteTemplate(id) {
      return templates.delete(id);
    },
  };
}

export function createScheduledDispatchTemplateService(deps: { store?: ScheduledDispatchTemplateStore } = {}) {
  const store = deps.store ?? prismaScheduledDispatchTemplateStore;

  return {
    async createTemplate(input: ScheduledDispatchTemplateInput) {
      return toTemplateView(await store.createTemplate(normalizeTemplateInput(input)));
    },

    async listTemplates() {
      return (await store.listTemplates()).map(toTemplateView);
    },

    async getTemplate(id: string) {
      const template = await store.findTemplateById(id);
      if (!template) throw new ScheduledDispatchTemplateNotFoundError(id);
      return toTemplateView(template);
    },

    async updateTemplate(id: string, input: ScheduledDispatchTemplateInput) {
      const template = await store.updateTemplate(id, normalizeTemplateInput(input));
      if (!template) throw new ScheduledDispatchTemplateNotFoundError(id);
      return toTemplateView(template);
    },

    async deleteTemplate(id: string) {
      const deleted = await store.deleteTemplate(id);
      if (!deleted) throw new ScheduledDispatchTemplateNotFoundError(id);
      return { deleted: true };
    },
  };
}

export const scheduledDispatchTemplateService = createScheduledDispatchTemplateService();
