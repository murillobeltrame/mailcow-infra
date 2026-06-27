import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import {
  deleteMessages,
  getMessage,
  listFolders,
  listMessages,
  sendMail,
  toggleFlag,
  verifyCredentials,
} from "./mail-service.js";
import { createSession, destroySession, getSession, touchSession } from "./session.js";

const app = Fastify({ logger: true });
const SESSION_COOKIE = "nive_mail_session";

await app.register(cors, {
  origin: true,
  credentials: true,
});

await app.register(cookie, {
  secret: config.cookieSecret,
  hook: "onRequest",
});

function requireSession(request: { cookies: Record<string, string | undefined> }) {
  const session = getSession(request.cookies[SESSION_COOKIE]);
  if (!session) {
    const err = new Error("Não autenticado") as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
  }
  touchSession(session.id, config.sessionTtlMs);
  return session;
}

app.get("/health", async () => ({ ok: true, service: "nive-mail-web" }));

app.post("/api/auth/login", async (request, reply) => {
  const body = request.body as { email?: string; password?: string };
  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  if (!email || !password) {
    return reply.status(400).send({ error: "E-mail e senha são obrigatórios" });
  }
  const valid = await verifyCredentials(email, password);
  if (!valid) {
    return reply.status(401).send({ error: "E-mail ou senha inválidos" });
  }
  const session = createSession(email, password, email.split("@")[0], config.sessionTtlMs);
  reply.setCookie(SESSION_COOKIE, session.id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: config.sessionTtlMs / 1000,
  });
  return { email: session.email, name: session.name };
});

app.post("/api/auth/logout", async (request, reply) => {
  destroySession(request.cookies[SESSION_COOKIE]);
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
  return { ok: true };
});

app.get("/api/auth/me", async (request, reply) => {
  const session = getSession(request.cookies[SESSION_COOKIE]);
  if (!session) return reply.status(401).send({ error: "Não autenticado" });
  return { email: session.email, name: session.name };
});

app.get("/api/folders", async (request, reply) => {
  try {
    const session = requireSession(request);
    const folders = await listFolders(session);
    return { folders };
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return reply.status(e.statusCode ?? 500).send({ error: e.message });
  }
});

app.get("/api/messages", async (request, reply) => {
  try {
    const session = requireSession(request);
    const q = request.query as { folder?: string; page?: string; limit?: string; q?: string };
    const folder = q.folder ?? "INBOX";
    const page = parseInt(q.page ?? "0", 10);
    const limit = parseInt(q.limit ?? "40", 10);
    const result = await listMessages(session, folder, page, limit, q.q);
    return result;
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return reply.status(e.statusCode ?? 500).send({ error: e.message });
  }
});

app.get("/api/messages/:uid", async (request, reply) => {
  try {
    const session = requireSession(request);
    const { uid } = request.params as { uid: string };
    const q = request.query as { folder?: string };
    const message = await getMessage(session, q.folder ?? "INBOX", parseInt(uid, 10));
    return message;
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return reply.status(e.statusCode ?? 500).send({ error: e.message });
  }
});

app.post("/api/messages/send", async (request, reply) => {
  try {
    const session = requireSession(request);
    const body = request.body as { to?: string; subject?: string; body?: string; cc?: string };
    if (!body.to?.trim() || !body.subject?.trim() || !body.body?.trim()) {
      return reply.status(400).send({ error: "Destinatário, assunto e mensagem são obrigatórios" });
    }
    await sendMail(session, {
      to: body.to.trim(),
      subject: body.subject.trim(),
      body: body.body,
      cc: body.cc?.trim(),
    });
    return { ok: true };
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return reply.status(e.statusCode ?? 500).send({ error: e.message || "Falha ao enviar" });
  }
});

app.delete("/api/messages", async (request, reply) => {
  try {
    const session = requireSession(request);
    const body = request.body as { folder?: string; uids?: number[] };
    if (!body.uids?.length) return reply.status(400).send({ error: "Nenhuma mensagem selecionada" });
    await deleteMessages(session, body.folder ?? "INBOX", body.uids);
    return { ok: true };
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return reply.status(e.statusCode ?? 500).send({ error: e.message });
  }
});

app.patch("/api/messages/:uid/flag", async (request, reply) => {
  try {
    const session = requireSession(request);
    const { uid } = request.params as { uid: string };
    const body = request.body as { folder?: string; flagged?: boolean };
    await toggleFlag(session, body.folder ?? "INBOX", parseInt(uid, 10), body.flagged ?? true);
    return { ok: true };
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return reply.status(e.statusCode ?? 500).send({ error: e.message });
  }
});

// SPA estática
const distPath = config.frontendDist;
if (fs.existsSync(distPath)) {
  await app.register(fastifyStatic, {
    root: distPath,
    prefix: "/",
    wildcard: false,
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) {
      return reply.status(404).send({ error: "Rota não encontrada" });
    }
    return reply.sendFile("index.html");
  });
}

await app.listen({ port: config.port, host: config.host });
console.log(`Nive Mail Web em http://${config.host}:${config.port}`);
