import type { FastifyInstance } from "fastify";
import {
  addDomain,
  addMailbox,
  assertSessionCanAccessDomain,
  editMailbox,
  getHostStatus,
  getVersion,
  listAliases,
  listDomains,
  listMailboxes,
} from "../mailcow-api.js";
import { handleRouteError, requireRoleSession } from "../http.js";

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get("/api/admin/status/host", async (request, reply) => {
    try {
      requireRoleSession(request, "admin");
      return await getHostStatus();
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.get("/api/admin/status/version", async (request, reply) => {
    try {
      requireRoleSession(request, "admin");
      return await getVersion();
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.get("/api/admin/domains", async (request, reply) => {
    try {
      requireRoleSession(request, "admin");
      return { domains: await listDomains() };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.post("/api/admin/domains", async (request, reply) => {
    try {
      requireRoleSession(request, "admin");
      const body = request.body as Record<string, unknown>;
      await addDomain(body);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.get("/api/admin/mailboxes", async (request, reply) => {
    try {
      requireRoleSession(request, "admin");
      const q = request.query as { domain?: string };
      return { mailboxes: await listMailboxes(q.domain) };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.post("/api/admin/mailboxes", async (request, reply) => {
    try {
      requireRoleSession(request, "admin");
      const body = request.body as Record<string, unknown>;
      await addMailbox(body);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.patch("/api/admin/mailboxes", async (request, reply) => {
    try {
      requireRoleSession(request, "admin");
      const body = request.body as Record<string, unknown>;
      await editMailbox(body);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.get("/api/admin/aliases", async (request, reply) => {
    try {
      requireRoleSession(request, "admin");
      const q = request.query as { domain?: string };
      return { aliases: await listAliases(q.domain) };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });
}

export async function registerDomainRoutes(app: FastifyInstance) {
  app.get("/api/domain/domains", async (request, reply) => {
    try {
      const session = requireRoleSession(request, "domainadmin", "admin");
      if (session.role === "admin") {
        return { domains: await listDomains() };
      }
      return {
        domains: (await listDomains()).filter((d) => {
          const name = String((d as { domain_name?: string }).domain_name ?? "").toLowerCase();
          return session.domains?.includes(name);
        }),
      };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.get("/api/domain/mailboxes", async (request, reply) => {
    try {
      const session = requireRoleSession(request, "domainadmin", "admin");
      const q = request.query as { domain?: string };
      if (!q.domain) return reply.status(400).send({ error: "domain obrigatório" });
      assertSessionCanAccessDomain(session, q.domain);
      return { mailboxes: await listMailboxes(q.domain) };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.post("/api/domain/mailboxes", async (request, reply) => {
    try {
      const session = requireRoleSession(request, "domainadmin", "admin");
      const body = request.body as Record<string, unknown> & { domain?: string };
      if (body.domain) assertSessionCanAccessDomain(session, String(body.domain));
      await addMailbox(body);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.patch("/api/domain/mailboxes", async (request, reply) => {
    try {
      const session = requireRoleSession(request, "domainadmin", "admin");
      const body = request.body as { items?: string[]; attr?: Record<string, unknown> };
      const mailbox = body.items?.[0];
      if (mailbox) {
        const domain = mailbox.split("@")[1];
        if (domain) assertSessionCanAccessDomain(session, domain);
      }
      await editMailbox(body as Record<string, unknown>);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.get("/api/domain/aliases", async (request, reply) => {
    try {
      const session = requireRoleSession(request, "domainadmin", "admin");
      const q = request.query as { domain?: string };
      if (!q.domain) return reply.status(400).send({ error: "domain obrigatório" });
      assertSessionCanAccessDomain(session, q.domain);
      return { aliases: await listAliases(q.domain) };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });
}
