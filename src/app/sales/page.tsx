import { redirect } from "next/navigation";

// Sales is a group of pages in the sidebar. The old single Sales page is now Sales by channel.
export default function Sales() {
  redirect("/sales/by-outlet");
}
