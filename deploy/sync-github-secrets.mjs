#!/usr/bin/env node
/**
 * Sincroniza deploy/.env.deploy → GitHub Actions Secrets (uma vez).
 * Requer: gh auth login
 *
 * Uso: node sync-github-secrets.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ENV_KEYS, loadEnv } from "./lib/env.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, ".env.deploy");

if (!existsSync(envPath)) {
  console.error("deploy/.env.deploy não encontrado. Rode: node deploy.mjs init");
  process.exit(1);
}

const gh = spawnSync("gh", ["auth", "status"], { encoding: "utf8" });
if (gh.status !== 0) {
  console.error("GitHub CLI não autenticado. Rode: gh auth login");
  process.exit(1);
}

const env = loadEnv(envPath);
const skip = new Set(["GIT_REPO"]);

for (const key of ENV_KEYS) {
  if (skip.has(key)) continue;
  const value = env[key];
  if (!value) {
    console.log(`  pulando ${key} (vazio)`);
    continue;
  }

  const res = spawnSync("gh", ["secret", "set", key, "--body", value], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (res.status !== 0) {
    console.error(`  erro ${key}:`, res.stderr || res.stdout);
    process.exit(1);
  }
  console.log(`  secret ${key} OK`);
}

console.log("\nSecrets sincronizados. Teste em Actions → Deploy Nive Mail → Run workflow.");
