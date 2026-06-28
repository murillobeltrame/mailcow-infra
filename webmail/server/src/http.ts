import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config.js";
import { destroySession, getSession, touchSession, type PortalSession, type UserRole } from "./session.js";

export const SESSION_COOKIE = "nive_mail_session";
export const COOKIE_PATH = process.env.COOKIE_PATH ?? "/mail/";

/** Paths legados — limpar todos para evitar cookie “fantasma” após logout. */
const CLEAR_PATHS = [...new Set([COOKIE_PATH, COOKIE_PATH.replace(/\/$/, ""), "/mail/", "/mail", "/"].filter(Boolean))];

export function sessionCookieOptions(maxAge?: number) {
  const opts = {
    path: COOKIE_PATH,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
  return maxAge !== undefined ? { ...opts, maxAge } : opts;
}

type UnsignResult = { valid: boolean; value: string | null };

/** Lê o ID da sessão do cookie (plain ou assinado pelo @fastify/cookie). */
export function getSessionCookieValue(request: FastifyRequest): string | undefined {
  const raw = request.cookies[SESSION_COOKIE];
  if (!raw) return undefined;

  const req = request as FastifyRequest & { unsignCookie?: (value: string) => UnsignResult };
  if (req.unsignCookie) {
    const unsigned = req.unsignCookie(raw);
    if (unsigned.valid && unsigned.value) return unsigned.value;
  }
  return raw;
}

export function getRequestSession(request: FastifyRequest): PortalSession | null {
  return getSession(getSessionCookieValue(request));
}

export function requireSession(request: FastifyRequest): PortalSession {
  const session = getRequestSession(request);
  if (!session) {
    const err = new Error("Não autenticado") as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
  }
  touchSession(session.id, config.sessionTtlMs);
  return session;
}

export function requireRoleSession(request: FastifyRequest, ...roles: UserRole[]): PortalSession {
  const session = requireSession(request);
  if (!roles.includes(session.role)) {
    const err = new Error("Acesso negado") as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }
  return session;
}

export function setSessionCookie(reply: FastifyReply, sessionId: string) {
  reply.setCookie(SESSION_COOKIE, sessionId, {
    ...sessionCookieOptions(config.sessionTtlMs / 1000),
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  const base = sessionCookieOptions();
  for (const path of CLEAR_PATHS) {
    reply.clearCookie(SESSION_COOKIE, { ...base, path, maxAge: 0 });
  }
}

export function handleRouteError(reply: FastifyReply, err: unknown) {
  const e = err as Error & { statusCode?: number };
  return reply.status(e.statusCode ?? 500).send({ error: e.message || "Erro interno" });
}

export function publicUser(session: PortalSession) {
  return {
    email: session.email ?? session.subject,
    name: session.name ?? session.subject,
    role: session.role,
    subject: session.subject,
    domains: session.domains,
  };
}

/** Invalida sessão server-side e remove cookies do browser. */
export function terminateSession(request: FastifyRequest, reply: FastifyReply) {
  const session = getRequestSession(request);
  if (session) {
    destroySession(session.id);
  } else {
    destroySession(getSessionCookieValue(request));
  }
  clearSessionCookie(reply);
  reply.header("Cache-Control", "no-store");
}
