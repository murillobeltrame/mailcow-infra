import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit } from "undici";
import { config } from "./config.js";

/** Fetch interno Docker → nginx Mailcow (Host + TLS opcional). */
const mailcowDispatcher = new Agent({
  connect: {
    rejectUnauthorized: !config.mailcowApiTlsInsecure,
    servername: config.mailcowHostname,
  },
});

export async function mailcowFetch(
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<Response> {
  const headers: Record<string, string> = {
    Host: config.mailcowHostname,
    ...init?.headers,
  };
  const req: UndiciRequestInit = {
    method: init?.method,
    body: init?.body,
    headers,
  };
  if (url.startsWith("https:")) {
    req.dispatcher = mailcowDispatcher;
  }
  return undiciFetch(url, req) as unknown as Promise<Response>;
}
