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
    txt: "v=DKIM1;k=rsa;p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC2RWODA/P1aX/U8EGEiytTW7TldsqT2xBPN9Xqis7GJHwjQXbE7lLUBq9foj34L/0jXCIcROJQtdxZ+GjhGZql9hKDB+9SSsDUp+vli1FTfkr90WFSVciRFQI2usEk/JQcnMO2tUovxXcKftcQRf2QSNtU3eq1lEFIMCZMaKQ3IwIDAQAB",
  },
  "corelycommerce.com.br": {
    zone: env.EXTRA_CLOUDFLARE_ZONE_ID,
    txt: "v=DKIM1;k=rsa;p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC7vGmYbNtmflUGNa/8hfkGRji5TUtKi12wdjHSwOzF2kZySE801p/3XCUqCZQfcrKbUtw2LCmKlS/4hqMZi+lkEsXXvJDH1YkUjwWIxtYkMTdwTuOJc7cIIa5657fbHVYCEsBRgXLgLl5t1UxXRaEdiztdjfYFbNEa8QHCesX/nwIDAQAB",
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
