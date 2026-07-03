import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CHECKLIST, type Department } from "@/lib/mock-data";

type ChecklistMap = Record<Department, string[]>;

type Ctx = {
  checklist: ChecklistMap;
  addItem: (dept: Department, item: string) => void;
  removeItem: (dept: Department, item: string) => void;
  renameItem: (dept: Department, oldItem: string, newItem: string) => void;
};

const ChecklistCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "zc_checklist_v1";

export function ChecklistProvider({ children }: { children: ReactNode }) {
  const [checklist, setChecklist] = useState<ChecklistMap>(() => ({ ...CHECKLIST }));

  useEffect(() => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      try {
        setChecklist({ ...CHECKLIST, ...JSON.parse(raw) });
      } catch {
        /* ignore */
      }
    }
  }, []);

  const persist = (next: ChecklistMap) => {
    setChecklist(next);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const addItem = useCallback((dept: Department, item: string) => {
    const trimmed = item.trim();
    if (!trimmed) return;
    setChecklist((prev) => {
      if (prev[dept].includes(trimmed)) return prev;
      const next = { ...prev, [dept]: [...prev[dept], trimmed] };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeItem = useCallback((dept: Department, item: string) => {
    setChecklist((prev) => {
      const next = { ...prev, [dept]: prev[dept].filter((i) => i !== item) };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const renameItem = useCallback((dept: Department, oldItem: string, newItem: string) => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    setChecklist((prev) => {
      const next = { ...prev, [dept]: prev[dept].map((i) => (i === oldItem ? trimmed : i)) };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(() => ({ checklist, addItem, removeItem, renameItem }), [checklist, addItem, removeItem, renameItem]);
  // reference persist to keep TS happy if unused
  void persist;
  return <ChecklistCtx.Provider value={value}>{children}</ChecklistCtx.Provider>;
}

export function useChecklist() {
  const v = useContext(ChecklistCtx);
  if (!v) throw new Error("useChecklist must be used within ChecklistProvider");
  return v;
}