#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of readFileSync(join(__dir, ".env.deploy"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

async function cf(method, path, body) {
  const r = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!d.success) throw new Error(JSON.stringify(d.errors));
  return d.result;
}

const zones = [
  ["nive", env.CLOUDFLARE_ZONE_ID],
  ["corely", env.EXTRA_CLOUDFLARE_ZONE_ID],
];

for (const [label, zoneId] of zones) {
  console.log(`\n=== ${label} records with zoho or -all or corelycommerce mail ===`);
  for (const type of ["MX", "TXT", "CNAME"]) {
    const recs = await cf("GET", `/zones/${zoneId}/dns_records?type=${type}&per_page=100`);
    for (const r of recs) {
      if (
        r.content.match(/zoho/i) ||
        r.content.includes("-all") ||
        r.content.includes("mail.corelycommerce") ||
        r.name.includes("com.br.corely")
      ) {
        console.log(`  [${type}] id=${r.id} name=${r.name} content=${r.content.slice(0, 100)}`);
      }
    }
  }
}
