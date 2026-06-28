import type { FastifyInstance } from "fastify";
import { authenticateLogin } from "../auth-service.js";
import { config } from "../config.js";
import {
  getRequestSession,
  handleRouteError,
  publicUser,
  requireSession,
  setSessionCookie,
  terminateSession,
} from "../http.js";
import { createSession } from "../session.js";

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/api/auth/login", async (request, reply) => {
    try {
      const body = request.body as {
        email?: string;
        login?: string;
        password?: string;
        loginAs?: "user" | "admin" | "domainadmin";
        role?: "user" | "admin" | "domainadmin";
      };
      const login = (body.login ?? body.email)?.trim();
      const password = body.password;
      const loginAs = body.loginAs ?? body.role ?? "user";
      if (!password) {
        return reply.status(400).send({ error: "Senha é obrigatória" });
      }
      if (loginAs !== "admin" && !login) {
        return reply.status(400).send({ error: "Usuário/e-mail é obrigatório" });
      }
      const result = await authenticateLogin(login ?? "admin", password, loginAs);
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

  const handleLogout = async (
    request: Parameters<typeof terminateSession>[0],
    reply: Parameters<typeof terminateSession>[1],
  ) => {
    terminateSession(request, reply);
    const redirect = (request.query as { redirect?: string }).redirect;
    if (request.method === "GET") {
      const target =
        redirect?.startsWith("/mail/") ? redirect : `${config.basePath}/login`.replace(/\/+/g, "/");
      return reply.redirect(target);
    }
    return { ok: true };
  };

  app.post("/api/auth/logout", async (request, reply) => handleLogout(request, reply));

  app.get("/api/auth/logout", async (request, reply) => handleLogout(request, reply));

  app.get("/api/auth/me", async (request, reply) => {
    const session = getRequestSession(request);
    reply.header("Cache-Control", "no-store");
    if (!session) return reply.status(401).send({ error: "Não autenticado" });
    return publicUser(session);
  });

  app.get("/api/auth/check", async (request) => {
    const session = requireSession(request);
    return publicUser(session);
  });
}
