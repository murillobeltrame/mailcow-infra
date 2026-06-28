import type { FastifyInstance } from "fastify";
import {
  addAppPassword,
  assertSessionCanAccessMailbox,
  deleteAppPassword,
  editMailbox,
  getMailbox,
  listAppPasswords,
} from "../mailcow-api.js";
import { handleRouteError, refreshSessionCookie, requireRoleSession } from "../http.js";
import { getActiveSieveScript, listSieveScripts, putSieveScript } from "../sieve-service.js";

export async function registerAccountRoutes(app: FastifyInstance) {
  app.get("/api/account/profile", async (request, reply) => {
    try {
      const session = requireRoleSession(request, "user");
      if (!session.email) return reply.status(400).send({ error: "E-mail obrigatório" });
      assertSessionCanAccessMailbox(session, session.email);
      const profile = await getMailbox(session.email);
      return { profile };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.get("/api/account/app-passwords", async (request, reply) => {
    try {
      const session = requireRoleSession(request, "user");
      if (!session.email || !session.password) {
        return reply.status(400).send({ error: "Sessão sem credenciais de caixa" });
      }
      assertSessionCanAccessMailbox(session, session.email);
      const items = await listAppPasswords(session.email);
      return { items };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.post("/api/account/app-passwords", async (request, reply) => {
    try {
      const session = requireRoleSession(request, "user");
      const body = request.body as { app_name?: string; app_passwd?: string; app_passwd2?: string };
      if (!session.email) return reply.status(400).send({ error: "E-mail obrigatório" });
      assertSessionCanAccessMailbox(session, session.email);
      await addAppPassword({
        active: "1",
        app_name: body.app_name ?? "App",
        app_passwd: body.app_passwd ?? "",
        app_passwd2: body.app_passwd2 ?? body.app_passwd ?? "",
        username: session.email,
      });
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.delete("/api/account/app-passwords", async (request, reply) => {
    try {
      const session = requireRoleSession(request, "user");
      const body = request.body as { id?: string };
      if (!session.email || !body.id) return reply.status(400).send({ error: "id obrigatório" });
      assertSessionCanAccessMailbox(session, session.email);
      await deleteAppPassword({ id: body.id });
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.post("/api/account/password", async (request, reply) => {
    try {
      const session = requireRoleSession(request, "user");
      const body = request.body as { password?: string; password2?: string };
      if (!session.email) return reply.status(400).send({ error: "E-mail obrigatório" });
      assertSessionCanAccessMailbox(session, session.email);
      await editMailbox({
        items: [session.email],
        attr: {
          password: body.password,
          password2: body.password2 ?? body.password,
        },
      });
      if (body.password) session.password = body.password;
      refreshSessionCookie(reply, session);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.get("/api/account/sieve", async (request, reply) => {
    try {
      const session = requireRoleSession(request, "user");
      if (!session.email || !session.password) {
        return reply.status(400).send({ error: "Credenciais IMAP necessárias para Sieve" });
      }
      const scripts = await listSieveScripts(session.email, session.password);
      const active = await getActiveSieveScript(session.email, session.password);
      return { scripts, active };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.put("/api/account/sieve", async (request, reply) => {
    try {
      const session = requireRoleSession(request, "user");
      const body = request.body as { name?: string; content?: string };
      if (!session.email || !session.password) {
        return reply.status(400).send({ error: "Credenciais IMAP necessárias" });
      }
      await putSieveScript(
        session.email,
        session.password,
        body.name ?? "custom",
        body.content ?? "",
      );
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });
}
