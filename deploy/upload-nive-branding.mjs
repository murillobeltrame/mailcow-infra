import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, connectSsh } from "./lib/env.mjs";
import { isLocalVpsDeploy, runBash, stageDirectory, writeExecutable, normalizeScript } from "./lib/local-deploy.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, ".env.deploy");
const env = loadEnv(envPath);

const root = join(__dir, "..");
const brandingDir = join(root, "branding");
const scriptPath = join(__dir, "apply-nive-branding.sh");
const ensureMountsPath = join(__dir, "ensure-sogo-theme-mounts.sh");
const remoteDir = "/tmp/nive-branding";
const remoteScript = "/tmp/apply-nive-branding.sh";
const remoteEnsureMounts = "/tmp/ensure-sogo-theme-mounts.sh";
const remoteRepair = "/tmp/repair-compose-override.sh";
const remoteSyncApiKey = "/tmp/sync-api-key.sh";

function collectFiles(dir, base = dir) {
  const entries = readdirSync(dir).filter((f) => !f.startsWith("."));
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

function patchBrandingScript(script) {
  return script
    .replace('BRANDING_DIR="${SCRIPT_DIR}/../branding"', `BRANDING_DIR="${remoteDir}"`)
    .replace('bash "${SCRIPT_DIR}/ensure-sogo-theme-mounts.sh"', `bash "${remoteEnsureMounts}"`)
    .replace('bash "${SCRIPT_DIR}/repair-compose-override.sh"', `bash ${remoteRepair}`)
    .replace('bash "${SCRIPT_DIR}/configure-mailcow-routes.sh"', "bash /tmp/configure-mailcow-routes.sh")
    .replace('bash "${SCRIPT_DIR}/sync-api-key.sh"', `bash "${remoteSyncApiKey}"`);
}

function writeSyncApiKeyScript() {
  const syncPath = join(__dir, "sync-api-key.sh");
  if (!existsSync(syncPath)) return;
  writeExecutable(remoteSyncApiKey, readFileSync(syncPath, "utf8"));
  console.log(`prepared ${remoteSyncApiKey}`);
}

function writeBrandingScripts() {
  writeSyncApiKeyScript();
  writeExecutable(remoteEnsureMounts, readFileSync(ensureMountsPath, "utf8"));
  console.log(`prepared ${remoteEnsureMounts}`);

  const repairPath = join(__dir, "repair-compose-override.sh");
  if (existsSync(repairPath)) {
    writeExecutable(remoteRepair, readFileSync(repairPath, "utf8"));
    console.log(`prepared ${remoteRepair}`);
  }

  const configureRoutes = join(__dir, "configure-mailcow-routes.sh");
  if (existsSync(configureRoutes)) {
    writeExecutable("/tmp/configure-mailcow-routes.sh", readFileSync(configureRoutes, "utf8"));
    console.log("prepared /tmp/configure-mailcow-routes.sh");
  }

  writeExecutable(remoteScript, patchBrandingScript(readFileSync(scriptPath, "utf8")));
  console.log(`prepared ${remoteScript}`);
}

async function runBrandingScript() {
  const mailcowDir = env.MAILCOW_DIR || "/opt/mailcow-dockerized";
  runBash(remoteScript, { MAILCOW_DIR: mailcowDir });
}

async function deployLocal() {
  console.log("==> Deploy local no VPS (sem SSH)");
  stageDirectory(brandingDir, remoteDir);
  console.log(`staged branding → ${remoteDir}`);
  writeBrandingScripts();
  await runBrandingScript();
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
  const files = collectFiles(brandingDir);
  const conn = await connect();
  try {
    const s = await sftp(conn);
    await exec(conn, `rm -rf ${remoteDir} && mkdir -p ${remoteDir}`);

    for (const { local, remote } of files) {
      await mkdirp(s, posix.dirname(remote));
      await writeFile(s, remote, readFileSync(local));
      console.log(`uploaded ${remote.slice(remoteDir.length + 1)}`);
    }

    await writeFile(s, remoteEnsureMounts, normalizeScript(readFileSync(ensureMountsPath, "utf8")), 0o755);

    if (existsSync(join(__dir, "repair-compose-override.sh"))) {
      await writeFile(
        s,
        remoteRepair,
        normalizeScript(readFileSync(join(__dir, "repair-compose-override.sh"), "utf8")),
        0o755,
      );
    }

    if (existsSync(join(__dir, "configure-mailcow-routes.sh"))) {
      await writeFile(
        s,
        "/tmp/configure-mailcow-routes.sh",
        normalizeScript(readFileSync(join(__dir, "configure-mailcow-routes.sh"), "utf8")),
        0o755,
      );
    }

    if (existsSync(join(__dir, "sync-api-key.sh"))) {
      await writeFile(
        s,
        remoteSyncApiKey,
        normalizeScript(readFileSync(join(__dir, "sync-api-key.sh"), "utf8")),
        0o755,
      );
    }

    await writeFile(s, remoteScript, patchBrandingScript(readFileSync(scriptPath, "utf8")), 0o755);

    const mailcowDir = env.MAILCOW_DIR || "/opt/mailcow-dockerized";
    await exec(conn, `MAILCOW_DIR=${mailcowDir} bash ${remoteScript}`);
  } finally {
    conn.end();
  }
}

if (isLocalVpsDeploy()) {
  await deployLocal();
} else {
  await deploySsh();
}
