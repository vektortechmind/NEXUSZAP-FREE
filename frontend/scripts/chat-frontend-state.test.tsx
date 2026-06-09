import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { APP_NAV_GROUPS, getAppRouteTitle } from "../src/features/navigation/appNavigation.ts";
import { ConversationList } from "../src/features/chat/ConversationList.tsx";
import { MessageBubble } from "../src/features/chat/MessageBubble.tsx";
import { ChatInput } from "../src/features/chat/ChatInput.tsx";
import { MessageContextMenu } from "../src/features/chat/MessageContextMenu.tsx";
import { MediaViewer } from "../src/features/chat/MediaViewer.tsx";
import { QUICK_REACTIONS } from "../src/features/chat/chatReactions.ts";
import { getViewportAwareMenuPosition } from "../src/features/chat/messageMenuPosition.ts";
import { getViewportAwarePopupPosition } from "../src/features/chat/emojiPickerPosition.ts";
import { getMessageContextActions, isWithinEditWindow } from "../src/features/chat/messageContextActions.ts";
import { getKnownMessageFallback, getMessageStatusLabel } from "../src/features/chat/chatDisplay.ts";
import { upsertMessage } from "../src/features/chat/chatState.ts";
import { filterConversations, getUnreadTotal } from "../src/features/chat/useConversations.ts";
import type { ChatConversation, ChatMessage } from "../src/features/chat/types.ts";

globalThis.React = React;

const textMessage: ChatMessage = {
  id: "message-1",
  conversationId: "conversation-a",
  instanceId: "instance-a",
  jid: "5511999990000@s.whatsapp.net",
  fromMe: false,
  body: "Oi, preciso de ajuda",
  messageType: "TEXT",
  status: "DELIVERED",
  providerMessageId: "wamid.in.1",
  mediaUrl: null,
  mediaMimeType: null,
  mediaDurationMs: null,
  reactionEmoji: null,
  editedAt: null,
  isDeleted: false,
  quotedMessageId: null,
  createdAt: "2026-06-09T12:00:00.000Z",
};

const audioMessage: ChatMessage = {
  ...textMessage,
  id: "message-audio",
  body: null,
  messageType: "AUDIO",
  mediaUrl: "https://media.example.com/audio.ogg",
  mediaMimeType: "audio/ogg",
  mediaDurationMs: 31_000,
};

const imageMessage: ChatMessage = {
  ...textMessage,
  id: "message-image",
  body: null,
  messageType: "IMAGE",
  mediaUrl: "/api/chat/media/instance-a/wamid.image.1",
  mediaMimeType: "image/jpeg",
};

const videoMessage: ChatMessage = {
  ...textMessage,
  id: "message-video",
  body: null,
  messageType: "VIDEO",
  mediaUrl: "/api/chat/media/instance-a/wamid.video.1",
  mediaMimeType: "video/mp4",
};

const conversations: ChatConversation[] = [
  {
    id: "conversation-a",
    instanceId: "instance-a",
    jid: "5511999990000@s.whatsapp.net",
    name: "Cliente Alpha",
    profilePicUrl: "https://img.example.com/a.jpg",
    lastMessageAt: "2026-06-09T12:00:00.000Z",
    unreadCount: 3,
    createdAt: "2026-06-09T11:00:00.000Z",
    updatedAt: "2026-06-09T12:00:00.000Z",
    lastMessage: textMessage,
  },
  {
    id: "conversation-b",
    instanceId: "instance-b",
    jid: "5511888880000@s.whatsapp.net",
    name: "Beta Suporte",
    profilePicUrl: null,
    lastMessageAt: "2026-06-09T10:00:00.000Z",
    unreadCount: 1,
    createdAt: "2026-06-09T09:00:00.000Z",
    updatedAt: "2026-06-09T10:00:00.000Z",
    lastMessage: audioMessage,
  },
];

test("chat route is exposed in navigation and route metadata", () => {
  const operationGroup = APP_NAV_GROUPS.find((group) => group.label === "Operação");
  assert.ok(operationGroup?.items.some((item) => item.name === "Conversas" && item.path === "/chat"));
  assert.equal(getAppRouteTitle("/chat"), "Conversas");
});

test("conversation helpers filter by instance, name and preview while summing unread totals", () => {
  assert.equal(getUnreadTotal(conversations), 4);
  assert.deepEqual(filterConversations(conversations, "instance-b", "").map((item) => item.id), ["conversation-b"]);
  assert.deepEqual(filterConversations(conversations, "all", "alpha").map((item) => item.id), ["conversation-a"]);
  assert.deepEqual(filterConversations(conversations, "all", "audio").map((item) => item.id), ["conversation-b"]);
});

test("conversation list renders avatar, preview, unread badge and instance badge when filter is all", () => {
  const html = renderToStaticMarkup(
    <ConversationList
      conversations={conversations}
      instances={[{ id: "instance-a", name: "Vendas" }, { id: "instance-b", name: "Suporte" }]}
      selectedConversationKey={null}
      selectedInstanceId="all"
      search=""
      loading={false}
      error={null}
      onSelect={() => undefined}
      onInstanceChange={() => undefined}
      onSearchChange={() => undefined}
    />,
  );
  assert.doesNotMatch(html, /<h1[^>]*>Conversas<\/h1>/);
  assert.match(html, /Cliente Alpha/);
  assert.match(html, /Oi, preciso de ajuda/);
  assert.match(html, /Vendas/);
  assert.match(html, />3</);
  assert.match(html, /Buscar nome ou mensagem/);
});

test("conversation list does not render unread badge for zero", () => {
  const html = renderToStaticMarkup(
    <ConversationList
      conversations={[{ ...conversations[0], unreadCount: 0 }]}
      instances={[{ id: "instance-a", name: "Vendas" }]}
      selectedConversationKey={null}
      selectedInstanceId="all"
      search=""
      loading={false}
      error={null}
      onSelect={() => undefined}
      onInstanceChange={() => undefined}
      onSearchChange={() => undefined}
    />,
  );
  assert.doesNotMatch(html, />0</);
});

test("message bubbles render direction, status and inline audio controls", () => {
  const sentHtml = renderToStaticMarkup(<MessageBubble message={{ ...textMessage, fromMe: true, status: "READ" }} />);
  const audioHtml = renderToStaticMarkup(<MessageBubble message={audioMessage} />);
  assert.match(sentHtml, /Oi, preciso de ajuda/);
  assert.match(sentHtml, /w-fit/);
  assert.match(sentHtml, /<time dateTime="2026-06-09T12:00:00.000Z">/);
  assert.match(sentHtml, /inline-flex align-baseline/);
  assert.match(sentHtml, /Lida/);
  assert.equal(getMessageStatusLabel("DELIVERED"), "Entregue");
  assert.match(audioHtml, /Reproduzir audio/);
  assert.doesNotMatch(audioHtml, /Mensagem sem texto/);
  assert.doesNotMatch(audioHtml, /border border-slate/);
  assert.doesNotMatch(audioHtml, /<audio[^>]*controls(\s|=|>)/);
  assert.doesNotMatch(audioHtml, /<a\s[^>]*download/i);
  assert.doesNotMatch(audioHtml, />\s*Baixar\s*</i);
  assert.match(audioHtml, /https:\/\/media.example.com\/audio.ogg/);
});

test("message bubbles render image, video, view-once marker and reactions inline", () => {
  const imageHtml = renderToStaticMarkup(<MessageBubble message={imageMessage} />);
  const videoHtml = renderToStaticMarkup(<MessageBubble message={videoMessage} />);
  const fallbackHtml = renderToStaticMarkup(<MessageBubble message={{ ...imageMessage, mediaUrl: null }} />);
  const reactedHtml = renderToStaticMarkup(<MessageBubble message={{ ...textMessage, reactionEmoji: "👍" }} />);
  const viewOnceHtml = renderToStaticMarkup(<MessageBubble message={{ ...imageMessage, body: "Visualizacao unica\nLegenda" }} />);
  assert.match(imageHtml, /<img/);
  assert.match(imageHtml, /\/api\/chat\/media\/instance-a\/wamid.image.1/);
  assert.match(imageHtml, /Abrir imagem/);
  assert.match(imageHtml, /p-0 overflow-hidden/);
  assert.match(videoHtml, /<video/);
  assert.match(videoHtml, /Abrir video/);
  assert.match(fallbackHtml, /\[Imagem\]/);
  assert.match(reactedHtml, /👍/);
  assert.match(viewOnceHtml, /Visualizacao unica/);
  assert.match(viewOnceHtml, /Legenda/);
});

test("message bubbles render edited, deleted and quoted states", () => {
  const editedHtml = renderToStaticMarkup(<MessageBubble message={{ ...textMessage, editedAt: "2026-06-09T12:01:00.000Z" }} />);
  const deletedHtml = renderToStaticMarkup(<MessageBubble message={{ ...textMessage, body: null, isDeleted: true }} />);
  const quotedHtml = renderToStaticMarkup(<MessageBubble message={{ ...textMessage, id: "reply", quotedMessageId: "wamid.in.1" }} quotedMessage={textMessage} />);
  assert.match(editedHtml, /Editado/);
  assert.match(deletedHtml, /Mensagem apagada/);
  assert.match(quotedHtml, /Voce|Contato/);
  assert.match(quotedHtml, /Oi, preciso de ajuda/);
});

test("message context menu exposes conditional actions", () => {
  assert.deepEqual(getMessageContextActions({ ...textMessage, fromMe: false }), ["reply"]);
  const freshOwnText = { ...textMessage, fromMe: true, createdAt: new Date().toISOString() };
  const oldOwnText = { ...freshOwnText, createdAt: new Date(Date.now() - 16 * 60 * 1000).toISOString() };
  assert.equal(isWithinEditWindow(freshOwnText), true);
  assert.equal(isWithinEditWindow(oldOwnText), false);
  assert.deepEqual(getMessageContextActions(freshOwnText).slice(0, 3), ["reply", "edit", "delete_for_me"]);
  assert.deepEqual(getMessageContextActions(oldOwnText).slice(0, 2), ["reply", "delete_for_me"]);
  assert.deepEqual(getMessageContextActions({ ...textMessage, isDeleted: true }), []);
  const html = renderToStaticMarkup(
    <MessageContextMenu
      message={freshOwnText}
      position={{ x: 10, y: 20 }}
      onAction={() => undefined}
      onClose={() => undefined}
    />,
  );
  assert.match(html, /Responder/);
  assert.match(html, /Editar/);
  assert.match(html, /Apagar para mim/);
});

test("emoji picker uses emoji-mart and message bubble plus button", () => {
  const bubbleHtml = renderToStaticMarkup(<MessageBubble message={{ ...textMessage, providerMessageId: "wamid.in.1" }} onReact={() => undefined} />);
  const packageJson = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../package.json"), "utf8"));
  const popupSource = fs.readFileSync(path.resolve(import.meta.dirname, "../src/features/chat/EmojiMartPopup.tsx"), "utf8");
  const bubbleSource = fs.readFileSync(path.resolve(import.meta.dirname, "../src/features/chat/MessageBubble.tsx"), "utf8");
  assert.equal(QUICK_REACTIONS.length, 6);
  assert.equal(typeof packageJson.dependencies["emoji-mart"], "string");
  assert.equal(typeof packageJson.dependencies["@emoji-mart/react"], "string");
  assert.equal(typeof packageJson.dependencies["@emoji-mart/data"], "string");
  assert.match(popupSource, /import Picker from "@emoji-mart\/react"/);
  assert.match(popupSource, /emojiVersion="14\.0"/);
  assert.match(popupSource, /theme="auto"/);
  assert.match(popupSource, /EMOJI_PICKER_CATEGORIES/);
  assert.match(popupSource, /"flags"/);
  assert.match(popupSource, /perLine=\{8\}/);
  assert.match(popupSource, /emojiSize=\{18\}/);
  assert.match(popupSource, /emojiButtonSize=\{30\}/);
  assert.match(popupSource, /previewPosition="none"/);
  assert.match(popupSource, /onEmojiSelect/);
  assert.match(popupSource, /pointerdown/);
  assert.match(popupSource, /Escape/);
  assert.match(bubbleHtml, /Abrir reacoes/);
  assert.match(bubbleSource, /Mais emojis/);
  assert.match(bubbleSource, /SmilePlus/);
  assert.doesNotMatch(bubbleSource, /group-hover:flex/);
});

test("emoji popup position opens inside viewport", () => {
  const topAnchor = { left: 20, right: 52, top: 8, bottom: 40, width: 32, height: 32 } as DOMRect;
  const bottomAnchor = { left: 740, right: 772, top: 560, bottom: 592, width: 32, height: 32 } as DOMRect;
  const topPosition = getViewportAwarePopupPosition({ anchorRect: topAnchor, popupWidth: 292, popupHeight: 340, viewportWidth: 800, viewportHeight: 600 });
  const bottomPosition = getViewportAwarePopupPosition({ anchorRect: bottomAnchor, popupWidth: 292, popupHeight: 340, viewportWidth: 800, viewportHeight: 600 });
  assert.equal(topPosition.top >= topAnchor.bottom, true);
  assert.equal(topPosition.left >= 8, true);
  assert.equal(bottomPosition.top < bottomAnchor.top, true);
  assert.equal(bottomPosition.left + 292 <= 792, true);
});

test("clear conversation menu exposes only panel cleanup", () => {
  const source = fs.readFileSync(path.resolve(import.meta.dirname, "../src/features/chat/ChatHeader.tsx"), "utf8");
  assert.match(source, /Limpar painel/);
  assert.equal(source.includes("onClear?.();"), true);
  assert.equal((source.match(/Limpar painel/g) ?? []).length, 1);
});

test("message context menu position stays inside viewport", () => {
  const normal = getViewportAwareMenuPosition({ position: { x: 40, y: 40 }, menuWidth: 176, menuHeight: 160, viewportWidth: 800, viewportHeight: 600 });
  const bottom = getViewportAwareMenuPosition({ position: { x: 40, y: 580 }, menuWidth: 176, menuHeight: 160, viewportWidth: 800, viewportHeight: 600 });
  const right = getViewportAwareMenuPosition({ position: { x: 790, y: 40 }, menuWidth: 176, menuHeight: 160, viewportWidth: 800, viewportHeight: 600 });
  const corner = getViewportAwareMenuPosition({ position: { x: 790, y: 590 }, menuWidth: 176, menuHeight: 160, viewportWidth: 800, viewportHeight: 600 });
  assert.deepEqual(normal, { x: 40, y: 40 });
  assert.equal(bottom.y < 580, true);
  assert.equal(right.x < 790, true);
  assert.equal(corner.x + 176 <= 800, true);
  assert.equal(corner.y + 160 <= 600, true);
});

test("media viewer renders image and video actions", () => {
  const imageHtml = renderToStaticMarkup(<MediaViewer message={imageMessage} onClose={() => undefined} onReact={() => undefined} onReply={() => undefined} />);
  const videoHtml = renderToStaticMarkup(<MediaViewer message={videoMessage} onClose={() => undefined} onReact={() => undefined} onReply={() => undefined} />);
  assert.match(imageHtml, /Visualizador de midia/);
  assert.match(imageHtml, /Baixar midia/);
  assert.match(imageHtml, /Responder/);
  assert.match(imageHtml, /Mais emojis/);
  assert.match(videoHtml, /<video/);
  assert.match(videoHtml, /controls=""/);
});

test("chat input renders reply mode and cancel button", () => {
  const html = renderToStaticMarkup(<ChatInput replyingTo={textMessage} onCancelReply={() => undefined} onSend={() => undefined} />);
  assert.match(html, /Respondendo/);
  assert.match(html, /Oi, preciso de ajuda/);
  assert.match(html, /Cancelar resposta/);
  assert.match(html, /Anexar imagem/);
  assert.match(html, /Anexar video/);
  assert.match(html, /Anexar audio/);
  assert.match(html, /Anexar documento/);
});

test("chat input does not use a form submit wrapper", () => {
  const source = fs.readFileSync(path.resolve(import.meta.dirname, "../src/features/chat/ChatInput.tsx"), "utf8");
  assert.equal(source.includes("<form"), false);
  assert.equal(source.includes("onSubmit"), false);
  assert.match(source, /onClick=\{\(\) => void submit\(\)\}/);
});

test("known empty media/reply messages use readable fallback instead of generic empty text", () => {
  assert.equal(getKnownMessageFallback({ ...textMessage, body: null, messageType: "AUDIO", mediaUrl: null }), "Audio recebido");
  assert.equal(getKnownMessageFallback({ ...textMessage, body: null, messageType: "UNKNOWN", mediaMimeType: "audio/ogg" }), "Audio recebido");
  assert.equal(getKnownMessageFallback({ ...textMessage, body: null, messageType: "DOCUMENT" }), "Documento recebido");
  assert.equal(getKnownMessageFallback({ ...textMessage, body: null, messageType: "VIDEO" }), "Video recebido");
  assert.equal(getKnownMessageFallback({ ...textMessage, body: null, messageType: "UNKNOWN" }), "Mensagem recebida");
});

test("message upsert preserves chronological order and deduplicates older pages", () => {
  const older = { ...textMessage, id: "older", body: "Antiga", createdAt: "2026-06-09T11:00:00.000Z" };
  const current = { ...textMessage, id: "current", body: "Atual", createdAt: "2026-06-09T12:00:00.000Z" };
  const duplicate = { ...older, body: "Antiga editada" };
  const merged = [older, duplicate].reduce((items, message) => upsertMessage(items, message), [current]);
  assert.deepEqual(merged.map((message) => message.id), ["older", "current"]);
  assert.equal(merged[0].body, "Antiga editada");
});

test("chat page keeps desktop split and mobile list-or-thread contract", () => {
  const source = fs.readFileSync(path.resolve(import.meta.dirname, "../src/pages/ChatPage.tsx"), "utf8");
  assert.match(source, /md:grid-cols-\[320px_minmax\(0,1fr\)\]/);
  assert.match(source, /mobileThreadOpen \? "hidden" : "block"/);
  assert.match(source, /mobileThreadOpen \? "flex" : "hidden"/);
  assert.match(source, /h-\[calc\(100svh-3\.5rem\)\]/);
  assert.match(source, /connectionState !== "connected"/);
  assert.match(source, /loadConversations\(\)/);
  assert.match(source, /markConversationRead/);
  assert.match(source, /MediaViewer/);
  assert.match(source, /Limpar mensagens apenas do painel/);
});

test("message thread exposes a new messages jump button for open chats", () => {
  const source = fs.readFileSync(path.resolve(import.meta.dirname, "../src/features/chat/MessageThread.tsx"), "utf8");
  assert.match(source, /showNewMessagesButton/);
  assert.match(source, /Novas mensagens/);
  assert.match(source, /scrollToBottom/);
  assert.match(source, /bottom-20/);
});

test("chat realtime client subscribes to message reaction events", () => {
  const source = fs.readFileSync(path.resolve(import.meta.dirname, "../src/features/chat/useChat.ts"), "utf8");
  assert.match(source, /\/auth\/ws-token/);
  assert.match(source, /auth: token \? \{ token \} : undefined/);
  assert.match(source, /message:reaction/);
  assert.match(source, /message:edited/);
  assert.match(source, /message:deleted/);
  assert.match(source, /onMessageReaction/);
});

test("chat media upload uses multipart endpoint", () => {
  const source = fs.readFileSync(path.resolve(import.meta.dirname, "../src/features/chat/useConversations.ts"), "utf8");
  assert.match(source, /sendMediaMessage/);
  assert.match(source, /new FormData\(\)/);
  assert.match(source, /form\.append\("file", input\.file\)/);
  assert.equal(source.indexOf('form.append("instanceId"') < source.indexOf('form.append("file"'), true);
  assert.equal(source.indexOf('form.append("messageType"') < source.indexOf('form.append("file"'), true);
  assert.match(source, /\/chat\/send\/media/);
});

test("chat page handles read rollback and clear batch", () => {
  const source = fs.readFileSync(path.resolve(import.meta.dirname, "../src/pages/ChatPage.tsx"), "utf8");
  assert.match(source, /previousUnreadCount/);
  assert.match(source, /await markConversationRead/);
  assert.match(source, /Nao foi possivel marcar a conversa como lida/);
  assert.match(source, /conversation\.cleared/);
  assert.match(source, /setMessages\(\[\]\)/);
  assert.match(source, /sendMediaMessage/);
});

test("app wrapper lets chat route escape the default max width", () => {
  const source = fs.readFileSync(path.resolve(import.meta.dirname, "../src/App.tsx"), "utf8");
  assert.match(source, /pathname\.startsWith\("\/chat"\)/);
  assert.match(source, /isChatRoute \? "w-full px-0 py-0"/);
});
