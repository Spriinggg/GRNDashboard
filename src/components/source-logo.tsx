"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// The logo of the system a file comes from (Zeoniq, Codemax, TreeAMS). Same rule as the channel logos: no background in light
// mode, a white tile in dark mode because the logos are drawn for a light page. Files are in `public/logos/`. If a file is
// missing the name is written instead, so the page never shows a broken image.
export function SourceLogo({ src, name, className }: { src: string; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // An image that failed before the page was interactive never fires onError again, so check once on mount.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);
  if (failed) return <span className={cn("inline-flex h-8 items-center text-sm font-semibold", className)}>{name}</span>;
  return (
    <span className={cn("inline-flex h-8 items-center rounded-md dark:bg-white dark:px-2", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={img} src={src} alt={name} onError={() => setFailed(true)} className="h-6 w-auto max-w-40 object-contain" />
    </span>
  );
}
