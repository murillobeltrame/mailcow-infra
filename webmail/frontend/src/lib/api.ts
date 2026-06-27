export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
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

export type User = { email: string; name?: string };

export type Folder = {
  path: string;
  name: string;
  specialUse?: string;
  unseen?: number;
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
  login(email: string, password: string) {
    return request<User>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  logout() {
    return request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
  },
  me() {
    return request<User>("/api/auth/me");
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
  send(data: { to: string; subject: string; body: string; cc?: string }) {
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
};
