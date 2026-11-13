import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

/** Cada "boot" é um processo novo, como um restart do container. */
function boot(storePath: string, script: string, key = "k1") {
  const res = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], {
    cwd: path.resolve(import.meta.dirname, ".."),
    env: { ...process.env, SESSION_STORE_PATH: storePath, SESSION_STORE_KEY: key },
    encoding: "utf8",
  });
  assert.equal(res.status, 0, res.stderr);
  return res.stdout.trim();
}

const IMPORT = `const s = await import("./src/session.ts");`;

test("sessão sobrevive a restart; logout continua valendo depois do restart", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nive-session-"));
  const file = path.join(dir, "sessions.enc");
  try {
    const id = boot(
      file,
      `${IMPORT} console.log(s.createSession({ role: "user", subject: "a@b.c", email: "a@b.c", password: "segredo-123" }).id);`,
    );
    assert.equal(fs.readFileSync(file).includes("segredo-123"), false, "senha não pode ficar em claro");

    const resolved = boot(file, `${IMPORT} console.log(s.resolveSessionFromCookie("${id}")?.password ?? "null");`);
    assert.equal(resolved, "segredo-123");

    const wrongKey = boot(file, `${IMPORT} console.log(s.resolveSessionFromCookie("${id}")?.id ?? "null");`, "k2");
    assert.equal(wrongKey, "null");

    boot(file, `${IMPORT} s.destroySession("${id}");`);
    const afterLogout = boot(file, `${IMPORT} console.log(s.resolveSessionFromCookie("${id}")?.id ?? "null");`);
    assert.equal(afterLogout, "null");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
