import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, connectSsh } from "./lib/env.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, ".env.deploy");
const env = loadEnv(envPath);

const root = join(__dir, "..");
const brandingDir = join(root, "branding");
const scriptPath = join(__dir, "apply-nive-branding.sh");
const remoteDir = "/tmp/nive-branding";
const remoteScript = "/tmp/apply-nive-branding.sh";

const files = readdirSync(brandingDir).filter((f) => !f.startsWith("."));

function connect() {
  return new Promise((resolve, reject) => {
    connectSsh(env, {
      onReady: (conn) => resolve(conn),
      onError: reject,
    });
  });
}

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "";
      stream.on("data", (d) => {
        out += d.toString();
        process.stdout.write(d);
      });
      stream.stderr.on("data", (d) => process.stderr.write(d));
      stream.on("close", (code) => {
        if (code) reject(new Error(`exit ${code}`));
        else resolve(out);
      });
    });
  });
}

function sftp(conn) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, s) => (err ? reject(err) : resolve(s)));
  });
}

function mkdir(sftpClient, dir) {
  return new Promise((resolve, reject) => {
    sftpClient.mkdir(dir, { mode: 0o755 }, (err) => {
      if (err && err.code !== 4) reject(err);
      else resolve();
    });
  });
}

function writeFile(sftpClient, remote, content, mode = 0o644) {
  return new Promise((resolve, reject) => {
    sftpClient.writeFile(remote, content, { mode }, (err) => (err ? reject(err) : resolve()));
  });
}

const conn = await connect();
try {
  const s = await sftp(conn);
  await exec(conn, `rm -rf ${remoteDir} && mkdir -p ${remoteDir}`);
  await mkdir(s, remoteDir);

  for (const file of files) {
    const local = join(brandingDir, file);
    const remote = posix.join(remoteDir, file);
    await writeFile(s, remote, readFileSync(local));
    console.log(`uploaded ${file}`);
  }

  const script = readFileSync(scriptPath, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const patched = script.replace(
    'BRANDING_DIR="${SCRIPT_DIR}/../branding"',
    `BRANDING_DIR="${remoteDir}"`,
  );
  await writeFile(s, remoteScript, patched, 0o755);
  console.log("uploaded apply-nive-branding.sh");

  await exec(
    conn,
    `MAILCOW_DIR=${env.MAILCOW_DIR || "/opt/mailcow-dockerized"} bash ${remoteScript}`,
  );
} finally {
  conn.end();
}
