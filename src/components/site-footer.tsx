import Image from "next/image";
import Link from "next/link";

const columns = [
  {
    title: "Food control",
    links: [
      { label: "Dashboard", href: "/" },
      { label: "Food variance", href: "/variance" },
      { label: "Count & GRN", href: "/discipline" },
    ],
  },
  {
    title: "Network",
    links: [
      { label: "Outlets", href: "/outlets" },
      { label: "Upload data", href: "/upload" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-background/60">
      <div className="mx-auto grid w-full max-w-[1440px] gap-8 px-4 py-10 md:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))] md:px-6">
        <div className="max-w-xs">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.svg" alt="US Pizza" width={194} height={127} unoptimized className="h-8 w-auto" />
            <span className="font-display text-base font-bold">US Pizza Food Control</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Daily inventory and food cost variance for the 44 HQ outlets.</p>
          <p className="mt-3 text-sm text-muted-foreground">Variance is the counted stock minus what the system expects. Files are read in your browser.</p>
        </div>
        {columns.map((c) => (
          <div key={c.title}>
            <h2 className="text-sm font-semibold">{c.title}</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-foreground hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground md:px-6">
          <span>© 2026 US Pizza. Internal tool.</span>
          <span>Map data from OpenStreetMap. Outlet pins are approximate.</span>
        </div>
      </div>
    </footer>
  );
}
