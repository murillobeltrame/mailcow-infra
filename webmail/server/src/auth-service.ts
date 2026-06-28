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
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Forwarded-Host": config.mailcowHostname,
      },
      body: new URLSearchParams(fields),
      redirect: "manual",
    });
    const location = res.headers.get("location") ?? "";
    if (res.status === 302 || res.status === 303) {
      return !location.includes("login") && location.length > 0;
    }
    const cookies = res.headers.get("set-cookie") ?? "";
    return res.status === 200 && (cookies.includes("mailcow") || cookies.includes("PHPSESSID"));
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

async function resolveDomainAdminDomains(username: string): Promise<string[]> {
  try {
    const all = await listDomains();
    const names = (all as { domain_name?: string }[])
      .map((d) => d.domain_name?.toLowerCase())
      .filter(Boolean) as string[];
    if (username.includes("@")) {
      const dom = username.split("@")[1]?.toLowerCase();
      if (dom && names.includes(dom)) return [dom];
    }
    return names;
  } catch {
    if (username.includes("@")) {
      const dom = username.split("@")[1]?.toLowerCase();
      return dom ? [dom] : [];
    }
    return [];
  }
}

async function verifyDomainAdminLogin(username: string, password: string): Promise<string[] | null> {
  const attempts: Record<string, string>[] = [
    { login_user: username, login_pass: password },
    { username, password },
  ];
  for (const fields of attempts) {
    if (await probePanelLogin("/domainadmin/", fields)) {
      const domains = await resolveDomainAdminDomains(username);
      return domains.length ? domains : null;
    }
  }
  return null;
}

function authError(message: string, statusCode = 401): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

/**
 * Autentica conforme a aba escolhida no login (mesmas regras do Mailcow PHP).
 * - user: só caixa IMAP (e-mail completo)
 * - admin: painel /admin/ (usuário admin global)
 * - domainadmin: painel /domainadmin/ (sem fallback IMAP)
 */
export async function authenticateLogin(
  login: string,
  password: string,
  loginAs: UserRole = "user",
): Promise<LoginResult> {
  const id = login.trim();
  const lower = id.toLowerCase();

  if (loginAs === "admin") {
    const adminUser = lower === "admin" || !id ? "admin" : id;
    const ok = await verifyAdminLogin(adminUser, password);
    if (!ok) throw authError("Credenciais de administrador inválidas");
    return { role: "admin", subject: adminUser, password, name: "Administrador" };
  }

  if (loginAs === "domainadmin") {
    if (!id) throw authError("Informe o usuário do administrador de domínio");
    const domains = await verifyDomainAdminLogin(id, password);
    if (!domains) throw authError("Credenciais de administrador de domínio inválidas");
    return {
      role: "domainadmin",
      subject: id,
      email: id.includes("@") ? lower : undefined,
      password,
      name: id.includes("@") ? id.split("@")[0]! : id,
      domains,
    };
  }

  // loginAs === "user" — exclusivamente caixa de e-mail via IMAP
  if (!id.includes("@")) {
    throw authError("Informe o endereço de e-mail completo (ex.: voce@empresa.com.br)", 400);
  }
  const imapOk = await verifyCredentials(lower, password);
  if (!imapOk) throw authError("E-mail ou senha inválidos");
  return {
    role: "user",
    subject: lower,
    email: lower,
    password,
    name: lower.split("@")[0],
  };
}

/** Sessão portal após FIDO2 Mailcow (cookie PHP já validado). */
export async function sessionFromFido2Subject(subject: string): Promise<LoginResult> {
  if (subject.toLowerCase() === "admin") {
    return { role: "admin", subject: "admin", password: "", name: "Administrador" };
  }
  if (subject.includes("@")) {
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
