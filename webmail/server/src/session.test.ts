import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { test } from "node:test";
import { config } from "./config.js";
import {
  createSession,
  destroySession,
  isRevoked,
  resolveSessionFromCookie,
  touchSession,
} from "./session.js";

function sealLegacyToken(session: {
  id: string;
  role: "admin";
  subject: string;
  expiresAt: number;
}) {
  const payload = Buffer.from(JSON.stringify({ v: "v1", s: session })).toString("base64url");
  const sig = createHmac("sha256", config.cookieSecret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

test("logout revoga UUID e o cookie deixa de resolver sessão", () => {
  const session = createSession({ role: "admin", subject: "admin", name: "Administrador" });
  assert.equal(resolveSessionFromCookie(session.id)?.id, session.id);

  destroySession(session.id);

  assert.equal(isRevoked(session.id), true);
  assert.equal(resolveSessionFromCookie(session.id), null);
});

test("logout não deixa token legado recriar a sessão (bug do Sair)", () => {
  const legacySession = {
    id: randomUUID(),
    role: "admin" as const,
    subject: "admin",
    expiresAt: Date.now() + 60 * 60 * 1000,
  };
  const token = sealLegacyToken(legacySession);

  const first = resolveSessionFromCookie(token);
  assert.ok(first);
  assert.equal(first.id, legacySession.id);

  destroySession(legacySession.id);

  assert.equal(resolveSessionFromCookie(token), null);
  assert.equal(resolveSessionFromCookie(legacySession.id), null);
});

test("touchSession após logout não recoloca a sessão no store", () => {
  const session = createSession({ role: "admin", subject: "admin" });
  destroySession(session.id);
  touchSession(session, 8 * 60 * 60 * 1000);
  assert.equal(resolveSessionFromCookie(session.id), null);
});
