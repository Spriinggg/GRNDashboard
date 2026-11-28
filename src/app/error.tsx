"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { describeError } from "@/lib/notify";

// Shown when a page breaks while it is drawing. The menu stays, so the person can go somewhere else, and nothing is lost: the
// data is in Supabase and in the other pages. "Try again" draws the page once more.
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("page error", error);
  }, [error]);
  const f = describeError(error, "show this page");
  return (
    <div role="alert" className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <TriangleAlert aria-hidden className="size-10 text-warning" />
      <div>
        <h1 className="text-xl font-semibold">This page ran into a problem</h1>
        <p className="mt-1 text-sm text-muted-foreground">{f.text} Your data is safe.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button nativeButton={false} variant="outline" render={<Link href="/" />}>
          Go to the Dashboard
        </Button>
      </div>
      <details className="w-full max-w-md rounded-lg border bg-card px-3 py-2 text-left text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">Technical details</summary>
        <p className="mt-2 break-words">{f.detail}</p>
        {error.digest ? <p className="mt-1">Reference {error.digest}</p> : null}
      </details>
    </div>
  );
}
