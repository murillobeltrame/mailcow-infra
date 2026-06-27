#!/usr/bin/env node
/**
 * CLI de deploy — Mailcow Nive Mail
 *
 * Uso:
 *   node deploy.mjs <comando>
 *   node deploy.mjs help
 *
 * Requer deploy/.env.deploy (copie de .env.deploy.example).
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, requireSshAuth } from "./lib/env.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dir, ".env.deploy");
const ENV_EXAMPLE = join(__dir, ".env.deploy.example");

function getEnv() {
  if (!existsSync(ENV_PATH) && !process.env.VPS_SSH_PASS && !process.env.VPS_SSH_KEY) {
    console.error("Arquivo deploy/.env.deploy não encontrado.");
    console.error("Execute: node deploy.mjs init");
    console.error("Ou configure os Secrets no GitHub Actions.");
    process.exit(1);
  }
  const env = loadEnv(ENV_PATH);
  requireSshAuth(env);
  return env;
}

function runNode(script, args = [], env = {}) {
  const res = spawnSync(process.execPath, [join(__dir, script), ...args], {
    cwd: __dir,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

function runScript(scriptName, env) {
  runNode("_ssh-deploy.mjs", [scriptName, ENV_PATH], env);
}

function runBranding(env) {
  runNode("upload-nive-branding.mjs", [], env);
}

const commands = {
  init() {
    if (!existsSync(ENV_PATH)) {
      copyFileSync(ENV_EXAMPLE, ENV_PATH);
      console.log("Criado deploy/.env.deploy a partir do exemplo.");
    } else {
      console.log("deploy/.env.deploy já existe.");
    }
    console.log("\nGere senhas e preencha o arquivo:\n");
    runNode("generate-secrets.mjs");
    console.log("\nEdite deploy/.env.deploy (VPS_SSH_PASS, Cloudflare, etc.) antes do setup.");
  },

  setup() {
    runScript("setup-mailcow.sh", getEnv());
  },

  dns() {
    getEnv();
    runNode("configure-dns.mjs");
  },

  "dns-dkim"() {
    getEnv();
    runNode("configure-dns.mjs", ["--dkim"]);
  },

  branding() {
    runBranding(getEnv());
  },

  tune() {
    runScript("tune-performance.sh", getEnv());
  },

  "disable-sogo"() {
    runScript("disable-sogo.sh", getEnv());
  },

  bootstrap() {
    runScript("bootstrap-domain-db.sh", getEnv());
  },

  "reset-admin"() {
    runScript("reset-admin-password.sh", getEnv());
  },

  ssl() {
    runScript("renew-ssl.sh", getEnv());
  },

  "ssl-fix"() {
    runScript("fix-ssl.sh", getEnv());
  },

  update() {
    runScript("update-mailcow.sh", getEnv());
    console.log("\nReaplicando branding Nive Mail...");
    runBranding(getEnv());
  },

  validate() {
    runScript("validate-mailcow.sh", getEnv());
  },

  "test-api"() {
    runScript("test-api.sh", getEnv());
  },

  /** Instalação completa: setup → DNS → aguarda → DKIM → branding → tune → validate */
  async full() {
    const env = getEnv();
    const waitSec = Number(process.env.DEPLOY_DKIM_WAIT_SEC || 120);

    console.log("==> 1/5 setup Mailcow");
    runScript("setup-mailcow.sh", env);

    console.log("\n==> 2/5 DNS (A, MX, SPF, DMARC)");
    runNode("configure-dns.mjs");

    console.log(`\n==> Aguardando ${waitSec}s para o Mailcow subir e gerar DKIM...`);
    await new Promise((r) => setTimeout(r, waitSec * 1000));

    console.log("\n==> 3/5 DNS DKIM");
    runNode("configure-dns.mjs", ["--dkim"]);

    console.log("\n==> 4/5 branding + performance");
    runBranding(env);
    runScript("tune-performance.sh", env);

    console.log("\n==> 5/5 validação");
    runScript("validate-mailcow.sh", env);

    console.log(
      "\nDeploy completo. Painel: https://" + (env.MAILCOW_HOSTNAME || "mail.nivesistemas.com.br") + "/admin",
    );
  },

  help() {
    console.log(`
Mailcow Nive Mail — deploy

  node deploy.mjs init          Cria .env.deploy e gera senhas sugeridas
  node deploy.mjs full          Instalação completa (aguarda DKIM automaticamente)
  node deploy.mjs setup         Instala/atualiza Mailcow no VPS
  node deploy.mjs dns           Cloudflare: A, MX, SPF, DMARC
  node deploy.mjs dns-dkim      Cloudflare: + DKIM (Mailcow já rodando)
  node deploy.mjs branding      Logo e CSS Nive Mail
  node deploy.mjs update        git pull Mailcow + reaplica branding
  node deploy.mjs validate      Health check (portas, HTTPS, DKIM)
  node deploy.mjs tune          Swap + otimizações VPS
  node deploy.mjs disable-sogo  Desativa SOGo (webmail)
  node deploy.mjs bootstrap     Cria domínio inicial no banco
  node deploy.mjs reset-admin   Reset senha admin (MAILCOW_PASS)
  node deploy.mjs ssl           Renova Let's Encrypt
  node deploy.mjs ssl-fix       Corrige certificado HTTPS
  node deploy.mjs test-api      Testa API Mailcow
  node deploy.mjs help          Esta ajuda

Config: deploy/.env.deploy (local) ou GitHub Actions Secrets (CI)
Docs:   deploy/README.md
`);
  },
};

const cmd = process.argv[2] || "help";
if (!commands[cmd]) {
  console.error(`Comando desconhecido: ${cmd}\n`);
  commands.help();
  process.exit(1);
}

const result = commands[cmd]();
if (result instanceof Promise) {
  result.catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
