import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config.js";
import { parseSessionToken, sessionToToken, touchSession, type PortalSession, type UserRole } from "./session.js";

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
  return parseSessionToken(getSessionCookieValue(request));
}

export function requireSession(request: FastifyRequest): PortalSession {
  const session = getRequestSession(request);
  if (!session) {
    const err = new Error("Não autenticado") as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
  }
  return touchSession(session, config.sessionTtlMs);
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

export function setSessionCookie(reply: FastifyReply, session: PortalSession) {
  const maxAge = Math.max(1, Math.floor((session.expiresAt - Date.now()) / 1000));
  reply.setCookie(SESSION_COOKIE, sessionToToken(session), {
    ...sessionCookieOptions(maxAge),
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  const expired = new Date(0);
  const base = sessionCookieOptions();
  for (const path of CLEAR_PATHS) {
    for (const signed of [false, true] as const) {
      const opts = { ...base, path, maxAge: 0, expires: expired, signed };
      reply.clearCookie(SESSION_COOKIE, opts);
      reply.setCookie(SESSION_COOKIE, "", opts);
    }
  }
}

export function handleRouteError(reply: FastifyReply, err: unknown) {
  const e = err as Error & { statusCode?: number; status?: number };
  const code = e.statusCode ?? e.status ?? 500;
  return reply.status(code).send({ error: e.message || "Erro interno" });
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
export function terminateSession(_request: FastifyRequest, reply: FastifyReply) {
  clearSessionCookie(reply);
  reply.header("Cache-Control", "no-store, no-cache, must-revalidate");
  reply.header("Pragma", "no-cache");
}
