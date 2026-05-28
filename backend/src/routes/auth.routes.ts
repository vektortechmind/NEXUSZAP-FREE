import { FastifyInstance, FastifyRequest } from "fastify";
import { env } from "../config/env";
import { z } from "zod";
import { csrfCookieName, generateCsrfToken, verifyCsrf, verifyJwt } from "../security/middlewares";
import { timingSafeEqual } from "crypto";
import { getAdminCredentials } from "../services/setup.service";

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(256)
});

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function isSecureRequest(request: FastifyRequest): boolean {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  return proto?.split(",")[0]?.trim() === "https";
}

export async function authRoutes(fastify: FastifyInstance) {
  /** Limite por IP: evita brute force sem bloquear testes legítimos (dev incluso) */
  fastify.post("/login", {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 minute"
      }
    }
  }, async (request, reply) => {
    try {
      const { email, password } = loginSchema.parse(request.body);
      
      const admin = getAdminCredentials();
      if (!safeEqual(email, admin.email) || !safeEqual(password, admin.password)) {
        return reply.status(401).send({ error: "Credenciais inválidas" });
      }

      const token = fastify.jwt.sign({ email, role: "admin" });
      const csrfToken = generateCsrfToken();
      const secureCookie = env.NODE_ENV === "production" && isSecureRequest(request);
      
      reply.setCookie("token", token, {
        path: "/",
        httpOnly: true,
        secure: secureCookie,
        sameSite: secureCookie ? "strict" : "lax",
        maxAge: 12 * 60 * 60 // 12 horas
      });

      reply.setCookie(csrfCookieName, csrfToken, {
        path: "/",
        httpOnly: false,
        secure: secureCookie,
        sameSite: secureCookie ? "strict" : "lax",
        maxAge: 12 * 60 * 60
      });

      return reply.send({ success: true, message: "Autenticado com sucesso", csrfToken, user: { email, role: "admin" } });
    } catch (error) {
       return reply.status(400).send({ error: "Inputs ou credenciais inválidas" });
    }
  });

  fastify.post("/logout", {
    preValidation: [verifyJwt, verifyCsrf],
    config: {
      rateLimit: {
        max: 20,
        timeWindow: "1 minute"
      }
    }
  }, async (request, reply) => {
    reply.clearCookie("token", { path: "/" });
    reply.clearCookie(csrfCookieName, { path: "/" });
    return reply.send({ success: true });
  });

  fastify.get("/me", { preValidation: [verifyJwt] }, async (request, reply) => {
    return reply.send({ user: request.user });
  });
}
