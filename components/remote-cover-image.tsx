"use client";

import { useState } from "react";

type RemoteCoverImageProps = {
  /** Remote URL; null shows placeholder immediately. */
  src: string | null;
  alt: string;
  className?: string;
  /** Poster cards use a 3:4 tile; thumbs fill a fixed box from the parent. */
  variant: "poster" | "thumb";
};

/**
 * Hotlinked catalog cover with a graceful fallback when the CDN returns 404 or blocks the request.
 */
export function RemoteCoverImage({
  src,
  alt,
  className = "",
  variant,
}: RemoteCoverImageProps) {
  const [broken, setBroken] = useState(false);
  const showPlaceholder = !src || broken;

  if (showPlaceholder && variant === "poster") {
    return (
      <div
        className={`flex aspect-[3/4] w-full items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50/80 text-center text-[10px] font-medium text-zinc-400 ${className}`}
      >
        No cover
      </div>
    );
  }

  if (showPlaceholder && variant === "thumb") {
    return <div className={`bg-zinc-100 ${className}`} />;
  }

  const url = src as string;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote CDN; onError handled in-app
    <img
      src={url}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      className={
        variant === "poster"
          ? `aspect-[3/4] w-full rounded-lg object-cover ${className}`
          : `object-cover ${className}`
      }
      onError={() => setBroken(true)}
    />
  );
}
