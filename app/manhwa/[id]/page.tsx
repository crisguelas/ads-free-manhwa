import { notFound } from "next/navigation";
import { PageSurface } from "@/components/layout/page-surface";
import { SeriesDetailView } from "@/components/series-detail-view";
import { getSeriesDetailData } from "@/lib/reader-data";

/**
 * Defines route params for the series detail page.
 */
type SeriesDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * Renders a mobile-first series detail screen: synopsis, actions, searchable chapter list.
 */
export default async function SeriesDetailPage({ params }: SeriesDetailPageProps) {
  const { id } = await params;
  const data = await getSeriesDetailData(id);

  if (!data) {
    notFound();
  }

  return (
    <PageSurface>
      <main className="flex flex-1 flex-col">
        <SeriesDetailView data={data} />
      </main>
    </PageSurface>
  );
}
