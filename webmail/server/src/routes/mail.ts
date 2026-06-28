import type { FastifyInstance, FastifyRequest } from "fastify";
import { config } from "../config.js";
import { handleRouteError, requireSession } from "../http.js";
import {
  deleteMessages,
  getAttachment,
  getMessage,
  listFolders,
  listMessages,
  markUnread,
  moveMessages,
  sendMail,
  toggleFlag,
} from "../mail-service.js";
import { asMailSession } from "../session.js";

function mailSession(request: FastifyRequest) {
  const session = requireSession(request);
  const mail = asMailSession(session);
  if (!mail) {
    const err = new Error("Webmail disponível apenas para usuários de caixa") as Error & {
      statusCode: number;
    };
    err.statusCode = 403;
    throw err;
  }
  return mail;
}

export async function registerMailRoutes(app: FastifyInstance) {
  app.get("/api/folders", async (request, reply) => {
    try {
      const session = mailSession(request);
      return { folders: await listFolders(session) };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.get("/api/messages", async (request, reply) => {
    try {
      const session = mailSession(request);
      const q = request.query as { folder?: string; page?: string; limit?: string; q?: string };
      return await listMessages(
        session,
        q.folder ?? "INBOX",
        parseInt(q.page ?? "0", 10),
        parseInt(q.limit ?? "40", 10),
        q.q,
      );
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.get("/api/messages/:uid", async (request, reply) => {
    try {
      const session = mailSession(request);
      const { uid } = request.params as { uid: string };
      const q = request.query as { folder?: string };
      return await getMessage(session, q.folder ?? "INBOX", parseInt(uid, 10));
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.get("/api/messages/:uid/attachments/:index", async (request, reply) => {
    try {
      const session = mailSession(request);
      const { uid, index } = request.params as { uid: string; index: string };
      const q = request.query as { folder?: string };
      const att = await getAttachment(session, q.folder ?? "INBOX", parseInt(uid, 10), parseInt(index, 10));
      reply.header("Content-Type", att.contentType);
      reply.header("Content-Disposition", `attachment; filename="${encodeURIComponent(att.filename)}"`);
      return reply.send(att.data);
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.post("/api/messages/send", async (request, reply) => {
    try {
      const session = mailSession(request);
      const body = request.body as {
        to?: string;
        subject?: string;
        body?: string;
        cc?: string;
        bcc?: string;
      };
      if (!body.to?.trim() || !body.subject?.trim() || !body.body?.trim()) {
        return reply.status(400).send({ error: "Destinatário, assunto e mensagem são obrigatórios" });
      }
      await sendMail(session, {
        to: body.to.trim(),
        subject: body.subject.trim(),
        body: body.body,
        cc: body.cc?.trim(),
        bcc: body.bcc?.trim(),
      });
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.delete("/api/messages", async (request, reply) => {
    try {
      const session = mailSession(request);
      const body = request.body as { folder?: string; uids?: number[] };
      if (!body.uids?.length) return reply.status(400).send({ error: "Nenhuma mensagem selecionada" });
      await deleteMessages(session, body.folder ?? "INBOX", body.uids);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.patch("/api/messages/:uid/flag", async (request, reply) => {
    try {
      const session = mailSession(request);
      const { uid } = request.params as { uid: string };
      const body = request.body as { folder?: string; flagged?: boolean };
      await toggleFlag(session, body.folder ?? "INBOX", parseInt(uid, 10), body.flagged ?? true);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.patch("/api/messages/:uid/unread", async (request, reply) => {
    try {
      const session = mailSession(request);
      const { uid } = request.params as { uid: string };
      const body = request.body as { folder?: string };
      await markUnread(session, body.folder ?? "INBOX", parseInt(uid, 10));
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  app.post("/api/messages/move", async (request, reply) => {
    try {
      const session = mailSession(request);
      const body = request.body as { from?: string; to?: string; uids?: number[] };
      if (!body.from || !body.to || !body.uids?.length) {
        return reply.status(400).send({ error: "from, to e uids são obrigatórios" });
      }
      await moveMessages(session, body.from, body.to, body.uids);
      return { ok: true };
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });
}
