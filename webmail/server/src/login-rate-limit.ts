type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function clientIpFromRequest(req: {
  ip?: string;
  headers?: Record<string, unknown>;
}): string {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return req.ip || "unknown";
}

export function checkLoginRateLimit(
  req: { ip?: string; headers?: Record<string, unknown> },
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
