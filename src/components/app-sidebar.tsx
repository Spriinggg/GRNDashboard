"use client";

import { BadgeDollarSign, CheckSquare, ChevronRight, ClipboardCheck, Clock, LayoutDashboard, MapPin, Scale, ShieldCheck, ShoppingBag, Upload } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useData } from "@/components/data-provider";
import { useAuth } from "@/components/auth-provider";
import { statusOf } from "@/lib/calc";

type Child = { label: string; href: string; icon?: LucideIcon };
type Item = { label: string; icon: LucideIcon; href: string; badge?: number; children?: Child[] };
type Group = { label?: string; items: Item[] };

export function AppSidebar() {
  const pathname = usePathname();
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const { setOpenMobile } = useSidebar();
  const { cur, requests } = useData();
  const { isAdmin } = useAuth();
  const flagged = cur?.items ? cur.items.filter((i) => statusOf(i)[0] !== "good").length : 0;
  const groups: Group[] = [
    { items: [{ label: "Dashboard", icon: LayoutDashboard, href: "/" }] },
    {
      label: "Sales & P&L",
      items: [
        {
          label: "Sales",
          icon: ShoppingBag,
          href: "/sales",
          children: [
            { label: "By outlet", href: "/sales/by-outlet" },
            { label: "By channel", href: "/sales/by-channel" },
          ],
        },
        { label: "Profit & loss", icon: BadgeDollarSign, href: "/pnl" },
      ],
    },
    {
      label: "Food control",
      items: [
        { label: "Food variance", icon: Scale, href: "/variance", badge: flagged || undefined },
        { label: "Count & GRN", icon: ClipboardCheck, href: "/discipline" },
        { label: "Labour vs sales", icon: Clock, href: "/labor" },
      ],
    },
    { label: "Operations", items: [{ label: "Treeams", icon: CheckSquare, href: "/treeams" }] },
    { label: "Network", items: [{ label: "Outlets", icon: MapPin, href: "/outlets" }] },
    {
      label: "Data",
      items: [
        { label: "Upload data", icon: Upload, href: "/upload" },
        ...(isAdmin ? [{ label: "Approvals", icon: ShieldCheck, href: "/approvals", badge: requests.length || undefined }] : []),
      ],
    },
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
                  if (item.children) {
                    const open = opened[item.label] ?? current;
                    const sub = item.children;
                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton isActive={current} tooltip={item.label} aria-expanded={open} onClick={() => setOpened((o) => ({ ...o, [item.label]: !open }))}>
                          <Icon />
                          <span>{item.label}</span>
                          <ChevronRight aria-hidden className={`ml-auto transition-transform ${open ? "rotate-90" : ""}`} />
                        </SidebarMenuButton>
                        {open ? (
                          <SidebarMenuSub>
                            {sub.map((c) => {
                              const on = c.href === item.href ? pathname === c.href : pathname.startsWith(c.href);
                              return (
                                <SidebarMenuSubItem key={c.href}>
                                  <SidebarMenuSubButton isActive={on} aria-current={on ? "page" : undefined} render={<Link href={c.href} onClick={() => setOpenMobile(false)} />}>
                                    <span>{c.label}</span>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        ) : null}
                      </SidebarMenuItem>
                    );
                  }
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
