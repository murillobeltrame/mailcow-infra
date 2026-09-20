import { Agent, request } from "undici";
import { config } from "./config.js";

/**
 * Cliente HTTP interno Docker → nginx Mailcow.
 * Usa `request()` e não `fetch()`: o fetch do undici segue a spec e descarta o
 * header Host. Sem Host=MAILCOW_HOSTNAME o nginx responde 502 HTML.
 */
const mailcowDispatcher = new Agent({
  connect: {
    rejectUnauthorized: !config.mailcowApiTlsInsecure,
    servername: config.mailcowHostname,
  },
});

type MailcowResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

export async function mailcowFetch(
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<MailcowResponse> {
  const { statusCode, body } = await request(url, {
    method: init?.method,
    body: init?.body,
    headers: {
      Host: config.mailcowHostname,
      ...init?.headers,
    },
    dispatcher: url.startsWith("https:") ? mailcowDispatcher : undefined,
  });
  const text = await body.text();
  return {
    ok: statusCode >= 200 && statusCode < 300,
    status: statusCode,
    text: async () => text,
  };
}
