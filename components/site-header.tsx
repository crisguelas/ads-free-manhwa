import Link from "next/link";
import { CloudMark } from "@/components/brand/cloud-mark";
import { SiteHeaderSearchShell } from "@/components/site-header-search-shell";

/**
 * Top bar: Home, Browse, and search (violet accent).
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 shrink-0 border-b border-zinc-200/90 bg-white/95 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-md backdrop-saturate-150">
      <div className="h-1 w-full bg-gradient-to-r from-violet-600 via-violet-500 to-amber-400" aria-hidden />
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2 rounded-lg text-zinc-900 outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-violet-500/80 focus-visible:ring-offset-2"
        >
          <CloudMark className="h-9 w-9 shrink-0 transition duration-200 ease-out group-hover:scale-[1.04]" />
          <span className="text-sm font-bold tracking-tight transition group-hover:text-violet-900 sm:text-base">
            Manhwa Cloud
          </span>
        </Link>

        <nav className="order-last flex w-full items-center gap-1 sm:order-none sm:flex-1 sm:justify-center md:w-auto lg:justify-start lg:pl-4">
          <Link
            href="/"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-800 outline-none transition-[opacity,colors,transform] duration-200 ease-out hover:bg-zinc-100/90 hover:text-violet-900 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-violet-400/50 focus-visible:ring-offset-2"
          >
            Home
          </Link>
          <Link
            href="/browse"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-700 outline-none transition-[opacity,colors,transform] duration-200 ease-out hover:bg-zinc-100/90 hover:text-zinc-900 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-violet-400/50 focus-visible:ring-offset-2"
          >
            Browse
          </Link>
        </nav>

        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-initial md:flex-1 lg:max-w-md">
          <SiteHeaderSearchShell />
        </div>
      </div>
    </header>
  );
}
