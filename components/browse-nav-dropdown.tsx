"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BROWSE_SOURCE_KEYS, BROWSE_SOURCE_LABELS } from "@/lib/browse-constants";

/** Milliseconds before closing after pointer leaves (crossing the trigger–panel gap). */
const HOVER_CLOSE_DELAY_MS = 140;

/**
 * Subscribes to `(hover: hover)` so touch-first devices use tap-to-toggle while fine pointers use hover open.
 */
function subscribeHoverCapability(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }
  const mq = window.matchMedia("(hover: hover)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

/**
 * Returns whether the primary input supports true hover (desktop mouse); SSR snapshot is false (mobile-first).
 */
function getHoverHoverSnapshot(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;
}

/**
 * Header “Browse” submenu: opens on hover for hover-capable pointers, tap-to-toggle otherwise; fades in/out; closes when focus leaves the control.
 */
export function BrowseNavDropdown() {
  const prefersHover = useSyncExternalStore(subscribeHoverCapability, getHoverHoverSnapshot, () => false);
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openMenu = useCallback(() => {
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer]);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        if (prefersHover) {
          openMenu();
        }
      }}
      onMouseLeave={() => {
        if (prefersHover) {
          scheduleClose();
        }
      }}
      onFocusCapture={() => openMenu()}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          scheduleClose();
        }
      }}
    >
      <button
        type="button"
        className="flex cursor-pointer items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-zinc-700 outline-none transition-[opacity,colors,transform] duration-200 ease-out hover:bg-zinc-100/90 hover:text-zinc-900 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-violet-400/50 focus-visible:ring-offset-2"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          if (!prefersHover) {
            setOpen((value) => !value);
          }
        }}
      >
        Browse
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-zinc-400 transition duration-200 ease-out ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`absolute left-0 top-full z-50 min-w-[13rem] pt-1 transition-[opacity,transform] duration-200 ease-out ${
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0"
        }`}
        role="menu"
        aria-hidden={!open}
      >
        <div className="rounded-xl border border-zinc-200/90 bg-white/98 py-1 shadow-lg shadow-zinc-900/12 ring-1 ring-zinc-900/[0.04] backdrop-blur-sm">
          {BROWSE_SOURCE_KEYS.map((key) => (
            <Link
              key={key}
              href={`/browse/${key}`}
              className="block px-4 py-2.5 text-sm text-zinc-700 transition-colors duration-150 hover:bg-violet-50 hover:text-violet-900 active:bg-violet-100/80"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              {BROWSE_SOURCE_LABELS[key]}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
