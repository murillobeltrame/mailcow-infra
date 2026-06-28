import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import { config, mailTlsOptions } from "./config.js";
import type { MailSession } from "./session.js";

export type FolderInfo = {
  path: string;
  name: string;
  specialUse?: string;
  unseen?: number;
};

export type MessageSummary = {
  uid: number;
  subject: string;
  from: string;
  fromName?: string;
  date: string;
  seen: boolean;
  flagged: boolean;
  hasAttachments: boolean;
  preview: string;
};

export type MessageDetail = MessageSummary & {
  to: string[];
  cc: string[];
  html?: string;
  text?: string;
  attachments: { filename: string; contentType: string; size: number }[];
};

function imapOptions(email: string, password: string) {
  return {
    host: config.imapHost,
    port: config.imapPort,
    secure: config.imapSecure,
    auth: { user: email, pass: password },
    logger: false as const,
    tls: mailTlsOptions,
  };
}

function createImapClient(session: MailSession) {
  return new ImapFlow(imapOptions(session.email, session.password));
}

export async function verifyCredentials(email: string, password: string) {
  const client = new ImapFlow(imapOptions(email, password));
  try {
    await client.connect();
    await client.logout();
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const authFailed =
      (err as { authenticationFailed?: boolean }).authenticationFailed ||
      /auth/i.test(msg) ||
      /invalid credentials/i.test(msg);
    if (!authFailed) {
      console.error("[imap] verifyCredentials:", msg);
    }
    return false;
  }
}

function formatAddress(addr: { name?: string; address?: string } | undefined) {
  if (!addr) return "";
  if (addr.name && addr.address) return `${addr.name} <${addr.address}>`;
  return addr.address ?? addr.name ?? "";
}

function folderDisplayName(path: string) {
  const map: Record<string, string> = {
    INBOX: "Caixa de entrada",
    Sent: "Enviados",
    "Sent Messages": "Enviados",
    Drafts: "Rascunhos",
    Trash: "Lixeira",
    Junk: "Spam",
    Archive: "Arquivo",
    Templates: "Modelos",
  };
  const base = path.split("/").pop() ?? path;
  return map[base] ?? base;
}

export async function listFolders(session: MailSession): Promise<FolderInfo[]> {
  const client = createImapClient(session);
  await client.connect();
  try {
    const mailboxes = await client.list();
    const folders: FolderInfo[] = [];
    for (const box of mailboxes) {
      if (box.flags.has("\\Noselect")) continue;
      let unseen = 0;
      try {
        const status = await client.status(box.path, { unseen: true });
        unseen = status.unseen ?? 0;
      } catch {
        /* ignore */
      }
      folders.push({
        path: box.path,
        name: folderDisplayName(box.path),
        specialUse: box.specialUse ?? undefined,
        unseen,
      });
    }
    const order = ["\\Inbox", "\\Sent", "\\Drafts", "\\Archive", "\\Junk", "\\Trash"];
    folders.sort((a, b) => {
      const ai = order.indexOf(a.specialUse ?? "");
      const bi = order.indexOf(b.specialUse ?? "");
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return a.name.localeCompare(b.name, "pt-BR");
    });
    return folders;
  } finally {
    await client.logout();
  }
}

export async function listMessages(
  session: MailSession,
  folder: string,
  page = 0,
  limit = 40,
  query?: string
): Promise<{ messages: MessageSummary[]; total: number }> {
  const client = createImapClient(session);
  await client.connect();
  const lock = await client.getMailboxLock(folder);
  try {
    const mailbox = client.mailbox;
    const total = mailbox && typeof mailbox !== "boolean" ? mailbox.exists : 0;
    if (total === 0 && !query?.trim()) return { messages: [], total: 0 };

    let uids: number[] = [];
    if (query?.trim()) {
      const found = await client.search(
        {
          or: [{ subject: query }, { from: query }, { body: query }],
        },
        { uid: true }
      );
      uids = Array.isArray(found) ? found.slice().reverse() : [];
    } else {
      const found = await client.search({ all: true }, { uid: true });
      uids = Array.isArray(found) ? found.slice().reverse() : [];
    }

    const slice = uids.slice(page * limit, (page + 1) * limit);
    const messages: MessageSummary[] = [];
    if (slice.length === 0) return { messages: [], total: uids.length };

    for await (const msg of client.fetch(slice.join(","), {
      uid: true,
      envelope: true,
      flags: true,
      bodyStructure: true,
      source: { start: 0, maxLength: 512 },
    }, { uid: true })) {
      const from = msg.envelope?.from?.[0];
      const subject = msg.envelope?.subject ?? "(Sem assunto)";
      let preview = "";
      if (msg.source) {
        const raw = msg.source.toString("utf8");
        const bodyStart = raw.indexOf("\r\n\r\n");
        preview = (bodyStart > -1 ? raw.slice(bodyStart + 4) : raw)
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 140);
      }
      messages.push({
        uid: msg.uid,
        subject,
        from: from?.address ?? "",
        fromName: from?.name,
        date: msg.envelope?.date?.toISOString() ?? new Date().toISOString(),
        seen: msg.flags?.has("\\Seen") ?? false,
        flagged: msg.flags?.has("\\Flagged") ?? false,
        hasAttachments: hasAttachments(msg.bodyStructure),
        preview,
      });
    }

    return { messages, total: uids.length };
  } finally {
    lock.release();
    await client.logout();
  }
}

function hasAttachments(structure: unknown): boolean {
  if (!structure || typeof structure !== "object") return false;
  const s = structure as { disposition?: string; childNodes?: unknown[]; type?: string };
  if (s.disposition === "attachment") return true;
  if (s.type === "multipart" && s.childNodes) {
    return s.childNodes.some(hasAttachments);
  }
  return false;
}

export async function getMessage(session: MailSession, folder: string, uid: number): Promise<MessageDetail> {
  const client = createImapClient(session);
  await client.connect();
  const lock = await client.getMailboxLock(folder);
  try {
    let raw = "";
    for await (const msg of client.fetch(String(uid), { uid: true, source: true }, { uid: true })) {
      raw = msg.source?.toString("utf8") ?? "";
      if (!msg.flags?.has("\\Seen")) {
        await client.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"], { uid: true });
      }
    }
    const parsed = await simpleParser(raw);
    const from = parsed.from?.value?.[0];

    const toAddresses = Array.isArray(parsed.to)
      ? parsed.to.flatMap((g) => g.value)
      : (parsed.to?.value ?? []);
    const ccAddresses = Array.isArray(parsed.cc)
      ? parsed.cc.flatMap((g) => g.value)
      : (parsed.cc?.value ?? []);

    return {
      uid,
      subject: parsed.subject ?? "(Sem assunto)",
      from: from?.address ?? "",
      fromName: from?.name,
      to: toAddresses.map((a) => formatAddress(a)),
      cc: ccAddresses.map((a) => formatAddress(a)),
      date: parsed.date?.toISOString() ?? new Date().toISOString(),
      seen: true,
      flagged: false,
      hasAttachments: (parsed.attachments?.length ?? 0) > 0,
      preview: parsed.text?.slice(0, 140) ?? "",
      html: parsed.html || undefined,
      text: parsed.text || undefined,
      attachments: (parsed.attachments ?? []).map((a) => ({
        filename: a.filename ?? "anexo",
        contentType: a.contentType,
        size: a.size,
      })),
    };
  } finally {
    lock.release();
    await client.logout();
  }
}

export async function sendMail(
  session: MailSession,
  opts: { to: string; subject: string; body: string; cc?: string; replyTo?: string }
) {
  const transport = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: { user: session.email, pass: session.password },
    tls: mailTlsOptions,
  });

  await transport.sendMail({
    from: session.name ? `"${session.name}" <${session.email}>` : session.email,
    to: opts.to,
    cc: opts.cc,
    replyTo: opts.replyTo,
    subject: opts.subject,
    text: opts.body,
    html: opts.body.replace(/\n/g, "<br>"),
  });
}

export async function deleteMessages(session: MailSession, folder: string, uids: number[]) {
  const client = createImapClient(session);
  await client.connect();
  const lock = await client.getMailboxLock(folder);
  try {
    await client.messageDelete({ uid: uids.join(",") }, { uid: true });
  } finally {
    lock.release();
    await client.logout();
  }
}

export async function toggleFlag(session: MailSession, folder: string, uid: number, flagged: boolean) {
  const client = createImapClient(session);
  await client.connect();
  const lock = await client.getMailboxLock(folder);
  try {
    if (flagged) {
      await client.messageFlagsAdd({ uid }, ["\\Flagged"], { uid: true });
    } else {
      await client.messageFlagsRemove({ uid }, ["\\Flagged"], { uid: true });
    }
  } finally {
    lock.release();
    await client.logout();
  }
}
