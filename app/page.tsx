import { HomeBrowse } from "@/components/home-browse";
import { getHomePageData } from "@/lib/home-data";

type HomePageProps = {
  searchParams?: Promise<{ source?: string }>;
};

/**
 * Renders the home page with scan-style browse UI; `?source=asura-scans` or `flame-scans` filters the catalog.
 */
export default async function Home({ searchParams }: HomePageProps) {
  const data = await getHomePageData();
  const sp = searchParams ? await searchParams : {};
  const sourceFilter =
    typeof sp.source === "string" && sp.source.length > 0 ? sp.source : null;

  return <HomeBrowse data={data} sourceFilter={sourceFilter} />;
}
