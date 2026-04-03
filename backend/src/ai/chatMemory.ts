/**
 * Histórico user/assistant por conversa (WhatsApp / Telegram), antes do system prompt.
 * Reduz tokens e custo; 5 turnos costuma ser suficiente para contexto recente.
 */
export const CHAT_MEMORY_MAX_MESSAGES = 5;
