#!/usr/bin/env node
/**
 * Garante registro A smtp.<domínio> DNS-only para SMTP/IMAP (mail pode estar proxied).
 * Uso: node ensure-smtp-dns.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./lib/env.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const env = loadEnv(join(__dir, ".env.deploy"));
const mailHost = env.MAILCOW_HOSTNAME || "mail.nivesistemas.com.br";
const smtpName = mailHost.replace(/^mail\./, "smtp.");
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
  `/zones/${zoneId}/dns_records?name=${encodeURIComponent(smtpName)}&type=A`,
);

const payload = { type: "A", name: smtpName, content: vpsIp, ttl: 1, proxied: false };

if (list[0]) {
  await cfApi("PUT", `/zones/${zoneId}/dns_records/${list[0].id}`, payload);
  console.log(`Atualizado: ${smtpName} -> ${vpsIp} (DNS only)`);
} else {
  await cfApi("POST", `/zones/${zoneId}/dns_records`, payload);
  console.log(`Criado: ${smtpName} -> ${vpsIp} (DNS only)`);
}

console.log(`Use ${smtpName} como host SMTP/IMAP quando mail.* estiver com proxy Cloudflare.`);
