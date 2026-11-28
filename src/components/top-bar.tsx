"use client";

import { usePathname } from "next/navigation";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AlertsMenu } from "@/components/alerts-menu";
import { CloudStatus } from "@/components/cloud-status";
import { UserMenu } from "@/components/user-menu";
import { useData } from "@/components/data-provider";
import { ScopeBar } from "@/components/page-header";

const titles: Record<string, string> = { "/": "Dashboard", "/variance": "Food variance", "/variance/day": "Food variance, one day", "/discipline": "Count & GRN", "/outlets": "Outlets", "/upload": "Upload data", "/sales/by-outlet": "Sales by outlet", "/sales/by-channel": "Sales by channel", "/pnl": "Profit & loss", "/labor": "Labour vs sales", "/treeams": "Treeams", "/approvals": "Approvals" };

export function TopBar() {
  const pathname = usePathname();
  const { cur } = useData();
  const showScope = ["/discipline", "/variance/day"].some((p) => pathname.startsWith(p));
  const title = titles[pathname] ?? "US Pizza";
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-1 data-vertical:h-4 data-vertical:self-center" />
      <Breadcrumb className={showScope ? "hidden xl:block" : undefined}>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden sm:block">US Pizza</BreadcrumbItem>
          <BreadcrumbSeparator className="hidden sm:block" />
          <BreadcrumbItem>
            <BreadcrumbPage>{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {showScope ? (
        <>
          <Separator orientation="vertical" className="mx-1 hidden data-vertical:h-4 data-vertical:self-center xl:block" />
          <div className="min-w-0 flex-1 md:flex-none"><ScopeBar /></div>
        </>
      ) : null}

      <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-3">
        {cur?.sample ? (
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground xl:inline-flex" title="This day is sample data">
            <span aria-hidden className="size-1.5 rounded-full bg-warning" />
            Sample data
          </span>
        ) : null}
        <CloudStatus />
        <AlertsMenu />
        <UserMenu />
      </div>
    </header>
  );
}
