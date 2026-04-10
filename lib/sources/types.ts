/**
 * Represents a lightweight chapter item returned by a source adapter.
 */
export type SourceChapterSummary = {
  slug: string;
  title: string;
  url: string;
  chapterLabel?: string;
};

/**
 * Represents detailed chapter payload used by the reader page.
 */
export type SourceChapterDetail = {
  slug: string;
  title: string;
  url: string;
  imageUrls: string[];
};

/**
 * Defines the adapter contract implemented per scanlation source.
 */
export interface SourceAdapter {
  /**
   * Unique adapter key matching persisted `Source.key`.
   */
  readonly key: string;
  /**
   * Human-readable adapter display name.
   */
  readonly name: string;
  /**
   * Returns recent chapter summaries for a series.
   */
  listSeriesChapters(seriesSlug: string): Promise<SourceChapterSummary[]>;
  /**
   * Returns chapter details including reader image URLs.
   */
  getChapterDetail(
    seriesSlug: string,
    chapterSlug: string,
  ): Promise<SourceChapterDetail | null>;
}
