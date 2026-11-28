"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { reportError } from "@/lib/notify";

// Things that happen to the whole app and not to one button: losing the internet connection, and a failure nobody caught. Both
// tell the person what happened instead of leaving a page that quietly stops working.
export function SystemNotices() {
  useEffect(() => {
    const offline = () => toast.warning("You are offline", { id: "offline", duration: Infinity, description: "Changes will not be saved to Supabase until you are back online." });
    const online = () => {
      toast.dismiss("offline");
      toast.success("Back online", { id: "online", duration: 4000 });
    };
    // A promise that failed and had no one to handle it. A cancelled request is not a failure.
    const rejected = (e: PromiseRejectionEvent) => {
      const r = e.reason as { name?: string; message?: string } | undefined;
      if (r?.name === "AbortError" || /ResizeObserver/i.test(r?.message ?? "")) return;
      reportError(e.reason, { what: "complete that action" });
    };
    if (!navigator.onLine) offline();
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    window.addEventListener("unhandledrejection", rejected);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      window.removeEventListener("unhandledrejection", rejected);
    };
  }, []);
  return null;
}
