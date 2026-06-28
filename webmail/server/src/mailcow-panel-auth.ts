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

/** Verifica domain admin e retorna domínios permitidos (Mailcow: senha em `admin`, escopo em `domain_admins`). */
export async function verifyDomainAdminPassword(
  username: string,
  password: string,
): Promise<string[] | null> {
  const user = username.trim();
  const candidates = user === user.toLowerCase() ? [user] : [user, user.toLowerCase()];

  const result = await withDb(async (conn) => {
    let matchedUser: string | null = null;
    let hash: string | undefined;

    for (const candidate of candidates) {
      const [admins] = await conn.execute(
        "SELECT password FROM admin WHERE username = ? AND superadmin = 0 AND active = 1 LIMIT 1",
        [candidate],
      );
      const row = (admins as RowDataPacket[])[0] as { password?: string } | undefined;
      if (row?.password) {
        matchedUser = candidate;
        hash = row.password;
        break;
      }
    }

    if (!matchedUser || !hash || !verifyBlfCrypt(hash, password)) return null;

    const [domainRows] = await conn.execute(
      "SELECT domain FROM domain_admins WHERE username = ? AND active = 1",
      [matchedUser],
    );
    const assigned = (domainRows as RowDataPacket[])
      .map((r) => (r as { domain?: string }).domain)
      .filter(Boolean) as string[];

    if (assigned.some((d) => d.toUpperCase() === "ALL")) {
      const [allRows] = await conn.execute("SELECT domain FROM domain WHERE active = 1");
      const allDomains = (allRows as RowDataPacket[])
        .map((r) => (r as { domain?: string }).domain?.toLowerCase())
        .filter(Boolean) as string[];
      return allDomains.length ? allDomains : null;
    }

    const domains = assigned.map((d) => d.toLowerCase());
    return domains.length ? domains : null;
  });

  return result;
}
