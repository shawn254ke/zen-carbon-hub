import { expireSession, getStoredSession } from "@/lib/auth";
import { type Department } from "@/lib/evidence-config-api";
import { fetchProjectsApi } from "@/lib/projects-api";

export type EvidenceStatus = "pending" | "verified" | "rejected";

export type EvidenceItem = {
  id: string;
  projectId: string;
  department: Department;
  documentType: string;
  fileName: string;
  uploadedBy: string;
  uploadedAt: string;
  status: EvidenceStatus;
  isOther?: boolean;
};

type BackendEvidenceDto = {
  id?: string | number | null;
  projectId?: string | number | null;
  documentType?: string | null;
  fileName?: string | null;
  file?: string | null;
  uploadedBy?: string | null;
  uploadedAt?: string | null;
  status?: string | null;
  department?: string | null;
};

type FetchEvidenceOptions = {
  projectId?: string;
  department?: Department;
  token?: string | null;
};

type UpsertEvidencePayload = {
  projectId: string;
  department: Department;
  documentType: string;
  fileName: string;
  uploadedBy: string;
  uploadedAt?: string;
  status?: EvidenceStatus;
  isOther?: boolean;
};

export type CreateEvidenceMultipartPayload = FormData;

function getEvidenceEndpoints() {
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  const paths = ["/api/evidences", "/api/evidence"];

  if (!base) return paths;
  return paths.flatMap((path) => [`${base}${path}`, path]);
}

function getEvidenceUploadEndpoints() {
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  const paths = ["/api/evidence-documents", "/api/evidences", "/api/evidence"];

  // Uploads must target backend APIs directly in dev. Falling back to relative paths
  // can hit the frontend server and return an HTML 404 page.
  if (!base) return paths;
  return paths.map((path) => `${base}${path}`);
}

function getAuthHeaders(token?: string | null, includeJson = false) {
  const authToken = token ?? getStoredSession().token;
  return {
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };
}

function handleUnauthorizedResponse(response: Response) {
  if (response.status === 401) {
    expireSession();
    throw new Error("Your session has expired. Please sign in again.");
  }
}

async function readApiErrorMessage(response: Response) {
  try {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const data = (await response.json()) as { message?: string; error?: string; details?: string };
      return data.message ?? data.error ?? data.details ?? "";
    }

    const text = await response.text();
    return text.trim();
  } catch {
    return "";
  }
}

function normalizeDepartment(rawDepartment: string | null | undefined): Department {
  const normalized = (rawDepartment ?? "").trim().toLowerCase();
  if (normalized.includes("mechan")) return "mechanical";
  if (normalized.includes("chem")) return "chemical";
  if (normalized.includes("mrv") || normalized.includes("verif")) return "mrv";
  if (normalized.includes("admin")) return "admin";
  return "ic";
}

function normalizeEvidenceStatus(rawStatus: string | null | undefined): EvidenceStatus {
  const normalized = (rawStatus ?? "").trim().toLowerCase();
  if (normalized === "verified") return "verified";
  if (normalized === "rejected") return "rejected";
  return "pending";
}

function hasUploadedEvidence(item: BackendEvidenceDto) {
  return Boolean(item.fileName?.trim() || item.file?.trim());
}

function mapEvidenceItem(item: BackendEvidenceDto): EvidenceItem {
  return {
    id: String(item.id ?? `e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
    projectId: String(item.projectId ?? ""),
    department: normalizeDepartment(item.department),
    documentType: (item.documentType ?? "Evidence document").trim(),
    fileName: (item.fileName ?? item.file ?? "evidence.txt").trim(),
    uploadedBy: (item.uploadedBy ?? "System").trim(),
    uploadedAt: (item.uploadedAt ?? "").trim() || new Date().toISOString().slice(0, 10),
    status: normalizeEvidenceStatus(item.status),
  };
}

function matchesFilter(item: EvidenceItem, options: FetchEvidenceOptions) {
  if (options.projectId && item.projectId !== options.projectId) return false;
  if (options.department && item.department !== options.department) return false;
  return true;
}

function toBackendPayload(payload: UpsertEvidencePayload) {
  const numericProjectId = /^\d+$/.test(payload.projectId) ? Number(payload.projectId) : null;
  return {
    documentType: payload.documentType,
    fileName: payload.fileName,
    uploadedBy: payload.uploadedBy,
    uploadedAt: payload.uploadedAt ?? new Date().toISOString().slice(0, 10),
    status: payload.status ?? "pending",
    department: payload.department,
    project: numericProjectId != null ? { id: numericProjectId } : { id: payload.projectId },
    projectId: numericProjectId ?? payload.projectId,
  };
}

async function fetchEvidenceFromProjectsFallback(options: FetchEvidenceOptions) {
  const projects = await fetchProjectsApi();
  const evidence = projects.flatMap((project) => project.evidences ?? []);
  return evidence.filter((item) => matchesFilter(item as EvidenceItem, options));
}

export async function fetchEvidenceApi(options: FetchEvidenceOptions = {}) {
  const endpoints = getEvidenceEndpoints();
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: getAuthHeaders(options.token),
      });

      if (!response.ok) {
        handleUnauthorizedResponse(response);
        if (response.status === 404) continue;
        lastError = new Error(`Unable to load evidence (${response.status})`);
        continue;
      }

      const data = (await response.json()) as BackendEvidenceDto[];
      const items = data
        .filter(hasUploadedEvidence)
        .map(mapEvidenceItem)
        .filter((item) => item.projectId);
      return items.filter((item) => matchesFilter(item, options));
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unable to load evidence.");
    }
  }

  try {
    return await fetchEvidenceFromProjectsFallback(options);
  } catch {
    throw lastError ?? new Error("Unable to load evidence.");
  }
}

export async function createEvidenceApi(payload: CreateEvidenceMultipartPayload, token?: string | null) {
  const endpoints = getEvidenceUploadEndpoints();
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: payload,
      });

      if (!response.ok) {
        handleUnauthorizedResponse(response);
        const apiMessage = await readApiErrorMessage(response);
        const details = apiMessage ? `: ${apiMessage}` : "";
        lastError = new Error(`Unable to create evidence (${response.status})${details}`);
        continue;
      }

      const data = (await response.json()) as BackendEvidenceDto;
      return mapEvidenceItem(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create evidence.";
      lastError = new Error(`Upload request failed for ${endpoint}: ${message}`);
    }
  }

  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  if (!base) {
    throw new Error("Unable to create evidence. VITE_API_BASE_URL is not set, so upload may be hitting the frontend host.");
  }

  throw lastError ?? new Error("Unable to create evidence.");
}

export async function updateEvidenceApi(evidenceId: string, payload: UpsertEvidencePayload, token?: string | null) {
  const endpoints = getEvidenceEndpoints();
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${endpoint}/${evidenceId}`, {
        method: "PATCH",
        headers: getAuthHeaders(token, true),
        body: JSON.stringify(toBackendPayload(payload)),
      });

      if (!response.ok) {
        handleUnauthorizedResponse(response);
        lastError = new Error(`Unable to update evidence (${response.status})`);
        continue;
      }

      const data = (await response.json()) as BackendEvidenceDto;
      return mapEvidenceItem({ ...data, id: data.id ?? evidenceId, projectId: data.projectId ?? payload.projectId, department: data.department ?? payload.department });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unable to update evidence.");
    }
  }

  throw lastError ?? new Error("Unable to update evidence.");
}

export async function deleteEvidenceApi(evidenceId: string, token?: string | null) {
  const endpoints = getEvidenceEndpoints();
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${endpoint}/${evidenceId}`, {
        method: "DELETE",
        headers: getAuthHeaders(token),
      });

      if (response.ok) return;
      handleUnauthorizedResponse(response);
      lastError = new Error(`Unable to delete evidence (${response.status})`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unable to delete evidence.");
    }
  }

  throw lastError ?? new Error("Unable to delete evidence.");
}
