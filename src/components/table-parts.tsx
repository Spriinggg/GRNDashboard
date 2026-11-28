"use client";

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableHead } from "@/components/ui/table";
import { FilterSelect } from "@/components/filter-select";
import { PAGE_SIZES, type SortState } from "@/hooks/use-table-view";
import { cn } from "@/lib/utils";

// A column header that sorts the table. Click once for ascending, again for descending, a third time to go
// back to the original order. `aria-sort` tells a screen reader which column is sorted.
export function SortHead({
  label,
  node,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  // Shown instead of the words when a logo says the same thing. `label` stays as the accessible name.
  node?: React.ReactNode;
  sortKey: string;
  sort: SortState;
  onSort: (key: string) => void;
  className?: string;
}) {
  const dir = sort?.key === sortKey ? sort.dir : null;
  const Icon = dir === "asc" ? ArrowUp : dir === "desc" ? ArrowDown : ChevronsUpDown;
  return (
    <TableHead aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"} className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}`}
        className="-mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-1 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        {node ?? label}
        {/* Always the full text colour (black in light mode), so the sort buttons are easy to see */}
        <Icon aria-hidden className="size-4 text-foreground" strokeWidth={dir ? 2.5 : 2} />
      </button>
    </TableHead>
  );
}

type PageInfo = {
  total: number;
  page: number;
  pageCount: number;
  size: number;
  from: number;
  to: number;
  setPage: (page: number) => void;
  setSize: (size: number) => void;
};

// The footer of a table or list: which rows are shown, how many rows per page, and the previous and next
// buttons. The controls are always there so a person can see the table is paged. With one page of rows the
// previous and next buttons are greyed out. `note` is for a caveat that really matters, for example how
// lateness is measured.
export function TablePagination({
  view,
  noun,
  note,
  bare = false,
  sizes = true,
}: {
  view: PageInfo;
  noun: string;
  note?: string;
  // For a table inside a padded card (a dashboard widget): no border and no side padding.
  bare?: boolean;
  // Set to false when the page size is fixed and a person cannot change it.
  sizes?: boolean;
}) {
  const paged = view.total > 0;
  return (
    <nav
      aria-label={`${noun}, pages`}
      className={cn(
        "flex flex-col gap-3 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between",
        bare ? "pt-3" : "border-t px-4 py-3",
      )}
    >
      <div className="min-w-0 md:flex-1">
        <p aria-live="polite" className="tabular-nums">
          {view.total === 0 ? `No ${noun}` : `Showing ${view.from} to ${view.to} of ${view.total} ${noun}`}
        </p>
        {note ? <p>{note}</p> : null}
      </div>
      {paged ? (
        <div className="flex flex-wrap items-center gap-3 md:shrink-0 md:flex-nowrap md:justify-end">
          {sizes ? (
            <FilterSelect
              label="Rows"
              value={String(view.size)}
              onChange={(v) => view.setSize(Number(v))}
              options={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
            />
          ) : null}
          <span className="tabular-nums">
            Page {view.page} of {view.pageCount}
          </span>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" disabled={view.page <= 1} onClick={() => view.setPage(view.page - 1)}>
              <ChevronLeft aria-hidden /> Previous
            </Button>
            <Button variant="outline" size="sm" disabled={view.page >= view.pageCount} onClick={() => view.setPage(view.page + 1)}>
              Next <ChevronRight aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}
    </nav>
  );
}
