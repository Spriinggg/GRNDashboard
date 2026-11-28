"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import type { Checklist, CloudState, Day, DeleteRequest, Kind, Store } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";
import { supabase } from "@/lib/supabase";
import { datesFor, firstKeyWithItems, toIsoDate } from "@/lib/calc";
import { NO_SPAN, type DateSpan } from "@/lib/date-span";
import { detect, ensure, ingestCount, ingestMovement, ingestSales, rowsOf } from "@/lib/parse";
import { ingestAppOrders, ingestChecklist, ingestGrn, parseGrnPdf } from "@/lib/parse-extra";
import { SAMPLE_ITEMS, SAMPLE_MV } from "@/lib/sample";
import { describeError, errorDialog, reportError } from "@/lib/notify";
import type { DialogItem } from "@/lib/notify";

// Where a file is up to while it is read and saved, so the page can show it is working.
export type UploadProgress = { done: number; total: number; name: string; stage: "reading" | "saving" };
const UPLOAD_TOAST = "upload";
// The app starts with the latest week of days, the latest day of every outlet, and an index (id, outlet, date) of everything
// saved. Older days are fetched when a page asks for their dates, so opening the app does not pull every day ever uploaded.
const WINDOW_DAYS = 7;
// A few ids go in one request. More than this, one request asks for the whole range of dates instead, so the address never gets too long.
const CHUNK = 60;
const isoMinus = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};
const NAME_OF: Record<string, Kind> = { stockcount: "stockcount", movement: "movement", sales: "sales", apporders: "channels", checklist: "checklist" };

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
  /** Set while files are being read and saved, otherwise null. */
  progress: UploadProgress | null;
  /** The first and last day saved in Supabase, whether or not the day is loaded yet. */
  bounds: { min: string; max: string } | null;
  /** How many days each outlet has saved (by outlet key), counting days not loaded yet. */
  daysByOutlet: Record<string, number>;
  /** Loads the days inside a range that are saved but not loaded yet. Pages call this for the dates they show. */
  ensureRange: (span: DateSpan) => Promise<void>;
  /** True while days are being fetched. */
  ranging: boolean;
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
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const busy = useRef(false);
  // What is saved in Supabase, without the data: id to outlet key and day. Drives bounds, counts and which days to fetch.
  const indexRef = useRef<Map<string, { ok: string; iso: string }>>(new Map());
  const pending = useRef<Set<string>>(new Set());
  // Opens once the index is known (or known to be unavailable). A page that asks for a range before that waits here.
  const gate = useRef<{ promise: Promise<void>; open: () => void } | null>(null);
  if (!gate.current) {
    let open: () => void = () => {};
    const promise = new Promise<void>((r) => {
      open = r;
    });
    gate.current = { promise, open };
  }
  const [bounds, setBounds] = useState<{ min: string; max: string } | null>(null);
  const [daysByOutlet, setDaysByOutlet] = useState<Record<string, number>>({});
  const [ranging, setRanging] = useState(0);
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

  const refreshIndex = useCallback(() => {
    const counts: Record<string, number> = {};
    let min = "";
    let max = "";
    indexRef.current.forEach((v) => {
      counts[v.ok] = (counts[v.ok] ?? 0) + 1;
      if (!min || v.iso < min) min = v.iso;
      if (!max || v.iso > max) max = v.iso;
    });
    setDaysByOutlet(counts);
    setBounds(min ? { min, max } : null);
  }, []);

  // Fetches the saved days with these ids and adds them to the store. Ids already loaded or already being fetched are skipped. A
  // few ids are asked for by id. Many are asked for as one range of dates, which is one request however many days it holds.
  const fetchDays = useCallback(
    async (ids: string[]): Promise<boolean> => {
      if (!supabase) return true;
      const want = ids.filter((id) => !(id in storeRef.current) && !pending.current.has(id));
      if (!want.length) return true;
      want.forEach((id) => pending.current.add(id));
      setRanging((n) => n + 1);
      try {
        const got: { id: string; data: (Day & { __cl?: Checklist }) | null }[] = [];
        const isos = want.map((id) => indexRef.current.get(id)?.iso).filter((x): x is string => !!x);
        if (want.length > CHUNK && isos.length === want.length) {
          const from = isos.reduce((a, b) => (a < b ? a : b));
          const to = isos.reduce((a, b) => (a > b ? a : b));
          const { data, error } = await supabase.from("datasets").select("id,data").gte("date_iso", from).lte("date_iso", to);
          if (error) throw error;
          got.push(...(data || []));
        } else {
          for (let i = 0; i < want.length; i += CHUNK) {
            const { data, error } = await supabase.from("datasets").select("id,data").in("id", want.slice(i, i + CHUNK));
            if (error) throw error;
            got.push(...(data || []));
          }
        }
        const next: Store = { ...storeRef.current };
        got.forEach((r) => {
          if (r.id === CL_ID) {
            if (r.data?.__cl) setChecklist(r.data.__cl);
          } else if (r.data && !(r.id in next)) next[r.id] = r.data; // a day already here may hold newer changes, so keep it
        });
        commit(next);
        return true;
      } catch (e) {
        reportError(e, { what: "load those days from Supabase" });
        return false;
      } finally {
        want.forEach((id) => pending.current.delete(id));
        setRanging((n) => n - 1);
      }
    },
    [commit],
  );

  const ensureRange = useCallback(
    async (span: DateSpan) => {
      await gate.current!.promise;
      const need: string[] = [];
      indexRef.current.forEach((v, id) => {
        if ((!span.from || v.iso >= span.from) && (!span.to || v.iso <= span.to)) need.push(id);
      });
      await fetchDays(need);
    },
    [fetchDays],
  );

  /* cloud load once on mount: the index, then the latest month and the latest day of each outlet */
  useEffect(() => {
    if (!supabase) {
      gate.current!.open();
      return;
    }
    let alive = true;
    (async () => {
      try {
        const { data: idx, error } = await supabase!.from("datasets").select("id,outlet_key,date_iso");
        if (error) throw error;
        if (!alive) return;
        const rows = (idx || []) as { id: string; outlet_key: string | null; date_iso: string | null }[];
        const map = new Map<string, { ok: string; iso: string }>();
        const latest = new Map<string, { id: string; iso: string }>();
        const always: string[] = [CL_ID];
        let max = "";
        for (const r of rows) {
          if (r.id === CL_ID) continue;
          if (!r.date_iso) {
            always.push(r.id); // a day saved before the date column existed: its range is unknown, so load it
            continue;
          }
          const ok = r.outlet_key ?? "";
          map.set(r.id, { ok, iso: r.date_iso });
          if (r.date_iso > max) max = r.date_iso;
          const l = latest.get(ok);
          if (!l || r.date_iso > l.iso) latest.set(ok, { id: r.id, iso: r.date_iso });
        }
        indexRef.current = map;
        refreshIndex();
        gate.current!.open();
        const start = max ? isoMinus(max, WINDOW_DAYS - 1) : "";
        const inWindow = [...map.entries()].filter(([, v]) => v.iso >= start).map(([id]) => id);
        // The latest week as one range, and a few single days: each outlet's latest day (so the Outlets page is right for an outlet
        // that has not uploaded this week) and anything saved without a date.
        const extras = [...new Set([...always, ...[...latest.values()].map((l) => l.id)])].filter((id) => !inWindow.includes(id));
        const [a, b] = await Promise.all([fetchDays(inWindow), fetchDays(extras)]);
        const ok = a && b;
        if (alive) setCloud(ok ? "synced" : "error");
      } catch (e) {
        gate.current!.open();
        if (alive) {
          setCloud("error");
          reportError(e, { what: "load your data from Supabase", retry: () => window.location.reload() });
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [fetchDays, refreshIndex]);

  // Saves the days to Supabase. Returns null when it worked, or the error so the caller can tell the person.
  const cloudSave = useCallback(async (s: Store, keys: Set<string>): Promise<unknown> => {
    if (!supabase) return null;
    const ks = [...keys].filter((k) => s[k] && s[k].items && s[k].items!.length);
    if (!ks.length) {
      setCloud("synced");
      return null;
    }
    try {
      setCloud("loading");
      for (let i = 0; i < ks.length; i += 20) {
        const rows = ks.slice(i, i + 20).map((k) => ({ id: k, outlet: s[k].outlet, outlet_key: s[k].ok, date: s[k].date, date_iso: toIsoDate(s[k].date) || null, data: s[k] }));
        const { error } = await supabase.from("datasets").upsert(rows);
        if (error) throw error;
      }
      ks.forEach((k) => {
        const iso = toIsoDate(s[k].date);
        if (iso) indexRef.current.set(k, { ok: s[k].ok, iso });
      });
      refreshIndex();
      setCloud("saved");
      setTimeout(() => setCloud("synced"), 1500);
      return null;
    } catch (e) {
      console.error("cloudSave", e);
      setCloud("error");
      return e;
    }
  }, [refreshIndex]);

  const saveChecklist = useCallback(async (cl: Checklist): Promise<unknown> => {
    if (!supabase) return null;
    const { error } = await supabase.from("datasets").upsert({ id: CL_ID, outlet: "Treeams", outlet_key: "__sys", date: "", data: { __cl: cl } });
    if (error) console.error("saveChecklist", error);
    return error ?? null;
  }, []);

  const loadRequests = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("delete_requests").select("*").eq("status", "pending").order("created_at");
    if (error) reportError(error, { what: "load the delete requests" });
    else setRequests((data as DeleteRequest[]) || []);
  }, []);
  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (busy.current) {
        toast.info("Still working on the last files", { description: "Wait for it to finish, then add more." });
        return;
      }
      busy.current = true;
      const total = files.length;
      // A file adds to a day that may already be saved (stock count after sales, say). Load every saved day first, so the day
      // is never saved over with only part of what it had.
      setProgress({ done: 0, total, name: "Checking the days already saved", stage: "reading" });
      await ensureRange(NO_SPAN);
      const draft: Store = structuredClone(storeRef.current);
      const names = structuredClone(fileNames) as Record<Kind, string[]>;
      const cl: Checklist = structuredClone(checklist);
      const grn: string[] = [];
      const touched = new Set<string>();
      const failed: DialogItem[] = [];
      let clNew = false;
      toast.loading(`Reading ${total} ${total === 1 ? "file" : "files"}`, { id: UPLOAD_TOAST, description: "Please keep this page open." });
      try {
        for (let i = 0; i < total; i++) {
          const f = files[i];
          setStatus(`Parsing ${i + 1} of ${total}: ${f.name}…`);
          setProgress({ done: i, total, name: f.name, stage: "reading" });
          toast.loading(`Reading file ${i + 1} of ${total}`, { id: UPLOAD_TOAST, description: f.name });
          await new Promise((r) => setTimeout(r, 0));
          const mine: string[] = [];
          try {
            if (/\.pdf$/i.test(f.name)) {
              const key = ingestGrn(draft, await parseGrnPdf(await f.arrayBuffer()));
              if (!key) {
                failed.push({ name: f.name, detail: "This PDF is not a readable GRN. No GRN number, date, storage or items were found in it." });
                continue;
              }
              grn.push(f.name);
              names.grn.push(f.name);
              mine.push(key);
            } else {
              const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: "array", dense: true });
              const k = detect(wb);
              const R = rowsOf(wb);
              if (k === "stockcount") mine.push(...ingestCount(draft, R));
              else if (k === "movement") mine.push(...ingestMovement(draft, R));
              else if (k === "sales") mine.push(...ingestSales(draft, R));
              else if (k === "apporders") mine.push(...ingestAppOrders(draft, R));
              else if (k === "checklist") {
                if (!ingestChecklist(cl, R)) {
                  failed.push({ name: f.name, detail: "The file was recognised as a checklist report, but no checklist rows could be read from it." });
                  continue;
                }
                clNew = true;
              } else {
                failed.push({ name: f.name, detail: "This file was not recognised as a Zeoniq, Codemax or TreeAMS export. Check that it is the right report." });
                continue;
              }
              if (k !== "checklist" && !mine.length) {
                failed.push({ name: f.name, detail: "The file was recognised, but no outlet or date could be read from it." });
                continue;
              }
              names[NAME_OF[k]].push(f.name);
            }
          } catch (e) {
            console.error("parse fail", f.name, e);
            failed.push({ name: f.name, detail: `This file could not be opened. It may be damaged, password protected or not the right type. (${e instanceof Error ? e.message : String(e)})` });
            continue;
          }
          for (const key of mine) {
            touched.add(key);
            const d = draft[key];
            d.files = d.files || [];
            if (!d.files.includes(f.name)) d.files.push(f.name);
          }
        }
        const ok = total - failed.length;
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
        setStatus(`${ok} file(s) added.`);

        let saveError: unknown = null;
        if (supabase && (touched.size || clNew)) {
          setProgress({ done: total, total, name: "", stage: "saving" });
          toast.loading(`Saving ${touched.size} ${touched.size === 1 ? "day" : "days"} to Supabase`, { id: UPLOAD_TOAST, description: "Almost done." });
          saveError = await cloudSave(draft, touched);
          if (!saveError && clNew) saveError = await saveChecklist(cl);
        }

        if (saveError) {
          toast.dismiss(UPLOAD_TOAST);
          const d = describeError(saveError, "save to Supabase");
          void errorDialog({ title: "Read, but not saved", text: `${d.text} Your files are shown on this page for now, but they will be lost if you close the tab.`, detail: d.detail });
        } else if (failed.length === total) {
          toast.dismiss(UPLOAD_TOAST);
          void errorDialog({ title: total === 1 ? "This file could not be read" : `None of the ${total} files could be read`, text: "Nothing was added.", items: failed });
        } else if (failed.length) {
          toast.warning(`${ok} of ${total} files added`, {
            id: UPLOAD_TOAST,
            description: `${failed.length} could not be read.`,
            duration: 15000,
            action: { label: "See which", onClick: () => void errorDialog({ icon: "warning", title: `${failed.length} ${failed.length === 1 ? "file" : "files"} could not be read`, text: "The other files were added.", items: failed }) },
          });
        } else {
          toast.success(`${ok} ${ok === 1 ? "file" : "files"} added`, { id: UPLOAD_TOAST, description: supabase ? `${touched.size} outlet ${touched.size === 1 ? "day" : "days"} saved to Supabase.` : "Kept on this computer only.", duration: 6000 });
        }
      } catch (e) {
        toast.dismiss(UPLOAD_TOAST);
        reportError(e, { what: "read those files", dialog: true });
      } finally {
        busy.current = false;
        setProgress(null);
      }
    },
    [fileNames, checklist, who, commit, cloudSave, saveChecklist, ensureRange],
  );

  const deleteDay = useCallback(
    async (key: string) => {
      const gone = storeRef.current[key];
      const label = gone ? `${gone.outlet}, ${gone.date}` : "that day";
      if (supabase) {
        const { error } = await supabase.from("datasets").delete().eq("id", key);
        if (error) {
          setCloud("error");
          reportError(error, { what: `delete ${label}`, dialog: true });
          return;
        }
        await supabase
          .from("delete_requests")
          .update({ status: "approved", resolved_by: userId, resolved_at: new Date().toISOString() })
          .eq("dataset_id", key)
          .eq("status", "pending");
      }
      indexRef.current.delete(key);
      refreshIndex();
      const next = { ...storeRef.current };
      delete next[key];
      storeRef.current = next;
      setStore(next);
      setCurD((d) => (curO && d && curO + "|" + d === key ? (datesFor(next, curO).slice(-1)[0] ?? null) : d));
      await loadRequests();
      toast.success(`Deleted ${label}`, { description: "Removed for everyone." });
    },
    [userId, curO, loadRequests, refreshIndex],
  );

  const requestDelete = useCallback(
    async (key: string) => {
      const d = storeRef.current[key];
      if (!d || !supabase) return;
      const { error } = await supabase.from("delete_requests").insert({ dataset_id: key, outlet: d.outlet, date: d.date, requested_by: userId, requester_email: who });
      if (error) reportError(error, { what: "send the delete request" });
      else toast.success("Delete requested", { description: `${d.outlet}, ${d.date}. An admin will review it.` });
      await loadRequests();
    },
    [userId, who, loadRequests],
  );

  const rejectRequest = useCallback(
    async (id: string) => {
      if (supabase) {
        const { error } = await supabase.from("delete_requests").update({ status: "rejected", resolved_by: userId, resolved_at: new Date().toISOString() }).eq("id", id);
        if (error) reportError(error, { what: "reject the request" });
        else toast.success("Request rejected");
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
    toast.success("Sample day loaded", { description: "Ampang, 24 Nov 2026. It is not saved to Supabase." });
  }, []);

  const clearAll = useCallback(async () => {
    storeRef.current = {};
    setStore({});
    indexRef.current = new Map();
    refreshIndex();
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
      if (error) {
        reportError(error, { what: "clear the saved data", dialog: true });
        return;
      }
    }
    toast.success("All data cleared");
  }, [refreshIndex]);

  const setOutlet = useCallback((o: string) => {
    setCurO(o);
    setCurD((d) => {
      const dts = datesFor(storeRef.current, o);
      return d && dts.includes(d) ? d : (dts[dts.length - 1] ?? null);
    });
  }, []);

  const cur = curO && curD ? (store[curO + "|" + curD] ?? null) : null;
  const value = useMemo<Ctx>(
    () => ({ store, curO, curD, cur, setOutlet, setDate: setCurD, grnDocs, fileNames, cloud, status, progress, bounds, daysByOutlet, ensureRange, ranging: ranging > 0, handleFiles, loadSample, clearAll, openCode, setOpenCode, checklist, requests, deleteDay, requestDelete, rejectRequest }),
    [store, curO, curD, cur, setOutlet, grnDocs, fileNames, cloud, status, progress, bounds, daysByOutlet, ensureRange, ranging, handleFiles, loadSample, clearAll, openCode, checklist, requests, deleteDay, requestDelete, rejectRequest],
  );
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}
