import type { ChatMessageStatus } from "./types";

export function getMessageStatusLabel(status: ChatMessageStatus) {
  if (status === "READ") return "Lida";
  if (status === "DELIVERED") return "Entregue";
  if (status === "FAILED") return "Falhou";
  if (status === "PENDING") return "Pendente";
  return "Enviada";
}
