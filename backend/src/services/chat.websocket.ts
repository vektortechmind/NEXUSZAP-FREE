import type { FastifyInstance } from "fastify";
import { Server as SocketServer, type Namespace } from "socket.io";
import { prisma } from "../database/prisma";
import { chatRealtime } from "./chat.realtime";

export const CHAT_SOCKET_PATH = "/ws/chat";
export const CHAT_SOCKET_NAMESPACE = "/chat";

type JwtPayloadWithInstances = {
  instances?: unknown;
  instanceIds?: unknown;
  role?: unknown;
};

type ChatSocketServerDeps = {
  instanceResolver?: (payload: JwtPayloadWithInstances) => Promise<string[]>;
};

function normalizeBearerToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase().startsWith("bearer ") ? trimmed.slice(7).trim() : trimmed;
}

function tokenFromCookieHeader(cookieHeader: unknown): string | null {
  if (typeof cookieHeader !== "string" || !cookieHeader.trim()) return null;
  for (const chunk of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = chunk.split("=");
    if (rawName?.trim() !== "token") continue;
    const value = rawValue.join("=").trim();
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

function instanceIdsFromPayload(payload: JwtPayloadWithInstances): string[] {
  const value = Array.isArray(payload.instances) ? payload.instances : payload.instanceIds;
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

async function defaultInstanceResolver(payload: JwtPayloadWithInstances): Promise<string[]> {
  const fromToken = instanceIdsFromPayload(payload);
  if (fromToken.length > 0) return fromToken;

  // Current admin JWTs do not carry instance ACLs yet. Until per-user ACLs exist,
  // an authenticated admin receives all configured instances.
  const instances = await prisma.instance.findMany({ select: { id: true } });
  return instances.map((instance) => instance.id);
}

export function createChatSocketServer(fastify: FastifyInstance, deps: ChatSocketServerDeps = {}) {
  const instanceResolver = deps.instanceResolver ?? defaultInstanceResolver;
  const io = new SocketServer(fastify.server, {
    path: CHAT_SOCKET_PATH,
    connectionStateRecovery: {
      maxDisconnectionDuration: 120_000,
      skipMiddlewares: false,
    },
    cors: {
      origin: true,
      credentials: true,
    },
  });
  const chatNamespace: Namespace = io.of(CHAT_SOCKET_NAMESPACE);

  chatNamespace.use(async (socket, next) => {
    const token = normalizeBearerToken(socket.handshake.auth?.token) ?? tokenFromCookieHeader(socket.handshake.headers.cookie);
    if (!token) return next(new Error("Unauthorized"));

    try {
      const jwtVerifier = (fastify as FastifyInstance & { jwt: { verify<T>(token: string): Promise<T> } }).jwt;
      const payload = await jwtVerifier.verify<JwtPayloadWithInstances>(token);
      const instances = await instanceResolver(payload);
      if (instances.length === 0) return next(new Error("No instances available"));
      socket.data.user = payload;
      socket.data.instances = instances;
      return next();
    } catch {
      return next(new Error("Invalid token"));
    }
  });

  chatNamespace.on("connection", (socket) => {
    const instances = Array.isArray(socket.data.instances) ? socket.data.instances : [];
    for (const instanceId of instances) {
      if (typeof instanceId === "string" && instanceId.trim()) {
        void socket.join(`instance:${instanceId}`);
      }
    }
  });

  chatRealtime.setEmitter({
    emitToInstance(instanceId, event, payload) {
      chatNamespace.to(`instance:${instanceId}`).emit(event, payload);
    },
  });

  return io;
}
