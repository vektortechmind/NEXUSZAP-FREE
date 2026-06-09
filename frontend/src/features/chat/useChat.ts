import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "../../contexts/AuthContext";
import type { ChatConnectionState, ChatConversation, ChatMessage, ChatPresence } from "./types";

const CHAT_NAMESPACE = "/chat";
const CHAT_SOCKET_PATH = "/ws/chat";

type ChatSocketCallbacks = {
  onMessageNew?: (message: ChatMessage) => void;
  onMessageSent?: (message: ChatMessage) => void;
  onMessageStatus?: (message: ChatMessage) => void;
  onConversationUpdate?: (conversation: ChatConversation) => void;
  onPresenceUpdate?: (presence: ChatPresence) => void;
};

function socketOriginFromApiBase() {
  const configuredBase = (import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL;
  if (!configuredBase) return window.location.origin;
  try {
    const url = new URL(configuredBase, window.location.origin);
    if (url.pathname.endsWith("/api")) {
      url.pathname = url.pathname.slice(0, -4) || "/";
    }
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return window.location.origin;
  }
}

export function useChat(callbacks: ChatSocketCallbacks) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const callbacksRef = useRef(callbacks);
  const [connectionState, setConnectionState] = useState<ChatConnectionState>("idle");

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setConnectionState("offline");
  }, []);

  useEffect(() => {
    if (!user) return;
    const socket = io(`${socketOriginFromApiBase()}${CHAT_NAMESPACE}`, {
      path: CHAT_SOCKET_PATH,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 10_000,
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnectionState("connected"));
    socket.io.on("reconnect_attempt", () => setConnectionState("reconnecting"));
    socket.on("connect_error", () => setConnectionState("error"));
    socket.on("disconnect", () => {
      setConnectionState(socket.active ? "reconnecting" : "offline");
    });
    socket.on("message:new", (message: ChatMessage) => callbacksRef.current.onMessageNew?.(message));
    socket.on("message:sent", (message: ChatMessage) => callbacksRef.current.onMessageSent?.(message));
    socket.on("message:status", (message: ChatMessage) => callbacksRef.current.onMessageStatus?.(message));
    socket.on("conversation:update", (conversation: ChatConversation) => callbacksRef.current.onConversationUpdate?.(conversation));
    socket.on("presence:update", (presence: ChatPresence) => callbacksRef.current.onPresenceUpdate?.(presence));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  return { connectionState, disconnect };
}
