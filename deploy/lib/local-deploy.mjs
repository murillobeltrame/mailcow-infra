import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Deploy no próprio VPS (runner self-hosted) — mesmo modelo do sistemaloja. */
export function isLocalVpsDeploy() {
  return process.env.DEPLOY_MODE === "local_vps";
}

export function normalizeScript(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function stageDirectory(src, dest) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
}

export function writeExecutable(path, content) {
  writeFileSync(path, normalizeScript(content), { mode: 0o755 });
  chmodSync(path, 0o755);
}

export function runBash(scriptPath, extraEnv = {}) {
  const res = spawnSync("bash", [scriptPath], {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
  if (res.status !== 0) {
    throw new Error(`Falha ao executar ${scriptPath} (exit ${res.status ?? 1})`);
  }
}
