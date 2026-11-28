import { ArrowLeft, Compass } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Shown for any address that does not exist (404). It sits inside the normal layout, so the menu is still there.
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <Compass aria-hidden className="size-10 text-muted-foreground" />
      <div>
        <p className="font-display text-5xl font-bold tabular-nums">404</p>
        <h1 className="mt-2 text-xl font-semibold">We could not find that page</h1>
        <p className="mt-1 text-sm text-muted-foreground">The address may be wrong, or the page was moved or removed. Nothing you did caused this, and no data was lost.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button nativeButton={false} render={<Link href="/" />}>
          Go to the Dashboard
        </Button>
        <Button nativeButton={false} variant="outline" render={<Link href="/upload" />}>
          <ArrowLeft aria-hidden /> Upload data
        </Button>
      </div>
    </div>
  );
}
