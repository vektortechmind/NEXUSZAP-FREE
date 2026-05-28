import { prisma } from "../database/prisma";

/** Instruções extras (opcional). A identidade fixa vem de `ai/systemPrompt.ts`. */
const DEFAULT_BEHAVIORAL = "";

/**
 * Texto adicional de comportamento/negócio (só na instância). Não substitui a identidade fixa.
 */
export async function getResolvedAgentPrompt(instanceId: string): Promise<string> {
  const instance = await prisma.instance.findUnique({
    where: { id: instanceId },
    include: {
      agent: {
        select: {
          systemPrompt: true,
        },
      },
    },
  });
  const custom = instance?.agent?.systemPrompt?.trim() || instance?.systemPrompt?.trim();
  if (custom) return custom;
  return DEFAULT_BEHAVIORAL;
}

/**
 * Texto de comportamento exclusivo do Telegram.
 */
export async function getResolvedTelegramPrompt(instanceId: string): Promise<string> {
  const instance = await prisma.instance.findUnique({
    where: { id: instanceId },
    include: {
      agent: {
        select: {
          telegramSystemPrompt: true,
        },
      },
    },
  });
  const custom = instance?.agent?.telegramSystemPrompt?.trim() || instance?.telegramSystemPrompt?.trim();
  if (custom) return custom;
  return DEFAULT_BEHAVIORAL;
}
