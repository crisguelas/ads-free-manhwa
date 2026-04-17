import Link from "next/link";
import { CloudMark } from "@/components/brand/cloud-mark";

/**
 * Light-themed site footer with browse shortcuts; avoids third-party scan branding.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-zinc-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center gap-6 text-center">
          <Link href="/" className="flex items-center gap-2 text-zinc-900">
            <CloudMark className="h-10 w-10" />
            <span className="text-lg font-bold tracking-tight">Manhwa Cloud</span>
          </Link>
          <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-medium text-zinc-600">
            <Link href="/" className="transition hover:text-violet-700">
              Home
            </Link>

          </nav>
          <p className="text-xs text-zinc-400">© {new Date().getFullYear()} Manhwa Cloud</p>
        </div>
      </div>
    </footer>
  );
}
