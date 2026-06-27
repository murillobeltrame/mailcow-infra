#!/usr/bin/env node
/**
 * Configura registros DNS no Cloudflare para Mailcow.
 * Uso:
 *   node deploy/configure-dns.mjs           # A, MX, SPF, DMARC
 *   node deploy/configure-dns.mjs --dkim    # + DKIM (requer Mailcow rodando)
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "ssh2";

const __dir = dirname(fileURLToPath(import.meta.url));
const withDkim = process.argv.includes("--dkim");

function loadEnv() {
  const path = join(__dir, ".env.deploy");
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

async function cfApi(token, method, path, body) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(JSON.stringify(data.errors || data));
  }
  return data.result;
}

async function upsertRecord(token, zoneId, type, name, content, extra = {}) {
  const list = await cfApi(
    token,
    "GET",
    `/zones/${zoneId}/dns_records?type=${type}&name=${encodeURIComponent(name)}`
  );
  const payload = { type, name, content, ttl: 1, proxied: false, ...extra };
  if (list.length) {
    await cfApi(token, "PUT", `/zones/${zoneId}/dns_records/${list[0].id}`, payload);
    console.log(`  atualizado ${type} ${name}`);
  } else {
    await cfApi(token, "POST", `/zones/${zoneId}/dns_records`, payload);
    console.log(`  criado ${type} ${name}`);
  }
}

function fetchDkimViaSsh(env) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => {
        const cmd = `docker compose -f /opt/mailcow-dockerized/docker-compose.yml exec -T rspamd-mailcow cat /var/lib/rspamd/dkim/${env.MAILCOW_HOSTNAME}.txt 2>/dev/null || true`;
        conn.exec(cmd, (err, stream) => {
          if (err) return reject(err);
          let out = "";
          stream.on("data", (d) => (out += d));
          stream.on("close", () => {
            conn.end();
            resolve(out.trim());
          });
        });
      })
      .on("error", reject)
      .connect({
        host: env.VPS_IP,
        port: 22,
        username: env.VPS_USER || "root",
        password: env.VPS_SSH_PASS,
        readyTimeout: 60000,
      });
  });
}

function parseDkimTxt(raw) {
  const m = raw.match(/"([^"]+)"\s*"([^"]+)"/);
  if (!m) {
    const single = raw.match(/"([^"]+)"/);
    return single ? single[1].replace(/\s+/g, "") : null;
  }
  return (m[1] + m[2]).replace(/\s+/g, "");
}

const env = loadEnv();
const {
  CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_ZONE_ID,
  MAILCOW_HOSTNAME,
  VPS_IP,
  MAIL_DOMAIN,
} = env;

if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID || !MAILCOW_HOSTNAME || !VPS_IP) {
  console.error("Preencha deploy/.env.deploy (veja .env.deploy.example)");
  process.exit(1);
}

const domain = MAIL_DOMAIN || MAILCOW_HOSTNAME.split(".").slice(-2).join(".");
const mailHost = MAILCOW_HOSTNAME;

console.log(`==> DNS Cloudflare: ${domain}`);
console.log(`    hostname mail: ${mailHost}`);

await upsertRecord(CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, "A", mailHost, VPS_IP);
await upsertRecord(
  CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_ZONE_ID,
  "MX",
  domain,
  mailHost,
  { priority: 10 }
);
await upsertRecord(
  CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_ZONE_ID,
  "TXT",
  domain,
  `v=spf1 mx a:${mailHost} ip4:${VPS_IP} ~all`
);
await upsertRecord(
  CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_ZONE_ID,
  "TXT",
  `_dmarc.${domain}`,
  "v=DMARC1; p=quarantine; rua=mailto:postmaster@" + domain
);

if (withDkim) {
  if (!env.VPS_SSH_PASS) {
    console.error("VPS_SSH_PASS necessário para --dkim");
    process.exit(1);
  }
  console.log("==> Buscando DKIM no VPS...");
  const raw = await fetchDkimViaSsh(env);
  const dkim = parseDkimTxt(raw);
  if (!dkim) {
    console.error("DKIM não encontrado. Aguarde o Mailcow inicializar e tente de novo.");
    process.exit(1);
  }
  await upsertRecord(
    CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_ZONE_ID,
    "TXT",
    `dkim._domainkey.${domain}`,
    dkim
  );
}

console.log("\nDNS base configurado.");
console.log("Configure PTR/rDNS no hPanel Hostinger:", mailHost, "->", VPS_IP);
if (!withDkim) console.log("Depois: node deploy/configure-dns.mjs --dkim");
