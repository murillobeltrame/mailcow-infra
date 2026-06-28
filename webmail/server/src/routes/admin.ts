import type { FastifyInstance } from "fastify";
import {
  addDomain,
  addDomainAdmin,
  addMailbox,
  assertSessionCanAccessDomain,
  deleteDomainAdmin,
  editDomainAdmin,
  editMailbox,
  getContainerStatus,
  getHostStatus,
  getVersion,
  getVmailStatus,
  listAliases,
  listDomainAdmins,
  listDomains,
  listMailboxes,
} from "../mailcow-api.js";
import { handleRouteError, requireRoleSession } from "../http.js";
import { buildAdminDashboard } from "../status-utils.js";

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get("/api/admin/status/dashboard", async (request, reply) => {
    try {
      requireRoleSession(request, "admin");
      const [host, vmail, version, containers] = await Promise.all([
        getHostStatus(),
        getVmailStatus(),
        getVersion(),
        getContainerStatus(),
      ]);
      return buildAdminDashboard(
        host,
        vmail,
        version,
        containers as Parameters<typeof buildAdminDashboard>[3],
      );
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.get("/api/admin/status/host", async (request, reply) => {
    try {
      requireRoleSession(request, "admin");
      return await getHostStatus();
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.get("/api/admin/status/vmail", async (request, reply) => {
    try {
      requireRoleSession(request, "admin");
      return await getVmailStatus();
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.get("/api/admin/status/containers", async (request, reply) => {
    try {
      requireRoleSession(request, "admin");
      return await getContainerStatus();
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

  app.get("/api/admin/domain-admins", async (request, reply) => {
    try {
      requireRoleSession(request, "admin");
      return { domainAdmins: await listDomainAdmins() };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.post("/api/admin/domain-admins", async (request, reply) => {
    try {
      requireRoleSession(request, "admin");
      const body = request.body as {
        username?: string;
        password?: string;
        domains?: string[];
        active?: string;
      };
      const username = body.username?.trim().toLowerCase();
      const password = body.password;
      const domains = body.domains?.map((d) => d.trim().toLowerCase()).filter(Boolean);
      if (!username) return reply.status(400).send({ error: "Usuário é obrigatório" });
      if (!password) return reply.status(400).send({ error: "Senha é obrigatória" });
      if (!domains?.length) return reply.status(400).send({ error: "Selecione ao menos um domínio" });
      await addDomainAdmin({
        username,
        password,
        password2: password,
        domains: domains.join(","),
        active: body.active ?? "1",
      });
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.patch("/api/admin/domain-admins", async (request, reply) => {
    try {
      requireRoleSession(request, "admin");
      const body = request.body as {
        username?: string;
        password?: string;
        domains?: string[];
        active?: boolean;
        currentActive?: string;
      };
      const username = body.username?.trim().toLowerCase();
      if (!username) return reply.status(400).send({ error: "username é obrigatório" });

      const attr: Record<string, unknown> = {
        username_new: username,
      };
      if (body.domains?.length) {
        attr.domains = body.domains.map((d) => d.trim().toLowerCase()).filter(Boolean);
      }
      if (body.password) {
        attr.password = body.password;
        attr.password2 = body.password;
      }
      if (body.active !== undefined && body.currentActive !== undefined) {
        const to = body.active ? "1" : "0";
        if (body.currentActive !== to) {
          attr.active = [body.currentActive, to];
        }
      }

      await editDomainAdmin({ items: [username], attr });
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.delete("/api/admin/domain-admins", async (request, reply) => {
    try {
      requireRoleSession(request, "admin");
      const body = request.body as { username?: string };
      const username = body.username?.trim().toLowerCase();
      if (!username) return reply.status(400).send({ error: "username é obrigatório" });
      await deleteDomainAdmin([username]);
      return { ok: true };
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
