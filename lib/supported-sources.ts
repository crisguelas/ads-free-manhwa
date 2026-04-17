/**
 * Source keys currently supported by UI and runtime flows.
 */
export const SUPPORTED_SOURCE_KEYS = ["asura-scans"] as const;

/**
 * Union type for supported source keys.
 */
export type SupportedSourceKey = (typeof SUPPORTED_SOURCE_KEYS)[number];

/**
 * Runtime guard for source-key filtering.
 */
export function isSupportedSourceKey(value: string): value is SupportedSourceKey {
  return (SUPPORTED_SOURCE_KEYS as readonly string[]).includes(value);
}
