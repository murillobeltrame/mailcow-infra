#!/usr/bin/env node
/** Envia hotfix SMTP TLS para o backend no VPS e reinicia PM2. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, connectSsh } from "./lib/env.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const env = loadEnv(join(__dir, ".env.deploy"));
const localFile = join(
  __dir,
  "..",
  "..",
  "corely-foundation-builders",
  "backend",
  "src",
  "notifications",
  "notifications.service.ts",
);

const remotePaths = [
  "/var/www/corely-foundation-builders/backend/src/notifications/notifications.service.ts",
  "/var/www/corely-foundation-builders-b/backend/src/notifications/notifications.service.ts",
];

const content = readFileSync(localFile, "utf8");
if (!content.includes("buildSmtpTransportOptions")) {
  console.error("Arquivo local não contém o hotfix buildSmtpTransportOptions");
  process.exit(1);
}

connectSsh(env, {
  onReady: (conn) => {
    conn.sftp((err, sftp) => {
      if (err) throw err;
      let pending = remotePaths.length;
      for (const remote of remotePaths) {
        sftp.writeFile(remote, content, { mode: 0o644 }, (err2) => {
          if (err2) console.warn(`skip ${remote}: ${err2.message}`);
          else console.log(`uploaded ${remote}`);
          if (--pending === 0) {
            conn.exec(
              `set -e
for root in /var/www/corely-foundation-builders /var/www/corely-foundation-builders-b; do
  [ -d "$root/backend" ] || continue
  echo "==> build $root"
  (cd "$root/backend" && npm run build)
done
pm2 restart corely-green corely-blue 2>/dev/null || pm2 restart corely-green
echo "Hotfix SMTP TLS aplicado."`,
              (err3, stream) => {
                if (err3) throw err3;
                stream.pipe(process.stdout);
                stream.stderr.pipe(process.stderr);
                stream.on("close", (code) => process.exit(code ?? 0));
              },
            );
          }
        });
      }
    });
  },
});
