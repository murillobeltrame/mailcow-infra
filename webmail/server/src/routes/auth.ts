import type { FastifyInstance } from "fastify";
import { authenticateLogin } from "../auth-service.js";
import { config } from "../config.js";
import {
  clearSessionCookie,
  getRequestSession,
  handleRouteError,
  publicUser,
  requireSession,
  SESSION_COOKIE,
  setSessionCookie,
} from "../http.js";
import { createSession, destroySession } from "../session.js";

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/api/auth/login", async (request, reply) => {
    try {
      const body = request.body as { email?: string; login?: string; password?: string };
      const login = (body.login ?? body.email)?.trim();
      const password = body.password;
      if (!login || !password) {
        return reply.status(400).send({ error: "Usuário/e-mail e senha são obrigatórios" });
      }
      const result = await authenticateLogin(login, password);
      const session = createSession(
        {
          role: result.role,
          subject: result.subject,
          email: result.email,
          password: result.password,
          name: result.name,
          domains: result.domains,
        },
        config.sessionTtlMs,
      );
      setSessionCookie(reply, session.id);
      return publicUser(session);
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.post("/api/auth/fido2-session", async (request, reply) => {
    try {
      const body = request.body as { subject?: string; role?: "user" | "admin" | "domainadmin" };
      if (!body.subject) return reply.status(400).send({ error: "subject obrigatório" });
      const session = createSession({
        role: body.role ?? "user",
        subject: body.subject.toLowerCase(),
        email: body.subject.includes("@") ? body.subject.toLowerCase() : undefined,
        name: body.subject.split("@")[0],
        password: "",
      }, config.sessionTtlMs);
      setSessionCookie(reply, session.id);
      return publicUser(session);
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.post("/api/auth/logout", async (request, reply) => {
    destroySession(request.cookies[SESSION_COOKIE]);
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.get("/api/auth/me", async (request, reply) => {
    const session = getRequestSession(request);
    if (!session) return reply.status(401).send({ error: "Não autenticado" });
    return publicUser(session);
  });

  app.get("/api/auth/check", async (request) => {
    const session = requireSession(request);
    return publicUser(session);
  });
}
