#!/usr/bin/env node
/**
 * Ativa proxy Cloudflare no A de mail (fallback) ou garante DNS-only + tunnel CNAME.
 * Uso: node fix-mail-web-dns.mjs [--proxy]
 */
import { loadEnv } from "./lib/env.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const env = loadEnv(join(__dir, ".env.deploy"));
const useProxy = process.argv.includes("--proxy");
const name = env.MAILCOW_HOSTNAME || "mail.nivesistemas.com.br";
const zoneId = env.CLOUDFLARE_ZONE_ID;
const token = env.CLOUDFLARE_API_TOKEN;
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

const list = await cfApi(
  "GET",
  `/zones/${zoneId}/dns_records?name=${encodeURIComponent(name)}&type=A`,
);
const rec = list[0];
if (!rec) throw new Error(`Registro A ${name} não encontrado`);

await cfApi("PUT", `/zones/${zoneId}/dns_records/${rec.id}`, {
  type: "A",
  name,
  content: vpsIp,
  ttl: 1,
  proxied: useProxy,
});

console.log(`${name} -> ${vpsIp} proxied=${useProxy}`);
console.log(
  useProxy
    ? "Proxy laranja ativo (HTTPS via Cloudflare). SMTP/IMAP continuam direto ao IP."
    : "DNS only (grey cloud). Use Cloudflare Tunnel se 443 externo estiver bloqueado.",
);
