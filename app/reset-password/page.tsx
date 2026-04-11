import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { PageSurface } from "@/components/layout/page-surface";
import { isValidResetTokenFormat } from "@/lib/auth/reset-token";
import { cardElevated, textLink } from "@/lib/ui-styles";

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string }>;
};

/**
 * Completes password reset when opened from the link containing `?token=`.
 */
export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const sp = await searchParams;
  const raw = typeof sp.token === "string" ? sp.token.trim() : "";
  const valid = isValidResetTokenFormat(raw);

  return (
    <PageSurface variant="auth">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-14 sm:px-8">
        {valid ? (
          <ResetPasswordForm token={raw} />
        ) : (
          <div className={`${cardElevated} mx-auto w-full max-w-sm text-center`}>
            <p className="text-sm leading-relaxed text-zinc-600">
              This reset link is missing or no longer valid. Request a new one to continue.
            </p>
            <Link href="/forgot-password" className={`${textLink} mt-5 inline-block`}>
              Forgot password
            </Link>
          </div>
        )}
        <p className="mt-8 text-center text-sm text-zinc-500">
          <Link href="/" className={textLink}>
            ← Back to home
          </Link>
        </p>
      </main>
    </PageSurface>
  );
}
