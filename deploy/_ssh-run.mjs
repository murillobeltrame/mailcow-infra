import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, connectSsh } from "./lib/env.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const scriptName = process.argv[2];
const envPath = process.argv[3] || join(__dir, ".env.deploy");

if (!scriptName) {
  console.error("Uso: node _ssh-run.mjs <script.sh> [.env.deploy]");
  process.exit(1);
}

const scriptPath = join(__dir, scriptName);
const env = loadEnv(envPath);

function parseEnvExports(text) {
  const out = [];
  for (const line of text.split("\n")) {
    const clean = line.replace(/\r$/, "");
    const m = clean.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    out.push(`export ${m[1]}='${m[2].replace(/'/g, `'\\''`)}'`);
  }
  return out.join("\n");
}

const script = readFileSync(scriptPath, "utf8");
const envExports = existsSync(envPath) ? parseEnvExports(readFileSync(envPath, "utf8")) : "";
const remote = `/tmp/mailcow-ssh-${Date.now()}.sh`;
const wrapper = `${envExports}\n${script}`.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

connectSsh(env, {
  onReady: (conn) => {
    conn.sftp((err, sftp) => {
      if (err) throw err;
      sftp.writeFile(remote, wrapper, { mode: 0o755 }, (err2) => {
        if (err2) throw err2;
        conn.exec(`bash ${remote}; rm -f ${remote}`, (err3, stream) => {
          if (err3) throw err3;
          stream.pipe(process.stdout);
          stream.stderr.pipe(process.stderr);
          stream.on("close", (code) => process.exit(code ?? 0));
        });
      });
    });
  },
});
