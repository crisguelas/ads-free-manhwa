import { AsuraSourceAdapter } from "@/lib/sources/adapters/asura-source-adapter";
import { MockSourceAdapter } from "@/lib/sources/adapters/mock-source-adapter";
import type { SourceAdapter } from "@/lib/sources/types";

/**
 * Builds the default adapter registry for supported source keys.
 * To add a site: implement `SourceAdapter`, map `Source.key` here, and seed `Source` in Prisma.
 * See `lib/sources/README.md`.
 */
function createAdapterRegistry(): Map<string, SourceAdapter> {
  return new Map<string, SourceAdapter>([
    [
      "asura-scans",
      new AsuraSourceAdapter(),
    ],
    [
      "reaper-scans",
      new MockSourceAdapter("reaper-scans", "Reaper Scans Adapter"),
    ],
    [
      "flame-scans",
      new MockSourceAdapter("flame-scans", "Flame Scans Adapter"),
    ],
  ]);
}

/**
 * Stores adapter instances keyed by source key.
 */
const ADAPTER_REGISTRY = createAdapterRegistry();

/**
 * Returns a registered source adapter for a given key when available.
 */
export function getSourceAdapter(sourceKey: string): SourceAdapter | null {
  return ADAPTER_REGISTRY.get(sourceKey) ?? null;
}
