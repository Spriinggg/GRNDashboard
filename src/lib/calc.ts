import type { Day, GrnCheck, Money, Store, StatusCode, Item } from './types';

export const num = (v: unknown): number => {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
};
export const S = (v: unknown): string => (v == null ? '' : String(v).trim());
export const norm = (s: unknown) => S(s).toUpperCase().replace(/\[RM\]|US PIZZA|\(RM\)/g, '').replace(/[^A-Z0-9]/g, '');
export const clean = (s: unknown) =>
  S(s).replace(/\[RM\]/gi, '').replace(/US PIZZA/gi, '').trim().replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
export const titl = (s: unknown) => S(s).split('(')[0].trim().replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// A positive figure is green and a negative one is red. Zero keeps the normal colour.
export const signTone = (n: number) => (n > 0 ? 'text-success' : n < 0 ? 'text-danger' : '');
export const RM = (n: number) => (n < 0 ? '−RM ' : 'RM ') + Math.abs(n).toLocaleString('en', { maximumFractionDigits: 0 });
export const RM2 = (n: number) =>
  (n < 0 ? '−RM ' : 'RM ') + Math.abs(n).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dKey = (s: string) => {
  const m = S(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? +m[3] * 10000 + +m[2] * 100 + +m[1] : 0;
};
export const fmtD = (s: string) => {
  const m = S(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? +m[1] + ' ' + MON[+m[2] - 1] + ' ' + m[3] : S(s) || 'No date';
};
export const fmtS = (s: string) => {
  const m = S(s).match(/^(\d{1,2})\/(\d{1,2})\//);
  return m ? +m[1] + ' ' + MON[+m[2] - 1] : S(s);
};

/* ---------- store queries ---------- */
export function outletsOf(store: Store) {
  const m: Record<string, { name: string; dates: string[] }> = {};
  for (const k in store) {
    const d = store[k];
    if (!d.items) continue;
    (m[d.ok] = m[d.ok] || { name: d.outlet, dates: [] }).dates.push(d.date);
  }
  return m;
}
export function datesFor(store: Store, ok: string) {
  return Object.keys(store)
    .filter((k) => store[k].ok === ok && store[k].items)
    .map((k) => store[k].date)
    .sort((a, b) => dKey(a) - dKey(b));
}
export const totVar = (d?: Day | null) => (d && d.items ? d.items.reduce((s, x) => s + x.varrm, 0) : 0);
export const firstKeyWithItems = (store: Store) => Object.keys(store).find((k) => store[k].items && store[k].items!.length);

/* ---------- status ---------- */
export function statusOf(it: Item): [StatusCode, string] {
  if (it.varrm <= -50) return ['crit', 'critical'];
  if (it.varrm <= -10) return ['warn', 'short'];
  if (it.varrm >= 50) return ['info', 'surplus'];
  if (it.varrm >= 10) return ['info', 'over'];
  return ['good', 'on target'];
}
export const TONE: Record<StatusCode, string> = { crit: 'danger', warn: 'warning', good: 'success', info: 'info' };
export const RANK: Record<StatusCode, number> = { crit: 0, warn: 1, info: 2, good: 3 };

/* ---------- food cost ---------- */
export function money(d: Day): Money {
  if (d.sum) {
    const s = d.sum, v = s.actual - s.ideal;
    return { ok: true, sales: s.sales, ideal: s.ideal, actual: s.actual, variance: v, actPct: s.sales ? (s.actual / s.sales) * 100 : 0, idealPct: s.sales ? (s.ideal / s.sales) * 100 : 0, varPct: s.sales ? (v / s.sales) * 100 : 0 };
  }
  if (!d.items || !d.mv || !d.sales) return { ok: false };
  let ideal = 0, actual = 0;
  for (const it of d.items) {
    if (it.cat !== 'FOOD') continue;
    const mv = d.mv[it.code];
    const cost = it.varq ? Math.abs(it.varrm / it.varq) : mv ? mv.cost : 0;
    const iq = mv ? mv.outPos : 0;
    const iv = iq * cost;
    ideal += iv;
    actual += iv + -it.varrm;
  }
  const sales = d.sales.net || 0, v = actual - ideal;
  return { ok: true, sales, ideal, actual, variance: v, actPct: sales ? (actual / sales) * 100 : 0, idealPct: sales ? (ideal / sales) * 100 : 0, varPct: sales ? (v / sales) * 100 : 0 };
}
export function weekToDate(store: Store, ok: string) {
  let sales = 0, ideal = 0, actual = 0, n = 0;
  for (const k in store) {
    const d = store[k];
    if (d.ok !== ok) continue;
    const m = money(d);
    if (!m.ok) continue;
    sales += m.sales; ideal += m.ideal; actual += m.actual; n++;
  }
  const v = actual - ideal;
  return { ok: true as const, sales, ideal, actual, variance: v, actPct: sales ? (actual / sales) * 100 : 0, idealPct: sales ? (ideal / sales) * 100 : 0, varPct: sales ? (v / sales) * 100 : 0, days: n };
}

export function dayChecks(d: Day) {
  const hasGrn = !!d.mv && Object.values(d.mv).some((m) => m.events.some((e) => /GRN/i.test(e.r)));
  const hasDed = !!d.mv && Object.values(d.mv).some((m) => m.outPos > 0);
  return { hasGrn, hasDed };
}

// "24/11/2026" to "2026-11-24", the form the date filter uses.
export const toIsoDate = (s: string) => {
  const m = S(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
};

/* ---------- GRN cross-check ---------- */
// Each GRN item is matched to the Stock Movement IN record carrying the same GRN number and item code.
export function grnCheck(d?: Day | null): GrnCheck[] | null {
  if (!d || !d.grns || !d.grns.length) return null;
  const idx = new Map<string, { in: number; uom: string }>();
  if (d.mv) {
    for (const code of Object.keys(d.mv)) {
      for (const e of d.mv[code].events) {
        const m = String(e.r).match(/\((GRN\/\d+\/\d+)\)/);
        if (m && e.in > 0) {
          const k = m[1] + '|' + code;
          const hit = idx.get(k) ?? { in: 0, uom: e.u || '' };
          hit.in += e.in;
          idx.set(k, hit);
        }
      }
    }
  }
  return d.grns.map((g) => {
    const items = g.items.map((it) => {
      const hit = idx.get(g.no + '|' + it.code);
      if (!hit) return { ...it, status: 'miss' as const };
      const exact = hit.uom === it.uom && Math.abs(hit.in - it.qty) < 1e-6;
      return { ...it, inq: +hit.in.toFixed(3), inuom: hit.uom, status: exact ? ('exact' as const) : ('diff' as const) };
    });
    const rec = items.filter((i) => i.status !== 'miss').length;
    return { no: g.no, items, rec, total: items.length, miss: items.length - rec };
  });
}
