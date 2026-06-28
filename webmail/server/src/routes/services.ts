import type { FastifyInstance } from "fastify";
import { assertSessionCanAccessDomain, listAliases } from "../mailcow-api.js";
import {
  addAlias,
  addBccMap,
  addDkim,
  addDomainPolicy,
  addFwdHost,
  addOAuth2Client,
  addRecipientMap,
  addRelayHost,
  addResource,
  addSyncJob,
  addTimeLimitedAlias,
  addTlsPolicyMap,
  addTransport,
  deleteAliases,
  deleteBccMaps,
  deleteDkim,
  deleteDomainPolicies,
  deleteDomains,
  deleteFwdHosts,
  deleteMailQueue,
  deleteOAuth2Clients,
  deleteQuarantineItems,
  deleteRecipientMaps,
  deleteRelayHosts,
  deleteResources,
  deleteSyncJobs,
  deleteTlsPolicyMaps,
  deleteTransports,
  editAlias,
  editDaAcl,
  editDomain,
  editFail2ban,
  editMailQueue,
  editRlDomain,
  editRlMbox,
  editSpamScore,
  editSyncJob,
  editUserAcl,
  getDkim,
  getDomain,
  getFail2ban,
  getRlDomain,
  getRlMbox,
  getSolrStatus,
  listBccMaps,
  listFwdHosts,
  listLogs,
  listMailQueue,
  listOAuth2Clients,
  listQuarantine,
  listRecipientMaps,
  listRelayHosts,
  listResources,
  listSyncJobs,
  listTimeLimitedAliases,
  listTlsPolicyMaps,
  listTransports,
} from "../mailcow-services-api.js";
import { handleRouteError, requireRoleSession } from "../http.js";

function adminOnly(request: Parameters<typeof requireRoleSession>[0]) {
  return requireRoleSession(request, "admin");
}

function domainScope(
  request: Parameters<typeof requireRoleSession>[0],
  domain?: string,
) {
  const session = requireRoleSession(request, "domainadmin", "admin");
  if (domain && session.role === "domainadmin") {
    assertSessionCanAccessDomain(session, domain);
  }
  return session;
}

export async function registerServiceRoutes(app: FastifyInstance) {
  // ── Aliases ──
  app.post("/api/admin/aliases", async (request, reply) => {
    try {
      adminOnly(request);
      await addAlias(request.body as Record<string, unknown>);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.patch("/api/admin/aliases", async (request, reply) => {
    try {
      adminOnly(request);
      await editAlias(request.body as Record<string, unknown>);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.delete("/api/admin/aliases", async (request, reply) => {
    try {
      adminOnly(request);
      const { address } = request.body as { address?: string };
      if (!address) return reply.status(400).send({ error: "address obrigatório" });
      await deleteAliases([address]);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.post("/api/domain/aliases", async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown> & { address?: string };
      const domain = String(body.address ?? "").split("@")[1];
      if (domain) domainScope(request, domain);
      await addAlias(body);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.patch("/api/domain/aliases", async (request, reply) => {
    try {
      const body = request.body as { items?: string[] };
      const addr = body.items?.[0] ?? "";
      const domain = addr.split("@")[1];
      if (domain) domainScope(request, domain);
      await editAlias(request.body as Record<string, unknown>);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.delete("/api/domain/aliases", async (request, reply) => {
    try {
      const { address } = request.body as { address?: string };
      if (!address) return reply.status(400).send({ error: "address obrigatório" });
      const domain = address.split("@")[1];
      if (domain) domainScope(request, domain);
      await deleteAliases([address]);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  // ── Domains (edit/delete/dkim) ──
  app.patch("/api/admin/domains", async (request, reply) => {
    try {
      adminOnly(request);
      await editDomain(request.body as Record<string, unknown>);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.delete("/api/admin/domains", async (request, reply) => {
    try {
      adminOnly(request);
      const { domain } = request.body as { domain?: string };
      if (!domain) return reply.status(400).send({ error: "domain obrigatório" });
      await deleteDomains([domain]);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.get("/api/admin/domains/:domain", async (request, reply) => {
    try {
      adminOnly(request);
      const { domain } = request.params as { domain: string };
      return { domain: await getDomain(domain) };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.get("/api/admin/dkim/:domain", async (request, reply) => {
    try {
      adminOnly(request);
      const { domain } = request.params as { domain: string };
      return { dkim: await getDkim(domain) };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.post("/api/admin/dkim", async (request, reply) => {
    try {
      adminOnly(request);
      await addDkim(request.body as Record<string, unknown>);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.delete("/api/admin/dkim", async (request, reply) => {
    try {
      adminOnly(request);
      await deleteDkim(request.body as Record<string, unknown>);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  // ── Quarantine & mail queue ──
  app.get("/api/admin/quarantine", async (request, reply) => {
    try {
      adminOnly(request);
      return { items: await listQuarantine() };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.delete("/api/admin/quarantine", async (request, reply) => {
    try {
      adminOnly(request);
      const { ids } = request.body as { ids?: string[] };
      if (!ids?.length) return reply.status(400).send({ error: "ids obrigatório" });
      await deleteQuarantineItems(ids);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.get("/api/admin/mailq", async (request, reply) => {
    try {
      adminOnly(request);
      return { items: await listMailQueue() };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.post("/api/admin/mailq/action", async (request, reply) => {
    try {
      adminOnly(request);
      const body = request.body as { action?: string; payload?: unknown };
      if (body.action === "delete") await deleteMailQueue(body.payload);
      else if (body.action === "edit") await editMailQueue(body.payload as Record<string, unknown>);
      else return reply.status(400).send({ error: "action inválida" });
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  // ── Fail2ban ──
  app.get("/api/admin/fail2ban", async (request, reply) => {
    try {
      adminOnly(request);
      return { fail2ban: await getFail2ban() };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.patch("/api/admin/fail2ban", async (request, reply) => {
    try {
      adminOnly(request);
      await editFail2ban(request.body as Record<string, unknown>);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  // ── Infrastructure lists ──
  const infraRoutes: [string, () => Promise<unknown>, string][] = [
    ["/api/admin/fwdhosts", listFwdHosts, "items"],
    ["/api/admin/relayhosts", listRelayHosts, "items"],
    ["/api/admin/transports", listTransports, "items"],
    ["/api/admin/syncjobs", listSyncJobs, "items"],
    ["/api/admin/resources", listResources, "items"],
    ["/api/admin/bcc-maps", listBccMaps, "items"],
    ["/api/admin/recipient-maps", listRecipientMaps, "items"],
    ["/api/admin/tls-policy-maps", listTlsPolicyMaps, "items"],
    ["/api/admin/oauth2-clients", listOAuth2Clients, "items"],
  ];

  for (const [path, fn, key] of infraRoutes) {
    app.get(path, async (request, reply) => {
      try {
        adminOnly(request);
        return { [key]: await fn() };
      } catch (err) {
        return handleRouteError(reply, err);
      }
    });
  }

  app.post("/api/admin/fwdhosts", async (request, reply) => {
    try {
      adminOnly(request);
      await addFwdHost(request.body as Record<string, unknown>);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.delete("/api/admin/fwdhosts", async (request, reply) => {
    try {
      adminOnly(request);
      await deleteFwdHosts(request.body);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.post("/api/admin/relayhosts", async (request, reply) => {
    try {
      adminOnly(request);
      await addRelayHost(request.body as Record<string, unknown>);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.delete("/api/admin/relayhosts", async (request, reply) => {
    try {
      adminOnly(request);
      await deleteRelayHosts(request.body);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.post("/api/admin/transports", async (request, reply) => {
    try {
      adminOnly(request);
      await addTransport(request.body as Record<string, unknown>);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.delete("/api/admin/transports", async (request, reply) => {
    try {
      adminOnly(request);
      await deleteTransports(request.body);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.post("/api/admin/syncjobs", async (request, reply) => {
    try {
      adminOnly(request);
      await addSyncJob(request.body as Record<string, unknown>);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.patch("/api/admin/syncjobs", async (request, reply) => {
    try {
      adminOnly(request);
      await editSyncJob(request.body as Record<string, unknown>);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.delete("/api/admin/syncjobs", async (request, reply) => {
    try {
      adminOnly(request);
      await deleteSyncJobs(request.body);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.post("/api/admin/resources", async (request, reply) => {
    try {
      adminOnly(request);
      await addResource(request.body as Record<string, unknown>);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.delete("/api/admin/resources", async (request, reply) => {
    try {
      adminOnly(request);
      await deleteResources(request.body);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  // ── Rate limits & spam (admin + account) ──
  app.get("/api/admin/rl-domain/:domain", async (request, reply) => {
    try {
      adminOnly(request);
      const { domain } = request.params as { domain: string };
      return { rl: await getRlDomain(domain) };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.patch("/api/admin/rl-domain", async (request, reply) => {
    try {
      adminOnly(request);
      await editRlDomain(request.body as Record<string, unknown>);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.get("/api/admin/rl-mbox/:mailbox", async (request, reply) => {
    try {
      adminOnly(request);
      const { mailbox } = request.params as { mailbox: string };
      return { rl: await getRlMbox(mailbox) };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.patch("/api/admin/rl-mbox", async (request, reply) => {
    try {
      adminOnly(request);
      await editRlMbox(request.body as Record<string, unknown>);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  // ── Logs & Solr ──
  app.get("/api/admin/logs/:type", async (request, reply) => {
    try {
      adminOnly(request);
      const { type } = request.params as { type: string };
      const q = request.query as { count?: string };
      return { logs: await listLogs(type, parseInt(q.count ?? "50", 10)) };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.get("/api/admin/status/solr", async (request, reply) => {
    try {
      adminOnly(request);
      return { solr: await getSolrStatus() };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  // ── Domain admin ACL ──
  app.patch("/api/admin/da-acl", async (request, reply) => {
    try {
      adminOnly(request);
      await editDaAcl(request.body as Record<string, unknown>);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  // ── Account-level (user) ──
  app.get("/api/account/time-limited-aliases", async (request, reply) => {
    try {
      const session = requireRoleSession(request, "user");
      if (!session.email) return reply.status(400).send({ error: "E-mail obrigatório" });
      return { aliases: await listTimeLimitedAliases(session.email) };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.post("/api/account/time-limited-aliases", async (request, reply) => {
    try {
      const session = requireRoleSession(request, "user");
      if (!session.email) return reply.status(400).send({ error: "E-mail obrigatório" });
      await addTimeLimitedAlias({
        ...(request.body as Record<string, unknown>),
        mailbox: session.email,
      });
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.patch("/api/account/spam-score", async (request, reply) => {
    try {
      const session = requireRoleSession(request, "user");
      if (!session.email) return reply.status(400).send({ error: "E-mail obrigatório" });
      const body = request.body as { spam_score?: string };
      await editSpamScore({
        items: [session.email],
        attr: { spam_score: body.spam_score ?? "8,15" },
      });
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.patch("/api/account/user-acl", async (request, reply) => {
    try {
      const session = requireRoleSession(request, "user");
      if (!session.email) return reply.status(400).send({ error: "E-mail obrigatório" });
      await editUserAcl({
        items: [session.email],
        attr: (request.body as { attr?: Record<string, unknown> }).attr ?? request.body,
      });
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  // Re-export alias list for domain (already in admin.ts but keep domain aliases GET there)
  void listAliases;
}
