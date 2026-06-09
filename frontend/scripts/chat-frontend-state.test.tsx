import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { APP_NAV_GROUPS, getAppRouteTitle } from "../src/features/navigation/appNavigation.ts";
import { ConversationList } from "../src/features/chat/ConversationList.tsx";
import { MessageBubble } from "../src/features/chat/MessageBubble.tsx";
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

test("message bubbles render direction, status and inline audio controls", () => {
  const sentHtml = renderToStaticMarkup(<MessageBubble message={{ ...textMessage, fromMe: true, status: "READ" }} />);
  const audioHtml = renderToStaticMarkup(<MessageBubble message={audioMessage} />);
  assert.match(sentHtml, /Oi, preciso de ajuda/);
  assert.match(sentHtml, /Lida/);
  assert.equal(getMessageStatusLabel("DELIVERED"), "Entregue");
  assert.match(audioHtml, /Reproduzir audio/);
  assert.doesNotMatch(audioHtml, /Mensagem sem texto/);
  assert.doesNotMatch(audioHtml, /<audio[^>]*controls(\s|=|>)/);
  assert.doesNotMatch(audioHtml, /<a\s[^>]*download/i);
  assert.doesNotMatch(audioHtml, />\s*Baixar\s*</i);
  assert.match(audioHtml, /https:\/\/media.example.com\/audio.ogg/);
});

test("known empty media/reply messages use readable fallback instead of generic empty text", () => {
  assert.equal(getKnownMessageFallback({ ...textMessage, body: null, messageType: "AUDIO", mediaUrl: null }), "Audio indisponivel");
  assert.equal(getKnownMessageFallback({ ...textMessage, body: null, messageType: "DOCUMENT" }), "Documento recebido");
  assert.equal(getKnownMessageFallback({ ...textMessage, body: null, messageType: "VIDEO" }), "Video recebido");
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
});

test("app wrapper lets chat route escape the default max width", () => {
  const source = fs.readFileSync(path.resolve(import.meta.dirname, "../src/App.tsx"), "utf8");
  assert.match(source, /pathname\.startsWith\("\/chat"\)/);
  assert.match(source, /isChatRoute \? "w-full px-0 py-0"/);
});
