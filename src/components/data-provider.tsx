"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import type { Checklist, CloudState, Day, DeleteRequest, Kind, Store } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";
import { supabase } from "@/lib/supabase";
import { datesFor, firstKeyWithItems } from "@/lib/calc";
import { detect, ensure, ingestCount, ingestMovement, ingestSales, rowsOf } from "@/lib/parse";
import { ingestAppOrders, ingestChecklist, ingestGrn, parseGrnPdf } from "@/lib/parse-extra";
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
  checklist: Checklist;
  /** Pending delete requests (admins see all, staff see their own). */
  requests: DeleteRequest[];
  deleteDay: (key: string) => Promise<void>;
  requestDelete: (key: string) => Promise<void>;
  rejectRequest: (id: string) => Promise<void>;
};

const DataCtx = createContext<Ctx | null>(null);
export const useData = () => {
  const c = useContext(DataCtx);
  if (!c) throw new Error("useData must be used inside DataProvider");
  return c;
};

const CL_ID = "__TREEAMS__";
const emptyNames = (): Record<Kind, string[]> => ({ sales: [], stockcount: [], movement: [], grn: [], checklist: [], channels: [] });

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
  const [checklist, setChecklist] = useState<Checklist>({});
  const [requests, setRequests] = useState<DeleteRequest[]>([]);
  const { userId, label, email } = useAuth();
  const who = label || email;

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
        (data || []).forEach((r: { id: string; data: (Day & { __cl?: Checklist }) | null }) => {
          if (r.id === CL_ID) {
            if (r.data?.__cl) setChecklist(r.data.__cl);
          } else if (r.data) next[r.id] = r.data;
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

  const saveChecklist = useCallback(async (cl: Checklist) => {
    if (!supabase) return;
    const { error } = await supabase.from("datasets").upsert({ id: CL_ID, outlet: "Treeams", outlet_key: "__sys", date: "", data: { __cl: cl } });
    if (error) console.error("saveChecklist", error);
  }, []);

  const loadRequests = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("delete_requests").select("*").eq("status", "pending").order("created_at");
    if (error) console.error("loadRequests", error);
    else setRequests((data as DeleteRequest[]) || []);
  }, []);
  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const handleFiles = useCallback(
    async (files: File[]) => {
      const draft: Store = structuredClone(storeRef.current);
      const names = structuredClone(fileNames) as Record<Kind, string[]>;
      const cl: Checklist = structuredClone(checklist);
      const grn: string[] = [];
      const touched = new Set<string>();
      let clNew = false;
      let n = 0;
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setStatus(`Parsing ${i + 1} of ${files.length}: ${f.name}…`);
        await new Promise((r) => setTimeout(r, 0));
        const mine: string[] = [];
        try {
          if (/\.pdf$/i.test(f.name)) {
            grn.push(f.name);
            names.grn.push(f.name);
            try {
              const key = ingestGrn(draft, await parseGrnPdf(await f.arrayBuffer()));
              if (key) mine.push(key);
            } catch (e) {
              console.error("grn parse", f.name, e);
            }
          } else {
            const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: "array", dense: true });
            const k = detect(wb);
            const R = rowsOf(wb);
            if (k === "stockcount") {
              mine.push(...ingestCount(draft, R));
              names.stockcount.push(f.name);
            } else if (k === "movement") {
              mine.push(...ingestMovement(draft, R));
              names.movement.push(f.name);
            } else if (k === "sales") {
              mine.push(...ingestSales(draft, R));
              names.sales.push(f.name);
            } else if (k === "apporders") {
              mine.push(...ingestAppOrders(draft, R));
              names.channels.push(f.name);
            } else if (k === "checklist") {
              if (ingestChecklist(cl, R)) clNew = true;
              names.checklist.push(f.name);
            } else continue;
          }
          n++;
        } catch (e) {
          console.error("parse fail", f.name, e);
        }
        for (const key of mine) {
          touched.add(key);
          const d = draft[key];
          d.files = d.files || [];
          if (!d.files.includes(f.name)) d.files.push(f.name);
        }
      }
      const now = new Date().toISOString();
      touched.forEach((key) => {
        if (draft[key]) {
          draft[key].upAt = now;
          if (who) draft[key].upBy = who;
        }
      });
      setGrnDocs((g) => [...g, ...grn]);
      setFileNames(names);
      if (clNew) setChecklist(cl);
      commit(draft);
      setStatus(`${n} file(s) added.`);
      await cloudSave(draft, touched);
      if (clNew) await saveChecklist(cl);
    },
    [fileNames, checklist, who, commit, cloudSave, saveChecklist],
  );

  const deleteDay = useCallback(
    async (key: string) => {
      if (supabase) {
        const { error } = await supabase.from("datasets").delete().eq("id", key);
        if (error) {
          console.error("deleteDay", error);
          setCloud("error");
          return;
        }
        await supabase
          .from("delete_requests")
          .update({ status: "approved", resolved_by: userId, resolved_at: new Date().toISOString() })
          .eq("dataset_id", key)
          .eq("status", "pending");
      }
      const next = { ...storeRef.current };
      delete next[key];
      storeRef.current = next;
      setStore(next);
      setCurD((d) => (curO && d && curO + "|" + d === key ? (datesFor(next, curO).slice(-1)[0] ?? null) : d));
      await loadRequests();
    },
    [userId, curO, loadRequests],
  );

  const requestDelete = useCallback(
    async (key: string) => {
      const d = storeRef.current[key];
      if (!d || !supabase) return;
      const { error } = await supabase.from("delete_requests").insert({ dataset_id: key, outlet: d.outlet, date: d.date, requested_by: userId, requester_email: who });
      if (error) console.error("requestDelete", error);
      await loadRequests();
    },
    [userId, who, loadRequests],
  );

  const rejectRequest = useCallback(
    async (id: string) => {
      if (supabase) {
        const { error } = await supabase.from("delete_requests").update({ status: "rejected", resolved_by: userId, resolved_at: new Date().toISOString() }).eq("id", id);
        if (error) console.error("rejectRequest", error);
      }
      await loadRequests();
    },
    [userId, loadRequests],
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
    setChecklist({});
    setRequests([]);
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
    () => ({ store, curO, curD, cur, setOutlet, setDate: setCurD, grnDocs, fileNames, cloud, status, handleFiles, loadSample, clearAll, openCode, setOpenCode, checklist, requests, deleteDay, requestDelete, rejectRequest }),
    [store, curO, curD, cur, setOutlet, grnDocs, fileNames, cloud, status, handleFiles, loadSample, clearAll, openCode, checklist, requests, deleteDay, requestDelete, rejectRequest],
  );
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}
