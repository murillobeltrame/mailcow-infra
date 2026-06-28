import { verifyAdminPassword, verifyDomainAdminPassword } from "./mailcow-panel-auth.js";
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

function authError(message: string, statusCode = 401): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

/**
 * Autentica conforme a aba escolhida no login (mesmas regras do Mailcow PHP).
 * Admin/domainadmin validam senha BLF-CRYPT no MySQL (nginx redireciona POST /admin/ → portal).
 * - user: caixa IMAP (e-mail completo)
 * - admin: tabela admin
 * - domainadmin: senha na tabela admin (superadmin=0) + domínios em domain_admins
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
    const ok = await verifyAdminPassword(adminUser, password);
    if (!ok) throw authError("Credenciais de administrador inválidas");
    return { role: "admin", subject: adminUser, password, name: "Administrador" };
  }

  if (loginAs === "domainadmin") {
    if (!id) throw authError("Informe o usuário do administrador de domínio");
    const domains = await verifyDomainAdminPassword(id, password);
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
