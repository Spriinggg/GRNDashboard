import type { Metadata } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "./outlet-map.css";
import { AuthProvider } from "@/components/auth-provider";
import { AppSidebar } from "@/components/app-sidebar";
import { DataProvider } from "@/components/data-provider";
import { ItemSheet } from "@/components/item-sheet";
import { SiteFooter } from "@/components/site-footer";
import { ThemeProvider } from "@/components/theme-provider";
import { TopBar } from "@/components/top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

const sans = Plus_Jakarta_Sans({ variable: "--font-sans", subsets: ["latin"] });
// A warmer display face for page titles. Everything else stays in Plus Jakarta Sans.
const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "US Pizza Food Control",
  description: "Daily inventory and food cost variance for US Pizza outlets.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
          <DataProvider>
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset className="min-w-0 bg-gradient-to-b from-primary/[0.07] to-background to-[420px]">
                <TopBar />
                <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 px-4 py-5 md:px-6">{children}</main>
                <SiteFooter />
              </SidebarInset>
            </SidebarProvider>
            <ItemSheet />
          </DataProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
