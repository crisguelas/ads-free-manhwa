import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { deliverPasswordResetLink } from "@/lib/auth/deliver-password-reset";
import {
  generateResetTokenRaw,
  hashResetToken,
  isValidResetTokenFormat,
} from "@/lib/auth/reset-token";

const RESET_TTL_MS = 1000 * 60 * 60;
const MIN_PASSWORD_LEN = 8;

/**
 * Creates a one-hour reset token for the user, replaces any pending tokens, and delivers the link.
 */
export async function requestPasswordReset(
  emailNormalized: string,
  resetPageBaseUrl: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: emailNormalized },
    select: { id: true },
  });
  if (!user) {
    return;
  }

  const raw = generateResetTokenRaw();
  const tokenHash = hashResetToken(raw);

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    }),
  ]);

  const resetUrl = `${resetPageBaseUrl}/reset-password?token=${encodeURIComponent(raw)}`;
  await deliverPasswordResetLink(emailNormalized, resetUrl);
}

/**
 * Validates token and password, updates the user password, and clears all reset rows for that user.
 */
export async function completePasswordReset(
  rawToken: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isValidResetTokenFormat(rawToken)) {
    return { ok: false, message: "Invalid or expired reset link." };
  }
  if (newPassword.length < MIN_PASSWORD_LEN) {
    return {
      ok: false,
      message: `Password must be at least ${MIN_PASSWORD_LEN} characters.`,
    };
  }

  const tokenHash = hashResetToken(rawToken);
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
    return { ok: false, message: "Invalid or expired reset link." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash: hashPassword(newPassword) },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { userId: row.userId },
    }),
  ]);

  return { ok: true };
}
