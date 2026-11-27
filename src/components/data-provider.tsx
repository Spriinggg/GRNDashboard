"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import type { CloudState, Day, Kind, Store } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { datesFor, firstKeyWithItems } from "@/lib/calc";
import { detect, ensure, ingestCount, ingestMovement, ingestSales, rowsOf } from "@/lib/parse";
import { SAMPLE_ITEMS, SAMPLE_MV } from "@/lib/sample";

type Ctx = {
  store: Store;
  curO: string | null;
  curD: string | null;
  cur: Day | null;
  setOutlet: (o: string) => void;
  setDate: (d: string) => void;
  grnDocs: string[];
  fileNames: Record<Kind, string[]>;
  cloud: CloudState;
  status: string;
  handleFiles: (files: File[]) => Promise<void>;
  loadSample: () => void;
  clearAll: () => Promise<void>;
  openCode: string | null;
  setOpenCode: (c: string | null) => void;
};

const DataCtx = createContext<Ctx | null>(null);
export const useData = () => {
  const c = useContext(DataCtx);
  if (!c) throw new Error("useData must be used inside DataProvider");
  return c;
};

const emptyNames = (): Record<Kind, string[]> => ({ sales: [], stockcount: [], movement: [], grn: [] });

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<Store>({});
  const storeRef = useRef<Store>({});
  const [curO, setCurO] = useState<string | null>(null);
  const [curD, setCurD] = useState<string | null>(null);
  const [grnDocs, setGrnDocs] = useState<string[]>([]);
  const [fileNames, setFileNames] = useState<Record<Kind, string[]>>(emptyNames());
  const [cloud, setCloud] = useState<CloudState>(supabase ? "loading" : "off");
  const [status, setStatus] = useState("");
  const [openCode, setOpenCode] = useState<string | null>(null);

  const commit = useCallback((s: Store) => {
    storeRef.current = s;
    setStore(s);
    setCurO((o) => {
      if (o) return o;
      const k = firstKeyWithItems(s);
      if (k) {
        const ok = s[k].ok;
        setCurD(datesFor(s, ok).slice(-1)[0] ?? s[k].date);
        return ok;
      }
      return o;
    });
  }, []);

  /* cloud load once on mount */
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase.from("datasets").select("id,data");
        if (error) throw error;
        if (!alive) return;
        const next: Store = { ...storeRef.current };
        (data || []).forEach((r: { id: string; data: Day | null }) => {
          if (r.data) next[r.id] = r.data;
        });
        commit(next);
        setCloud("synced");
      } catch (e) {
        console.error("cloudLoad", e);
        if (alive) setCloud("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [commit]);

  const cloudSave = useCallback(async (s: Store, keys: Set<string>) => {
    if (!supabase) return;
    const ks = [...keys].filter((k) => s[k] && s[k].items && s[k].items!.length);
    if (!ks.length) {
      setCloud("synced");
      return;
    }
    try {
      setCloud("loading");
      for (let i = 0; i < ks.length; i += 20) {
        const rows = ks.slice(i, i + 20).map((k) => ({ id: k, outlet: s[k].outlet, outlet_key: s[k].ok, date: s[k].date, data: s[k] }));
        const { error } = await supabase.from("datasets").upsert(rows);
        if (error) throw error;
      }
      setCloud("saved");
      setTimeout(() => setCloud("synced"), 1500);
    } catch (e) {
      console.error("cloudSave", e);
      setCloud("error");
    }
  }, []);

  const handleFiles = useCallback(
    async (files: File[]) => {
      const draft: Store = structuredClone(storeRef.current);
      const names = structuredClone(fileNames) as Record<Kind, string[]>;
      const grn: string[] = [];
      const touched = new Set<string>();
      let n = 0;
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setStatus(`Parsing ${i + 1} of ${files.length}: ${f.name}…`);
        await new Promise((r) => setTimeout(r, 0));
        try {
          if (/\.pdf$/i.test(f.name)) {
            grn.push(f.name);
            names.grn.push(f.name);
            n++;
            continue;
          }
          const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: "array", dense: true });
          const k = detect(wb);
          const R = rowsOf(wb);
          let keys: string[] = [];
          if (k === "stockcount") {
            keys = ingestCount(draft, R);
            names.stockcount.push(f.name);
          } else if (k === "movement") {
            keys = ingestMovement(draft, R);
            names.movement.push(f.name);
          } else if (k === "sales") {
            keys = ingestSales(draft, R);
            names.sales.push(f.name);
          } else continue;
          keys.forEach((x) => touched.add(x));
          n++;
        } catch (e) {
          console.error("parse fail", f.name, e);
        }
      }
      setGrnDocs((g) => [...g, ...grn]);
      setFileNames(names);
      commit(draft);
      setStatus(`${n} file(s) added.`);
      await cloudSave(draft, touched);
    },
    [fileNames, commit, cloudSave],
  );

  const loadSample = useCallback(() => {
    const draft: Store = structuredClone(storeRef.current);
    const d = ensure(draft, "AMPANG|24/11/2026", "Ampang", "24/11/2026");
    Object.assign(d, {
      items: SAMPLE_ITEMS,
      sample: true,
      nCounts: 2,
      openDoc: "SC/RM/26/0018607",
      closeDoc: "SC/RM/26/0018633",
      sales: { pizzas: 78, units: 149, net: 1275.29 },
      sum: { sales: 1275.29, ideal: 338.47, actual: 1705.79 },
      mv: SAMPLE_MV,
    });
    setGrnDocs((g) => (g.length ? g : ["GRN_26_0010309.pdf", "GRN_26_0010333.pdf"]));
    setFileNames((f) => (f.grn.length ? f : { ...f, grn: ["GRN_26_0010309.pdf", "GRN_26_0010333.pdf"] }));
    storeRef.current = draft;
    setStore(draft);
    setCurO("AMPANG");
    setCurD("24/11/2026");
  }, []);

  const clearAll = useCallback(async () => {
    storeRef.current = {};
    setStore({});
    setGrnDocs([]);
    setFileNames(emptyNames());
    setCurO(null);
    setCurD(null);
    setStatus("");
    if (supabase) {
      const { error } = await supabase.from("datasets").delete().neq("id", "__none__");
      setCloud(error ? "error" : "synced");
    }
  }, []);

  const setOutlet = useCallback((o: string) => {
    setCurO(o);
    setCurD((d) => {
      const dts = datesFor(storeRef.current, o);
      return d && dts.includes(d) ? d : (dts[dts.length - 1] ?? null);
    });
  }, []);

  const cur = curO && curD ? (store[curO + "|" + curD] ?? null) : null;
  const value = useMemo<Ctx>(
    () => ({ store, curO, curD, cur, setOutlet, setDate: setCurD, grnDocs, fileNames, cloud, status, handleFiles, loadSample, clearAll, openCode, setOpenCode }),
    [store, curO, curD, cur, setOutlet, grnDocs, fileNames, cloud, status, handleFiles, loadSample, clearAll, openCode],
  );
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}
