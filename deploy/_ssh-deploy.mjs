import { Client } from "ssh2";
import { readFileSync } from "node:fs";

const password = process.argv[2];
const scriptPath = process.argv[3];
const envPath = process.argv[4];
if (!password || !scriptPath) process.exit(1);

function parseEnv(text) {
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
const envExports = envPath ? parseEnv(readFileSync(envPath, "utf8")) : "";
const remote = `/tmp/mailcow-deploy-${Date.now()}.sh`;
const wrapper = `${envExports}\n${script}`.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

const conn = new Client();
conn
  .on("ready", () => {
    conn.sftp((err, sftp) => {
      if (err) throw err;
      sftp.writeFile(remote, wrapper, { mode: 0o755 }, (err2) => {
        if (err2) throw err2;
        conn.exec(`bash ${remote}`, (err3, stream) => {
          if (err3) throw err3;
          stream.pipe(process.stdout);
          stream.stderr.pipe(process.stderr);
          stream.on("close", (code) => process.exit(code ?? 0));
        });
      });
    });
  })
  .on("error", (e) => {
    console.error(e.message);
    process.exit(1);
  })
  .connect({
    host: process.env.VPS_IP || "2.25.181.76",
    port: Number(process.env.VPS_PORT || 22),
    username: process.env.VPS_USER || "root",
    password,
    readyTimeout: 120000,
  });
