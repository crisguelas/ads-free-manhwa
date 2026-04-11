/**
 * Parses Asura’s series detail HTML for the purple “format” pill (manhwa / manga / manhua / …).
 * Browse cards do not include this field, so catalog filtering may fetch `/comics/{slug}` once per title.
 */

/**
 * Reads the primary format label from an Asura `/comics/{slug}` HTML response.
 * Anchors on the hero badge (purple dot + uppercase pill); falls back to the first known format keyword.
 */
export function extractAsuraComicFormatFromSeriesHtml(html: string): string | null {
  const anchored = html.match(
    /bg-\[#913FE2\][\s\S]{0,240}?uppercase">\s*([^<]+?)\s*</i,
  );
  if (anchored?.[1]) {
    const label = anchored[1].trim();
    if (label.length > 0) {
      return label;
    }
  }
  const keyword = html.match(
    /uppercase">\s*(manhwa|manga|manhua|comic|novel|webtoon|cartoon)\s*</i,
  );
  return keyword?.[1]?.trim() ?? null;
}
