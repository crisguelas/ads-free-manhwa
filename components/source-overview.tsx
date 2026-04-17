import type { HomePageData } from "@/lib/home-data";
import { cardElevated } from "@/lib/ui-styles";

/**
 * Defines props for the source overview home sections.
 */
type SourceOverviewProps = {
  data: HomePageData;
};

const sectionTitle = "text-lg font-semibold tracking-tight text-zinc-900";
const sectionEyebrow = "mb-1 text-xs font-semibold uppercase tracking-wider text-indigo-600/90";
const listRow =
  "flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50/40 px-3.5 py-2.5 transition hover:border-zinc-200 hover:bg-white";

/**
 * Renders the source and reading overview cards on the home page.
 */
export function SourceOverview({ data }: SourceOverviewProps) {
  return (
    <div className="grid gap-6">
      <section className={`${cardElevated} flex flex-col`}>
        <div>
          <p className={sectionEyebrow}>Sources</p>
          <h2 className={sectionTitle}>Enabled connectors</h2>
          <p className="mt-1 text-sm text-zinc-500">Sites your reader can pull chapters from.</p>
        </div>
        <ul className="mt-5 space-y-2">
          {data.sources.map((source) => (
            <li key={source.id} className={listRow}>
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-900">{source.name}</p>
                <p className="truncate text-xs text-zinc-500">{source.baseUrl}</p>
              </div>
              <span
                className={
                  source.isEnabled
                    ? "shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800"
                    : "shrink-0 rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-semibold text-zinc-600"
                }
              >
                {source.isEnabled ? "Active" : "Off"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
