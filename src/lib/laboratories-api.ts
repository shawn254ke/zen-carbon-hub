import { expireSession, getStoredSession } from "@/lib/auth";

export type LaboratoryResponse = {
  id: string;
  name: string;
  contact?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  documents?: LaboratoryDocumentResponse[];
  createdAt?: string;
  updatedAt?: string;
};

export type LaboratoryDocumentResponse = {
  id: string;
  fileName: string;
  url?: string;
  laboratoryName?: string;
  laboratoryId?: string;
  documentType?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateLaboratoryPayload = {
  name: string;
  contact?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
};

export type UpdateLaboratoryPayload = CreateLaboratoryPayload;

type BackendLaboratoryResponseDto = {
  id?: string | number | null;
  name?: string | null;
  contact?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  documents?: BackendLaboratoryDocumentDto[] | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type BackendLaboratoryDocumentDto = {
  id?: string | number | null;
  fileName?: string | null;
  url?: string | null;
  laboratoryName?: string | null;
  laboratoryId?: string | number | null;
  documentType?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type CreateLaboratoryDocumentPayload = {
  laboratoryId: string;
  laboratoryName?: string;
  documentType: string;
  file: File;
};

export type UploadLaboratoryDocumentSuccess = {
  status: string;
  url?: string;
  message: string;
};

function getLaboratoriesEndpoint() {
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  return base ? `${base}/api/laboratories` : "/api/laboratories";
}

function getLaboratoryDocumentsEndpoints() {
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  const paths = ["/api/laboratories-documents"];

  if (!base) return paths;
  // When an explicit API base URL is configured, always target it directly.
  // Falling back to relative paths can hit the frontend dev server and produce misleading 404/405s.
  return paths.map((path) => `${base}${path}`);
}

function getAuthHeaders(includeJson = false, token?: string | null) {
  const authToken = token ?? getStoredSession().token;
  return {
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };
}

function getOptionalAuthHeaders(token?: string | null) {
  const authToken = token ?? getStoredSession().token;
  return authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
}

async function readApiErrorMessage(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const data = await response
      .json()
      .catch(() => null) as { message?: string; error?: string; details?: string } | null;

    if (data?.message?.trim()) return data.message;
    if (data?.error?.trim()) return data.error;
    if (data?.details?.trim()) return data.details;
  }

  const text = await response.text().catch(() => "");
  return text.trim();
}

function mapLaboratoryDto(lab: BackendLaboratoryResponseDto): LaboratoryResponse {
  return {
    id: String(lab.id ?? ""),
    name: (lab.name ?? "").trim(),
    contact: (lab.contactPerson ?? lab.contact ?? "").trim() || undefined,
    email: (lab.email ?? "").trim() || undefined,
    phone: (lab.phone ?? "").trim() || undefined,
    address: (lab.address ?? "").trim() || undefined,
    notes: (lab.notes ?? "").trim() || undefined,
    documents: (lab.documents ?? [])
      .map((document) => ({
        id: String(document.id ?? ""),
        fileName: (document.fileName ?? "").trim(),
        url: (document.url ?? "").trim() || undefined,
        laboratoryName: (document.laboratoryName ?? "").trim() || undefined,
        laboratoryId: document.laboratoryId == null ? undefined : String(document.laboratoryId),
        documentType: (document.documentType ?? "").trim() || undefined,
        createdAt: (document.createdAt ?? "").trim() || undefined,
        updatedAt: (document.updatedAt ?? "").trim() || undefined,
      }))
      .filter((document) => document.id && document.fileName),
    createdAt: (lab.createdAt ?? "").trim() || undefined,
    updatedAt: (lab.updatedAt ?? "").trim() || undefined,
  };
}

export async function fetchLaboratoriesApi(token?: string | null) {
  const endpoint = getLaboratoriesEndpoint();
  const response = await fetch(endpoint, {
    headers: getAuthHeaders(false, token),
  });

  if (!response.ok) {
    if (response.status === 401) {
      expireSession();
      throw new Error("Your session has expired. Please sign in again.");
    }

    const message = await readApiErrorMessage(response);
    throw new Error(message || `Unable to load laboratories (${response.status})`);
  }

  const data = (await response.json()) as BackendLaboratoryResponseDto[];
  return data.map(mapLaboratoryDto).filter((item) => item.id && item.name);
}

export async function createLaboratoryApi(payload: CreateLaboratoryPayload, token?: string | null) {
  const endpoint = getLaboratoriesEndpoint();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: getAuthHeaders(true, token),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 401) {
      expireSession();
      throw new Error("Your session has expired. Please sign in again.");
    }

    const message = await readApiErrorMessage(response);
    throw new Error(message || `Unable to create laboratory (${response.status})`);
  }
}

export async function updateLaboratoryApi(id: string, payload: UpdateLaboratoryPayload, token?: string | null) {
  const endpoint = getLaboratoriesEndpoint();
  const response = await fetch(`${endpoint}/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(true, token),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 401) {
      expireSession();
      throw new Error("Your session has expired. Please sign in again.");
    }

    const message = await readApiErrorMessage(response);
    throw new Error(message || `Unable to update laboratory (${response.status})`);
  }

  const data = (await response.json()) as BackendLaboratoryResponseDto;
  return mapLaboratoryDto({ ...data, id: data.id ?? id });
}

export async function deleteLaboratoryApi(id: string, token?: string | null) {
  const endpoint = getLaboratoriesEndpoint();
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
    throw new Error(message || `Unable to delete laboratory (${response.status})`);
  }
}

export async function uploadLaboratoryDocumentApi(payload: CreateLaboratoryDocumentPayload, token?: string | null) {
  const endpoints = getLaboratoryDocumentsEndpoints();
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const formData = new FormData();
      formData.append("laboratoryId", payload.laboratoryId);
      formData.append("documentType", payload.documentType);
      formData.append("fileName", payload.file.name);
      if (payload.laboratoryName?.trim()) {
        formData.append("laboratoryName", payload.laboratoryName.trim());
      }
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
        lastError = new Error(message || `Unable to upload laboratory document (${response.status})`);
        continue;
      }

      const data = (await response.json().catch(() => null)) as {
        Status?: string;
        status?: string;
        Url?: string;
        url?: string;
        message?: string;
      } | null;

      return {
        status: (data?.Status ?? data?.status ?? "SUCCESS").trim(),
        url: (data?.Url ?? data?.url ?? "").trim() || undefined,
        message: (data?.message ?? "File uploaded successfully").trim(),
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unable to upload laboratory document.");
    }
  }

  throw lastError ?? new Error("Unable to upload laboratory document.");
}

export async function deleteLaboratoryDocumentApi(documentId: string, token?: string | null) {
  if (!/^\d+$/.test(String(documentId).trim())) {
    throw new Error("Invalid document id for deletion.");
  }

  const endpoints = getLaboratoryDocumentsEndpoints();
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const target = `${endpoint}/${documentId}`;
      const unauthenticated = await fetch(target, {
        method: "DELETE",
      });

      if (unauthenticated.ok) return;

      if (unauthenticated.status === 401) {
        const authenticated = await fetch(target, {
          method: "DELETE",
          headers: getOptionalAuthHeaders(token),
        });

        if (authenticated.ok) return;
        if (authenticated.status === 401) {
          expireSession();
          throw new Error("Your session has expired. Please sign in again.");
        }

        const authedMessage = await readApiErrorMessage(authenticated);
        lastError = new Error(authedMessage || `Unable to delete laboratory document (${authenticated.status}) at ${target}`);
        continue;
      }

      const message = await readApiErrorMessage(unauthenticated);
      lastError = new Error(message || `Unable to delete laboratory document (${unauthenticated.status}) at ${target}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unable to delete laboratory document.");
    }
  }

  throw lastError ?? new Error("Unable to delete laboratory document.");
}

export async function downloadLaboratoryDocumentApi(documentId: string, token?: string | null, fallbackFileName?: string) {
  if (!/^\d+$/.test(String(documentId).trim())) {
    throw new Error("Invalid document id for download.");
  }

  const endpoints = getLaboratoryDocumentsEndpoints();
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const target = `${endpoint}/${documentId}`;
      let response = await fetch(target, {
        method: "GET",
      });

      if (response.status === 401) {
        response = await fetch(target, {
          method: "GET",
          headers: getOptionalAuthHeaders(token),
        });
      }

      if (!response.ok) {
        if (response.status === 401) {
          expireSession();
          throw new Error("Your session has expired. Please sign in again.");
        }

        const message = await readApiErrorMessage(response);
        lastError = new Error(message || `Unable to download laboratory document (${response.status}) at ${target}`);
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
        fileName: (decodedEncodedName ?? matchedFileName ?? safeFallbackName) || `laboratory-document-${documentId}`,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unable to download laboratory document.");
    }
  }

  throw lastError ?? new Error("Unable to download laboratory document.");
}
