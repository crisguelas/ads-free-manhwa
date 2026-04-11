/**
 * Sends or logs the password-reset link. Uses Resend when configured; otherwise logs (dev-friendly).
 */

const DEFAULT_APP_NAME = "Manhwa Cloud";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function appDisplayName(): string {
  const fromEnv =
    process.env.APP_PUBLIC_NAME?.trim() ||
    process.env.RESEND_FROM_NAME?.trim() ||
    "";
  return fromEnv || DEFAULT_APP_NAME;
}

/**
 * Resend `from`: use full "Name <email>" if already set; otherwise "Name <RESEND_FROM_EMAIL>".
 */
function buildResendFromLine(): string | null {
  const raw = process.env.RESEND_FROM_EMAIL?.trim();
  if (!raw) {
    return null;
  }
  if (raw.includes("<") && raw.includes(">")) {
    return raw;
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    const name = appDisplayName();
    return `${name} <${raw}>`;
  }
  return raw;
}

function passwordResetEmailHtml(appName: string, resetUrl: string): string {
  const safeName = escapeHtml(appName);
  const safeUrl = escapeHtml(resetUrl);
  return `
<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8" /></head>
  <body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f4f4f5;color:#18181b;line-height:1.5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;padding:28px 24px;">
            <tr>
              <td>
                <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#18181b;">${safeName}</p>
                <p style="margin:0 0 20px;font-size:15px;color:#52525b;">Password reset</p>
                <p style="margin:0 0 20px;font-size:15px;color:#3f3f46;">
                  We received a request to reset the password for your account. This link expires in <strong>one hour</strong>.
                </p>
                <p style="margin:0 0 24px;">
                  <a href="${safeUrl}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:10px;">Reset your password</a>
                </p>
                <p style="margin:0 0 12px;font-size:13px;color:#71717a;">If the button does not work, copy and paste this URL into your browser:</p>
                <p style="margin:0;font-size:12px;word-break:break-all;color:#52525b;">${safeUrl}</p>
                <p style="margin:24px 0 0;font-size:13px;color:#a1a1aa;">
                  If you did not request this, you can ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();
}

function passwordResetEmailText(appName: string, resetUrl: string): string {
  return [
    `${appName} — password reset`,
    "",
    "We received a request to reset your password. Open the link below (expires in one hour):",
    "",
    resetUrl,
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");
}

export async function deliverPasswordResetLink(
  email: string,
  resetUrl: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = buildResendFromLine();
  const appName = appDisplayName();
  const subject =
    process.env.RESEND_PASSWORD_RESET_SUBJECT?.trim() ||
    `Reset your ${appName} password`;

  if (apiKey && from) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject,
        html: passwordResetEmailHtml(appName, resetUrl),
        text: passwordResetEmailText(appName, resetUrl),
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[password-reset] Resend API error", res.status, text);
    }
    return;
  }

  console.info("[password-reset] Reset link (configure RESEND_API_KEY + RESEND_FROM_EMAIL to email)", {
    to: email,
    url: resetUrl,
  });
}
