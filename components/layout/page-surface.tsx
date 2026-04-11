import type { ReactNode } from "react";

type PageSurfaceProps = {
  children: ReactNode;
  /** Stronger hero tint for centered auth flows */
  variant?: "default" | "auth";
};

/**
 * Soft gradient wash behind page content for a calm, modern baseline.
 */
export function PageSurface({ children, variant = "default" }: PageSurfaceProps) {
  const gradient =
    variant === "auth"
      ? "bg-[radial-gradient(ellipse_85%_55%_at_50%_-8%,rgba(234,88,12,0.08),transparent)]"
      : "bg-[radial-gradient(ellipse_90%_45%_at_50%_-12%,rgba(234,88,12,0.06),transparent)]";

  return (
    <div className="relative flex flex-1 flex-col bg-[var(--browse-canvas)]">
      <div className={`pointer-events-none absolute inset-0 ${gradient}`} aria-hidden />
      <div className="relative flex flex-1 flex-col">{children}</div>
    </div>
  );
}
