import Link from "next/link";
import type { SessionUser } from "@/lib/auth/current-user";
import { CloudMark } from "@/components/brand/cloud-mark";
import { LogoutButton } from "@/components/auth/logout-button";

type SiteHeaderProps = {
  user: SessionUser | null;
};

/**
 * Top bar with account actions; `user` comes from the verified session cookie.
 */
export function SiteHeader({ user }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 shrink-0 border-b border-zinc-200/90 bg-white/95 shadow-sm shadow-zinc-900/[0.03] backdrop-blur-md">
      <div
        className="h-0.5 w-full bg-gradient-to-r from-orange-500/90 via-amber-400/80 to-zinc-200/60"
        aria-hidden
      />
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <Link
          href="/"
          className="group flex items-center gap-2.5 rounded-lg text-zinc-900 outline-none transition hover:text-orange-800 focus-visible:ring-2 focus-visible:ring-orange-500/80 focus-visible:ring-offset-2"
        >
          <CloudMark className="h-8 w-8 shrink-0 transition group-hover:scale-[1.03]" />
          <span className="text-sm font-bold tracking-tight sm:text-base">Manhwa Cloud</span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/#browse"
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            Browse
          </Link>
          {user ? (
            <>
              <span className="hidden max-w-[14rem] truncate rounded-lg bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600 sm:inline">
                {user.email}
              </span>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900 sm:text-sm"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 sm:text-sm"
              >
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
