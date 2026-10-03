import { clientIpFromRequest, type ClientIpRequest } from "./client-ip.js";

const DEFAULT_CMS_URL = "http://127.0.0.1:3000";

function cmsUrl(): string {
  const raw = process.env.STEPGO_SITE_API_URL?.trim();
  return (raw || DEFAULT_CMS_URL).replace(/\/$/, "");
}

export function reportLoginFailureToNive(
  req: ClientIpRequest,
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
    body: JSON.stringify({ ip: clientIpFromRequest(req), email, service }),
  })
    .catch(() => undefined)
    .finally(() => clearTimeout(timeout));
}
