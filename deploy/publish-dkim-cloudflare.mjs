#!/usr/bin/env node
/** Publica DKIM no Cloudflare (valores passados ou via SSH). */
import { loadEnv } from "./lib/env.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const env = loadEnv(join(__dir, ".env.deploy"));

const DKIM = {
  "nivesistemas.com.br": {
    zone: env.CLOUDFLARE_ZONE_ID,
    // Seletor dkim, RSA 2048 (chave atual do Mailcow; a privada fica só no Redis).
    txt: "v=DKIM1;k=rsa;t=s;s=email;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsUeX1QAwoIwsPGkK3fJ7rYfQ94QEqGBHolOFEOUqV97V+FjJgW+bmbOXqmVpPm0boIUrmxxVO3NR10ZyQBsh9kwDBCArAU9+3rjyG6+eFb8HcNNkqugdYE0X/Gm+LGKjCYTAeU2p6HE9So7EzCnhHB6wjp7sg9FQjzDhOMXcXXAKVKcvq4985jJ1EmzhpZmb/xP00MFESB7wAN021H1jw8veWgYHXVR8iLwSaXDE4jauH/6b5XFbN7WSAx/mIn25ke+4lcci4ZhAff39PypeE3iSsGlUZZdoSctnxZY9AvOX0CfKhctRHgqfm1ZbsAZxM0VgFAUvN332j4GIVcX91QIDAQAB",
  },
};

async function cfApi(method, path, body) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.success) throw new Error(JSON.stringify(data.errors || data));
  return data.result;
}

for (const [domain, { zone, txt }] of Object.entries(DKIM)) {
  const name = `dkim._domainkey.${domain}`;
  const list = await cfApi("GET", `/zones/${zone}/dns_records?type=TXT&name=${encodeURIComponent(name)}`);
  const payload = { type: "TXT", name, content: txt, ttl: 1, proxied: false };
  if (list.length) {
    await cfApi("PUT", `/zones/${zone}/dns_records/${list[0].id}`, payload);
    console.log(`DKIM atualizado: ${domain}`);
  } else {
    await cfApi("POST", `/zones/${zone}/dns_records`, payload);
    console.log(`DKIM criado: ${domain}`);
  }
}

console.log("DKIM publicado no Cloudflare.");
