/**
 * Builds the public site origin for password-reset links (prefer `APP_BASE_URL`, then request headers).
 */
export function getAppBaseUrlFromRequest(request: Request): string {
  const fromEnv = process.env.APP_BASE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) {
    return fromEnv;
  }
  const origin = request.headers.get("origin");
  if (origin && origin.startsWith("http")) {
    return origin.replace(/\/$/, "");
  }
  const host = request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") ?? "http";
    return `${proto.split(",")[0]?.trim() ?? "http"}://${host.split(",")[0]?.trim() ?? host}`;
  }
  return "http://localhost:3000";
}
