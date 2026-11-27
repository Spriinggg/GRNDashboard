"use client";

import { ClipboardCheck, LayoutDashboard, MapPin, Scale, Upload } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useData } from "@/components/data-provider";
import { statusOf } from "@/lib/calc";

type Item = { label: string; icon: LucideIcon; href: string; badge?: number };
type Group = { label?: string; items: Item[] };

export function AppSidebar() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const { cur } = useData();
  const flagged = cur?.items ? cur.items.filter((i) => statusOf(i)[0] !== "good").length : 0;
  const groups: Group[] = [
    { items: [{ label: "Dashboard", icon: LayoutDashboard, href: "/" }] },
    {
      label: "Food control",
      items: [
        { label: "Food variance", icon: Scale, href: "/variance", badge: flagged || undefined },
        { label: "Count & GRN", icon: ClipboardCheck, href: "/discipline" },
      ],
    },
    { label: "Network", items: [{ label: "Outlets", icon: MapPin, href: "/outlets" }] },
    { label: "Data", items: [{ label: "Upload data", icon: Upload, href: "/upload" }] },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex h-14 items-center gap-3 px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <Image src="/logo.svg" alt="US Pizza" width={194} height={127} priority unoptimized className="h-11 w-auto shrink-0 group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:w-12" />
          <div className="leading-tight group-data-[collapsible=icon]:hidden">
            <p className="font-display text-lg font-bold">US Pizza</p>
            <p className="text-xs text-muted-foreground">Food Control</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((g, gi) => (
          <SidebarGroup key={g.label ?? gi}>
            {g.label ? <SidebarGroupLabel>{g.label}</SidebarGroupLabel> : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => {
                  const Icon = item.icon;
                  const current = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        isActive={current}
                        aria-current={current ? "page" : undefined}
                        tooltip={item.label}
                        render={<Link href={item.href} onClick={() => setOpenMobile(false)} />}
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
