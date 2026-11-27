export type Item = { code: string; name: string; cat: string; sys: number; uom: string; phys: number; varq: number; varrm: number };
export type MvEvent = { t: string; in: number; out: number; r: string; u?: string };
export type Mv = { code: string; name: string; in: number; outPos: number; cost: number; events: MvEvent[] };
export type Sales = { pizzas: number; units: number; net: number };
export type GrnItem = { code: string; desc: string; qty: number; uom: string };
export type Grn = { no: string; storage: string; date: string; items: GrnItem[] };
export type Channels = { shopee?: number; grab?: number; panda?: number; app?: number; appOrders?: number; walkin?: number };
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
  grns?: Grn[];
  channels?: Channels;
  files?: string[];
  upAt?: string;
  upBy?: string;
};
export type Checklist = Record<string, Record<string, { done: number; exp: number }>>;
export type Role = 'admin' | 'user';
export type DeleteRequest = { id: string; dataset_id: string; outlet?: string; date?: string; requester_email?: string };
export type GrnCheckItem = GrnItem & { status: 'miss' | 'exact' | 'diff'; inq?: number; inuom?: string };
export type GrnCheck = { no: string; items: GrnCheckItem[]; rec: number; total: number; miss: number };
export type Store = Record<string, Day>;
export type Kind = 'sales' | 'stockcount' | 'movement' | 'grn' | 'checklist' | 'channels';
export type CloudState = 'off' | 'synced' | 'saved' | 'loading' | 'error';
export type Money =
  | { ok: false }
  | { ok: true; sales: number; ideal: number; actual: number; variance: number; actPct: number; idealPct: number; varPct: number };
export type StatusCode = 'crit' | 'warn' | 'good' | 'info';
