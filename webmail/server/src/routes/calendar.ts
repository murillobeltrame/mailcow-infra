import type { FastifyInstance } from "fastify";
import {
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
}
