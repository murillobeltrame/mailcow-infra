import crypto from "node:crypto";
import { config } from "./config.js";

const davBase = () => `https://${config.mailcowHostname}/SOGo/dav`;

function basicAuth(email: string, password: string) {
  return `Basic ${Buffer.from(`${email}:${password}`).toString("base64")}`;
}

async function davRequest(
  email: string,
  password: string,
  path: string,
  method = "PROPFIND",
  body?: string,
  headers: Record<string, string> = {},
) {
  const url = `${davBase()}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: basicAuth(email, password),
      Depth: "1",
      "Content-Type": "application/xml; charset=utf-8",
      ...headers,
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`CalDAV/CardDAV erro ${res.status}`) as Error & { statusCode: number };
    err.statusCode = res.status;
    throw err;
  }
  return text;
}

const propfindCalendars = `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><D:displayname/><C:calendar-description/></D:prop>
</D:propfind>`;

export async function listCalendars(email: string, password: string) {
  const xml = await davRequest(email, password, `/${encodeURIComponent(email)}/Calendar/`, "PROPFIND", propfindCalendars);
  const names: { href: string; name: string }[] = [];
  const parts = xml.split("<D:response>");
  for (const part of parts) {
    const href = part.match(/<D:href>([^<]+)<\/D:href>/)?.[1];
    const name = part.match(/<D:displayname>([^<]*)<\/D:displayname>/)?.[1] ?? "Calendário";
    if (href && href.includes("/Calendar/")) names.push({ href, name });
  }
  return names;
}

const propfindContacts = `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:carddav">
  <D:prop><D:displayname/></D:prop>
</D:propfind>`;

export async function listAddressBooks(email: string, password: string) {
  const xml = await davRequest(
    email,
    password,
    `/${encodeURIComponent(email)}/Contacts/`,
    "PROPFIND",
    propfindContacts,
  );
  const books: { href: string; name: string }[] = [];
  const parts = xml.split("<D:response>");
  for (const part of parts) {
    const href = part.match(/<D:href>([^<]+)<\/D:href>/)?.[1];
    const name = part.match(/<D:displayname>([^<]*)<\/D:displayname>/)?.[1] ?? "Contactos";
    if (href && href.includes("/Contacts/")) books.push({ href, name });
  }
  return books;
}

export async function fetchCalendarEvents(email: string, password: string, calendarHref: string) {
  const report = `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><D:getetag/><C:calendar-data/></D:prop>
  <C:filter><C:comp-filter name="VCALENDAR"><C:comp-filter name="VEVENT"/></C:comp-filter></C:filter>
</C:calendar-query>`;
  const path = calendarHref.replace(/^https?:\/\/[^/]+/, "").replace("/SOGo/dav", "");
  const xml = await davRequest(email, password, path, "REPORT", report);
  const events: { summary: string; raw: string; path?: string }[] = [];
  for (const part of xml.split("<D:response>")) {
    if (!part.includes("BEGIN:VEVENT")) continue;
    const href = part.match(/<D:href>([^<]+)<\/D:href>/)?.[1];
    const block = part.split("BEGIN:VEVENT")[1]?.split("END:VEVENT")[0];
    if (!block) continue;
    const summary = block.match(/\nSUMMARY:([^\n]+)/)?.[1] ?? "(Sem título)";
    events.push({
      summary,
      raw: "BEGIN:VEVENT" + block + "END:VEVENT",
      path: href,
    });
  }
  return events;
}

export async function fetchContacts(email: string, password: string, bookHref: string) {
  const report = `<?xml version="1.0" encoding="utf-8" ?>
<C:addressbook-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:carddav">
  <D:prop><C:address-data/></D:prop>
</C:addressbook-query>`;
  const path = bookHref.replace(/^https?:\/\/[^/]+/, "").replace("/SOGo/dav", "");
  const xml = await davRequest(email, password, path, "REPORT", report);
  const contacts: { fn: string; email?: string; path?: string }[] = [];
  for (const part of xml.split("<D:response>")) {
    if (!part.includes("BEGIN:VCARD")) continue;
    const href = part.match(/<D:href>([^<]+)<\/D:href>/)?.[1];
    const block = part.split("BEGIN:VCARD")[1]?.split("END:VCARD")[0];
    if (!block) continue;
    const fn = block.match(/\nFN:([^\n]+)/)?.[1] ?? "Contacto";
    const emailMatch = block.match(/\nEMAIL[^:]*:([^\n]+)/)?.[1];
    contacts.push({ fn, email: emailMatch, path: href });
  }
  return contacts;
}

function davPath(href: string) {
  return href.replace(/^https?:\/\/[^/]+/, "").replace("/SOGo/dav", "");
}

export async function createCalendarEvent(
  email: string,
  password: string,
  calendarHref: string,
  summary: string,
) {
  const uid = crypto.randomUUID();
  const base = davPath(calendarHref).replace(/\/?$/, "/");
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `SUMMARY:${summary}`,
    `DTSTART:${now}`,
    `DTEND:${now}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  await davRequest(email, password, `${base}${uid}.ics`, "PUT", ics, {
    "Content-Type": "text/calendar; charset=utf-8",
  });
  return uid;
}

export async function deleteCalendarEvent(email: string, password: string, eventPath: string) {
  await davRequest(email, password, davPath(eventPath), "DELETE", undefined, { Depth: "0" });
}

export async function createContact(
  email: string,
  password: string,
  bookHref: string,
  fn: string,
  contactEmail?: string,
) {
  const uid = crypto.randomUUID();
  const base = davPath(bookHref).replace(/\/?$/, "/");
  const vcard = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${fn}`,
    contactEmail ? `EMAIL:${contactEmail}` : "",
    "END:VCARD",
  ]
    .filter(Boolean)
    .join("\r\n");
  await davRequest(email, password, `${base}${uid}.vcf`, "PUT", vcard, {
    "Content-Type": "text/vcard; charset=utf-8",
  });
  return uid;
}

export async function deleteContact(email: string, password: string, contactPath: string) {
  await davRequest(email, password, davPath(contactPath), "DELETE", undefined, { Depth: "0" });
}
