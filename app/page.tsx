import { SourceOverview } from "@/components/source-overview";
import { getHomePageData } from "@/lib/home-data";

/**
 * Renders the home page with live database-backed overview data.
 */
export default async function Home() {
  const data = await getHomePageData();

  return (
    <div className="flex flex-col flex-1 bg-zinc-50">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-5 py-10 sm:px-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            Personal Manhwa Reader
          </h1>
          <p className="text-sm text-zinc-600">
            Scraper-first architecture: source targets can be finalized later.
            Current view is driven by seeded Prisma data in Neon.
          </p>
        </header>
        <SourceOverview data={data} />
      </main>
    </div>
  );
}
