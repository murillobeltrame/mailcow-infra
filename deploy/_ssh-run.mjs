import { Client } from "ssh2";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, sshConnectOptions } from "./lib/env.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, ".env.deploy");

/** Compat: _ssh-run.mjs "senha" "cmd"  ou  _ssh-run.mjs "cmd" */
let cmd;
let passwordOverride;
if (process.argv[3]) {
  passwordOverride = process.argv[2];
  cmd = process.argv[3];
} else {
  cmd = process.argv[2];
}

if (!cmd) {
  console.error("Uso: node _ssh-run.mjs \"comando remoto\"");
  console.error("     node _ssh-run.mjs \"senha\" \"comando remoto\"  (legado)");
  process.exit(1);
}

const env = loadEnv(envPath);

const conn = new Client();
conn
  .on("ready", () => {
    conn.exec(cmd, { pty: true }, (err, stream) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }
      stream.on("close", (code) => process.exit(code ?? 0));
      stream.pipe(process.stdout);
      stream.stderr.pipe(process.stderr);
    });
  })
  .on("error", (e) => {
    console.error(e.message);
    process.exit(1);
  })
  .connect(sshConnectOptions(env, passwordOverride));
