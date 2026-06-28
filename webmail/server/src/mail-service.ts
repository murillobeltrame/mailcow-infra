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

async function streamToBuffer(stream: AsyncIterable<Buffer | string>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function markSeen(client: ImapFlow, uid: number) {
  try {
    await client.messageFlagsAdd({ uid }, ["\\Seen"], { uid: true });
  } catch {
    /* Pastas Sent/Drafts podem rejeitar flags */
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} excedeu ${Math.round(ms / 1000)}s`)), ms);
    }),
  ]);
}

export async function getMessage(session: MailSession, folder: string, uid: number): Promise<MessageDetail> {
  return withTimeout(getMessageInner(session, folder, uid), 45_000, "Leitura da mensagem");
}

async function getMessageInner(session: MailSession, folder: string, uid: number): Promise<MessageDetail> {
  const client = createImapClient(session);
  await client.connect();
  const lock = await client.getMailboxLock(folder);
  try {
    const { content } = await client.download(String(uid), undefined, { uid: true });
    const rawBuffer = await streamToBuffer(content);

    if (!rawBuffer.length) {
      const err = new Error("Mensagem não encontrada") as Error & { statusCode: number };
      err.statusCode = 404;
      throw err;
    }

    await markSeen(client, uid);

    const parsed = await simpleParser(rawBuffer);
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

async function buildMimeMessage(
  opts: nodemailer.SendMailOptions
): Promise<Buffer> {
  const builder = nodemailer.createTransport({
    streamTransport: true,
    newline: "unix",
    buffer: true,
  });
  const info = await builder.sendMail(opts);
  const raw = info.message;
  if (Buffer.isBuffer(raw)) return raw;
  return Buffer.from(String(raw));
}

async function resolveSentFolder(client: ImapFlow): Promise<string | null> {
  const mailboxes = await client.list();
  const sent = mailboxes.find((box) => box.specialUse === "\\Sent");
  if (sent) return sent.path;

  const fallbacks = ["Sent", "Sent Messages", "Sent Items", "INBOX.Sent"];
  for (const name of fallbacks) {
    const match = mailboxes.find((box) => box.path === name || box.path.endsWith(`/${name}`));
    if (match) return match.path;
  }
  return null;
}

async function appendToSentFolder(session: MailSession, raw: Buffer) {
  const client = createImapClient(session);
  await client.connect();
  try {
    const sentPath = await resolveSentFolder(client);
    if (!sentPath) {
      console.warn("[sendMail] Pasta Enviados não encontrada — cópia IMAP ignorada");
      return;
    }
    await client.append(sentPath, raw, ["\\Seen"], new Date());
  } finally {
    await client.logout();
  }
}

export async function sendMail(
  session: MailSession,
  opts: {
    to: string;
    subject: string;
    body: string;
    cc?: string;
    bcc?: string;
    replyTo?: string;
    attachments?: { filename: string; content: Buffer; contentType?: string }[];
  },
) {
  const mailOptions: nodemailer.SendMailOptions = {
    from: session.name ? `"${session.name}" <${session.email}>` : session.email,
    to: opts.to,
    cc: opts.cc,
    bcc: opts.bcc,
    replyTo: opts.replyTo,
    subject: opts.subject,
    text: opts.body,
    html: opts.body.replace(/\n/g, "<br>"),
    attachments: opts.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  };

  const raw = await buildMimeMessage(mailOptions);

  const transport = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: { user: session.email, pass: session.password },
    tls: mailTlsOptions,
  });

  await transport.sendMail(mailOptions);

  try {
    await appendToSentFolder(session, raw);
  } catch (err) {
    console.error("[sendMail] Falha ao gravar em Enviados:", err instanceof Error ? err.message : err);
  }
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

export async function markUnread(session: MailSession, folder: string, uid: number) {
  const client = createImapClient(session);
  await client.connect();
  const lock = await client.getMailboxLock(folder);
  try {
    await client.messageFlagsRemove({ uid }, ["\\Seen"], { uid: true });
  } finally {
    lock.release();
    await client.logout();
  }
}

export async function moveMessages(
  session: MailSession,
  fromFolder: string,
  toFolder: string,
  uids: number[],
) {
  const client = createImapClient(session);
  await client.connect();
  const lock = await client.getMailboxLock(fromFolder);
  try {
    await client.messageMove({ uid: uids.join(",") }, toFolder, { uid: true });
  } finally {
    lock.release();
    await client.logout();
  }
}

export async function getAttachment(
  session: MailSession,
  folder: string,
  uid: number,
  index: number,
): Promise<{ filename: string; contentType: string; data: Buffer }> {
  const client = createImapClient(session);
  await client.connect();
  const lock = await client.getMailboxLock(folder);
  try {
    const { content } = await client.download(String(uid), undefined, { uid: true });
    const rawBuffer = await streamToBuffer(content);
    const parsed = await simpleParser(rawBuffer);
    const att = parsed.attachments?.[index];
    if (!att) {
      const err = new Error("Anexo não encontrado") as Error & { statusCode: number };
      err.statusCode = 404;
      throw err;
    }
    return {
      filename: att.filename ?? "anexo",
      contentType: att.contentType,
      data: att.content,
    };
  } finally {
    lock.release();
    await client.logout();
  }
}
