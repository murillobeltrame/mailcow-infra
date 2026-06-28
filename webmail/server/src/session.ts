import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { config } from "./config.js";

export type UserRole = "user" | "domainadmin" | "admin";

export type PortalSession = {
  id: string;
  role: UserRole;
  /** E-mail ou username (ex.: admin) */
  subject: string;
  email?: string;
  password?: string;
  name?: string;
  /** Domínios permitidos (domainadmin) */
  domains?: string[];
  expiresAt: number;
};

/** @deprecated use PortalSession */
export type MailSession = PortalSession & { email: string; password: string };

const SESSION_VERSION = "v1";

function sealSession(session: PortalSession, secret: string): string {
  const payload = Buffer.from(JSON.stringify({ v: SESSION_VERSION, s: session })).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function unsealSession(token: string, secret: string): PortalSession | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      v?: string;
      s?: PortalSession;
    };
    if (parsed.v !== SESSION_VERSION || !parsed.s) return null;
    if (parsed.s.expiresAt < Date.now()) return null;
    return parsed.s;
  } catch {
    return null;
  }
}

export function createSession(
  data: Omit<PortalSession, "id" | "expiresAt">,
  ttlMs = 8 * 60 * 60 * 1000,
): PortalSession {
  return {
    ...data,
    id: randomUUID(),
    expiresAt: Date.now() + ttlMs,
  };
}

export function parseSessionToken(token: string | undefined): PortalSession | null {
  if (!token) return null;
  return unsealSession(token, config.cookieSecret);
}

export function sessionToToken(session: PortalSession): string {
  return sealSession(session, config.cookieSecret);
}

export function touchSession(session: PortalSession, ttlMs: number): PortalSession {
  return { ...session, expiresAt: Date.now() + ttlMs };
}

export function asMailSession(session: PortalSession): MailSession | null {
  if (session.role !== "user" || !session.email || !session.password) return null;
  return session as MailSession;
}
