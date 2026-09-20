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
const sessions = new Map<string, PortalSession>();
/** IDs/tokens destruídos no logout — impede cookie legado ou resposta em voo de recriar a sessão. */
const revokedUntil = new Map<string, number>();

function revokeId(id: string, ttlMs = config.sessionTtlMs) {
  revokedUntil.set(id, Date.now() + Math.max(ttlMs, 60_000));
}

export function isRevoked(id: string | undefined): boolean {
  if (!id) return false;
  const until = revokedUntil.get(id);
  if (until === undefined) return false;
  if (until < Date.now()) {
    revokedUntil.delete(id);
    return false;
  }
  return true;
}

/** Token legado (cookie stateless com senha embutida) — compatibilidade temporária. */
function unsealLegacyToken(token: string, secret: string): PortalSession | null {
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

function persistSession(session: PortalSession) {
  if (isRevoked(session.id)) return;
  sessions.set(session.id, session);
}

export function createSession(
  data: Omit<PortalSession, "id" | "expiresAt">,
  ttlMs = 8 * 60 * 60 * 1000,
): PortalSession {
  const session: PortalSession = {
    ...data,
    id: randomUUID(),
    expiresAt: Date.now() + ttlMs,
  };
  persistSession(session);
  return session;
}

export function getSession(id: string | undefined): PortalSession | null {
  if (!id || isRevoked(id)) return null;
  const session = sessions.get(id);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(id);
    return null;
  }
  return session;
}

export function destroySession(id: string | undefined) {
  if (!id) return;
  sessions.delete(id);
  revokeId(id);
}

/** Resolve sessão a partir do valor do cookie (UUID ou token legado). */
export function resolveSessionFromCookie(value: string | undefined): PortalSession | null {
  if (!value || isRevoked(value)) return null;

  const fromStore = getSession(value);
  if (fromStore) {
    if (isRevoked(fromStore.id)) return null;
    return fromStore;
  }

  const legacy = unsealLegacyToken(value, config.cookieSecret);
  if (!legacy) return null;
  if (isRevoked(legacy.id)) return null;

  persistSession(legacy);
  return legacy;
}

export function touchSession(session: PortalSession, ttlMs: number): PortalSession {
  if (isRevoked(session.id)) return session;
  session.expiresAt = Date.now() + ttlMs;
  persistSession(session);
  return session;
}

export function asMailSession(session: PortalSession): MailSession | null {
  if (session.role !== "user" || !session.email || !session.password) return null;
  return session as MailSession;
}

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (session.expiresAt < now) sessions.delete(id);
  }
  for (const [id, until] of revokedUntil) {
    if (until < now) revokedUntil.delete(id);
  }
}, 60 * 60 * 1000).unref();
