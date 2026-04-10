import type {
  SourceAdapter,
  SourceChapterDetail,
  SourceChapterSummary,
} from "@/lib/sources/types";

/**
 * Provides a safe placeholder adapter until real scraping logic is selected.
 */
export class MockSourceAdapter implements SourceAdapter {
  /**
   * Stores adapter key for registry lookup.
   */
  public readonly key: string;

  /**
   * Stores adapter display name for UI/debug visibility.
   */
  public readonly name: string;

  /**
   * Constructs the adapter with a source key and display name.
   */
  public constructor(key: string, name: string) {
    this.key = key;
    this.name = name;
  }

  /**
   * Returns no chapters until concrete scraper implementation is added.
   */
  public async listSeriesChapters(
    _seriesSlug: string,
  ): Promise<SourceChapterSummary[]> {
    void _seriesSlug;
    return [];
  }

  /**
   * Returns no chapter detail until concrete scraper implementation is added.
   */
  public async getChapterDetail(
    _seriesSlug: string,
    _chapterSlug: string,
  ): Promise<SourceChapterDetail | null> {
    void _seriesSlug;
    void _chapterSlug;
    return null;
  }
}
