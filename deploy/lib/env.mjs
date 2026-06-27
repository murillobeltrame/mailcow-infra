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

export function sshConnectOptions(env, passwordOverride) {
  const config = {
    host: env.VPS_IP,
    port: Number(env.VPS_PORT || 22),
    username: env.VPS_USER || "root",
    readyTimeout: 120000,
  };

  if (process.env.VPS_SSH_KEY) {
    config.privateKey = process.env.VPS_SSH_KEY;
  } else {
    config.password = passwordOverride || env.VPS_SSH_PASS;
  }

  return config;
}
