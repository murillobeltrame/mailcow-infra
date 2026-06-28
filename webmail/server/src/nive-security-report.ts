const DEFAULT_CMS_URL = "http://127.0.0.1:3000";

function cmsUrl(): string {
  const raw = process.env.STEPGO_SITE_API_URL?.trim();
  return (raw || DEFAULT_CMS_URL).replace(/\/$/, "");
}

function clientIp(req: { ip?: string; headers?: Record<string, unknown> }): string {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return req.ip || "unknown";
}

export function reportLoginFailureToNive(
  req: { ip?: string; headers?: Record<string, unknown> },
  email: string,
  service = "nive-webmail",
): void {
  const secret = process.env.PROVISIONING_SECRET?.trim();
  if (!secret) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  void fetch(`${cmsUrl()}/api/internal/security/login-failure`, {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      "X-Provisioning-Secret": secret,
    },
    body: JSON.stringify({ ip: clientIp(req), email, service }),
  })
    .catch(() => undefined)
    .finally(() => clearTimeout(timeout));
}
