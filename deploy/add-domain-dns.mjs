#!/usr/bin/env node
/**
 * Adiciona domínio de e-mail: DNS Cloudflare + instruções VPS.
 * Uso: node add-domain-dns.mjs <dominio> <cloudflare_zone_id> [--dkim-via-ssh]
 */
import { Client } from "ssh2";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, sshConnectOptions } from "./lib/env.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const domain = process.argv[2];
const zoneId = process.argv[3];
const withDkim = process.argv.includes("--dkim");

if (!domain || !zoneId) {
  console.error("Uso: node add-domain-dns.mjs <dominio> <zone_id> [--dkim]");
  process.exit(1);
}

const env = loadEnv(join(__dir, ".env.deploy"));
const token = env.CLOUDFLARE_API_TOKEN;
const mailHost = env.MAILCOW_HOSTNAME;
const vpsIp = env.VPS_IP;

async function cfApi(method, path, body) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.success) throw new Error(JSON.stringify(data.errors || data));
  return data.result;
}

async function listRecords(type, name) {
  const q = name
    ? `/zones/${zoneId}/dns_records?type=${type}&name=${encodeURIComponent(name)}&per_page=100`
    : `/zones/${zoneId}/dns_records?type=${type}&per_page=100`;
  return cfApi("GET", q);
}

async function upsert(type, name, content, extra = {}) {
  const list = await listRecords(type, name);
  const payload = { type, name, content, ttl: 1, proxied: false, ...extra };
  if (type === "TXT" && name === domain) {
    const spf = list.find((r) => r.content.includes("v=spf1"));
    if (spf) {
      await cfApi("PUT", `/zones/${zoneId}/dns_records/${spf.id}`, payload);
      console.log(`  SPF ${name}`);
      return;
    }
  }
  if (list.length) {
    await cfApi("PUT", `/zones/${zoneId}/dns_records/${list[0].id}`, payload);
  } else {
    await cfApi("POST", `/zones/${zoneId}/dns_records`, payload);
  }
  console.log(`  ${type} ${name}`);
}

console.log(`\n==> DNS ${domain}`);
for (const sub of ["autodiscover", "autoconfig", "mta-sts"]) {
  await upsert("A", `${sub}.${domain}`, vpsIp);
}
await upsert("MX", domain, mailHost, { priority: 10 });
await upsert("TXT", domain, `v=spf1 mx a:${mailHost} ip4:${vpsIp} ~all`);
await upsert("TXT", `_dmarc.${domain}`, `v=DMARC1; p=quarantine; rua=mailto:postmaster@${domain}`);

if (withDkim) {
  const raw = await new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => {
        conn.exec(
          `cd /opt/mailcow-dockerized && docker compose exec -T rspamd-mailcow cat /var/lib/rspamd/dkim/${domain}.txt 2>/dev/null || docker compose exec -T rspamd-mailcow rspamadm dkim_keygen -d ${domain} -s dkim`,
          (err, stream) => {
            if (err) return reject(err);
            let out = "";
            stream.on("data", (d) => (out += d));
            stream.on("close", () => {
              conn.end();
              resolve(out);
            });
          },
        );
      })
      .on("error", reject)
      .connect(sshConnectOptions(env));
  });
  const parts = [...raw.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const dkim = parts.length >= 2 ? parts.join("").replace(/\s+/g, "") : null;
  if (!dkim) throw new Error("DKIM não encontrado no VPS");
  await upsert("TXT", `dkim._domainkey.${domain}`, dkim);
  console.log(`  DKIM ${domain}`);
}

console.log("\nDNS OK:", domain);
