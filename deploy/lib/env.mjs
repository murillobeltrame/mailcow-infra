import { existsSync, readFileSync, writeFileSync } from "node:fs";

/** Variáveis suportadas em .env.deploy e nos Secrets do GitHub. */
export const ENV_KEYS = [
  "VPS_IP",
  "VPS_USER",
  "VPS_PORT",
  "VPS_SSH_PASS",
  "MAILCOW_DIR",
  "MAILCOW_HOSTNAME",
  "MAILCOW_TZ",
  "MAIL_DOMAIN",
  "MAILCOW_IPV4_NETWORK",
  "MAILCOW_PASS",
  "MAILCOW_API_KEY",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ZONE_ID",
  "CLOUDFLARE_ACCOUNT_ID",
  "EXTRA_MAIL_DOMAIN",
  "EXTRA_CLOUDFLARE_ZONE_ID",
  "GIT_REPO",
];

const DEFAULTS = {
  VPS_IP: "2.25.181.76",
  VPS_USER: "root",
  VPS_PORT: "22",
  MAILCOW_DIR: "/opt/mailcow-dockerized",
  MAILCOW_HOSTNAME: "mail.nivesistemas.com.br",
  MAILCOW_TZ: "America/Sao_Paulo",
  MAIL_DOMAIN: "nivesistemas.com.br",
  MAILCOW_IPV4_NETWORK: "172.23.1",
  GIT_REPO: "https://github.com/murillobeltrame/mailcow-infra.git",
};

function parseEnvText(text) {
  const env = {};
  for (const line of text.split("\n")) {
    const clean = line.replace(/\r$/, "");
    const m = clean.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

export function loadEnv(envPath) {
  let env = {};

  if (envPath && existsSync(envPath)) {
    env = parseEnvText(readFileSync(envPath, "utf8"));
  }

  for (const key of ENV_KEYS) {
    if (process.env[key]) env[key] = process.env[key];
  }

  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (!env[key]) env[key] = value;
  }

  return env;
}

export function writeEnvFile(envPath, env) {
  const lines = [];
  for (const key of ENV_KEYS) {
    if (env[key] !== undefined && env[key] !== "") {
      lines.push(`${key}=${env[key]}`);
    }
  }
  writeFileSync(envPath, `${lines.join("\n")}\n`, "utf8");
}

export function requireSshAuth(env) {
  if (process.env.VPS_SSH_KEY) return;
  if (!env.VPS_SSH_PASS) {
    throw new Error("VPS_SSH_PASS ou VPS_SSH_KEY é obrigatório");
  }
}

/** Deploy no VPS só via GitHub Actions, salvo emergência explícita. */
export function requireGithubActions() {
  if (process.env.GITHUB_ACTIONS === "true") return;
  if (process.env.ALLOW_LOCAL_DEPLOY === "1") {
    console.warn("AVISO: ALLOW_LOCAL_DEPLOY=1 — deploy local (use só em emergência).");
    return;
  }
  console.error("Deploy no VPS bloqueado localmente.");
  console.error("");
  console.error("Fluxo padrão:");
  console.error("  1. git add / commit");
  console.error("  2. git push origin master");
  console.error("  3. GitHub Actions aplica no VPS");
  console.error("");
  console.error("Manual: Actions → Deploy Nive Mail → Run workflow");
  console.error("Emergência: ALLOW_LOCAL_DEPLOY=1 node deploy.mjs <cmd>");
  process.exit(1);
}

export function sshConnectOptions(env, passwordOverride) {
  const config = {
    host: env.VPS_IP,
    port: Number(env.VPS_PORT || 22),
    username: env.VPS_USER || "root",
    readyTimeout: Number(process.env.SSH_READY_TIMEOUT_MS || 180000),
    keepaliveInterval: 10000,
    keepaliveCountMax: 3,
  };

  if (process.env.VPS_SSH_KEY) {
    config.privateKey = process.env.VPS_SSH_KEY;
  } else {
    config.password = passwordOverride || env.VPS_SSH_PASS;
  }

  return config;
}

/** Conecta com retentativas (runners GitHub podem levar ou falhar na 1ª tentativa). */
export function connectSsh(env, handlers, { attempts = 3, delayMs = 15000 } = {}) {
  let tryNum = 0;

  const tryConnect = () => {
    tryNum += 1;
    const conn = new Client();
    conn.on("ready", () => handlers.onReady(conn));
    conn.on("error", (err) => {
      if (tryNum < attempts) {
        console.warn(`SSH tentativa ${tryNum}/${attempts} falhou: ${err.message}. Retry em ${delayMs / 1000}s...`);
        setTimeout(tryConnect, delayMs);
      } else {
        console.error(`SSH falhou após ${attempts} tentativas: ${err.message}`);
        console.error("Rode no VPS: bash fix-ssh-github-actions-vps.sh");
        console.error("hPanel Hostinger: libere TCP 22 para 0.0.0.0/0");
        handlers.onError?.(err);
        process.exit(1);
      }
    });
    conn.connect(sshConnectOptions(env));
  };

  tryConnect();
}
