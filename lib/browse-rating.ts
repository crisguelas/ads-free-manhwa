/**
 * Derives a stable pseudo star rating from an id string so trending/sidebar cards show a number without remote scores.
 */
export function catalogPseudoRating(id: string): string {
  let n = 0;
  for (let i = 0; i < id.length; i += 1) {
    n = (n + id.charCodeAt(i) * (i + 3)) % 997;
  }
  const v = 8.4 + (n % 16) / 10;
  return v.toFixed(1);
}
