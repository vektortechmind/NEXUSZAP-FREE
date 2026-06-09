import type { ChatMessage } from "./types";

export type MessageContextMenuAction = "reply" | "edit" | "delete_for_me" | "delete_for_everyone" | "delete_forever";

function isWithinDeleteWindow(message: ChatMessage) {
  return Date.now() - new Date(message.createdAt).getTime() <= 48 * 60 * 60 * 1000;
}

export function isWithinEditWindow(message: ChatMessage) {
  return Date.now() - new Date(message.createdAt).getTime() <= 15 * 60 * 1000;
}

export function getMessageContextActions(message: ChatMessage): MessageContextMenuAction[] {
  if (message.isDeleted) return [];
  const actions: MessageContextMenuAction[] = ["reply"];
  if (message.fromMe) {
    if (message.messageType === "TEXT" && isWithinEditWindow(message)) actions.push("edit");
    actions.push("delete_for_me");
    if (isWithinDeleteWindow(message)) actions.push("delete_for_everyone");
    actions.push("delete_forever");
  }
  return actions;
}
