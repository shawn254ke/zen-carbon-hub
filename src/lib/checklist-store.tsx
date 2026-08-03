import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  createEvidenceChecklistApi,
  deleteEvidenceChecklistApi,
  type Department,
  fetchDepartmentsApi,
  fetchEvidenceChecklistsApi,
  getDefaultChecklistEntries,
  getDefaultDepartments,
  mergeChecklistEntries,
  type ChecklistEntry,
  type DepartmentInfo,
  updateEvidenceChecklistApi,
} from "@/lib/evidence-config-api";
import { useProjects } from "@/lib/projects-context";
import { toast } from "sonner";

type ChecklistMap = Record<Department, string[]>;
type ChecklistEntryMap = Record<Department, ChecklistEntry[]>;

type Ctx = {
  departments: DepartmentInfo[];
  checklist: ChecklistMap;
  getChecklistForProject: (projectId: string) => ChecklistMap;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addItem: (dept: Department, item: string, projectId?: string) => Promise<void>;
  removeItem: (dept: Department, item: string, projectId?: string) => Promise<void>;
  renameItem: (dept: Department, oldItem: string, newItem: string, projectId?: string) => Promise<void>;
};

const ChecklistCtx = createContext<Ctx | null>(null);

const ALL_DEPARTMENTS: Department[] = ["ic", "mechanical", "chemical", "mrv", "admin"];

function flattenEntries(entries: ChecklistEntryMap) {
  return ALL_DEPARTMENTS.flatMap((dept) => entries[dept]);
}

function mergeEntriesUnique(base: ChecklistEntryMap, incoming: ChecklistEntry[]) {
  const next: ChecklistEntryMap = {
    ic: [...base.ic],
    mechanical: [...base.mechanical],
    chemical: [...base.chemical],
    mrv: [...base.mrv],
    admin: [...base.admin],
  };

  const seen = new Set(
    ALL_DEPARTMENTS.flatMap((dept) =>
      next[dept].map((entry) => `${dept}|${entry.projectId ?? "global"}|${entry.label.toLowerCase()}`),
    ),
  );

  let hasChanges = false;

  for (const entry of incoming) {
    const key = `${entry.departmentKey}|${entry.projectId ?? "global"}|${entry.label.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next[entry.departmentKey].push(entry);
    hasChanges = true;
  }

  return hasChanges ? next : base;
}

function deriveChecklistEntriesFromProjects(projects: ReturnType<typeof useProjects>["projects"]) {
  return projects.flatMap((project) =>
    (project.checklistTemplates ?? []).map((template) => ({
      id: `project-${template.id}`,
      departmentKey: template.department,
      departmentId: null,
      projectId: template.projectId ?? project.id,
      label: template.label,
    } satisfies ChecklistEntry)),
  );
}

export function ChecklistProvider({ children }: { children: ReactNode }) {
  const { projects } = useProjects();
  const [departments, setDepartments] = useState<DepartmentInfo[]>(() => getDefaultDepartments());
  const [entries, setEntries] = useState<ChecklistEntryMap>(() => getDefaultChecklistEntries());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const nextDepartments = await fetchDepartmentsApi();
      const nextEntries = await fetchEvidenceChecklistsApi(nextDepartments);

      setDepartments(nextDepartments);
      setEntries((prev) => mergeEntriesUnique(mergeChecklistEntries(nextEntries), flattenEntries(prev)));
      setError(null);
    } catch (loadError) {
      setDepartments(getDefaultDepartments());
      setError(loadError instanceof Error ? loadError.message : "Unable to load departments and checklists.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const runLoadConfig = async () => {
      try {
        const nextDepartments = await fetchDepartmentsApi();
        const nextEntries = await fetchEvidenceChecklistsApi(nextDepartments);

        if (!cancelled) {
          setDepartments(nextDepartments);
          setEntries((prev) => mergeEntriesUnique(mergeChecklistEntries(nextEntries), flattenEntries(prev)));
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setDepartments(getDefaultDepartments());
          setError(loadError instanceof Error ? loadError.message : "Unable to load departments and checklists.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void runLoadConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const derivedEntries = deriveChecklistEntriesFromProjects(projects);
    if (derivedEntries.length === 0) return;

    setEntries((prev) => mergeEntriesUnique(prev, derivedEntries));
  }, [projects]);

  const checklist = useMemo<ChecklistMap>(() => ({
    ic: entries.ic.map((entry) => entry.label),
    mechanical: entries.mechanical.map((entry) => entry.label),
    chemical: entries.chemical.map((entry) => entry.label),
    mrv: entries.mrv.map((entry) => entry.label),
    admin: entries.admin.map((entry) => entry.label),
  }), [entries]);

  const getChecklistForProject = useCallback((projectId: string): ChecklistMap => {
    const pickLabels = (dept: Department) => {
      const scoped = entries[dept]
        .filter((entry) => entry.projectId === projectId)
        .map((entry) => entry.label);

      const global = entries[dept]
        .filter((entry) => entry.projectId == null)
        .map((entry) => entry.label);

      return [...new Set([...scoped, ...global])];
    };

    return {
      ic: pickLabels("ic"),
      mechanical: pickLabels("mechanical"),
      chemical: pickLabels("chemical"),
      mrv: pickLabels("mrv"),
      admin: pickLabels("admin"),
    };
  }, [entries]);

  const getDepartmentInfo = useCallback((dept: Department) => {
    return departments.find((department) => department.key === dept)
      ?? getDefaultDepartments().find((department) => department.key === dept)!;
  }, [departments]);

  const addItem = useCallback(async (dept: Department, item: string, projectId?: string) => {
    const trimmed = item.trim();
    if (!trimmed) return;

    if (entries[dept].some((entry) => entry.label === trimmed && (entry.projectId ?? null) === (projectId ?? null))) return;

    try {
      const selectedProjectName = projectId
        ? projects.find((project) => project.id === projectId)?.name ?? null
        : null;
      const created = await createEvidenceChecklistApi(
        getDepartmentInfo(dept),
        trimmed,
        projectId,
        selectedProjectName,
      );
      setEntries((prev) => ({
        ...prev,
        [dept]: [...prev[dept], created],
      }));
    } catch (mutationError) {
      toast.error(mutationError instanceof Error ? mutationError.message : "Unable to add checklist item.");
      throw mutationError;
    }
  }, [entries, getDepartmentInfo, projects]);

  const removeItem = useCallback(async (dept: Department, item: string, projectId?: string) => {
    const existing = entries[dept].find((entry) => entry.label === item && (entry.projectId ?? null) === (projectId ?? null));
    if (!existing) return;

    if (existing.id.startsWith("default-")) {
      const mutationError = new Error("This checklist item is not synced from the backend yet.");
      toast.error(mutationError.message);
      throw mutationError;
    }

    try {
      await deleteEvidenceChecklistApi(existing.id);
      setEntries((prev) => ({
        ...prev,
        [dept]: prev[dept].filter((entry) => entry.id !== existing.id),
      }));
    } catch (mutationError) {
      toast.error(mutationError instanceof Error ? mutationError.message : "Unable to delete checklist item.");
      throw mutationError;
    }
  }, [entries]);

  const renameItem = useCallback(async (dept: Department, oldItem: string, newItem: string, projectId?: string) => {
    const trimmed = newItem.trim();
    if (!trimmed) return;

    const existing = entries[dept].find((entry) => entry.label === oldItem && (entry.projectId ?? null) === (projectId ?? null));
    if (!existing) return;

    if (existing.id.startsWith("default-")) {
      const mutationError = new Error("This checklist item is not synced from the backend yet.");
      toast.error(mutationError.message);
      throw mutationError;
    }

    try {
      const updated = await updateEvidenceChecklistApi(existing.id, getDepartmentInfo(dept), trimmed, projectId);
      setEntries((prev) => ({
        ...prev,
        [dept]: prev[dept].map((entry) => (entry.id === existing.id ? updated : entry)),
      }));
    } catch (mutationError) {
      toast.error(mutationError instanceof Error ? mutationError.message : "Unable to update checklist item.");
      throw mutationError;
    }
  }, [entries, getDepartmentInfo]);

  const value = useMemo(() => ({ departments, checklist, getChecklistForProject, isLoading, error, refresh: loadConfig, addItem, removeItem, renameItem }), [departments, checklist, getChecklistForProject, isLoading, error, loadConfig, addItem, removeItem, renameItem]);
  return <ChecklistCtx.Provider value={value}>{children}</ChecklistCtx.Provider>;
}

export function useChecklist() {
  const v = useContext(ChecklistCtx);
  if (!v) throw new Error("useChecklist must be used within ChecklistProvider");
  return v;
}