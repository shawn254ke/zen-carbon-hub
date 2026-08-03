import { getStoredSession } from "@/lib/auth";
import { expireSession } from "@/lib/auth";
import { type Project as ProjectModel } from "@/models/project.model";
import { type EvidenceChecklist as EvidenceChecklistModel } from "@/models/evidence-checklist.model";
import { type LaboratoryResult as LaboratoryResultModel } from "@/models/laboratory-result.model";
import { type EmissionActivity as EmissionActivityModel } from "@/models/emission-activity.model";
import { type Batch as BatchModel } from "@/models/batch.model";
import { type LaboratoryAnalysis as LaboratoryAnalysisModel } from "@/models/laboratory-analysis.model";

export type ProjectCategory = "industrial" | "internal";
export type Department = "ic" | "mechanical" | "chemical" | "mrv" | "admin";
export type ProjectStatus = "active" | "planning" | "verification" | "closed";
export type EvidenceStatus = "pending" | "verified" | "rejected";
export type LabResultStatus = "reported" | "in_progress";
export type BatchStatus = "complete" | "in_progress" | "failed";

export type EvidenceItem = {
  id: string;
  documentId?: string;
  projectId: string;
  department: Department;
  documentType: string;
  fileName: string;
  uploadedBy: string;
  uploadedAt: string;
  status: EvidenceStatus;
  item?: EvidenceChecklistModel["item"];
  departmentName?: EvidenceChecklistModel["departmentName"];
  projectName?: EvidenceChecklistModel["projectName"];
  createdAt?: EvidenceChecklistModel["createdAt"];
  updatedAt?: EvidenceChecklistModel["updatedAt"];
  documents?: EvidenceChecklistModel["documents"];
};

export type ProjectChecklistTemplate = {
  id: string;
  projectId: string | null;
  department: Department;
  label: string;
};

export type LabResult = {
  id: string;
  projectId: string;
  batchId?: string;
  testName: string;
  labName: string;
  sampleDate: string;
  reportDate: string;
  result: string;
  status: LabResultStatus;
  test?: LaboratoryResultModel["test"];
  results?: LaboratoryResultModel["results"];
  resultFile?: LaboratoryResultModel["resultFile"];
};

export type EmissionActivity = {
  id: string;
  projectId: string;
  scope: "scope1" | "scope2" | "scope3" | "removals";
  activity: EmissionActivityModel["activity"];
  period: string;
  tco2e: number;
  status?: EmissionActivityModel["status"];
};

export type Batch = {
  id: string;
  projectId: string;
  code: string;
  runDate: string;
  feedstock: string;
  massKg: number;
  yieldKg: number;
  temperatureC: number;
  status: BatchStatus;
  timestamp?: BatchModel["timestamp"];
  energy?: BatchModel["energy"];
  cement?: BatchModel["cement"];
  fines?: BatchModel["fines"];
  coarse?: BatchModel["coarse"];
  addMixture?: BatchModel["addMixture"];
  initialPh?: BatchModel["initialPH"];
  finalPh?: BatchModel["finalPH"];
  co2Injected?: BatchModel["co2Injected"];
  dissolvedCo2?: BatchModel["dissolvedCO2"];
  waterUsed?: BatchModel["waterUsed"];
  initialTemp?: number;
  finalTemp?: number;
  initialPressure?: number;
  finalPressure?: number;
  initialFlowRate?: number;
  finalFlowRate?: number;
};

export type LaboratoryAnalysis = {
  id: string;
  labResultId?: string;
  fileName: string;
  summary?: string;
  findings?: LaboratoryAnalysisModel["findings"];
  recommendations?: LaboratoryAnalysisModel["recommendations"];
  uploadedBy?: string;
};

export type Project = {
  id: string;
  name: ProjectModel["name"];
  code: ProjectModel["code"];
  location: ProjectModel["location"];
  methodology: ProjectModel["methodology"];
  batches?: ProjectModel["batches"];
  tCo2mineralized?: ProjectModel["tCo2mineralized"];
  category: ProjectCategory;
  pathway?: "liquid_co2" | "carbonated_water";
  status: ProjectStatus;
  startDate?: string;
  registry?: string;
  emissionsAvoidedTco2e?: number;
  batchesRun?: number;
  evidencesCount?: number | string;
  labCount?: number | string;
  evidences?: EvidenceItem[];
  checklistTemplates?: ProjectChecklistTemplate[];
  labResults?: LabResult[];
  emissions?: EmissionActivity[];
  batch?: Batch[];
  labAnalysis?: LaboratoryAnalysis[];
};

type ProjectMutationPayload = {
  name: string;
  code: string;
  location: string;
  methodology: string;
  project_type_id: string;
  status: string;
  pathway: "liquid_co2" | "carbonated_water";
};

type BackendProjectDto = {
  id?: string | number | null;
  name?: string | null;
  code?: string | null;
  location?: string | null;
  methodology?: string | null;
  pathway?: string | null;
  startDate?: string | null;
  batches?: string | number | null;
  tCo2mineralized?: string | number | null;
  Category?: string | null;
  category?: string | null;
  evidencesCount?: string | number | null;
  labCount?: string | number | null;
  evidences?: BackendEvidenceDto[] | null;
  labResults?: BackendLabResultDto[] | null;
  emissions?: BackendEmissionDto[] | null;
  batch?: BackendBatchDto[] | null;
  labAnalysis?: BackendLabAnalysisDto[] | null;
  Status?: string | null;
  status?: string | null;
};

type BackendEvidenceDto = {
  id?: string | number | null;
  projectId?: string | number | null;
  projectName?: string | null;
  departmentId?: string | number | null;
  departmentName?: string | null;
  documentType?: string | null;
  fileName?: string | null;
  file?: string | null;
  uploadedBy?: string | null;
  uploadedAt?: string | null;
  status?: string | null;
  department?: string | null;
  item?: string | null;
  documents?: BackendEvidenceDocumentDto[] | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type BackendEvidenceDocumentDto = {
  id?: string | number | null;
  DocumentType?: string | null;
  checklistId?: string | number | null;
  uploadedById?: string | number | null;
  uploadedByName?: string | null;
  fileName?: string | null;
  version?: string | null;
  uploadURL?: string | null;
  uploadDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  status?: string | null;
};

type BackendLabResultDto = {
  id?: string | number | null;
  projectId?: string | number | null;
  test?: string | null;
  testName?: string | null;
  resultFile?: string | null;
  result?: string | number | null;
  results?: string | number | null;
  sampleDate?: string | null;
  reportDate?: string | null;
  status?: string | null;
  batch?: { id?: string | number | null; batchNumber?: string | null } | null;
  lab?: { name?: string | null } | null;
};

type BackendEmissionDto = {
  id?: string | number | null;
  scope?: string | null;
  activity?: string | null;
  period?: string | null;
  tco2e?: string | number | null;
  tCo2e?: string | number | null;
};

type BackendBatchDto = {
  id?: string | number | null;
  projectId?: string | number | null;
  batchNumber?: string | null;
  cement?: string | number | null;
  fines?: string | number | null;
  coarse?: string | number | null;
  addMixture?: string | number | null;
  initialPH?: string | number | null;
  finalPH?: string | number | null;
  co2Injected?: string | number | null;
  dissolvedCO2?: string | number | null;
  waterUsed?: string | number | null;
  initialTemp?: string | number | null;
  finalTemp?: string | number | null;
  initialPressure?: string | number | null;
  finalPressure?: string | number | null;
  initialFlowRate?: string | number | null;
  finalFlowRate?: string | number | null;
  energy?: string | null;
  timestamp?: string | null;
  status?: string | null;
};

type BackendLabAnalysisDto = {
  id?: string | number | null;
  file?: string | null;
  summary?: string | number | null;
  findings?: string | null;
  recommendations?: string | null;
  uploadedBy?: string | null;
  laboratoryResult?: { id?: string | number | null } | null;
};

let projectsCache: Project[] = [];

function getProjectsEndpoints() {
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  // When an explicit API base URL is configured, always target it directly.
  // Falling back to relative paths can hit the frontend dev server and produce misleading 404s.
  return base ? [`${base}/api/projects`] : ["/api/projects"];
}

function getProjectBackendId(projectId: string) {
  const parsed = Number(projectId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("This project cannot be synced because its backend id is missing.");
  }
  return parsed;
}

function normalizeCategory(rawCategory: string | null | undefined): ProjectCategory {
  const normalized = (rawCategory ?? "").trim().toLowerCase();

  if (normalized === "internal" || normalized === "industrial") {
    return normalized;
  }

  return "industrial";
}

function normalizePathway(rawPathway: string | null | undefined): Project["pathway"] {
  const normalized = (rawPathway ?? "").trim().toLowerCase();
  if (normalized === "liquid_co2" || normalized === "carbonated_water") {
    return normalized;
  }
  return undefined;
}

function normalizeDepartment(rawDepartment: string | null | undefined): Department {
  const normalized = (rawDepartment ?? "").trim().toLowerCase();
  if (normalized.includes("mechan")) return "mechanical";
  if (normalized.includes("chem")) return "chemical";
  if (normalized.includes("mrv") || normalized.includes("verif")) return "mrv";
  if (normalized.includes("admin")) return "admin";
  return "ic";
}

function toNumber(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLabStatus(rawStatus: string | null | undefined): LabResult["status"] {
  const normalized = (rawStatus ?? "").trim().toLowerCase();
  if (normalized === "reported" || normalized === "complete" || normalized === "completed") {
    return "reported";
  }

  return "in_progress";
}

function normalizeBatchStatus(rawStatus: string | null | undefined): Batch["status"] {
  const normalized = (rawStatus ?? "").trim().toLowerCase();
  if (normalized === "complete" || normalized === "completed") return "complete";
  if (normalized === "failed") return "failed";
  return "in_progress";
}

function normalizeEvidenceStatus(rawStatus: string | null | undefined): EvidenceItem["status"] {
  const normalized = (rawStatus ?? "").trim().toLowerCase();
  if (normalized === "verified") return "verified";
  if (normalized === "rejected") return "rejected";
  return "pending";
}

function hasUploadedEvidence(item: BackendEvidenceDto) {
  const primaryDocument = item.documents?.[0];
  return Boolean(
    primaryDocument?.fileName?.trim()
      || primaryDocument?.uploadURL?.trim()
      || item.fileName?.trim()
      || item.file?.trim(),
  );
}

function resolveChecklistTemplateLabel(item: BackendEvidenceDto) {
  return (item.item ?? item.documentType ?? "").trim();
}

function mapChecklistTemplates(items: BackendEvidenceDto[] | null | undefined, projectId: string): ProjectChecklistTemplate[] {
  if (!items) return [];
  const templates: ProjectChecklistTemplate[] = [];
  const seen = new Set<string>();

  items.forEach((item, index) => {
    const label = resolveChecklistTemplateLabel(item);
    if (!label) return;

    const department = normalizeDepartment(item.departmentName ?? item.department);
    const templateProjectId = item.projectId != null ? String(item.projectId) : null;
    const key = `${department}|${templateProjectId ?? projectId}|${label.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);

    templates.push({
      id: String(item.id ?? `tmpl_${projectId}_${index}`),
      projectId: templateProjectId,
      department,
      label,
    });
  });

  return templates;
}

function mapEvidenceItems(items: BackendEvidenceDto[] | null | undefined, projectId: string): EvidenceItem[] {
  if (!items) return [];
  return items
    .filter(hasUploadedEvidence)
    .map((item, index) => {
    const primaryDocument = item.documents?.[0];
    const documents = (item.documents ?? []).map((doc) => ({
      id: Number(doc.id ?? 0),
      documentType: (doc.DocumentType ?? item.documentType ?? item.item ?? "Evidence document").trim(),
      checklistId: Number(doc.checklistId ?? item.id ?? 0),
      uploadedById: Number(doc.uploadedById ?? 0),
      uploadedByName: (doc.uploadedByName ?? item.uploadedBy ?? "System").trim(),
      fileName: (doc.fileName ?? item.fileName ?? item.file ?? `evidence_${index + 1}.txt`).trim(),
      version: (doc.version ?? "v1").trim(),
      uploadURL: (doc.uploadURL ?? item.file ?? "").trim(),
      uploadDate: (doc.uploadDate ?? item.uploadedAt ?? item.createdAt ?? "").trim(),
      createdAt: (doc.createdAt ?? item.createdAt ?? "").trim(),
      updatedAt: (doc.updatedAt ?? item.updatedAt ?? "").trim(),
    }));

    return {
      id: String(item.id ?? `e_${projectId}_${index}`),
      documentId: primaryDocument?.id == null ? undefined : String(primaryDocument.id),
      projectId: String(item.projectId ?? projectId),
      department: normalizeDepartment(item.departmentName ?? item.department),
      documentType: (item.item ?? item.documentType ?? primaryDocument?.DocumentType ?? "Evidence document").trim(),
      fileName: (primaryDocument?.fileName ?? item.fileName ?? item.file ?? `evidence_${index + 1}.txt`).trim(),
      uploadedBy: (primaryDocument?.uploadedByName ?? item.uploadedBy ?? "System").trim(),
      uploadedAt: (primaryDocument?.createdAt ?? item.uploadedAt ?? item.createdAt ?? "—").slice(0, 10),
      status: normalizeEvidenceStatus(primaryDocument?.status ?? item.status),
      item: item.item?.trim() || undefined,
      departmentName: item.departmentName?.trim() || undefined,
      projectName: item.projectName?.trim() || undefined,
      createdAt: item.createdAt?.trim() || undefined,
      updatedAt: item.updatedAt?.trim() || undefined,
      documents,
    };
    });
}

function mapLabResults(items: BackendLabResultDto[] | null | undefined, projectId: string): LabResult[] {
  if (!items) return [];
  return items.map((item, index) => ({
    id: String(item.id ?? `l_${projectId}_${index}`),
    projectId,
    batchId: item.batch?.id != null ? String(item.batch.id) : undefined,
    testName: (item.testName ?? item.test ?? `Test ${index + 1}`).trim(),
    labName: (item.lab?.name ?? "Laboratory").trim(),
    sampleDate: (item.sampleDate ?? "—").trim(),
    reportDate: (item.reportDate ?? "").trim(),
    result: String(item.result ?? item.results ?? item.resultFile ?? "—"),
    status: normalizeLabStatus(item.status),
  }));
}

function mapEmissions(items: BackendEmissionDto[] | null | undefined, projectId: string): EmissionActivity[] {
  if (!items) return [];
  return items.map((item, index) => ({
    id: String(item.id ?? `em_${projectId}_${index}`),
    projectId,
    scope: ((item.scope ?? "scope1").trim().toLowerCase() as EmissionActivity["scope"]),
    activity: (item.activity ?? "Emission activity").trim(),
    period: (item.period ?? "—").trim(),
    tco2e: toNumber(item.tco2e ?? item.tCo2e),
  }));
}

function mapBatches(items: BackendBatchDto[] | null | undefined, projectId: string): Batch[] {
  if (!items) return [];
  return items.map((item, index) => ({
    id: String(item.id ?? `b_${projectId}_${index}`),
    projectId: String(item.projectId ?? projectId),
    code: (item.batchNumber ?? `B-${index + 1}`).trim(),
    runDate: (item.timestamp ?? "—").slice(0, 10),
    feedstock: "—",
    massKg: 0,
    yieldKg: 0,
    temperatureC: 0,
    status: normalizeBatchStatus(item.status),
    timestamp: item.timestamp ?? undefined,
    energy: item.energy ?? undefined,
    cement: item.cement != null ? toNumber(item.cement) : undefined,
    fines: item.fines != null ? toNumber(item.fines) : undefined,
    coarse: item.coarse != null ? toNumber(item.coarse) : undefined,
    addMixture: item.addMixture != null ? toNumber(item.addMixture) : undefined,
    initialPh: item.initialPH != null ? toNumber(item.initialPH) : undefined,
    finalPh: item.finalPH != null ? toNumber(item.finalPH) : undefined,
    co2Injected: item.co2Injected != null ? toNumber(item.co2Injected) : undefined,
    dissolvedCo2: item.dissolvedCO2 != null ? toNumber(item.dissolvedCO2) : undefined,
    waterUsed: item.waterUsed != null ? toNumber(item.waterUsed) : undefined,
    initialTemp: item.initialTemp != null ? toNumber(item.initialTemp) : undefined,
    finalTemp: item.finalTemp != null ? toNumber(item.finalTemp) : undefined,
    initialPressure: item.initialPressure != null ? toNumber(item.initialPressure) : undefined,
    finalPressure: item.finalPressure != null ? toNumber(item.finalPressure) : undefined,
    initialFlowRate: item.initialFlowRate != null ? toNumber(item.initialFlowRate) : undefined,
    finalFlowRate: item.finalFlowRate != null ? toNumber(item.finalFlowRate) : undefined,
  }));
}

function mapLabAnalyses(items: BackendLabAnalysisDto[] | null | undefined): LaboratoryAnalysis[] {
  if (!items) return [];
  return items.map((item, index) => ({
    id: String(item.id ?? `analysis_${index}`),
    labResultId: item.laboratoryResult?.id != null ? String(item.laboratoryResult.id) : undefined,
    fileName: (item.file ?? `analysis_${index + 1}.txt`).trim(),
    summary: item.summary != null ? String(item.summary) : undefined,
    findings: item.findings?.trim() || undefined,
    recommendations: item.recommendations?.trim() || undefined,
    uploadedBy: item.uploadedBy?.trim() || undefined,
  }));
}

function normalizeStatus(rawStatus: string | null | undefined): Project["status"] {
  const normalized = (rawStatus ?? "").trim().toLowerCase();

  switch (normalized) {
    case "active":
      return "active";
    case "verification":
      return "verification";
    case "closed":
      return "closed";
    case "draft":
    case "planning":
    default:
      return "planning";
  }
}

function mapBackendProject(project: BackendProjectDto, index: number): Project {
  const code = project.code?.trim() || `PROJECT-${index + 1}`;
  const projectId = String(project.id ?? code);
  const category = normalizeCategory(project.Category ?? project.category);
  const totalTco2 = Number(project.tCo2mineralized ?? 0);
  const batchesRun = Number(project.batches ?? 0);
  const evidences = mapEvidenceItems(project.evidences, projectId);
  const checklistTemplates = mapChecklistTemplates(project.evidences, projectId);
  const labResults = mapLabResults(project.labResults, projectId);
  const emissions = mapEmissions(project.emissions, projectId);
  const batch = mapBatches(project.batch, projectId);
  const labAnalysis = mapLabAnalyses(project.labAnalysis);

  return {
    id: projectId,
    code,
    name: project.name?.trim() || code,
    category,
    pathway: normalizePathway(project.pathway),
    status: normalizeStatus(project.Status ?? project.status),
    location: project.location?.trim() || "—",
    registry: category === "industrial" ? "Isometric" : undefined,
    methodology: project.methodology?.trim() || "",
    startDate: project.startDate?.trim() || "—",
    emissionsAvoidedTco2e: Number.isFinite(totalTco2) ? totalTco2 : 0,
    batchesRun: Number.isFinite(batchesRun) ? batchesRun : 0,
    evidencesCount: toNumber(project.evidencesCount) || evidences.length,
    labCount: toNumber(project.labCount) || labResults.length,
    evidences,
    checklistTemplates,
    labResults,
    emissions,
    batch,
    labAnalysis,
  };
}

export function getProjectsCache() {
  return projectsCache;
}

export function setProjectsCache(projects: Project[]) {
  projectsCache = projects;
  return projectsCache;
}

export function upsertProjectCache(project: Project) {
  const index = projectsCache.findIndex((item) => item.id === project.id);
  if (index >= 0) {
    projectsCache[index] = project;
  } else {
    projectsCache = [project, ...projectsCache];
  }
  return projectsCache;
}

export function removeProjectFromCache(projectId: string) {
  projectsCache = projectsCache.filter((project) => project.id !== projectId);
  return projectsCache;
}

export async function fetchProjectsApi(token?: string | null) {
  const authToken = token ?? getStoredSession().token;
  const endpoints = getProjectsEndpoints();

  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      });

      if (!response.ok) {
        if (response.status === 401) {
          expireSession();
          throw new Error("Your session has expired. Please sign in again.");
        }
        lastError = new Error(`Unable to load projects (${response.status})`);
        continue;
      }

      const data = (await response.json()) as BackendProjectDto[];
      return setProjectsCache(data.map(mapBackendProject));
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unable to load projects");
    }
  }

  throw lastError ?? new Error("Unable to load projects");
}

export async function updateProjectApi(
  projectId: string,
  payload: ProjectMutationPayload,
  token?: string | null,
) {
  const authToken = token ?? getStoredSession().token;
  const backendId = getProjectBackendId(projectId);
  const endpoints = getProjectsEndpoints();

  let lastMessage = "Unable to update project right now.";

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${endpoint}/${backendId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text().catch(() => "");

      if (response.ok) {
        return;
      }

      if (response.status === 401) {
        expireSession();
        throw new Error("Your session has expired. Please sign in again.");
      }

      lastMessage = text || `Update project failed (${response.status})`;
    } catch {
      lastMessage = "Unable to reach the project service.";
    }
  }

  throw new Error(lastMessage);
}

export async function deleteProjectApi(projectId: string, token?: string | null) {
  const authToken = token ?? getStoredSession().token;
  const backendId = getProjectBackendId(projectId);
  const endpoints = getProjectsEndpoints();

  let lastMessage = "Unable to delete project right now.";

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${endpoint}/${backendId}`, {
        method: "DELETE",
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      });

      if (response.ok) {
        return;
      }

      if (response.status === 401) {
        expireSession();
        throw new Error("Your session has expired. Please sign in again.");
      }

      const text = await response.text().catch(() => "");
      lastMessage = text || `Delete project failed (${response.status})`;
    } catch {
      lastMessage = "Unable to reach the project service.";
    }
  }

  throw new Error(lastMessage);
}