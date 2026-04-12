import { HomeBrowse } from "@/components/home-browse";
import { getHomePageData } from "@/lib/home-data";

export const dynamic = "force-dynamic";

/**
 * Renders the home dashboard with live Asura/Flame latest sections; full grids live under `/browse/[sourceKey]`.
 */
export default async function Home() {
  const data = await getHomePageData();

  return (
    <main className="flex flex-1 flex-col">
      <HomeBrowse data={data} />
    </main>
  );
}
