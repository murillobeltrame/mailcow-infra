import crypto from "node:crypto";
import { config } from "./config.js";
import { mailcowFetch } from "./mailcow-fetch.js";

/**
 * CalDAV/CardDAV via nginx interno do Mailcow (mesmo caminho da API). O container não
 * alcança o hostname público e o `fetch` global descarta o header Host.
 */
const davBase = () => `${config.mailcowApiUrl}/SOGo/dav`;

type HttpError = Error & { statusCode: number };

function httpError(message: string, statusCode: number): HttpError {
  const err = new Error(message) as HttpError;
  err.statusCode = statusCode;
  return err;
}

function basicAuth(email: string, password: string) {
  return `Basic ${Buffer.from(`${email}:${password}`).toString("base64")}`;
}

function davError(status: number) {
  const messages: Record<number, string> = {
    401: "Credenciais recusadas pelo servidor de agenda",
    403: "Sem permissão para acessar esta agenda",
    404: "Agenda ou livro de endereços não encontrado",
  };
  // 401 do SOGo não é sessão expirada do portal: 502 evita deslogar o usuário.
  const code = status === 401 || status >= 500 ? 502 : status;
  return httpError(messages[status] ?? `Servidor de agenda respondeu ${status}`, code);
}

async function davRequest(
  email: string,
  password: string,
  path: string,
  method = "PROPFIND",
  body?: string,
  headers: Record<string, string> = {},
) {
  let res;
  try {
    res = await mailcowFetch(`${davBase()}${path}`, {
      method,
      headers: {
        Authorization: basicAuth(email, password),
        Depth: "1",
        "Content-Type": "application/xml; charset=utf-8",
        ...headers,
      },
      body,
      timeoutMs: 15_000,
    });
  } catch {
    throw httpError("Servidor de agenda indisponível", 502);
  }
  const text = await res.text();
  if (!res.ok) throw davError(res.status);
  return text;
}

/** Aceita só caminhos DAV do próprio usuário (sem `..`, sem outro host) e devolve codificado. */
function safeDavPath(email: string, href: string) {
  let path = href.replace(/^https?:\/\/[^/]+/, "").replace(/^\/SOGo\/dav/, "");
  try {
    path = decodeURIComponent(path);
  } catch {
    throw httpError("Caminho inválido", 400);
  }
  if (!path.startsWith(`/${email}/`) || path.split("/").includes("..") || /[\r\n]/.test(path)) {
    throw httpError("Caminho inválido", 400);
  }
  return path.split("/").map(encodeURIComponent).join("/");
}

function collectionPath(email: string, href: string) {
  return safeDavPath(email, href).replace(/\/?$/, "/");
}

function xmlResponses(xml: string) {
  return xml.split(/<(?:\w+:)?response[\s>]/).slice(1);
}

function decodeXml(v: string) {
  return v
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function xmlText(part: string, tag: string) {
  const m = part.match(new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${tag}>`));
  return m ? decodeXml(m[1]).trim() : undefined;
}

function hrefName(href: string) {
  const seg = href.replace(/\/+$/, "").split("/").pop() ?? "";
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

/** Remove dobras de linha (RFC 5545/6350) e CR. */
function unfold(v: string) {
  return v.replace(/\r?\n[ \t]/g, "").replace(/\r/g, "");
}

function prop(block: string, name: string) {
  const m = block.match(new RegExp(`^${name}(?:;[^:\\n]*)?:(.*)$`, "mi"));
  return m ? m[1].trim() : undefined;
}

function props(block: string, name: string) {
  return [...block.matchAll(new RegExp(`^${name}(?:;[^:\\n]*)?:(.*)$`, "gmi"))].map((m) => m[1].trim());
}

function unescapeText(v: string) {
  return v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
}

function escapeText(v: string) {
  return v
    .replace(/\\/g, "\\\\")
    .replace(/[,;]/g, (c) => `\\${c}`)
    .replace(/\r?\n/g, "\\n");
}

/** `20261012T143000Z` → `2026-10-12T14:30:00Z`; data pura → `2026-10-12`. */
function icsDate(v?: string): string | undefined {
  if (!v) return undefined;
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return undefined;
  const [, y, mo, d, h, mi, s, z] = m;
  if (h === undefined) return `${y}-${mo}-${d}`;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}${z ?? ""}`;
}

function toIcsUtc(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

const propfindCollections = `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:">
  <D:prop><D:displayname/><D:resourcetype/></D:prop>
</D:propfind>`;

type Collection = { href: string; name: string };

async function listCollections(
  email: string,
  password: string,
  folder: "Calendar" | "Contacts",
  kind: "calendar" | "addressbook",
  fallbackName: string,
): Promise<Collection[]> {
  const base = `/${encodeURIComponent(email)}/${folder}/`;
  const xml = await davRequest(email, password, base, "PROPFIND", propfindCollections);
  const typed: Collection[] = [];
  const untyped: Collection[] = [];
  for (const part of xmlResponses(xml)) {
    const href = xmlText(part, "href");
    if (!href || !href.includes(`/${folder}/`)) continue;
    // o próprio diretório raiz não é uma agenda/livro
    if (hrefName(href) === folder) continue;
    const item = { href, name: xmlText(part, "displayname") || hrefName(href) || fallbackName };
    if (new RegExp(`<(?:\\w+:)?${kind}\\s*/>`).test(part)) typed.push(item);
    else untyped.push(item);
  }
  // SOGo também lista pastas auxiliares (ex.: inbox/outbox); só caímos nelas se nada vier tipado.
  return typed.length > 0 ? typed : untyped.filter((c) => /\/$/.test(c.href));
}

export function listCalendars(email: string, password: string) {
  return listCollections(email, password, "Calendar", "calendar", "Calendário");
}

export function listAddressBooks(email: string, password: string) {
  return listCollections(email, password, "Contacts", "addressbook", "Contactos");
}

export type CalendarEvent = {
  summary: string;
  start?: string;
  end?: string;
  location?: string;
  raw: string;
  path?: string;
};

export async function fetchCalendarEvents(email: string, password: string, calendarHref: string) {
  const report = `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><D:getetag/><C:calendar-data/></D:prop>
  <C:filter><C:comp-filter name="VCALENDAR"><C:comp-filter name="VEVENT"/></C:comp-filter></C:filter>
</C:calendar-query>`;
  const xml = await davRequest(email, password, collectionPath(email, calendarHref), "REPORT", report);
  const events: CalendarEvent[] = [];
  for (const part of xmlResponses(xml)) {
    const href = xmlText(part, "href");
    const data = xmlText(part, "calendar-data");
    if (!data || !data.includes("BEGIN:VEVENT")) continue;
    const block = unfold(data).split("BEGIN:VEVENT")[1]?.split("END:VEVENT")[0];
    if (!block) continue;
    const summary = prop(block, "SUMMARY");
    const location = prop(block, "LOCATION");
    events.push({
      summary: summary ? unescapeText(summary) : "(Sem título)",
      start: icsDate(prop(block, "DTSTART")),
      end: icsDate(prop(block, "DTEND")),
      location: location ? unescapeText(location) : undefined,
      raw: `BEGIN:VEVENT${block}END:VEVENT`,
      path: href,
    });
  }
  return events.sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
}

export type Contact = { fn: string; email?: string; phone?: string; path?: string };

export async function fetchContacts(email: string, password: string, bookHref: string) {
  const report = `<?xml version="1.0" encoding="utf-8" ?>
<C:addressbook-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:carddav">
  <D:prop><D:getetag/><C:address-data/></D:prop>
</C:addressbook-query>`;
  const xml = await davRequest(email, password, collectionPath(email, bookHref), "REPORT", report);
  const contacts: Contact[] = [];
  for (const part of xmlResponses(xml)) {
    const href = xmlText(part, "href");
    const data = xmlText(part, "address-data");
    if (!data || !data.includes("BEGIN:VCARD")) continue;
    const block = unfold(data).split("BEGIN:VCARD")[1]?.split("END:VCARD")[0];
    if (!block) continue;
    const n = prop(block, "N")
      ?.split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .reverse()
      .join(" ");
    const mail = props(block, "EMAIL")[0];
    const phone = props(block, "TEL")[0];
    contacts.push({
      fn: unescapeText(prop(block, "FN") || n || mail || "Contacto"),
      email: mail ? unescapeText(mail) : undefined,
      phone: phone ? unescapeText(phone) : undefined,
      path: href,
    });
  }
  return contacts.sort((a, b) => a.fn.localeCompare(b.fn, "pt-BR", { sensitivity: "base" }));
}

export async function createCalendarEvent(
  email: string,
  password: string,
  calendarHref: string,
  summary: string,
  start?: string,
) {
  const uid = crypto.randomUUID();
  const startDate = start ? new Date(start) : new Date();
  if (Number.isNaN(startDate.getTime())) throw httpError("Data inválida", 400);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nive Mail//Webmail//PT",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `SUMMARY:${escapeText(summary)}`,
    `DTSTART:${toIcsUtc(startDate)}`,
    `DTEND:${toIcsUtc(endDate)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
  await davRequest(email, password, `${collectionPath(email, calendarHref)}${uid}.ics`, "PUT", ics, {
    "Content-Type": "text/calendar; charset=utf-8",
  });
  return uid;
}

export async function deleteCalendarEvent(email: string, password: string, eventPath: string) {
  await davRequest(email, password, safeDavPath(email, eventPath), "DELETE", undefined, { Depth: "0" });
}

export async function createContact(
  email: string,
  password: string,
  bookHref: string,
  fn: string,
  contactEmail?: string,
) {
  const uid = crypto.randomUUID();
  const vcard = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `UID:${uid}`,
    `FN:${escapeText(fn)}`,
    `N:${escapeText(fn)};;;;`,
    contactEmail ? `EMAIL;TYPE=INTERNET:${escapeText(contactEmail)}` : "",
    "END:VCARD",
    "",
  ]
    .filter((l, i, a) => l !== "" || i === a.length - 1)
    .join("\r\n");
  await davRequest(email, password, `${collectionPath(email, bookHref)}${uid}.vcf`, "PUT", vcard, {
    "Content-Type": "text/vcard; charset=utf-8",
  });
  return uid;
}

export async function deleteContact(email: string, password: string, contactPath: string) {
  await davRequest(email, password, safeDavPath(email, contactPath), "DELETE", undefined, { Depth: "0" });
}
