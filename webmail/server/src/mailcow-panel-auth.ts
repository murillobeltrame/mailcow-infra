import bcrypt from "bcryptjs";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { config } from "./config.js";

function normalizeBlfHash(stored: string): string {
  return stored.replace(/^\{BLF-CRYPT\}/, "").replace(/^\$2y\$/, "$2a$");
}

function verifyBlfCrypt(stored: string, password: string): boolean {
  if (!stored || !password) return false;
  try {
    return bcrypt.compareSync(password, normalizeBlfHash(stored));
  } catch {
    return false;
  }
}

async function withDb<T>(fn: (conn: mysql.Connection) => Promise<T>): Promise<T | null> {
  if (!config.mailcowDbHost || !config.mailcowDbUser || !config.mailcowDbName) {
    return null;
  }
  const conn = await mysql.createConnection({
    host: config.mailcowDbHost,
    user: config.mailcowDbUser,
    password: config.mailcowDbPass,
    database: config.mailcowDbName,
  });
  try {
    return await fn(conn);
  } finally {
    await conn.end();
  }
}

/** Verifica admin global contra tabela `admin` (BLF-CRYPT). */
export async function verifyAdminPassword(username: string, password: string): Promise<boolean> {
  const user = username.toLowerCase().trim();
  const row = await withDb(async (conn) => {
    const [rows] = await conn.execute(
      "SELECT password FROM admin WHERE username = ? AND active = 1 LIMIT 1",
      [user],
    );
    return (rows as RowDataPacket[])[0] as { password?: string } | undefined;
  });
  if (!row?.password) return false;
  return verifyBlfCrypt(row.password, password);
}

/** Verifica domain admin e retorna domínios permitidos (tabelas `domain_admins` + `da_acl`). */
export async function verifyDomainAdminPassword(
  username: string,
  password: string,
): Promise<string[] | null> {
  const user = username.trim();
  const lower = user.toLowerCase();

  const result = await withDb(async (conn) => {
    const [admins] = await conn.execute(
      "SELECT password FROM domain_admins WHERE username = ? AND active = 1 LIMIT 1",
      [lower],
    );
    const row = (admins as RowDataPacket[])[0] as { password?: string } | undefined;
    if (!row?.password || !verifyBlfCrypt(row.password, password)) return null;

    const [aclRows] = await conn.execute("SELECT domain FROM da_acl WHERE username = ?", [lower]);
    const domains = (aclRows as RowDataPacket[])
      .map((r) => (r as { domain?: string }).domain?.toLowerCase())
      .filter(Boolean) as string[];
    if (domains.length) return domains;

    if (lower.includes("@")) {
      const dom = lower.split("@")[1];
      return dom ? [dom] : [];
    }
    return [];
  });

  if (result === null) return null;
  return result.length ? result : null;
}
