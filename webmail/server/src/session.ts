import { randomUUID } from "node:crypto";

export type MailSession = {
  id: string;
  email: string;
  password: string;
  name?: string;
  expiresAt: number;
};

const sessions = new Map<string, MailSession>();

export function createSession(email: string, password: string, name?: string, ttlMs = 8 * 60 * 60 * 1000) {
  const id = randomUUID();
  const session: MailSession = {
    id,
    email,
    password,
    name,
    expiresAt: Date.now() + ttlMs,
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id: string | undefined): MailSession | null {
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

// Limpa sessões expiradas a cada hora
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (session.expiresAt < now) sessions.delete(id);
  }
}, 60 * 60 * 1000).unref();
