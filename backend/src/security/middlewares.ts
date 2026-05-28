import { randomBytes, timingSafeEqual } from "crypto";
import { FastifyReply, FastifyRequest } from "fastify";

const CSRF_COOKIE_NAME = "csrfToken";
const CSRF_HEADER_NAME = "x-csrf-token";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CSRF_EXEMPT_PATHS = new Set(["/api/auth/login", "/api/setup/docker", "/api/setup/admin"]);

export const csrfCookieName = CSRF_COOKIE_NAME;
export const csrfHeaderName = CSRF_HEADER_NAME;

export function generateCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function getHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function requestPath(request: FastifyRequest): string {
  return request.url.split("?")[0];
}

function isMutatingRequest(request: FastifyRequest): boolean {
  return MUTATING_METHODS.has(request.method.toUpperCase());
}

function isCsrfExempt(request: FastifyRequest): boolean {
  return CSRF_EXEMPT_PATHS.has(requestPath(request));
}

function sameOriginFromRequest(request: FastifyRequest): string | null {
  const host = getHeaderValue(request.headers.host);
  if (!host) return null;
  const forwardedProto = getHeaderValue(request.headers["x-forwarded-proto"]);
  const proto = forwardedProto?.split(",")[0]?.trim() || "http";
  return `${proto}://${host}`;
}

function headerOrigin(headerValue: string | string[] | undefined): string | null {
  const raw = getHeaderValue(headerValue);
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export function buildAllowedOrigins(corsOrigins: string[], env: "development" | "test" | "production") {
  const allowed = new Set(corsOrigins.filter(Boolean));
  if (env !== "production") {
    allowed.add("http://localhost:3000");
    allowed.add("http://127.0.0.1:3000");
  }
  return allowed;
}

export function createOriginGuard(
  allowedOrigins: Set<string>,
  env: "development" | "test" | "production"
) {
  return async function verifyOrigin(request: FastifyRequest, reply: FastifyReply) {
    if (!isMutatingRequest(request)) return;

    const origin = headerOrigin(request.headers.origin);
    const refererOrigin = headerOrigin(request.headers.referer);
    const requestOrigin = origin ?? refererOrigin;

    if (!requestOrigin) {
      if (env === "production") {
        return reply.status(403).send({ error: "Origem da requisição ausente ou inválida" });
      }
      return;
    }

    const sameOrigin = sameOriginFromRequest(request);
    if (allowedOrigins.has(requestOrigin) || requestOrigin === sameOrigin) return;

    return reply.status(403).send({ error: "Origem da requisição não permitida" });
  };
}

export async function verifyCsrf(request: FastifyRequest, reply: FastifyReply) {
  if (!isMutatingRequest(request) || isCsrfExempt(request)) return;

  const csrfCookie = request.cookies?.[CSRF_COOKIE_NAME];
  const csrfHeader = getHeaderValue(request.headers[CSRF_HEADER_NAME]);

  if (!csrfCookie || !csrfHeader || !safeEqual(csrfCookie, csrfHeader)) {
    return reply.status(403).send({ error: "CSRF token ausente ou inválido" });
  }
}

export async function verifyJwt(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify({ onlyCookie: true });
  } catch (err) {
    return reply.status(401).send({ error: "Sessão inválida ou não autorizada" });
  }
}
