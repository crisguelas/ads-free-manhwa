import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { PageSurface } from "@/components/layout/page-surface";
import { getSessionUser } from "@/lib/auth/current-user";
import { textLink } from "@/lib/ui-styles";

/**
 * Registration screen; redirects home when already signed in.
 */
export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) {
    redirect("/");
  }

  return (
    <PageSurface variant="auth">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-14 sm:px-8">
        <RegisterForm />
        <p className="mt-8 text-center text-sm text-zinc-500">
          <Link href="/" className={textLink}>
            ← Back to home
          </Link>
        </p>
      </main>
    </PageSurface>
  );
}
