import { config } from "./config.js";
import { mailcowFetch } from "./mailcow-fetch.js";
import type { PortalSession, UserRole } from "./session.js";

type ApiResult = {
  type?: string;
  msg?: string | string[];
  log?: string[];
  [key: string]: unknown;
};

export class MailcowApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

function apiKey() {
  if (!config.mailcowApiKey) {
    throw new MailcowApiError("MAILCOW_API_KEY não configurada", 503, {});
  }
  return config.mailcowApiKey;
}

export async function mailcowRequest<T = ApiResult>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${config.mailcowApiUrl}/api/v1/${path.replace(/^\//, "")}`;
  const res = await mailcowFetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: T;
  try {
    data = text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    throw new MailcowApiError(`Resposta inválida da API Mailcow (${res.status})`, res.status, text);
  }

  if (!res.ok) {
    const msg =
      typeof (data as ApiResult).msg === "string"
        ? (data as ApiResult).msg
        : `Erro API Mailcow (${res.status})`;
    throw new MailcowApiError(String(msg), res.status, data);
  }

  return data;
}

/** Mailcow GET /all às vezes devolve objeto indexado ou { msg: [...] } em vez de array. */
export function normalizeMailcowList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (!data || typeof data !== "object") return [];

  const obj = data as ApiResult & Record<string, unknown>;
  if (obj.type === "error") {
    const msg = typeof obj.msg === "string" ? obj.msg : "Erro API Mailcow";
    throw new MailcowApiError(msg, 502, data);
  }
  if (Array.isArray(obj.msg)) return obj.msg as T[];

  const values = Object.values(obj).filter((v) => v && typeof v === "object");
  return values as T[];
}

export function normalizeContainers(
  data: unknown,
): Record<string, { container?: string; state?: string; image?: string }> {
  if (Array.isArray(data)) {
    const out: Record<string, { container?: string; state?: string; image?: string }> = {};
    for (const item of data) {
      if (!item || typeof item !== "object") continue;
      const row = item as { container?: string; state?: string; image?: string };
      const key = row.container ?? String(out.length);
      out[key] = row;
    }
    return out;
  }
  if (data && typeof data === "object") {
    return data as Record<string, { container?: string; state?: string; image?: string }>;
  }
  return {};
}

export async function getHostStatus() {
  return mailcowRequest<Record<string, unknown>>("GET", "get/status/host");
}

export async function getVersion() {
  return mailcowRequest<Record<string, unknown>>("GET", "get/status/version");
}

export async function getVmailStatus() {
  return mailcowRequest<Record<string, unknown>>("GET", "get/status/vmail");
}

export async function getContainerStatus() {
  const data = await mailcowRequest<unknown>("GET", "get/status/containers");
  return normalizeContainers(data);
}

export async function getMailbox(email: string) {
  return mailcowRequest<Record<string, unknown>>(
    "GET",
    `get/mailbox/${encodeURIComponent(email)}`,
  );
}

export async function listDomains() {
  const data = await mailcowRequest<unknown>("GET", "get/domain/all");
  return normalizeMailcowList(data);
}

export async function listMailboxes(domain?: string) {
  const path = domain ? `get/mailbox/all/${encodeURIComponent(domain)}` : "get/mailbox/all";
  const data = await mailcowRequest<unknown>("GET", path);
  return normalizeMailcowList(data);
}

export async function listAliases(domain?: string) {
  const path = domain ? `get/alias/all/${encodeURIComponent(domain)}` : "get/alias/all";
  const data = await mailcowRequest<unknown>("GET", path);
  return normalizeMailcowList(data);
}

export async function editMailbox(attrs: Record<string, unknown>) {
  return mailcowRequest("POST", "edit/mailbox", attrs);
}

export async function addMailbox(attrs: Record<string, unknown>) {
  return mailcowRequest("POST", "add/mailbox", attrs);
}

export async function addDomain(attrs: Record<string, unknown>) {
  return mailcowRequest("POST", "add/domain", attrs);
}

export function assertMailcowSuccess(data: unknown): void {
  const rows = Array.isArray(data) ? data : [data];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as ApiResult;
    if (r.type === "danger" || r.type === "error") {
      const msg = r.msg;
      const message = Array.isArray(msg)
        ? msg.map(String).join(" ")
        : typeof msg === "string"
          ? msg
          : "Erro API Mailcow";
      throw new MailcowApiError(message, 400, row);
    }
  }
}

export async function listDomainAdmins() {
  const data = await mailcowRequest<unknown>("GET", "get/domain-admin/all");
  return normalizeMailcowList<Record<string, unknown>>(data);
}

export async function addDomainAdmin(attrs: Record<string, unknown>) {
  const data = await mailcowRequest("POST", "add/domain-admin", attrs);
  assertMailcowSuccess(data);
  return data;
}

export async function editDomainAdmin(attrs: Record<string, unknown>) {
  const data = await mailcowRequest("POST", "edit/domain-admin", attrs);
  assertMailcowSuccess(data);
  return data;
}

export async function deleteDomainAdmin(usernames: string[]) {
  const data = await mailcowRequest("POST", "delete/domain-admin", usernames);
  assertMailcowSuccess(data);
  return data;
}

export async function listAppPasswords(mailbox: string) {
  const data = await mailcowRequest<unknown>("GET", `get/app-passwd/all/${encodeURIComponent(mailbox)}`);
  return normalizeMailcowList(data);
}

export async function addAppPassword(attrs: Record<string, unknown>) {
  return mailcowRequest("POST", "add/app-passwd", attrs);
}

export async function deleteAppPassword(attrs: Record<string, unknown>) {
  return mailcowRequest("POST", "delete/app-passwd", attrs);
}

export function assertSessionCanAccessMailbox(session: PortalSession, mailbox: string) {
  const mb = mailbox.toLowerCase();
  if (session.role === "admin") return;
  if (session.role === "user" && session.email?.toLowerCase() === mb) return;
  if (session.role === "domainadmin") {
    const domain = mb.split("@")[1];
    if (domain && session.domains?.map((d) => d.toLowerCase()).includes(domain)) return;
  }
  const err = new Error("Sem permissão para esta caixa") as Error & { statusCode: number };
  err.statusCode = 403;
  throw err;
}

export function assertSessionCanAccessDomain(session: PortalSession, domain: string) {
  const d = domain.toLowerCase();
  if (session.role === "admin") return;
  if (session.role === "domainadmin" && session.domains?.map((x) => x.toLowerCase()).includes(d)) return;
  const err = new Error("Sem permissão para este domínio") as Error & { statusCode: number };
  err.statusCode = 403;
  throw err;
}

export function requireRole(session: PortalSession, ...roles: UserRole[]) {
  if (!roles.includes(session.role)) {
    const err = new Error("Acesso negado") as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }
}
