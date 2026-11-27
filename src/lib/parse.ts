import * as XLSX from 'xlsx';
import type { Day, Item, Store } from './types';
import { S, num, norm, clean, titl } from './calc';

type Row = unknown[];
const docNum = (d: string) => {
  const m = S(d).match(/(\d+)\s*$/);
  return m ? parseInt(m[1]) : 0;
};

export function dateOf(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'number') {
    const o = XLSX.SSF.parse_date_code(v);
    if (o) return String(o.d).padStart(2, '0') + '/' + String(o.m).padStart(2, '0') + '/' + o.y;
  }
  return S(v).split(' ')[0];
}
export function timeOf(v: unknown): string {
  if (typeof v === 'number') {
    const o = XLSX.SSF.parse_date_code(v);
    if (o) {
      let h = o.H;
      const ap = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return h + ':' + String(o.M).padStart(2, '0') + ' ' + ap;
    }
  }
  return S(v).split(' ').slice(1).join(' ');
}

export const rowsOf = (wb: XLSX.WorkBook): Row[] =>
  XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null }) as Row[];

export function detect(wb: XLSX.WorkBook): 'movement' | 'stockcount' | 'sales' | null {
  const first = wb.SheetNames[0] || '';
  if (/MVMT|MOVEMENT/i.test(first)) return 'movement';
  const R = rowsOf(wb);
  for (const row of R.slice(0, 16)) {
    const j = (row || []).map(S).join(' ');
    if (/Movement Date/i.test(j)) return 'movement';
    if (/Document No\./i.test(j) || /Stock Count/i.test(j)) return 'stockcount';
    if (/Product Sales/i.test(j)) return 'sales';
  }
  return null;
}

export function ensure(store: Store, key: string, disp: unknown, date: string): Day {
  if (!store[key]) store[key] = { ok: norm(disp), outlet: clean(disp), date, items: null, counts: {}, sales: null, mv: null, sample: false };
  return store[key];
}

/* Each ingest function mutates the draft store and returns the keys it touched. */
export function ingestCount(store: Store, R: Row[]): string[] {
  const meta: { doc?: string; date?: string; branch?: string } = {};
  let hi = -1;
  for (let i = 0; i < R.length; i++) {
    const k = S(R[i][0]);
    if (k === 'Document No.') meta.doc = S(R[i][1]);
    else if (k === 'Document Date') meta.date = dateOf(R[i][1]);
    else if (k === 'Branch Name') meta.branch = S(R[i][1]);
    else if (k === 'No.') { hi = i; break; }
  }
  if (!meta.branch || hi < 0) return [];
  const items: Item[] = [];
  for (let i = hi + 1; i < R.length; i++) {
    const code = S(R[i][1]);
    if (!code.startsWith('USRW')) continue;
    items.push({ code, name: titl(R[i][2]), cat: S(R[i][3]), sys: num(R[i][5]), uom: S(R[i][6]), phys: num(R[i][7]), varq: num(R[i][10]), varrm: num(R[i][13]) });
  }
  const date = meta.date || '';
  const key = norm(meta.branch) + '|' + date;
  const d = ensure(store, key, meta.branch, date);
  d.counts[meta.doc || ''] = { doc: meta.doc || '', items };
  const sorted = Object.values(d.counts).sort((a, b) => docNum(a.doc) - docNum(b.doc));
  d.items = sorted[sorted.length - 1].items;
  d.openDoc = sorted[0].doc;
  d.closeDoc = sorted[sorted.length - 1].doc;
  d.nCounts = sorted.length;
  return [key];
}

export function ingestMovement(store: Store, R: Row[]): string[] {
  const keys = new Set<string>();
  for (let i = 1; i < R.length; i++) {
    const row = R[i];
    if (!row) continue;
    const code = S(row[1]);
    if (!code.startsWith('USRW')) continue;
    const date = dateOf(row[0]);
    const key = norm(row[4]) + '|' + date;
    const d = ensure(store, key, row[4], date);
    keys.add(key);
    if (!d.mv) d.mv = {};
    const m = d.mv[code] || (d.mv[code] = { code, name: titl(row[2]), in: 0, outPos: 0, cost: 0, events: [] });
    const qin = num(row[9]), qout = num(row[11]), rem = S(row[14]);
    m.in += qin;
    if (!m.cost) { const c = num(row[7]); if (c > 0) m.cost = c; }
    if (rem.startsWith('(POS ADJUSTMENT)')) m.outPos += qout;
    else m.events.push({ t: timeOf(row[0]), in: qin, out: qout, r: rem });
  }
  return [...keys];
}

export function ingestSales(store: Store, R: Row[]): string[] {
  let date = '';
  for (const row of R.slice(0, 8)) {
    const j = (row || []).map(S).join(' ');
    const m = j.match(/Business Date equal to (\d{2}\/\d{2}\/\d{4})/);
    if (m) { date = m[1]; break; }
  }
  let outlet: string | null = null;
  let item: { p: string; n: string } | null = null;
  const by: Record<string, { pizzas: number; units: number; net: number }> = {};
  for (const r of R) {
    const c0 = S(r[0]), c1 = S(r[1]), c2 = S(r[2]);
    const mo = c0.match(/^Outlet:\s*(\S+)-(.*)/);
    const mi = c1.match(/^Item:\s*([A-Z0-9]+)-(.*)/);
    if (mo) outlet = mo[2].trim();
    else if (mi) item = { p: mi[1], n: mi[2].trim() };
    else if (c2 === 'Subtotal' && item) {
      const o = outlet as string;
      by[o] = by[o] || { pizzas: 0, units: 0, net: 0 };
      const q = num(r[8]);
      by[o].net += num(r[5]);
      if (item.p.startsWith('ZA')) {
        by[o].units += q;
        if (/personal|regular|large/i.test(item.n)) by[o].pizzas += q;
      }
      item = null;
    }
  }
  const keys: string[] = [];
  for (const o in by) {
    if (!date) continue;
    const key = norm(o) + '|' + date;
    ensure(store, key, o, date).sales = by[o];
    keys.push(key);
  }
  return keys;
}
