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
  return mailcowRequest<Record<string, unknown>>("GET", "get/status/containers");
}

export async function getMailbox(email: string) {
  return mailcowRequest<Record<string, unknown>>(
    "GET",
    `get/mailbox/${encodeURIComponent(email)}`,
  );
}

export async function listDomains() {
  return mailcowRequest<unknown[]>("GET", "get/domain/all");
}

export async function listMailboxes(domain?: string) {
  const path = domain ? `get/mailbox/all/${encodeURIComponent(domain)}` : "get/mailbox/all";
  return mailcowRequest<unknown[]>("GET", path);
}

export async function listAliases(domain?: string) {
  const path = domain ? `get/alias/all/${encodeURIComponent(domain)}` : "get/alias/all";
  return mailcowRequest<unknown[]>("GET", path);
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

export async function listAppPasswords(mailbox: string) {
  return mailcowRequest<unknown[]>("GET", `get/app-passwd/all/${encodeURIComponent(mailbox)}`);
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
