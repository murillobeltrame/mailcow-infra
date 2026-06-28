import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, connectSsh } from "./lib/env.mjs";
import { isLocalVpsDeploy, runBash, stageDirectory, writeExecutable } from "./lib/local-deploy.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, ".env.deploy");
const env = loadEnv(envPath);

const root = join(__dir, "..");
const webmailDir = join(root, "webmail");
const scriptPath = join(__dir, "setup-webmail.sh");
const redirectScript = join(__dir, "redirect-webmail.sh");
const remoteDir = "/tmp/nive-webmail";

function collectFiles(dir, base = dir) {
  const skip = new Set(["node_modules", "dist", ".git"]);
  const entries = readdirSync(dir).filter((f) => !f.startsWith(".") && !skip.has(f));
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectFiles(full, base));
    } else {
      files.push({
        local: full,
        remote: posix.join(remoteDir, full.slice(base.length + 1).replace(/\\/g, "/")),
      });
    }
  }
  return files;
}

function patchSetupScript(script) {
  return script
    .replace('WEBMAIL_DIR="${SCRIPT_DIR}/../webmail"', `WEBMAIL_DIR="${remoteDir}"`)
    .replace('bash "${SCRIPT_DIR}/repair-compose-override.sh"', "bash /tmp/repair-compose-override.sh")
    .replace('bash "${SCRIPT_DIR}/configure-mailcow-routes.sh"', "bash /tmp/configure-mailcow-routes.sh")
    .replace('bash "${SCRIPT_DIR}/sync-api-key.sh"', "bash /tmp/sync-api-key.sh");
}

function writeDeployScripts() {
  const scripts = [
    [scriptPath, "setup-webmail.sh", patchSetupScript],
    [redirectScript, "redirect-webmail.sh", (s) => s],
    [join(__dir, "configure-mailcow-routes.sh"), "configure-mailcow-routes.sh", (s) => s],
    [join(__dir, "repair-compose-override.sh"), "repair-compose-override.sh", (s) => s],
    [join(__dir, "sync-api-key.sh"), "sync-api-key.sh", (s) => s],
  ];

  for (const [local, name, patch] of scripts) {
    if (!existsSync(local)) continue;
    const content = patch(readFileSync(local, "utf8"));
    writeExecutable(`/tmp/${name}`, content);
    console.log(`prepared /tmp/${name}`);
  }
}

async function runDeployScripts() {
  const mailcowDir = env.MAILCOW_DIR || "/opt/mailcow-dockerized";
  runBash("/tmp/setup-webmail.sh", { MAILCOW_DIR: mailcowDir });
  if (existsSync("/tmp/configure-mailcow-routes.sh")) {
    runBash("/tmp/configure-mailcow-routes.sh", { MAILCOW_DIR: mailcowDir });
  }
}

async function deployLocal() {
  console.log("==> Deploy local no VPS (sem SSH)");
  stageDirectory(webmailDir, remoteDir);
  console.log(`staged webmail → ${remoteDir}`);
  writeDeployScripts();
  await runDeployScripts();
}

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
      stream.on("data", (d) => process.stdout.write(d));
      stream.stderr.on("data", (d) => process.stderr.write(d));
      stream.on("close", (code) => {
        if (code) reject(new Error(`exit ${code}`));
        else resolve();
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

async function mkdirp(sftpClient, dir) {
  const parts = dir.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current += `/${part}`;
    await mkdir(sftpClient, current);
  }
}

function writeFile(sftpClient, remote, content, mode = 0o644) {
  return new Promise((resolve, reject) => {
    sftpClient.writeFile(remote, content, { mode }, (err) => (err ? reject(err) : resolve()));
  });
}

async function deploySsh() {
  console.log("==> Deploy via SSH");
  const conn = await connect();
  try {
    const s = await sftp(conn);
    await exec(conn, `rm -rf ${remoteDir} && mkdir -p ${remoteDir}`);
    const files = collectFiles(webmailDir);

    for (const { local, remote } of files) {
      await mkdirp(s, posix.dirname(remote));
      await writeFile(s, remote, readFileSync(local));
      console.log(`uploaded ${remote.slice(remoteDir.length + 1)}`);
    }

    for (const [local, name] of [
      [scriptPath, "setup-webmail.sh"],
      [redirectScript, "redirect-webmail.sh"],
      [join(__dir, "configure-mailcow-routes.sh"), "configure-mailcow-routes.sh"],
      [join(__dir, "repair-compose-override.sh"), "repair-compose-override.sh"],
      [join(__dir, "sync-api-key.sh"), "sync-api-key.sh"],
    ]) {
      if (!existsSync(local)) continue;
      const script = readFileSync(local, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const patched = patchSetupScript(script);
      await writeFile(s, `/tmp/${name}`, patched, 0o755);
    }

    const mailcowDir = env.MAILCOW_DIR || "/opt/mailcow-dockerized";
    await exec(conn, `MAILCOW_DIR=${mailcowDir} bash /tmp/setup-webmail.sh`);
    await exec(conn, `MAILCOW_DIR=${mailcowDir} bash /tmp/configure-mailcow-routes.sh`);
  } finally {
    conn.end();
  }
}

if (isLocalVpsDeploy()) {
  await deployLocal();
} else {
  await deploySsh();
}
