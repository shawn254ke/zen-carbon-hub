import { expireSession, getStoredSession } from "@/lib/auth";

export type LaboratoryResultStatus = "reported" | "in_progress";
export type LaboratoryResultBackendStatus = "PENDING" | "RECEIVED" | "VERIFIED" | "REJECTED";

export type LaboratoryResultItem = {
  id: string;
  projectId: string;
  projectName?: string;
  batchId?: string;
  batchName?: string;
  laboratoryId?: string;
  labName: string;
  laboratoryName: string;
  testName: string;
  result: string;
  status: LaboratoryResultStatus;
  sampleDate: string;
  reportDate: string;
  fileName?: string;
  uploadedById?: string;
  uploadedByName?: string;
};

export type UploadLaboratoryResultPayload = {
  projectId: string;
  projectName?: string;
  batchId?: string;
  laboratoryId: string;
  laboratoryName?: string;
  test: string;
  results: string;
  fileName: string;
  status: LaboratoryResultBackendStatus;
  sampleDate: string;
  reportDate?: string;
  uploadedById: string;
  uploadedByName?: string;
  file: File;
};

type BackendLaboratoryResultDto = {
  id?: string | number | null;
  projectId?: string | number | null;
  projectName?: string | null;
  batchId?: string | number | null;
  batchName?: string | null;
  laboratoryId?: string | number | null;
  laboratoryName?: string | null;
  test?: string | null;
  results?: string | number | null;
  resultFile?: string | null;
  fileName?: string | null;
  status?: string | null;
  sampleDate?: string | null;
  reportDate?: string | null;
  uploadedById?: string | number | null;
  uploadedByName?: string | null;
};

function getBaseApiUrl() {
  return import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
}

function getLaboratoryResultsEndpoint() {
  const base = getBaseApiUrl();
  return base ? `${base}/api/laboratory-results` : "/api/laboratory-results";
}

function getAuthHeaders(includeJson = false, token?: string | null) {
  const authToken = token ?? getStoredSession().token;
  return {
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };
}

async function readApiErrorMessage(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const data = (await response.json().catch(() => null)) as {
      message?: string;
      error?: string;
      details?: string;
    } | null;
    return data?.message ?? data?.error ?? data?.details ?? "";
  }

  return (await response.text().catch(() => "")).trim();
}

function normalizeStatus(rawStatus: string | null | undefined): LaboratoryResultStatus {
  const normalized = (rawStatus ?? "").trim().toLowerCase();
  if (normalized === "reported" || normalized === "completed" || normalized === "complete") {
    return "reported";
  }

  return "in_progress";
}

function normalizeDate(rawDate: string | null | undefined) {
  if (!rawDate) return "";
  const normalized = rawDate.trim();
  if (!normalized) return "";
  return normalized.includes("T") ? normalized.slice(0, 10) : normalized;
}

function toBackendStatus(status: LaboratoryResultStatus | LaboratoryResultBackendStatus) {
  if (status === "reported") return "COMPLETED";
  if (status === "in_progress") return "PENDING";
  return status;
}

function toBackendDateTime(date: string) {
  const trimmed = date.trim();
  if (!trimmed) return "";
  return trimmed.includes("T") ? trimmed : `${trimmed}T00:00:00`;
}

function mapLaboratoryResult(dto: BackendLaboratoryResultDto): LaboratoryResultItem {
  return {
    id: String(dto.id ?? ""),
    projectId: String(dto.projectId ?? ""),
    projectName: (dto.projectName ?? "").trim() || undefined,
    batchId: dto.batchId == null ? undefined : String(dto.batchId),
    batchName: (dto.batchName ?? "").trim() || undefined,
    laboratoryId: dto.laboratoryId == null ? undefined : String(dto.laboratoryId),
    labName: (dto.laboratoryName ?? "").trim() || "Unknown lab",
    laboratoryName: (dto.laboratoryName ?? "").trim() || "Unknown lab",
    testName: (dto.test ?? "").trim() || "Untitled test",
    result: String(dto.results ?? "").trim() || "—",
    status: normalizeStatus(dto.status),
    sampleDate: normalizeDate(dto.sampleDate),
    reportDate: normalizeDate(dto.reportDate),
    fileName: (dto.fileName ?? "").trim() || undefined,
    uploadedById: dto.uploadedById == null ? undefined : String(dto.uploadedById),
    uploadedByName: (dto.uploadedByName ?? "").trim() || undefined,
  };
}

export async function fetchLaboratoryResultsApi(token?: string | null) {
  const endpoint = getLaboratoryResultsEndpoint();
  const response = await fetch(endpoint, {
    headers: getAuthHeaders(false, token),
  });

  if (!response.ok) {
    if (response.status === 401) {
      expireSession();
      throw new Error("Your session has expired. Please sign in again.");
    }

    const message = await readApiErrorMessage(response);
    throw new Error(message || `Unable to load laboratory results (${response.status})`);
  }

  const data = (await response.json()) as BackendLaboratoryResultDto[];
  return data.map(mapLaboratoryResult).filter((item) => item.id);
}

export async function createLaboratoryResultApi(payload: UploadLaboratoryResultPayload, token?: string | null) {
  const endpoint = getLaboratoryResultsEndpoint();
  const formData = new FormData();

  formData.append("projectId", payload.projectId);
  if (payload.projectName?.trim()) formData.append("projectName", payload.projectName.trim());
  if (payload.batchId?.trim()) formData.append("batchId", payload.batchId.trim());
  formData.append("laboratoryId", payload.laboratoryId);
  if (payload.laboratoryName?.trim()) formData.append("laboratoryName", payload.laboratoryName.trim());
  formData.append("test", payload.test);
  formData.append("results", payload.results);
  formData.append("fileName", payload.fileName);
  formData.append("status", toBackendStatus(payload.status));
  formData.append("sampleDate", toBackendDateTime(payload.sampleDate));
  if (payload.reportDate?.trim()) formData.append("reportDate", toBackendDateTime(payload.reportDate.trim()));
  formData.append("uploadedById", payload.uploadedById);
  if (payload.uploadedByName?.trim()) formData.append("uploadedByName", payload.uploadedByName.trim());
  formData.append("file", payload.file);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: getAuthHeaders(false, token),
    body: formData,
  });

  if (!response.ok) {
    if (response.status === 401) {
      expireSession();
      throw new Error("Your session has expired. Please sign in again.");
    }

    const message = await readApiErrorMessage(response);
    throw new Error(message || `Unable to upload laboratory result (${response.status})`);
  }
}

export async function deleteLaboratoryResultApi(id: string, token?: string | null) {
  if (!/^\d+$/.test(id.trim())) {
    throw new Error("Invalid laboratory result id for deletion.");
  }

  const endpoint = getLaboratoryResultsEndpoint();
  const response = await fetch(`${endpoint}/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(false, token),
  });

  if (!response.ok) {
    if (response.status === 401) {
      expireSession();
      throw new Error("Your session has expired. Please sign in again.");
    }

    const message = await readApiErrorMessage(response);
    throw new Error(message || `Unable to delete laboratory result (${response.status})`);
  }
}

export async function downloadLaboratoryResultApi(id: string, fallbackFileName?: string, token?: string | null) {
  if (!/^\d+$/.test(id.trim())) {
    throw new Error("Invalid laboratory result id for download.");
  }

  const endpoint = getLaboratoryResultsEndpoint();
  const downloadCandidates = [
    `${endpoint}/${id}/download`,
    `${endpoint}/download/${id}`,
    `${endpoint}/${id}`,
  ];

  let lastError: Error | null = null;

  for (const candidate of downloadCandidates) {
    try {
      const response = await fetch(candidate, {
        method: "GET",
        headers: getAuthHeaders(false, token),
      });

      if (!response.ok) {
        if (response.status === 401) {
          expireSession();
          throw new Error("Your session has expired. Please sign in again.");
        }
        const message = await readApiErrorMessage(response);
        lastError = new Error(message || `Unable to download laboratory result (${response.status})`);
        continue;
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        // This candidate likely points to the details endpoint, not file download.
        lastError = new Error("Endpoint returned JSON instead of a file download.");
        continue;
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const encodedFileName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const decodedEncodedName = encodedFileName ? decodeURIComponent(encodedFileName) : undefined;
      const matchedFileName = disposition.match(/filename=\"?([^\";]+)\"?/i)?.[1];

      const safeFallbackName = (fallbackFileName ?? "").trim();
      return {
        blob,
        fileName: (decodedEncodedName ?? matchedFileName ?? safeFallbackName ?? "").trim() || `laboratory-result-${id}`,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unable to download laboratory result.");
    }
  }

  throw lastError ?? new Error("Unable to download laboratory result.");
}
