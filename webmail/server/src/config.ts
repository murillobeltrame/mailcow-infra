import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: parseInt(process.env.PORT ?? "8080", 10),
  host: process.env.HOST ?? "0.0.0.0",
  imapHost: process.env.IMAP_HOST ?? "dovecot-mailcow",
  imapPort: parseInt(process.env.IMAP_PORT ?? "993", 10),
  imapSecure: process.env.IMAP_SECURE !== "false",
  imapTlsServername: process.env.IMAP_TLS_SERVERNAME ?? "mail.nivesistemas.com.br",
  imapTlsRejectUnauthorized: process.env.IMAP_TLS_REJECT_UNAUTHORIZED === "true",
  smtpHost: process.env.SMTP_HOST ?? "postfix-mailcow",
  smtpPort: parseInt(process.env.SMTP_PORT ?? "587", 10),
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpTlsServername: process.env.SMTP_TLS_SERVERNAME ?? "mail.nivesistemas.com.br",
  sieveHost: process.env.SIEVE_HOST ?? "dovecot-mailcow",
  sievePort: parseInt(process.env.SIEVE_PORT ?? "4190", 10),
  sessionTtlMs: parseInt(process.env.SESSION_TTL_MS ?? String(8 * 60 * 60 * 1000), 10),
  cookieSecret: process.env.COOKIE_SECRET ?? "nive-mail-dev-secret-change-in-production",
  frontendDist: process.env.FRONTEND_DIST ?? path.resolve(__dirname, "../../frontend/dist"),
  basePath: process.env.BASE_PATH ?? "/mail",
  mailcowApiUrl: (process.env.MAILCOW_API_URL ?? "https://nginx-mailcow").replace(/\/$/, ""),
  mailcowApiKey: process.env.MAILCOW_API_KEY ?? "",
  mailcowHostname: process.env.MAILCOW_HOSTNAME ?? "mail.nivesistemas.com.br",
  mailcowDbHost: process.env.MAILCOW_DB_HOST ?? "mysql-mailcow",
  mailcowDbUser: process.env.MAILCOW_DB_USER ?? "",
  mailcowDbPass: process.env.MAILCOW_DB_PASS ?? "",
  mailcowDbName: process.env.MAILCOW_DB_NAME ?? "",
};

export const mailTlsOptions = {
  rejectUnauthorized: config.imapTlsRejectUnauthorized,
  servername: config.imapTlsServername,
};
