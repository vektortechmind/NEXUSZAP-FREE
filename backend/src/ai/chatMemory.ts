/**
 * Histórico user/assistant por conversa (WhatsApp / Telegram), antes do system prompt.
 * O limite padrão operacional continua pequeno, mas armazenamos mais mensagens
 * para permitir recorte por instância via memoryLimit no runtime.
 */
export const CHAT_MEMORY_MAX_MESSAGES = 5;
export const CHAT_MEMORY_STORAGE_MAX_MESSAGES = 50;
