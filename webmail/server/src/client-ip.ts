import { isIP } from "node:net";

/**
 * IP do cliente confiável — mesma abordagem do ERP (sistemaloja/server/src/lib/client-ip.ts).
 *
 * `X-Forwarded-For` tem a entrada mais à esquerda controlada pelo cliente (o proxy só
 * ANEXA o IP real ao final), então nunca usamos o primeiro hop. Só confiamos em cabeçalhos
 * de proxy quando a conexão veio de um proxy: loopback, rede privada (nginx/Docker) ou
 * `TRUST_PROXY_HEADERS=true`. Ordem: CF-Connecting-IP → XFF (entrada pública mais à
 * direita) → endereço do socket.
 */
export type ClientIpRequest = {
  ip?: string;
  headers?: Record<string, unknown>;
  socket?: { remoteAddress?: string | null };
};

function headerValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return value.join(",");
  return typeof value === "string" ? value : undefined;
}

function normalizeIpCandidate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let value = raw.trim();
  if (!value) return undefined;
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(value);
  if (bracketed) value = bracketed[1] ?? value;
  const v4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(value);
  if (v4WithPort) value = v4WithPort[1] ?? value;
  value = value.replace(/^::ffff:/i, "");
  return isIP(value) ? value : undefined;
}

function ipv4Octets(ip: string): number[] | undefined {
  const v4 = ip.toLowerCase().replace(/^::ffff:/, "");
  if (isIP(v4) !== 4) return undefined;
  return v4.split(".").map((part) => Number(part));
}

/** Loopback, privados (RFC1918), link-local, CGNAT, 0.0.0.0/8, ULA/link-local IPv6. */
export function isNonPublicIp(ip: string): boolean {
  const octets = ipv4Octets(ip);
  if (octets) {
    const [a = 0, b = 0] = octets;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return true;
  if (/^f[cd][0-9a-f]{2}:/.test(v6)) return true;
  if (/^fe[89ab][0-9a-f]:/.test(v6)) return true;
  return false;
}

/** Entrada pública mais à direita do XFF; sem pública, a válida mais à direita. */
export function pickForwardedClientIp(forwarded: string | undefined): string | undefined {
  if (!forwarded) return undefined;
  const entries = forwarded
    .split(",")
    .map((entry) => normalizeIpCandidate(entry))
    .filter((entry): entry is string => Boolean(entry));
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry && !isNonPublicIp(entry)) return entry;
  }
  return entries[entries.length - 1];
}

export function getTrustedClientIp(req: ClientIpRequest): string | undefined {
  const direct = normalizeIpCandidate(req.socket?.remoteAddress ?? undefined) ?? req.socket?.remoteAddress ?? undefined;
  const peer = direct ?? req.ip;
  const trustForwarded =
    process.env.TRUST_PROXY_HEADERS === "true" || (peer ? isNonPublicIp(normalizeIpCandidate(peer) ?? peer) : false);

  if (!trustForwarded) return direct ?? req.ip;

  const headers = req.headers ?? {};
  const cfIp = normalizeIpCandidate(headerValue(headers["cf-connecting-ip"])?.split(",")[0]);
  if (cfIp) return cfIp;

  return pickForwardedClientIp(headerValue(headers["x-forwarded-for"])) ?? direct ?? req.ip;
}

export function clientIpFromRequest(req: ClientIpRequest): string {
  return getTrustedClientIp(req) || req.ip || "unknown";
}
