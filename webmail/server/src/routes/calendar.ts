import type { FastifyInstance } from "fastify";
import {
  createCalendarEvent,
  createContact,
  deleteCalendarEvent,
  deleteContact,
  fetchCalendarEvents,
  fetchContacts,
  listAddressBooks,
  listCalendars,
} from "../caldav-service.js";
import { handleRouteError, requireRoleSession } from "../http.js";

export async function registerCalendarRoutes(app: FastifyInstance) {
  app.get("/api/calendar/calendars", async (request, reply) => {
    try {
      const session = requireRoleSession(request, "user");
      if (!session.email || !session.password) {
        return reply.status(400).send({ error: "Credenciais de caixa necessárias" });
      }
      return { calendars: await listCalendars(session.email, session.password) };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.get("/api/calendar/events", async (request, reply) => {
    try {
      const session = requireRoleSession(request, "user");
      const q = request.query as { href?: string };
      if (!session.email || !session.password || !q.href) {
        return reply.status(400).send({ error: "href obrigatório" });
      }
      return { events: await fetchCalendarEvents(session.email, session.password, q.href) };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.get("/api/contacts/books", async (request, reply) => {
    try {
      const session = requireRoleSession(request, "user");
      if (!session.email || !session.password) {
        return reply.status(400).send({ error: "Credenciais de caixa necessárias" });
      }
      return { books: await listAddressBooks(session.email, session.password) };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.get("/api/contacts/list", async (request, reply) => {
    try {
      const session = requireRoleSession(request, "user");
      const q = request.query as { href?: string };
      if (!session.email || !session.password || !q.href) {
        return reply.status(400).send({ error: "href obrigatório" });
      }
      return { contacts: await fetchContacts(session.email, session.password, q.href) };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.post("/api/calendar/events", async (request, reply) => {
    try {
      const session = requireRoleSession(request, "user");
      const body = request.body as { href?: string; summary?: string };
      if (!session.email || !session.password || !body.href || !body.summary) {
        return reply.status(400).send({ error: "href e summary obrigatórios" });
      }
      const id = await createCalendarEvent(
        session.email,
        session.password,
        body.href,
        body.summary,
      );
      return { ok: true, id };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.delete("/api/calendar/events", async (request, reply) => {
    try {
      const session = requireRoleSession(request, "user");
      const body = request.body as { path?: string };
      if (!session.email || !session.password || !body.path) {
        return reply.status(400).send({ error: "path obrigatório" });
      }
      await deleteCalendarEvent(session.email, session.password, body.path);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.post("/api/contacts", async (request, reply) => {
    try {
      const session = requireRoleSession(request, "user");
      const body = request.body as { href?: string; fn?: string; email?: string };
      if (!session.email || !session.password || !body.href || !body.fn) {
        return reply.status(400).send({ error: "href e fn obrigatórios" });
      }
      const id = await createContact(
        session.email,
        session.password,
        body.href,
        body.fn,
        body.email,
      );
      return { ok: true, id };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.delete("/api/contacts", async (request, reply) => {
    try {
      const session = requireRoleSession(request, "user");
      const body = request.body as { path?: string };
      if (!session.email || !session.password || !body.path) {
        return reply.status(400).send({ error: "path obrigatório" });
      }
      await deleteContact(session.email, session.password, body.path);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });
}
