/**
 * Allows only same-site relative paths after login/register to avoid open redirects.
 */
export function sanitizeRedirectPath(raw: string | undefined): string {
  if (typeof raw !== "string" || raw.length === 0 || !raw.startsWith("/")) {
    return "/";
  }
  if (raw.startsWith("//") || raw.includes("://")) {
    return "/";
  }
  return raw;
}
