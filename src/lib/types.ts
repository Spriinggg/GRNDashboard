export type Item = { code: string; name: string; cat: string; sys: number; uom: string; phys: number; varq: number; varrm: number };
export type MvEvent = { t: string; in: number; out: number; r: string };
export type Mv = { code: string; name: string; in: number; outPos: number; cost: number; events: MvEvent[] };
export type Sales = { pizzas: number; units: number; net: number };
export type Day = {
  ok: string;
  outlet: string;
  date: string;
  items: Item[] | null;
  counts: Record<string, { doc: string; items: Item[] }>;
  sales: Sales | null;
  mv: Record<string, Mv> | null;
  sample: boolean;
  nCounts?: number;
  openDoc?: string;
  closeDoc?: string;
  sum?: { sales: number; ideal: number; actual: number };
};
export type Store = Record<string, Day>;
export type Kind = 'sales' | 'stockcount' | 'movement' | 'grn';
export type CloudState = 'off' | 'synced' | 'saved' | 'loading' | 'error';
export type Money =
  | { ok: false }
  | { ok: true; sales: number; ideal: number; actual: number; variance: number; actPct: number; idealPct: number; varPct: number };
export type StatusCode = 'crit' | 'warn' | 'good' | 'info';
