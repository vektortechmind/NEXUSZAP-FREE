import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const DEFAULT_JWT_SECRET = "change-me-min-16-chars!!";
const DEFAULT_ADMIN_PASSWORD = "admin123";

function hasStrongPasswordShape(value: string): boolean {
  return /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().default(3000),
  JWT_SECRET: z.string().min(16),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(5),
  /** Origens extras para CORS (VPS), separadas por vírgula. Ex: https://app.seudominio.com */
  CORS_ORIGINS: z.string().optional(),
  APP_URL: z.preprocess((val) => {
    if (val === undefined || val === null || String(val).trim() === "") return undefined;
    return val;
  }, z.string().url().optional()),
  SETUP_TOKEN: z.string().optional(),
  ADMIN_SETUP_REQUIRED: z.string().optional(),
  SETUP_COMPLETED: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),
  GITHUB_REPO: z.string().optional(),
  OPENROUTER_REFERER: z.string().url().default("http://localhost:5173"),
  OPENROUTER_TITLE: z.string().min(1).default("Chatbot Multi-IA Guard"),
  /** Token real do BotFather (>=10). Valores curtos/placeholder são ignorados. */
  TELEGRAM_BOT_TOKEN: z.preprocess((val) => {
    if (val === undefined || val === null) return undefined;
    const s = String(val).trim();
    if (s.length < 10) return undefined;
    return s;
  }, z.string().min(10).optional())
}).superRefine((value, ctx) => {
  if (value.NODE_ENV !== "production") return;

  if (value.JWT_SECRET === DEFAULT_JWT_SECRET || value.JWT_SECRET.length < 32) {
    ctx.addIssue({
      code: "custom",
      path: ["JWT_SECRET"],
      message: "JWT_SECRET de produção deve ter pelo menos 32 caracteres e não pode usar valor padrão."
    });
  }

  if (
    value.ADMIN_PASSWORD === DEFAULT_ADMIN_PASSWORD ||
    value.ADMIN_PASSWORD.length < 12 ||
    !hasStrongPasswordShape(value.ADMIN_PASSWORD)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["ADMIN_PASSWORD"],
      message: "ADMIN_PASSWORD de produção deve ser forte e não pode usar valor padrão."
    });
  }

  if (!value.APP_URL) {
    ctx.addIssue({
      code: "custom",
      path: ["APP_URL"],
      message: "APP_URL de producao deve apontar para a URL publica real que expoe o backend/API."
    });
  }

  if (!value.GITHUB_REPO || value.GITHUB_REPO === "owner/repo" || !/^.+\/.+$/.test(value.GITHUB_REPO)) {
    ctx.addIssue({
      code: "custom",
      path: ["GITHUB_REPO"],
      message: "GITHUB_REPO de producao deve ser informado no formato owner/repo e nao pode usar owner/repo."
    });
  }

  const encryptionKey = value.ENCRYPTION_KEY ? Buffer.from(value.ENCRYPTION_KEY, "base64") : null;
  if (!encryptionKey || encryptionKey.length !== 32) {
    ctx.addIssue({
      code: "custom",
      path: ["ENCRYPTION_KEY"],
      message: "ENCRYPTION_KEY de producao deve ser base64 com 32 bytes."
    });
  }
});

export function parseRuntimeEnv(input: NodeJS.ProcessEnv) {
  return envSchema.parse(input);
}

export const DIRECT_ENV_READ_JUSTIFICATIONS = {
  setupService: "Le leituras diretas e arquivo .env para concluir o bootstrap inicial antes de reiniciar o processo com env validado.",
  updateServicePaths: "Overrides UPDATE_* e APP_VERSION sao caminhos/versoes operacionais nao sensiveis usados por worker CLI e testes.",
  scripts: "Scripts de teste/operacao definem defaults locais antes de importar o backend para isolar dependencias externas.",
} as const;

export const env = parseRuntimeEnv(process.env);

