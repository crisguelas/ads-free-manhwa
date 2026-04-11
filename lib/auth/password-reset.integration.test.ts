import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { completePasswordReset } from "@/lib/auth/password-reset";
import { generateResetTokenRaw, hashResetToken } from "@/lib/auth/reset-token";

const hasDb = Boolean(process.env.DATABASE_URL);

/**
 * End-to-end reset against a real DB when DATABASE_URL is set (skipped in CI without DB).
 */
test(
  "completePasswordReset updates password when token row exists",
  { skip: !hasDb },
  async () => {
    const email = `reset-test-${Date.now()}@manhwa.test`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashPassword("old-password-123"),
      },
      select: { id: true },
    });

    const raw = generateResetTokenRaw();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashResetToken(raw),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    try {
      const good = await completePasswordReset(raw, "new-password-456");
      assert.equal(good.ok, true);

      const updated = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { passwordHash: true },
      });
      assert.ok(verifyPassword("new-password-456", updated.passwordHash));
      assert.ok(!verifyPassword("old-password-123", updated.passwordHash));

      const tokens = await prisma.passwordResetToken.count({
        where: { userId: user.id },
      });
      assert.equal(tokens, 0);

      const replay = await completePasswordReset(raw, "other-password-789");
      assert.equal(replay.ok, false);
    } finally {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
  },
);
