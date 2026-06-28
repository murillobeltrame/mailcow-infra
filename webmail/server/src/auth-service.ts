import { config } from "./config.js";
import { listDomains, mailcowRequest } from "./mailcow-api.js";
import { verifyCredentials } from "./mail-service.js";
import type { UserRole } from "./session.js";

export type LoginResult = {
  role: UserRole;
  subject: string;
  email?: string;
  password: string;
  name?: string;
  domains?: string[];
};

async function probePanelLogin(
  path: string,
  fields: Record<string, string>,
): Promise<boolean> {
  try {
    const res = await fetch(`${config.mailcowApiUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields),
      redirect: "manual",
    });
    const location = res.headers.get("location") ?? "";
    if (res.status === 302 || res.status === 303) {
      return !location.includes("login") && location.length > 0;
    }
    return res.status === 200 && res.headers.get("set-cookie")?.includes("mailcow") === true;
  } catch {
    return false;
  }
}

async function verifyAdminLogin(username: string, password: string): Promise<boolean> {
  const attempts: Record<string, string>[] = [
    { login_user: username, login_pass: password },
    { username, password },
    { user: username, pass: password },
  ];
  for (const fields of attempts) {
    if (await probePanelLogin("/admin/", fields)) return true;
  }
  return false;
}

async function verifyDomainAdminLogin(username: string, password: string): Promise<string[] | null> {
  const attempts: Record<string, string>[] = [
    { login_user: username, login_pass: password },
    { username, password },
  ];
  for (const fields of attempts) {
    if (await probePanelLogin("/domainadmin/", fields)) {
      try {
        const domains = await listDomains();
        const names = (domains as { domain_name?: string }[])
          .map((d) => d.domain_name?.toLowerCase())
          .filter(Boolean) as string[];
        if (username.includes("@")) {
          const dom = username.split("@")[1]?.toLowerCase();
          return dom ? [dom] : names.slice(0, 1);
        }
        return names.length ? names : ["nivesistemas.com.br"];
      } catch {
        return username.includes("@") ? [username.split("@")[1]!] : [];
      }
    }
  }
  return null;
}

export async function authenticateLogin(login: string, password: string): Promise<LoginResult> {
  const id = login.trim();
  const lower = id.toLowerCase();

  if (lower === "admin") {
    const ok = await verifyAdminLogin("admin", password);
    if (!ok) {
      const err = new Error("Credenciais de administrador inválidas") as Error & { statusCode: number };
      err.statusCode = 401;
      throw err;
    }
    return { role: "admin", subject: "admin", password, name: "Administrador" };
  }

  if (id.includes("@")) {
    const imapOk = await verifyCredentials(lower, password);
    if (imapOk) {
      return {
        role: "user",
        subject: lower,
        email: lower,
        password,
        name: lower.split("@")[0],
      };
    }

    const domains = await verifyDomainAdminLogin(lower, password);
    if (domains) {
      return {
        role: "domainadmin",
        subject: lower,
        email: lower,
        password,
        name: lower.split("@")[0],
        domains,
      };
    }
  } else {
    const domains = await verifyDomainAdminLogin(id, password);
    if (domains) {
      return {
        role: "domainadmin",
        subject: id,
        password,
        name: id,
        domains,
      };
    }
  }

  const err = new Error("E-mail ou senha inválidos") as Error & { statusCode: number };
  err.statusCode = 401;
  throw err;
}

/** Sessão portal após FIDO2 Mailcow (cookie PHP já validado). */
export async function sessionFromFido2Subject(subject: string): Promise<LoginResult> {
  if (subject.toLowerCase() === "admin") {
    return { role: "admin", subject: "admin", password: "", name: "Administrador" };
  }
  if (subject.includes("@")) {
    try {
      await mailcowRequest("GET", "get/mailbox/all");
    } catch {
      /* ignore */
    }
    return {
      role: "user",
      subject: subject.toLowerCase(),
      email: subject.toLowerCase(),
      password: "",
      name: subject.split("@")[0],
    };
  }
  return { role: "domainadmin", subject, password: "", name: subject, domains: [] };
}
