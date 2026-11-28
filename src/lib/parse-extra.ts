import type { Checklist, Grn, Store } from './types';
import { S, num, norm } from './calc';
import { dateOf, ensure, unsafe } from './parse';

type Row = unknown[];

/* ---------- app orders (US Pizza app channel) ---------- */
export function ingestAppOrders(store: Store, R: Row[]): string[] {
  let hi = -1;
  for (let i = 0; i < R.length; i++) {
    const j = (R[i] || []).map(S).join('|');
    if (/Order ID/i.test(j) && /Outlet Name/i.test(j)) {
      hi = i;
      break;
    }
  }
  if (hi < 0) return [];
  const H = R[hi].map(S);
  const ci = (n: string) => H.findIndex((x) => x.toLowerCase() === n.toLowerCase());
  const cOut = ci('Outlet Name'), cSub = ci('Subtotal (RM)'), cGrand = ci('Grand Total (RM)'), cPay = ci('Payment Status'), cDate = ci('Order Date');
  if (cOut < 0 || cDate < 0) return [];
  const keys = new Set<string>();
  for (let i = hi + 1; i < R.length; i++) {
    const row = R[i];
    if (!row) continue;
    const pay = S(row[cPay]);
    if (pay && pay.toLowerCase() !== 'paid') continue;
    const dv = row[cDate];
    let date = '';
    if (typeof dv === 'number') date = dateOf(dv);
    else {
      const dp = S(dv).slice(0, 10).split('-');
      if (dp.length === 3) date = dp[2] + '/' + dp[1] + '/' + dp[0];
    }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) continue;
    const outlet = S(row[cOut]);
    if (!outlet) continue;
    const disp = outlet.replace(/us pizza\s*-?\s*/i, '').trim() || outlet;
    const key = norm(outlet) + '|' + date;
    const d = ensure(store, key, disp, date);
    keys.add(key);
    const ch = (d.channels = d.channels || {});
    ch.app = (ch.app || 0) + (cSub >= 0 ? num(row[cSub]) : num(row[cGrand]));
    ch.appOrders = (ch.appOrders || 0) + 1;
  }
  return [...keys];
}

/* ---------- Treeams checklist compliance ---------- */
const clShort = (n: string) =>
  /opening/i.test(n) ? 'Opening' : /closing/i.test(n) ? 'Closing' : /cash/i.test(n) ? 'Cash' : /manager|objective|hourly/i.test(n) ? 'Manager' : S(n).replace(/^MY OPS - /i, '').slice(0, 14);

// Mutates the checklist; returns true when any row was read.
export function ingestChecklist(cl: Checklist, R: Row[]): boolean {
  let o: string | null = null;
  let cols: number[] = [];
  let any = false;
  for (const row of R) {
    if (!row) continue;
    const a = S(row[0]);
    const nm = a.match(/^Network:\s*(.+)/);
    if (nm) {
      o = nm[1].trim();
      cols = [];
      for (let c = 1; c < row.length; c++) if (S(row[c])) cols.push(c);
      continue;
    }
    if (o && a && !unsafe(o)) {
      const s = clShort(a);
      if (unsafe(s)) continue;
      const ob = (cl[o] = cl[o] || {});
      const e = (ob[s] = ob[s] || { done: 0, exp: 0 });
      for (const c of cols) {
        const comp = num(row[c]), exp = num(row[c + 3]);
        if (exp > 0) {
          e.exp++;
          if (comp > 0) e.done++;
          any = true;
        }
      }
    }
  }
  return any;
}

/* ---------- GRN pdf ---------- */
type PdfItem = { str: string; transform: number[] };

export async function parseGrnPdf(buf: ArrayBuffer): Promise<Grn> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const allstr: string[] = [];
  const items: Grn['items'] = [];
  for (let pg = 1; pg <= pdf.numPages; pg++) {
    const tc = await (await pdf.getPage(pg)).getTextContent();
    const groups = new Map<number, string[]>();
    for (const it of tc.items as unknown as PdfItem[]) {
      if (typeof it.str !== 'string') continue;
      allstr.push(it.str);
      const xk = Math.round(it.transform[4] / 9) * 9;
      const g = groups.get(xk) ?? [];
      g.push(it.str.trim());
      groups.set(xk, g);
    }
    for (const strs of groups.values()) {
      const code = strs.find((x) => /^USRW\d+$/.test(x));
      let qm: RegExpMatchArray | null = null;
      for (const x of strs) {
        const m = x.match(/^(\d+(?:\.\d+)?)\s+([A-Z]{1,6})$/);
        if (m) {
          qm = m;
          break;
        }
      }
      if (code && qm) {
        const desc = strs.find((x) => x.length > 8 && !/^USRW/.test(x) && !/^\d/.test(x) && !/^(ACCEPTED|REJECTED|PENDING)$/.test(x)) || '';
        items.push({ code, desc, qty: parseFloat(qm[1]), uom: qm[2] });
      }
    }
  }
  const blob = allstr.join('\n');
  const no = (blob.match(/GRN\/\d+\/\d+/) || [])[0] || '';
  const dm = blob.match(/(\d{2})-([A-Za-z]{3})-(\d{4})/);
  const MO: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  const date = dm ? dm[1] + '/' + (MO[dm[2].toLowerCase()] || '00') + '/' + dm[3] : '';
  const storage = ((blob.match(/([A-Z][A-Za-z0-9 ]*\[RM\])/) || [])[1] || '').trim();
  return { no, storage, date, items };
}

// Attaches a parsed GRN to its outlet-day (storage name + date). Returns the key touched, or null if unreadable.
export function ingestGrn(store: Store, g: Grn): string | null {
  if (!g.no || !g.items.length || !g.date || !g.storage) return null;
  const key = norm(g.storage) + '|' + g.date;
  const d = ensure(store, key, g.storage, g.date);
  d.grns = d.grns || [];
  if (!d.grns.some((x) => x.no === g.no)) d.grns.push(g);
  return key;
}
