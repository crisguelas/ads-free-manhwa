/**
 * Decodes common HTML entities in strings scraped from source HTML attributes, `<title>`, or JSON fields.
 * Handles named entities, decimal `&#NNN;`, and hex `&#xNN;` forms (e.g. `&#x27;` → apostrophe) after normalizing `&amp;` first.
 */
export function decodeBasicHtmlEntities(raw: string): string {
  if (!raw) {
    return raw;
  }
  let out = raw
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
  out = out.replace(/&#x([0-9a-f]{1,6});/gi, (full, hex) => {
    const code = parseInt(hex, 16);
    if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) {
      return full;
    }
    try {
      return String.fromCodePoint(code);
    } catch {
      return full;
    }
  });
  out = out.replace(/&#(\d{1,7});/g, (full, dec) => {
    const code = parseInt(dec, 10);
    if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) {
      return full;
    }
    try {
      return String.fromCodePoint(code);
    } catch {
      return full;
    }
  });
  return out;
}
