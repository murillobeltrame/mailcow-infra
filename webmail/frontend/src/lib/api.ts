import type { UserRole } from "@/lib/roles";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const API_BASE = import.meta.env.BASE_URL.replace(/\/?$/, "/");

function apiUrl(path: string): string {
  return `${API_BASE}${path.replace(/^\//, "")}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError((data as { error?: string }).error ?? "Erro na requisição", res.status);
  }
  return data as T;
}

export type User = {
  email: string;
  name?: string;
  role: UserRole;
  subject: string;
  domains?: string[];
};

export type Folder = {
  path: string;
  name: string;
  specialUse?: string;
  unseen?: number;
};

export type AdminDashboard = {
  cpu: { cores: number; usagePercent: number };
  memory: {
    totalBytes: number;
    usagePercent: number;
    totalLabel: string;
    usedLabel: string;
  };
  disk: { used: string; total: string; usedPercent: string; device?: string };
  version: string;
  uptime: string;
  systemTime: string;
  architecture: string;
  containers: { name: string; state: string; image?: string }[];
  containersRunning: number;
  containersTotal: number;
};

export type DomainAdminRow = {
  username?: string;
  active?: string;
  created?: string;
  selected_domains?: string[];
  tfa_active?: string;
};

export type MailboxProfile = {
  username?: string;
  name?: string;
  domain?: string;
  quota?: number;
  quota_used?: number;
  percent_in_use?: string | number;
  messages?: number;
  created?: string;
  attributes?: Record<string, string | null>;
};

export type MessageSummary = {
  uid: number;
  subject: string;
  from: string;
  fromName?: string;
  date: string;
  seen: boolean;
  flagged: boolean;
  hasAttachments: boolean;
  preview: string;
};

export type MessageDetail = MessageSummary & {
  to: string[];
  cc: string[];
  html?: string;
  text?: string;
  attachments: { filename: string; contentType: string; size: number }[];
};

export const api = {
  login(login: string, password: string, loginAs: UserRole = "user") {
    return request<User>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ login, password, loginAs }),
    });
  },
  fido2Session(subject: string, role?: UserRole) {
    return request<User>("/api/auth/fido2-session", {
      method: "POST",
      body: JSON.stringify({ subject, role }),
    });
  },
  logout() {
    return request<{ ok: boolean }>("/api/auth/logout", { method: "POST", cache: "no-store" });
  },
  me() {
    return request<{ user: User | null }>("/api/auth/me", { cache: "no-store" }).then((r) => r.user);
  },
  folders() {
    return request<{ folders: Folder[] }>("/api/folders");
  },
  messages(folder: string, page = 0, q?: string) {
    const params = new URLSearchParams({ folder, page: String(page) });
    if (q) params.set("q", q);
    return request<{ messages: MessageSummary[]; total: number }>(`/api/messages?${params}`);
  },
  message(folder: string, uid: number) {
    return request<MessageDetail>(`/api/messages/${uid}?folder=${encodeURIComponent(folder)}`);
  },
  attachmentUrl(folder: string, uid: number, index: number) {
    return apiUrl(`/api/messages/${uid}/attachments/${index}?folder=${encodeURIComponent(folder)}`);
  },
  send(data: { to: string; subject: string; body: string; cc?: string; bcc?: string }) {
    return request<{ ok: boolean }>("/api/messages/send", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  deleteMessages(folder: string, uids: number[]) {
    return request<{ ok: boolean }>("/api/messages", {
      method: "DELETE",
      body: JSON.stringify({ folder, uids }),
    });
  },
  toggleFlag(folder: string, uid: number, flagged: boolean) {
    return request<{ ok: boolean }>(`/api/messages/${uid}/flag`, {
      method: "PATCH",
      body: JSON.stringify({ folder, flagged }),
    });
  },
  markUnread(folder: string, uid: number) {
    return request<{ ok: boolean }>(`/api/messages/${uid}/unread`, {
      method: "PATCH",
      body: JSON.stringify({ folder }),
    });
  },
  moveMessages(from: string, to: string, uids: number[]) {
    return request<{ ok: boolean }>("/api/messages/move", {
      method: "POST",
      body: JSON.stringify({ from, to, uids }),
    });
  },
  hostStatus() {
    return request<AdminDashboard>("/api/admin/status/dashboard");
  },
  accountProfile() {
    return request<{ profile: MailboxProfile }>("/api/account/profile");
  },
  adminDomains() {
    return request<{ domains: unknown[] }>("/api/admin/domains");
  },
  adminMailboxes(domain?: string) {
    const q = domain ? `?domain=${encodeURIComponent(domain)}` : "";
    return request<{ mailboxes: unknown[] }>(`/api/admin/mailboxes${q}`);
  },
  adminCreateDomain(domain: string) {
    return request<{ ok: boolean }>("/api/admin/domains", {
      method: "POST",
      body: JSON.stringify({
        domain,
        active: "1",
        aliases: "400",
        mailboxes: "50",
        defquota: "3072",
        maxquota: "10240",
        quota: "102400",
        relayhost: "",
        backupmx: "0",
        gal: "1",
      }),
    });
  },
  adminCreateMailbox(data: {
    local_part: string;
    domain: string;
    name: string;
    password: string;
    quota?: string;
  }) {
    return request<{ ok: boolean }>("/api/admin/mailboxes", {
      method: "POST",
      body: JSON.stringify({
        ...data,
        quota: data.quota ?? "3072",
        active: "1",
        force_pw_update: "0",
        password2: data.password,
      }),
    });
  },
  adminDomainAdmins() {
    return request<{ domainAdmins: DomainAdminRow[] }>("/api/admin/domain-admins");
  },
  adminCreateDomainAdmin(data: {
    username: string;
    password: string;
    domains: string[];
  }) {
    return request<{ ok: boolean }>("/api/admin/domain-admins", {
      method: "POST",
      body: JSON.stringify({ ...data, active: "1" }),
    });
  },
  adminUpdateDomainAdmin(data: {
    username: string;
    password?: string;
    domains?: string[];
    active?: boolean;
    currentActive?: string;
  }) {
    return request<{ ok: boolean }>("/api/admin/domain-admins", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
  adminDeleteDomainAdmin(username: string) {
    return request<{ ok: boolean }>("/api/admin/domain-admins", {
      method: "DELETE",
      body: JSON.stringify({ username }),
    });
  },
  domainDomains() {
    return request<{ domains: { domain_name?: string; active?: string }[] }>("/api/domain/domains");
  },
  domainMailboxes(domain: string) {
    return request<{ mailboxes: unknown[] }>(`/api/domain/mailboxes?domain=${encodeURIComponent(domain)}`);
  },
  domainCreateMailbox(data: {
    local_part: string;
    domain: string;
    name: string;
    password: string;
    quota?: string;
  }) {
    return request<{ ok: boolean }>("/api/domain/mailboxes", {
      method: "POST",
      body: JSON.stringify({
        ...data,
        quota: data.quota ?? "3072",
        active: "1",
        force_pw_update: "0",
        password2: data.password,
      }),
    });
  },
  changePassword(password: string, password2?: string) {
    return request<{ ok: boolean }>("/api/account/password", {
      method: "POST",
      body: JSON.stringify({ password, password2: password2 ?? password }),
    });
  },
  appPasswords() {
    return request<{ items: unknown[] }>("/api/account/app-passwords");
  },
  addAppPassword(app_name: string, app_passwd: string) {
    return request<{ ok: boolean }>("/api/account/app-passwords", {
      method: "POST",
      body: JSON.stringify({ app_name, app_passwd, app_passwd2: app_passwd }),
    });
  },
  deleteAppPassword(id: string) {
    return request<{ ok: boolean }>("/api/account/app-passwords", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });
  },
  sieve() {
    return request<{ scripts: { name: string; active: boolean }[]; active: string }>("/api/account/sieve");
  },
  saveSieve(name: string, content: string) {
    return request<{ ok: boolean }>("/api/account/sieve", {
      method: "PUT",
      body: JSON.stringify({ name, content }),
    });
  },
  calendars() {
    return request<{ calendars: { href: string; name: string }[] }>("/api/calendar/calendars");
  },
  calendarEvents(href: string) {
    return request<{ events: { summary: string; raw: string }[] }>(
      `/api/calendar/events?href=${encodeURIComponent(href)}`,
    );
  },
  contactBooks() {
    return request<{ books: { href: string; name: string }[] }>("/api/contacts/books");
  },
  contacts(href: string) {
    return request<{ contacts: { fn: string; email?: string }[] }>(
      `/api/contacts/list?href=${encodeURIComponent(href)}`,
    );
  },
};
