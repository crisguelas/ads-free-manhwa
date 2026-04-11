import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { PageSurface } from "@/components/layout/page-surface";
import { textLink } from "@/lib/ui-styles";

/**
 * Request a password reset email (or console log when email is not configured).
 */
export default function ForgotPasswordPage() {
  return (
    <PageSurface variant="auth">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-14 sm:px-8">
        <ForgotPasswordForm />
        <p className="mt-8 text-center text-sm text-zinc-500">
          <Link href="/" className={textLink}>
            ← Back to home
          </Link>
        </p>
      </main>
    </PageSurface>
  );
}
