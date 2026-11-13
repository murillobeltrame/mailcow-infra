import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
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

/**
 * Persistência em disco (SESSION_STORE_PATH): as sessões sobrevivem a restart/deploy do
 * container, então o usuário só sai quando clica em Sair ou fica sessionTtlMs sem usar.
 * O arquivo é cifrado (AES-256-GCM) porque a sessão guarda a senha da caixa para o IMAP.
 * Sem SESSION_STORE_PATH o store fica só em memória (dev e testes).
 */
const STORE_FILE_VERSION = 1;
const SAVE_DEBOUNCE_MS = 5_000;
let saveTimer: NodeJS.Timeout | null = null;

function storeKey(): Buffer {
  return createHash("sha256")
    .update(`nive-mail-session-store:${config.sessionStoreKey || config.cookieSecret}`)
    .digest();
}

function loadStore() {
  const file = config.sessionStorePath;
  if (!file) return;
  let raw: Buffer;
  try {
    raw = fs.readFileSync(file);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`[session] não foi possível ler ${file}:`, (err as Error).message);
    }
    return;
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", storeKey(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const json = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString();
    const parsed = JSON.parse(json) as {
      v?: number;
      sessions?: PortalSession[];
      revoked?: [string, number][];
    };
    if (parsed.v !== STORE_FILE_VERSION) return;
    const now = Date.now();
    for (const [id, until] of parsed.revoked ?? []) {
      if (until > now) revokedUntil.set(id, until);
    }
    for (const session of parsed.sessions ?? []) {
      if (session?.id && session.expiresAt > now && !revokedUntil.has(session.id)) {
        sessions.set(session.id, session);
      }
    }
  } catch (err) {
    // Chave trocada ou arquivo corrompido: começa vazio (todos fazem login de novo).
    console.error(`[session] store ilegível em ${file}, ignorando:`, (err as Error).message);
  }
}

/** Grava o store agora (também chamado no desligamento do processo). */
export function flushSessions() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const file = config.sessionStorePath;
  if (!file) return;
  try {
    const json = JSON.stringify({
      v: STORE_FILE_VERSION,
      sessions: [...sessions.values()],
      revoked: [...revokedUntil.entries()],
    });
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", storeKey(), iv);
    const data = Buffer.concat([cipher.update(json), cipher.final()]);
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, Buffer.concat([iv, cipher.getAuthTag(), data]), { mode: 0o600 });
    fs.renameSync(tmp, file);
  } catch (err) {
    console.error(`[session] falha ao gravar ${file}:`, (err as Error).message);
  }
}

/** Renovação de TTL acontece a cada request — agrupa as gravações. */
function scheduleSave() {
  if (!config.sessionStorePath || saveTimer) return;
  saveTimer = setTimeout(flushSessions, SAVE_DEBOUNCE_MS);
  saveTimer.unref();
}

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
  scheduleSave();
}

export function createSession(
  data: Omit<PortalSession, "id" | "expiresAt">,
  ttlMs = config.sessionTtlMs,
): PortalSession {
  const session: PortalSession = {
    ...data,
    id: randomUUID(),
    expiresAt: Date.now() + ttlMs,
  };
  persistSession(session);
  flushSessions();
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
  flushSessions();
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

loadStore();

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (session.expiresAt < now) sessions.delete(id);
  }
  for (const [id, until] of revokedUntil) {
    if (until < now) revokedUntil.delete(id);
  }
}, 60 * 60 * 1000).unref();
