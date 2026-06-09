import type { ChatMessageStatus } from "./types";
import type { ChatMessage } from "./types";

export function getMessageStatusLabel(status: ChatMessageStatus) {
  if (status === "READ") return "Lida";
  if (status === "DELIVERED") return "Entregue";
  if (status === "FAILED") return "Falhou";
  if (status === "PENDING") return "Pendente";
  return "Enviada";
}

export function getKnownMessageFallback(message: Pick<ChatMessage, "messageType" | "mediaUrl" | "mediaMimeType">) {
  const isAudio = message.messageType === "AUDIO" || Boolean(message.mediaMimeType?.toLowerCase().startsWith("audio/"));
  if (isAudio) return "Audio recebido";
  if (message.messageType === "IMAGE") return "Imagem recebida";
  if (message.messageType === "VIDEO") return "Video recebido";
  if (message.messageType === "DOCUMENT") return "Documento recebido";
  if (message.messageType === "REACTION") return "Reacao recebida";
  if (message.messageType === "BUTTONS_REPLY") return "Resposta de botao";
  if (message.messageType === "LIST_REPLY") return "Resposta de lista";
  return "Mensagem recebida";
}

export function getMessagePreviewText(message: Pick<ChatMessage, "body" | "messageType" | "mediaMimeType" | "isDeleted">) {
  if (message.isDeleted) return "Mensagem apagada";
  if (message.body?.trim()) return message.body.trim();
  return getKnownMessageFallback({ messageType: message.messageType, mediaUrl: null, mediaMimeType: message.mediaMimeType });
}
