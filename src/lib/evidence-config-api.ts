import { expireSession, getStoredSession } from "@/lib/auth";
import { type CreateDepartment, type Department as DepartmentEntity, type DepartmentDTO } from "@/models/department.model";
import { type CreateEvidenceChecklist } from "@/models/evidence-checklist.model";

export type Department = "ic" | "mechanical" | "chemical" | "mrv" | "admin";

const DEFAULT_DEPARTMENTS: { key: Department; label: string; description: string }[] = [
  { key: "ic", label: "Instrumentation & Control", description: "Sensors, controllers, calibration" },
  { key: "mechanical", label: "Mechanical", description: "Reactor, mechanical drawings, maintenance" },
  { key: "chemical", label: "Chemical / Process", description: "Process flow, mass balance" },
  { key: "mrv", label: "MRV", description: "Monitoring, reporting, verification" },
  { key: "admin", label: "Administration", description: "Permits, accreditations, compliance" },
];

export type DepartmentInfo = {
  id: string | null;
  key: Department;
  label: string;
  description: string;
};

export type ChecklistEntry = {
  id: string;
  departmentKey: Department;
  departmentId: string | null;
  projectId: string | null;
  label: string;
};

type BackendDepartment = Partial<DepartmentDTO & DepartmentEntity>;

type BackendChecklist = {
  id?: string | number | null;
  name?: string | null;
  title?: string | null;
  item?: string | null;
  checklistItem?: string | null;
  documentType?: string | null;
  department?: BackendDepartment | string | null;
  departmentId?: string | number | null;
  departmentName?: string | null;
  project?: { id?: string | number | null } | string | null;
  projectId?: string | number | null;
};

const DEFAULT_DEPARTMENT_BY_KEY = Object.fromEntries(
  DEFAULT_DEPARTMENTS.map((department) => [department.key, department]),
) as Record<Department, (typeof DEFAULT_DEPARTMENTS)[number]>;

const DEPARTMENT_KEYS: Department[] = ["ic", "mechanical", "chemical", "mrv", "admin"];

function getApiEndpoints(path: string) {
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  // When an explicit API base URL is configured, always target it directly.
  // Falling back to relative paths can hit the frontend dev server and produce misleading 404s.
  return base ? [`${base}${path}`] : [path];
}

function getAuthHeaders(token?: string | null, includeJson = false) {
  const authToken = token ?? getStoredSession().token;
  return {
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };
}

async function readErrorMessage(response: Response, fallback: string) {
  const contentType = response.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const data = await response.json() as Record<string, unknown>;
      const message = typeof data.message === "string"
        ? data.message
        : typeof data.error === "string"
          ? data.error
          : typeof data.details === "string"
            ? data.details
            : null;
      return message ? `${fallback}: ${message}` : fallback;
    }

    const text = (await response.text()).trim();
    return text ? `${fallback}: ${text}` : fallback;
  } catch {
    return fallback;
  }
}

function handleUnauthorizedResponse(response: Response) {
  if (response.status === 401) {
    expireSession();
    throw new Error("Your session has expired. Please sign in again.");
  }
}

function normalizeDepartmentKey(name: string | null | undefined): Department | null {
  const normalized = (name ?? "").trim().toLowerCase();

  if (!normalized) return null;
  if (
    normalized === "ic"
    || normalized === "i&c"
    || normalized.includes("instrumentation")
    || normalized.includes("control")
  ) return "ic";
  if (normalized.includes("mechanical")) return "mechanical";
  if (normalized.includes("chemical") || normalized.includes("process")) return "chemical";
  if (normalized === "mrv" || normalized.includes("monitoring") || normalized.includes("verification")) return "mrv";
  if (normalized === "admin" || normalized.includes("administration")) return "admin";

  return null;
}

function mapDepartment(department: BackendDepartment): DepartmentInfo | null {
  const key = normalizeDepartmentKey(department.name);
  if (!key) return null;

  const fallback = DEFAULT_DEPARTMENT_BY_KEY[key];
  return {
    id: department.id != null ? String(department.id) : null,
    key,
    label: department.name?.trim() || fallback.label,
    description: fallback.description,
  };
}

function selectPreferredDepartment(current: DepartmentInfo, candidate: DepartmentInfo) {
  const canonical = current.key;
  const currentLabel = current.label.trim().toLowerCase();
  const candidateLabel = candidate.label.trim().toLowerCase();
  const currentIsCanonical = currentLabel === canonical;
  const candidateIsCanonical = candidateLabel === canonical;

  if (candidateIsCanonical && !currentIsCanonical) return candidate;
  if (currentIsCanonical && !candidateIsCanonical) return current;

  const currentId = current.id != null && /^\d+$/.test(current.id) ? Number(current.id) : Number.MAX_SAFE_INTEGER;
  const candidateId = candidate.id != null && /^\d+$/.test(candidate.id) ? Number(candidate.id) : Number.MAX_SAFE_INTEGER;

  // Prefer the oldest canonical row when both candidates are equivalent aliases.
  return candidateId < currentId ? candidate : current;
}

function normalizeFetchedDepartments(departments: DepartmentInfo[]) {
  const byKey = new Map<Department, DepartmentInfo>();

  for (const department of departments) {
    const existing = byKey.get(department.key);
    if (!existing) {
      byKey.set(department.key, department);
      continue;
    }
    byKey.set(department.key, selectPreferredDepartment(existing, department));
  }

  const normalized = [...byKey.values()];

  if (normalized.length === 0) return getDefaultDepartments();

  return DEPARTMENT_KEYS.map((key) => normalized.find((department) => department.key === key))
    .filter((department): department is DepartmentInfo => department != null);
}

function resolveChecklistLabel(item: BackendChecklist) {
  return item.documentType?.trim()
    || item.checklistItem?.trim()
    || item.title?.trim()
    || item.name?.trim()
    || item.item?.trim()
    || "";
}

function resolveChecklistDepartment(
  item: BackendChecklist,
  departments: DepartmentInfo[],
): { key: Department; id: string | null } | null {
  const rawDepartment = typeof item.department === "string"
    ? { name: item.department, id: item.departmentId ?? null }
    : item.department;

  const departmentId = rawDepartment?.id ?? item.departmentId ?? null;
  const departmentName = rawDepartment?.name ?? item.departmentName ?? null;

  if (departmentId != null) {
    const match = departments.find((department) => department.id === String(departmentId));
    if (match) {
      return { key: match.key, id: match.id };
    }
  }

  const key = normalizeDepartmentKey(departmentName);
  if (!key) return null;

  const match = departments.find((department) => department.key === key);
  return { key, id: match?.id ?? null };
}

function mapChecklist(
  item: BackendChecklist,
  departments: DepartmentInfo[],
): ChecklistEntry | null {
  const label = resolveChecklistLabel(item);
  const department = resolveChecklistDepartment(item, departments);

  if (!label || !department) return null;

  return {
    id: String(item.id ?? `${department.key}-${label}`),
    departmentKey: department.key,
    departmentId: department.id,
    projectId: item.projectId != null
      ? String(item.projectId)
      : typeof item.project === "string"
        ? item.project
        : item.project?.id != null
          ? String(item.project.id)
          : null,
    label,
  };
}

function buildChecklistPayload(
  department: DepartmentInfo,
  label: string,
  projectId?: string | null,
  projectName?: string | null,
): CreateEvidenceChecklist {
  const departmentId = department.id != null && /^\d+$/.test(department.id) ? Number(department.id) : null;
  const numericProjectId = projectId != null && /^\d+$/.test(projectId) ? Number(projectId) : null;

  return {
    departmentId: departmentId ?? 0,
    departmentName: department.label,
    projectId: numericProjectId ?? undefined,
    projectName: projectName?.trim() || undefined,
    item: label,
  };
}

function createLocalChecklistEntry(
  department: DepartmentInfo,
  label: string,
  projectId?: string | null,
): ChecklistEntry {
  return {
    id: `local-${department.key}-${projectId ?? "global"}-${label}`,
    departmentKey: department.key,
    departmentId: department.id,
    projectId: projectId ?? null,
    label,
  };
}

async function resolveCreatedChecklistEntry(
  department: DepartmentInfo,
  label: string,
  projectId?: string | null,
  token?: string | null,
) {
  const nextEntries = await fetchEvidenceChecklistsApi([department, ...getDefaultDepartments().filter((item) => item.key !== department.key)], token);

  return nextEntries.find((entry) =>
    entry.departmentKey === department.key
    && entry.label === label
    && (entry.projectId ?? null) === (projectId ?? null),
  ) ?? createLocalChecklistEntry(department, label, projectId);
}

async function resolveDepartmentForCreate(department: DepartmentInfo, token?: string | null) {
  if (department.id != null && /^\d+$/.test(department.id)) return department;

  const backendDepartments = await fetchDepartmentsApi(token);
  const matched = backendDepartments.find((item) => item.key === department.key)
    ?? backendDepartments.find((item) => item.label.toLowerCase() === department.label.toLowerCase());

  return matched ?? department;
}

export function getDefaultDepartments(): DepartmentInfo[] {
  return DEFAULT_DEPARTMENTS.map((department) => ({
    id: null,
    key: department.key,
    label: department.label,
    description: department.description,
  }));
}

export function getDefaultChecklistEntries(): Record<Department, ChecklistEntry[]> {
  return {
    ic: [],
    mechanical: [],
    chemical: [],
    mrv: [],
    admin: [],
  };
}

export function createEmptyChecklistEntryMap() {
  return {
    ic: [],
    mechanical: [],
    chemical: [],
    mrv: [],
    admin: [],
  } as Record<Department, ChecklistEntry[]>;
}

export function mergeChecklistEntries(entries: ChecklistEntry[]) {
  const next = createEmptyChecklistEntryMap();

  for (const key of DEPARTMENT_KEYS) {
    next[key] = [];
  }

  for (const entry of entries) {
    next[entry.departmentKey] = [...next[entry.departmentKey], entry];
  }

  return next;
}

export async function fetchDepartmentsApi(token?: string | null) {
  const endpoints = getApiEndpoints("/api/departments");
  let lastError: Error | null = null;
  let sawNotFound = false;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        handleUnauthorizedResponse(response);
        if (response.status === 404) {
          sawNotFound = true;
          continue;
        }
        lastError = new Error(`Unable to load departments (${response.status})`);
        continue;
      }

      const data = (await response.json()) as BackendDepartment[];
      const mapped = data.map(mapDepartment).filter((department): department is DepartmentInfo => department != null);
      const normalized = normalizeFetchedDepartments(mapped);
      if (normalized.length > 0) {
        return normalized;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unable to load departments.");
    }
  }

  if (sawNotFound) {
    return getDefaultDepartments();
  }

  if (lastError) {
    throw lastError;
  }

  return getDefaultDepartments();
}

export async function createDepartmentApi(name: string, token?: string | null) {
  const payload: CreateDepartment = { name };
  const endpoints = getApiEndpoints("/api/departments");
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: getAuthHeaders(token, true),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        handleUnauthorizedResponse(response);
        lastError = new Error(`Unable to create department (${response.status})`);
        continue;
      }

      const data = (await response.json()) as BackendDepartment;
      const mapped = mapDepartment(data);
      if (mapped) return mapped;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unable to create department.");
    }
  }

  throw lastError ?? new Error("Unable to create department.");
}

export async function updateDepartmentApi(id: string, name: string, token?: string | null) {
  const payload: CreateDepartment = { name };
  const endpoints = getApiEndpoints("/api/departments");
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${endpoint}/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(token, true),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        handleUnauthorizedResponse(response);
        lastError = new Error(`Unable to update department (${response.status})`);
        continue;
      }

      const data = (await response.json()) as BackendDepartment;
      const mapped = mapDepartment(data);
      if (mapped) return mapped;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unable to update department.");
    }
  }

  throw lastError ?? new Error("Unable to update department.");
}

export async function deleteDepartmentApi(id: string, token?: string | null) {
  const endpoints = getApiEndpoints("/api/departments");
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${endpoint}/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(token),
      });

      if (response.ok) return;
      handleUnauthorizedResponse(response);
      lastError = new Error(`Unable to delete department (${response.status})`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unable to delete department.");
    }
  }

  throw lastError ?? new Error("Unable to delete department.");
}

export async function fetchEvidenceChecklistsApi(
  departments: DepartmentInfo[],
  token?: string | null,
) {
  const endpoints = getApiEndpoints("/api/evidence-checklists");
  let lastError: Error | null = null;
  let sawNotFound = false;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        handleUnauthorizedResponse(response);
        if (response.status === 404) {
          sawNotFound = true;
          continue;
        }
        lastError = new Error(`Unable to load evidence checklists (${response.status})`);
        continue;
      }

      const data = (await response.json()) as BackendChecklist[];
      return data
        .map((item) => mapChecklist(item, departments))
        .filter((item): item is ChecklistEntry => item != null);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unable to load evidence checklists.");
    }
  }

  if (sawNotFound) {
    return getDefaultChecklistEntries()["ic"].length >= 0
      ? Object.values(getDefaultChecklistEntries()).flat()
      : [];
  }

  throw lastError ?? new Error("Unable to load evidence checklists.");
}

export async function createEvidenceChecklistApi(
  department: DepartmentInfo,
  label: string,
  projectId?: string | null,
  projectName?: string | null,
  token?: string | null,
) {
  const resolvedDepartment = await resolveDepartmentForCreate(department, token);
  const hasNumericDepartmentId = resolvedDepartment.id != null && /^\d+$/.test(resolvedDepartment.id);
  const payload = buildChecklistPayload(resolvedDepartment, label, projectId, projectName);

  if (!hasNumericDepartmentId) {
    throw new Error(`Unable to add checklist item because department ${department.label} is not synced from the backend.`);
  }

  if (projectId != null && payload.projectId == null) {
    throw new Error("Unable to add checklist item because the selected project id is not a valid backend id.");
  }

  const endpoints = getApiEndpoints("/api/evidence-checklists");
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: getAuthHeaders(token, true),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        handleUnauthorizedResponse(response);
        lastError = new Error(await readErrorMessage(response, `Unable to add checklist item (${response.status})`));
        continue;
      }

      const contentType = response.headers.get("content-type") ?? "";

      if (contentType.includes("application/json")) {
        const data = (await response.json()) as BackendChecklist;
        return mapChecklist(data, [resolvedDepartment, ...getDefaultDepartments().filter((item) => item.key !== resolvedDepartment.key)])
          ?? createLocalChecklistEntry(resolvedDepartment, label, projectId);
      }

      await response.text().catch(() => "");
      return await resolveCreatedChecklistEntry(resolvedDepartment, label, projectId, token);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unable to add checklist item.");
    }
  }

  throw lastError ?? new Error("Unable to add checklist item.");
}

export async function updateEvidenceChecklistApi(
  checklistId: string,
  department: DepartmentInfo,
  label: string,
  projectId?: string | null,
  token?: string | null,
) {
  const endpoints = getApiEndpoints("/api/evidence-checklists");
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${endpoint}/${checklistId}`, {
        method: "PATCH",
        headers: getAuthHeaders(token, true),
        body: JSON.stringify(buildChecklistPayload(department, label, projectId)),
      });

      if (!response.ok) {
        handleUnauthorizedResponse(response);
        lastError = new Error(await readErrorMessage(response, `Unable to update checklist item (${response.status})`));
        continue;
      }

      const data = (await response.json()) as BackendChecklist;
      return mapChecklist(data, [department, ...getDefaultDepartments().filter((item) => item.key !== department.key)])
        ?? {
          id: checklistId,
          departmentKey: department.key,
          departmentId: department.id,
          projectId: projectId ?? null,
          label,
        };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unable to update checklist item.");
    }
  }

  throw lastError ?? new Error("Unable to update checklist item.");
}

export async function deleteEvidenceChecklistApi(checklistId: string, token?: string | null) {
  const endpoints = getApiEndpoints("/api/evidence-checklists");
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${endpoint}/${checklistId}`, {
        method: "DELETE",
        headers: getAuthHeaders(token),
      });

      if (response.ok) return;
      handleUnauthorizedResponse(response);
      lastError = new Error(`Unable to delete checklist item (${response.status})`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unable to delete checklist item.");
    }
  }

  throw lastError ?? new Error("Unable to delete checklist item.");
}
