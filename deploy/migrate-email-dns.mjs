#!/usr/bin/env node
/**
 * Migra DNS de e-mail (Nive + Corely) para Mailcow.
 * Remove registros conflitantes e publica MX/SPF/DMARC/DKIM corretos.
 */
import { readFileSync } from "node:fs";
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

async function listRecords(token, zoneId, type, name) {
  const q = name
    ? `/zones/${zoneId}/dns_records?type=${type}&name=${encodeURIComponent(name)}&per_page=100`
    : `/zones/${zoneId}/dns_records?type=${type}&per_page=100`;
  return cfApi(token, "GET", q);
}

async function deleteRecord(token, zoneId, id, label) {
  await cfApi(token, "DELETE", `/zones/${zoneId}/dns_records/${id}`);
  console.log(`  removido ${label} (${id})`);
}

async function upsertRecord(token, zoneId, type, name, content, extra = {}) {
  const list = await listRecords(token, zoneId, type, name);
  const payload = { type, name, content, ttl: 1, proxied: false, ...extra };

  if (type === "TXT" && name.endsWith(".com.br") && !name.startsWith("_") && !name.startsWith("dkim")) {
    const spf = list.find((r) => r.content.includes("v=spf1"));
    if (spf) {
      await cfApi(token, "PUT", `/zones/${zoneId}/dns_records/${spf.id}`, payload);
      console.log(`  atualizado SPF ${name}`);
      for (const r of list) {
        if (r.id !== spf.id && r.content.match(/v=spf1|zoho/i)) {
          await deleteRecord(token, zoneId, r.id, `TXT conflito ${r.name}`);
        }
      }
      return;
    }
  }

  if (list.length) {
    await cfApi(token, "PUT", `/zones/${zoneId}/dns_records/${list[0].id}`, payload);
    console.log(`  atualizado ${type} ${name}`);
  } else {
    await cfApi(token, "POST", `/zones/${zoneId}/dns_records`, payload);
    console.log(`  criado ${type} ${name}`);
  }
}

async function cleanupZone(token, zoneId, label) {
  console.log(`\n==> Limpeza ${label}`);
  const all = await cfApi(token, "GET", `/zones/${zoneId}/dns_records?per_page=100`);
  for (const r of all) {
    const bad =
      r.content.match(/zoho/i) ||
      r.content === '"v=spf1 -all"' ||
      r.content === "v=spf1 -all" ||
      r.name.includes("com.br.corelycommerce") ||
      (r.type === "MX" && r.content.includes("mail.corelycommerce.com.br"));
    if (bad) {
      await deleteRecord(token, zoneId, r.id, `${r.type} ${r.name} -> ${r.content.slice(0, 60)}`);
    }
  }
}

function fetchDkimViaSsh(env, dkimDomain) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => {
        const cmd = `cd /opt/mailcow-dockerized && docker compose exec -T rspamd-mailcow sh -c 'test -f /var/lib/rspamd/dkim/${dkimDomain}.txt && cat /var/lib/rspamd/dkim/${dkimDomain}.txt || rspamadm dkim_keygen -d ${dkimDomain} -s dkim'`;
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

function parseDkimTxt(raw) {
  const parts = [...raw.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  if (parts.length >= 2) return parts.join("").replace(/\s+/g, "");
  const single = raw.match(/"([^"]+)"/);
  return single ? single[1].replace(/\s+/g, "") : null;
}

async function publishDkim(env, zoneId, dkimDomain) {
  console.log(`==> DKIM: ${dkimDomain}`);
  const raw = await fetchDkimViaSsh(env, dkimDomain);
  const dkim = parseDkimTxt(raw);
  if (!dkim) {
    console.error(`  DKIM não encontrado para ${dkimDomain}`);
    return false;
  }
  await upsertRecord(
    env.CLOUDFLARE_API_TOKEN,
    zoneId,
    "TXT",
    `dkim._domainkey.${dkimDomain}`,
    dkim,
  );
  return true;
}

async function configureDomain(token, zoneId, domain, mailHost, vpsIp, isPrimaryZone) {
  console.log(`\n==> DNS ${domain}`);
  if (isPrimaryZone) {
    await upsertRecord(token, zoneId, "A", mailHost, vpsIp);
  }
  for (const sub of ["autodiscover", "autoconfig", "mta-sts"]) {
    await upsertRecord(token, zoneId, "A", `${sub}.${domain}`, vpsIp);
  }
  await upsertRecord(token, zoneId, "MX", domain, mailHost, { priority: 10 });
  await upsertRecord(
    token,
    zoneId,
    "TXT",
    domain,
    `v=spf1 mx a:${mailHost} ip4:${vpsIp} ~all`,
  );
  await upsertRecord(
    token,
    zoneId,
    "TXT",
    `_dmarc.${domain}`,
    `v=DMARC1; p=quarantine; rua=mailto:postmaster@${domain}`,
  );
}

const env = loadEnv(envPath);
const {
  CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_ZONE_ID,
  EXTRA_CLOUDFLARE_ZONE_ID,
  MAILCOW_HOSTNAME,
  VPS_IP,
  MAIL_DOMAIN,
  EXTRA_MAIL_DOMAIN,
} = env;

if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID || !MAILCOW_HOSTNAME || !VPS_IP) {
  console.error("Preencha deploy/.env.deploy");
  process.exit(1);
}

const mailHost = MAILCOW_HOSTNAME;

await cleanupZone(CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, MAIL_DOMAIN);
if (EXTRA_CLOUDFLARE_ZONE_ID) {
  await cleanupZone(CLOUDFLARE_API_TOKEN, EXTRA_CLOUDFLARE_ZONE_ID, EXTRA_MAIL_DOMAIN);
}

await configureDomain(CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, MAIL_DOMAIN, mailHost, VPS_IP, true);

if (EXTRA_MAIL_DOMAIN && EXTRA_CLOUDFLARE_ZONE_ID) {
  await configureDomain(
    CLOUDFLARE_API_TOKEN,
    EXTRA_CLOUDFLARE_ZONE_ID,
    EXTRA_MAIL_DOMAIN,
    mailHost,
    VPS_IP,
    false,
  );
}

if (withDkim) {
  await publishDkim(env, CLOUDFLARE_ZONE_ID, MAIL_DOMAIN);
  if (EXTRA_MAIL_DOMAIN && EXTRA_CLOUDFLARE_ZONE_ID) {
    await publishDkim(env, EXTRA_CLOUDFLARE_ZONE_ID, EXTRA_MAIL_DOMAIN);
  }
}

console.log("\nDNS migrado para Mailcow.");
console.log("PTR/rDNS manual:", VPS_IP, "->", mailHost);
if (!withDkim) console.log("Depois: node migrate-email-dns.mjs --dkim");
