#!/usr/bin/env node
/**
 * Configura registros DNS no Cloudflare para Mailcow.
 * Uso:
 *   node deploy/configure-dns.mjs           # A, MX, SPF, DMARC
 *   node deploy/configure-dns.mjs --dkim    # + DKIM (requer Mailcow rodando)
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "ssh2";
import { loadEnv, sshConnectOptions } from "./lib/env.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const withDkim = process.argv.includes("--dkim");
const envPath = join(__dir, ".env.deploy");

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

function fetchDkimViaSsh(env, dkimDomain) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => {
        const cmd = `cd /opt/mailcow-dockerized && docker compose exec -T rspamd-mailcow rspamadm dkim_keygen -d ${dkimDomain} -s dkim`;
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
      .connect(sshConnectOptions(env));
  });
}

async function publishDkim(env, zoneId, dkimDomain) {
  console.log(`==> DKIM: ${dkimDomain}`);
  const raw = await fetchDkimViaSsh(env, dkimDomain);
  const dkim = parseDkimTxt(raw);
  if (!dkim) {
    console.error(`DKIM não encontrado para ${dkimDomain}`);
    return false;
  }
  await upsertRecord(
    env.CLOUDFLARE_API_TOKEN,
    zoneId,
    "TXT",
    `dkim._domainkey.${dkimDomain}`,
    dkim
  );
  return true;
}

function parseDkimTxt(raw) {
  const parts = [...raw.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  if (parts.length >= 2) {
    return parts.join("").replace(/\s+/g, "");
  }
  const single = raw.match(/"([^"]+)"/);
  return single ? single[1].replace(/\s+/g, "") : null;
}

const env = loadEnv(envPath);
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

const domain =
  MAIL_DOMAIN ||
  (MAILCOW_HOSTNAME.includes(".com.br")
    ? MAILCOW_HOSTNAME.split(".").slice(-3).join(".")
    : MAILCOW_HOSTNAME.split(".").slice(-2).join("."));
const mailHost = MAILCOW_HOSTNAME;
const extraDomain = env.EXTRA_MAIL_DOMAIN;
const extraZoneId = env.EXTRA_CLOUDFLARE_ZONE_ID;

console.log(`==> DNS Cloudflare: ${domain}`);
console.log(`    hostname mail: ${mailHost}`);

await upsertRecord(CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, "A", mailHost, VPS_IP);

for (const sub of ["autodiscover", "autoconfig", "mta-sts"]) {
  await upsertRecord(
    CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_ZONE_ID,
    "A",
    `${sub}.${domain}`,
    VPS_IP
  );
}
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

if (extraDomain && extraZoneId) {
  console.log(`\n==> DNS secundário: ${extraDomain} -> ${mailHost}`);
  await upsertRecord(CLOUDFLARE_API_TOKEN, extraZoneId, "MX", extraDomain, mailHost, {
    priority: 10,
  });
  await upsertRecord(
    CLOUDFLARE_API_TOKEN,
    extraZoneId,
    "TXT",
    extraDomain,
    `v=spf1 mx a:${mailHost} ip4:${VPS_IP} ~all`
  );
}

if (withDkim) {
  if (!env.VPS_SSH_PASS && !process.env.VPS_SSH_KEY) {
    console.error("VPS_SSH_PASS ou VPS_SSH_KEY necessário para --dkim");
    process.exit(1);
  }
  await publishDkim(env, CLOUDFLARE_ZONE_ID, domain);
  if (extraDomain && extraZoneId) {
    await publishDkim(env, extraZoneId, extraDomain);
  }
}

console.log("\nDNS base configurado.");
console.log("Configure PTR/rDNS no hPanel Hostinger:", mailHost, "->", VPS_IP);
if (!withDkim) console.log("Depois: node deploy/configure-dns.mjs --dkim");
