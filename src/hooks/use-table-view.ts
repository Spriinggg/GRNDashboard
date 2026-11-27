"use client";

import { useState } from "react";

// Sorting and paging for a table or list. Give it the rows that are left after search and filters.
// It returns only the rows of the current page, plus what the header buttons and the footer need.
//
//   const view = useTableView(filtered, { resetKey: `${tab}|${outlet}|${q}`, sorts: { amount: (r) => r.total } });
//   view.rows.map(...)   <SortHead sortKey="amount" ... />   <TablePagination view={view} noun="requests" />
//
// The page goes back to 1 whenever `resetKey` or the sort changes, so a person never lands on an empty page.

export const PAGE_SIZES = [10, 25, 50] as const;

export type SortDir = "asc" | "desc";
export type SortState = { key: string; dir: SortDir } | null;
export type SortValue = string | number;

export type TableView<T> = {
  rows: T[]; // the rows on the current page
  total: number; // rows after search and filters, over all pages
  sort: SortState;
  toggleSort: (key: string) => void; // none, then ascending, then descending, then none again
  setSort: (sort: SortState) => void;
  page: number;
  pageCount: number;
  size: number;
  from: number; // number of the first row on this page, 0 when there are no rows
  to: number;
  setPage: (page: number) => void;
  setSize: (size: number) => void;
};

export function useTableView<T>(
  rows: T[],
  options: { sorts?: Record<string, (row: T) => SortValue>; resetKey?: string; pageSize?: number } = {},
): TableView<T> {
  const { sorts = {}, resetKey = "", pageSize = PAGE_SIZES[0] } = options;
  const [sort, setSort] = useState<SortState>(null);
  const [paging, setPaging] = useState({ key: "", page: 1, size: pageSize });

  const key = `${resetKey}|${sort ? `${sort.key}:${sort.dir}` : ""}`;
  const size = paging.size;

  // Without a sort the rows keep the order they came in. Equal values also keep their order.
  const accessor = sort ? sorts[sort.key] : undefined;
  const ordered =
    sort && accessor
      ? rows
          .map((row, index) => ({ row, index, value: accessor(row) }))
          .sort((a, b) => {
            const c =
              typeof a.value === "number" && typeof b.value === "number"
                ? a.value - b.value
                : String(a.value).localeCompare(String(b.value), "en", { numeric: true });
            return c !== 0 ? (sort.dir === "asc" ? c : -c) : a.index - b.index;
          })
          .map((x) => x.row)
      : rows;

  const total = ordered.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const page = Math.min(paging.key === key ? paging.page : 1, pageCount);
  const start = (page - 1) * size;

  return {
    rows: ordered.slice(start, start + size),
    total,
    sort,
    toggleSort: (k) => setSort((s) => (!s || s.key !== k ? { key: k, dir: "asc" } : s.dir === "asc" ? { key: k, dir: "desc" } : null)),
    setSort,
    page,
    pageCount,
    size,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + size, total),
    setPage: (p) => setPaging((s) => ({ ...s, key, page: p })),
    setSize: (n) => setPaging({ key, page: 1, size: n }),
  };
}
