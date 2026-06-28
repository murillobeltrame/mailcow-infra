#!/usr/bin/env node
/**
 * Corrige certificado SMTP/IMAP:
 * 1. mail.* DNS-only no Cloudflare (ACME precisa validar HTTP)
 * 2. smtp.* A record DNS-only
 * 3. Renova certificado no VPS
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./lib/env.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const env = loadEnv(join(__dir, ".env.deploy"));
const mailHost = env.MAILCOW_HOSTNAME || "mail.nivesistemas.com.br";
const smtpHost = mailHost.replace(/^mail\./, "smtp.");

function runNode(script, args = []) {
  const res = spawnSync(process.execPath, [join(__dir, script), ...args], {
    cwd: __dir,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

function runSsh(script) {
  const res = spawnSync(process.execPath, [join(__dir, "_ssh-run.mjs"), script, join(__dir, ".env.deploy")], {
    cwd: __dir,
    stdio: "inherit",
    env: { ...process.env, ...env, CLIENT_MAIL_HOST: smtpHost },
  });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

console.log("==> 1/3 Cloudflare: mail.* DNS-only (validação ACME)");
runNode("fix-mail-web-dns.mjs");

console.log(`\n==> 2/3 Cloudflare: ${smtpHost} DNS-only`);
runNode("ensure-smtp-dns.mjs");

console.log("\n==> 3/3 VPS: renovar certificado Mailcow");
runSsh("fix-mailcow-cert.sh");

console.log("\nCertificado corrigido.");
console.log(`Use ${smtpHost} como servidor SMTP/IMAP em clientes externos.`);
