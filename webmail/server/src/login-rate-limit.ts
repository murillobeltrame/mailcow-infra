import { clientIpFromRequest, type ClientIpRequest } from "./client-ip.js";

export { clientIpFromRequest };

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function checkLoginRateLimit(
  req: ClientIpRequest,
  loginAs = "user",
): { ok: true } | { ok: false; message: string } {
  const maxDefault = loginAs === "user" ? 30 : 15;
  const max = Number(process.env.RATE_LIMIT_LOGIN_MAX ?? String(maxDefault));
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? "60000");
  const key = `login:${clientIpFromRequest(req)}:${loginAs}`;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (bucket.count >= max) {
    return {
      ok: false,
      message: "Muitas tentativas. Aguarde um momento e tente novamente.",
    };
  }

  bucket.count += 1;
  return { ok: true };
}
