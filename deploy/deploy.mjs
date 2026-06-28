#!/usr/bin/env node
/**
 * CLI — Mailcow Nive Mail
 *
 * Dois fluxos:
 *   • GitHub Actions — branding, webmail, update (código versionado)
 *   • SSH local — diagnóstico, DNS, validação, scripts operacionais
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, requireDeployPipeline, requireSshAuth } from "./lib/env.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dir, ".env.deploy");
const ENV_EXAMPLE = join(__dir, ".env.deploy.example");

/** Release: código versionado → GitHub Actions (SSH local só diagnóstico). */
const PIPELINE_COMMANDS = new Set(["branding", "update", "full", "webmail"]);

function getEnv() {
  if (!existsSync(ENV_PATH) && !process.env.VPS_SSH_PASS && !process.env.VPS_SSH_KEY) {
    console.error("Arquivo deploy/.env.deploy não encontrado.");
    console.error("Execute: node deploy.mjs init");
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

/** SSH local — configuração e operação (sem exigir Actions). */
function runSsh(scriptName, env) {
  runNode("_ssh-run.mjs", [scriptName, ENV_PATH], env);
}

function runBranding(env, { local = false } = {}) {
  if (!local) requireDeployPipeline("branding");
  runNode("upload-nive-branding.mjs", [], env);
}

function maybePipeline(cmd) {
  if (PIPELINE_COMMANDS.has(cmd)) requireDeployPipeline(cmd);
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
    console.log("\nEdite deploy/.env.deploy (VPS_SSH_PASS, Cloudflare, etc.)");
  },

  /** SSH genérico: node deploy.mjs ssh fix-mail-vps.sh */
  ssh() {
    const script = process.argv[3];
    if (!script) {
      console.error("Uso: node deploy.mjs ssh <script.sh>");
      process.exit(1);
    }
    runSsh(script, getEnv());
  },

  setup() {
    runSsh("setup-mailcow.sh", getEnv());
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

  /** Preview local de logo/CSS (sem commit). Produção: use `branding` via Actions. */
  "branding-local"() {
    runBranding(getEnv(), { local: true });
  },

  tune() {
    runSsh("tune-performance.sh", getEnv());
  },

  "disable-sogo"() {
    runSsh("disable-sogo.sh", getEnv());
  },

  "enable-sogo"() {
    runSsh("enable-sogo.sh", getEnv());
  },

  "fix-sogo"() {
    runSsh("fix-sogo-all.sh", getEnv());
  },

  webmail() {
    requireDeployPipeline("webmail");
    runNode("upload-webmail.mjs", [], getEnv());
  },

  "redirect-webmail"() {
    runSsh("redirect-webmail.sh", getEnv());
  },

  bootstrap() {
    runSsh("bootstrap-all-domains-db.sh", getEnv());
    runSsh("bootstrap-all-domains.sh", getEnv());
  },

  "migrate-email"() {
    const env = getEnv();
    runSsh("sync-api-key.sh", env);
    runSsh("bootstrap-all-domains-db.sh", env);
    runSsh("bootstrap-all-domains.sh", env);
    runSsh("create-mailboxes.sh", env);
    runSsh("reset-mailbox-passwords.sh", env);
    runNode("migrate-email-dns.mjs");
    runNode("migrate-email-dns.mjs", ["--dkim"]);
    runSsh("verify-mail.sh", env);
    runSsh("validate-mailcow.sh", env);
  },

  "reset-admin"() {
    runSsh("reset-admin-password.sh", getEnv());
  },

  ssl() {
    runSsh("renew-ssl.sh", getEnv());
  },

  "ssl-fix"() {
    runSsh("fix-ssl.sh", getEnv());
  },

  "fix-mail-cert"() {
    getEnv();
    runNode("fix-mail-cert.mjs");
  },

  update() {
    maybePipeline("update");
    const env = getEnv();
    runSsh("update-mailcow.sh", env);
    console.log("\nReaplicando branding Nive Mail...");
    runBranding(env, { local: true });
  },

  validate() {
    runSsh("validate-mailcow.sh", getEnv());
  },

  "test-api"() {
    runSsh("test-api.sh", getEnv());
  },

  async full() {
    requireDeployPipeline("full");
    const env = getEnv();
    const waitSec = Number(process.env.DEPLOY_DKIM_WAIT_SEC || 120);

    console.log("==> 1/5 setup Mailcow");
    runSsh("setup-mailcow.sh", env);

    console.log("\n==> 2/5 DNS (A, MX, SPF, DMARC)");
    runNode("configure-dns.mjs");

    console.log(`\n==> Aguardando ${waitSec}s para DKIM...`);
    await new Promise((r) => setTimeout(r, waitSec * 1000));

    console.log("\n==> 3/5 DNS DKIM");
    runNode("configure-dns.mjs", ["--dkim"]);

    console.log("\n==> 4/5 branding + performance");
    runBranding(env, { local: true });
    runSsh("tune-performance.sh", env);

    console.log("\n==> 5/5 validação");
    runSsh("validate-mailcow.sh", env);

    console.log(
      "\nDeploy completo. Painel: https://" + (env.MAILCOW_HOSTNAME || "mail.nivesistemas.com.br") + "/admin",
    );
  },

  help() {
    console.log(`
Mailcow Nive Mail — deploy

── SSH local (diagnóstico / operação — não publica código) ──
  node deploy.mjs ssh <script.sh>   Investigar ou corrigir no VPS
  node deploy.mjs validate          Health check
  node deploy.mjs dns               Cloudflare MX/SPF/DMARC
  node deploy.mjs dns-dkim          + DKIM
  node deploy.mjs migrate-email     Migração de domínios/e-mail
  node deploy.mjs ssl-fix           Corrige HTTPS
  node deploy.mjs fix-mail-cert     Cert SMTP/IMAP (SAN + DNS)
  node deploy.mjs test-api          Testa API Mailcow
  node deploy.mjs branding-local    Preview logo/CSS (dev, sem commit)

── GitHub Actions (commit + push → produção) ──
  git push                          webmail/ branding/ deploy/ → Actions
  gh workflow run "Deploy Nive Mail" -f command=webmail
  node deploy.mjs branding          Bloqueado local — use push
  node deploy.mjs webmail           Bloqueado local — use push
  node deploy.mjs update            Mailcow upstream + branding (CI)
  node deploy.mjs full              Instalação completa (CI)

── Setup ──
  node deploy.mjs init              Cria .env.deploy
  node sync-github-secrets.mjs      Secrets → GitHub

Docs: deploy/README.md
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
