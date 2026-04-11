/**
 * Simple cloud mark for the header — no external assets.
 */
export function CloudMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M8 20a4 4 0 0 1-.2-8 6 6 0 0 1 11.4-2.4A5 5 0 0 1 25 20H8Z"
        className="fill-orange-500/90"
      />
      <path
        d="M10 18a3 3 0 0 1-.15-6 4.5 4.5 0 0 1 8.55-1.8A3.8 3.8 0 0 1 22 18h-12Z"
        className="fill-amber-400/55"
      />
    </svg>
  );
}
