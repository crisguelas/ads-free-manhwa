import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { PageSurface } from "@/components/layout/page-surface";
import { getSessionUser } from "@/lib/auth/current-user";
import { sanitizeRedirectPath } from "@/lib/auth/safe-redirect";
import { textLink } from "@/lib/ui-styles";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

/**
 * Login screen; redirects home when a session already exists.
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getSessionUser();
  if (user) {
    redirect("/");
  }
  const sp = await searchParams;
  const next = sanitizeRedirectPath(sp.next);

  return (
    <PageSurface variant="auth">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-14 sm:px-8">
        <LoginForm redirectTo={next} />
        <p className="mt-8 text-center text-sm text-zinc-500">
          <Link href="/" className={textLink}>
            ← Back to home
          </Link>
        </p>
      </main>
    </PageSurface>
  );
}
