#!/usr/bin/env node
/**
 * Gera deploy/.env.deploy a partir de variáveis de ambiente (GitHub Actions Secrets).
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ENV_KEYS, loadEnv, requireSshAuth, writeEnvFile } from "./lib/env.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, ".env.deploy");

const env = loadEnv(null);
requireSshAuth(env);

writeEnvFile(envPath, env);

const masked = ENV_KEYS.filter((k) => env[k]).map((k) => {
  if (k.includes("PASS") || k.includes("KEY") || k.includes("TOKEN")) {
    return `${k}=***`;
  }
  return `${k}=${env[k]}`;
});

console.log("deploy/.env.deploy gerado a partir dos secrets:\n" + masked.join("\n"));
