import { randomUUID } from "node:crypto";

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

const sessions = new Map<string, PortalSession>();

export function createSession(
  data: Omit<PortalSession, "id" | "expiresAt">,
  ttlMs = 8 * 60 * 60 * 1000,
): PortalSession {
  const session: PortalSession = {
    ...data,
    id: randomUUID(),
    expiresAt: Date.now() + ttlMs,
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string | undefined): PortalSession | null {
  if (!id) return null;
  const session = sessions.get(id);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(id);
    return null;
  }
  return session;
}

export function destroySession(id: string | undefined) {
  if (id) sessions.delete(id);
}

export function touchSession(id: string, ttlMs: number) {
  const session = sessions.get(id);
  if (session) session.expiresAt = Date.now() + ttlMs;
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
}, 60 * 60 * 1000).unref();
