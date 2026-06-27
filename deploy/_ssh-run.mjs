import { Client } from "ssh2";

const password = process.argv[2];
const cmd = process.argv[3];
if (!password || !cmd) process.exit(1);

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
  .connect({
    host: process.env.VPS_IP || "2.25.181.76",
    port: Number(process.env.VPS_PORT || 22),
    username: process.env.VPS_USER || "root",
    password,
    readyTimeout: 120000,
  });
