export type ProjectCategory = "industrial" | "internal";

export type Project = {
  id: string;
  code: string;
  name: string;
  category: ProjectCategory;
  pathway?: "liquid_co2" | "carbonated_water";
  status: "active" | "planning" | "verification" | "closed";
  location: string;
  registry?: string;
  methodology?: string;
  startDate: string;
  emissionsAvoidedTco2e: number;
  batchesRun: number;
  evidencesCount?: number;
  labCount?: number;
  evidences?: EvidenceItem[];
  labResults?: LabResult[];
  emissions?: EmissionActivity[];
  batch?: Batch[];
  labAnalysis?: LaboratoryAnalysis[];
};

export type LaboratoryAnalysis = {
  id: string;
  labResultId?: string;
  fileName: string;
  summary?: string;
  findings?: string;
  recommendations?: string;
  uploadedBy?: string;
};

export const PROJECTS: Project[] = [
  
];

export type Batch = {
  id: string;
  projectId: string;
  code: string;
  runDate: string;
  feedstock: string;
  massKg: number;
  yieldKg: number;
  temperatureC: number;
  status: "complete" | "in_progress" | "failed";
};

export const BATCHES: Batch[] = [
  { id: "b_1", projectId: "p_003", code: "B-014-024", runDate: "2025-05-28", feedstock: "Coffee husk", massKg: 120, yieldKg: 34, temperatureC: 520, status: "complete" },
  { id: "b_2", projectId: "p_003", code: "B-014-023", runDate: "2025-05-24", feedstock: "Coffee husk", massKg: 118, yieldKg: 31, temperatureC: 505, status: "complete" },
  { id: "b_3", projectId: "p_003", code: "B-014-022", runDate: "2025-05-20", feedstock: "Coffee husk + rice hulls", massKg: 122, yieldKg: 29, temperatureC: 490, status: "complete" },
  { id: "b_4", projectId: "p_004", code: "B-015-006", runDate: "2025-05-30", feedstock: "Macadamia shells", massKg: 80, yieldKg: 22, temperatureC: 540, status: "in_progress" },
];

export type Department = "ic" | "mechanical" | "chemical" | "mrv" | "admin";

export const DEPARTMENTS: { key: Department; label: string; description: string }[] = [
  { key: "ic", label: "Instrumentation & Control", description: "Sensors, controllers, calibration" },
  { key: "mechanical", label: "Mechanical", description: "Reactor, mechanical drawings, maintenance" },
  { key: "chemical", label: "Chemical / Process", description: "Process flow, mass balance" },
  { key: "mrv", label: "MRV", description: "Monitoring, reporting, verification" },
  { key: "admin", label: "Administration", description: "Permits, accreditations, compliance" },
];

export const CHECKLIST: Record<Department, string[]> = {
  ic: [],
  mechanical: [],
  chemical: [],
  mrv: [],
  admin: [],
};

export type EvidenceItem = {
  id: string;
  projectId: string;
  department: Department;
  documentType: string;
  fileName: string;
  uploadedBy: string;
  uploadedAt: string;
  status: "pending" | "verified" | "rejected";
  isOther?: boolean;
};

export const EVIDENCE: EvidenceItem[] = [
  { id: "e_1", projectId: "p_001", department: "ic", documentType: "Sensor datasheets", fileName: "thermocouple-K-type.pdf", uploadedBy: "J. Mwangi", uploadedAt: "2025-04-10", status: "verified" },
  { id: "e_2", projectId: "p_001", department: "ic", documentType: "Calibration certificates", fileName: "calibration-2025Q1.pdf", uploadedBy: "J. Mwangi", uploadedAt: "2025-04-11", status: "verified" },
  { id: "e_3", projectId: "p_001", department: "mechanical", documentType: "Technical drawings", fileName: "reactor-v3.dwg.pdf", uploadedBy: "L. Otieno", uploadedAt: "2025-03-22", status: "verified" },
  { id: "e_4", projectId: "p_001", department: "chemical", documentType: "Process flow diagrams", fileName: "pfd-rev2.pdf", uploadedBy: "S. Kariuki", uploadedAt: "2025-03-30", status: "pending" },
  { id: "e_5", projectId: "p_001", department: "mrv", documentType: "MRV plan", fileName: "mrv-plan-v1.pdf", uploadedBy: "N. Achieng", uploadedAt: "2025-05-02", status: "pending" },
  { id: "e_6", projectId: "p_001", department: "admin", documentType: "Operating permits", fileName: "NEMA-permit-2025.pdf", uploadedBy: "T. Wafula", uploadedAt: "2025-01-15", status: "verified" },
  { id: "e_7", projectId: "p_002", department: "mrv", documentType: "LCA boundary diagrams", fileName: "lca-boundary.pdf", uploadedBy: "N. Achieng", uploadedAt: "2025-05-14", status: "verified" },
];

export type InventoryItem = {
  id: string;
  sku: string;
  name: string;
  category: "feedstock" | "consumable" | "spare_part" | "reagent";
  quantity: number;
  unit: string;
  location: string;
  reorderLevel: number;
};

export const INVENTORY: InventoryItem[] = [
  { id: "i_1", sku: "FS-CH-001", name: "Coffee husk (dried)", category: "feedstock", quantity: 4200, unit: "kg", location: "Warehouse A", reorderLevel: 1000 },
  { id: "i_2", sku: "FS-MC-002", name: "Macadamia shells", category: "feedstock", quantity: 820, unit: "kg", location: "Warehouse A", reorderLevel: 500 },
  { id: "i_3", sku: "SP-TC-014", name: "Thermocouple K-type", category: "spare_part", quantity: 12, unit: "pcs", location: "Store B", reorderLevel: 5 },
  { id: "i_4", sku: "RG-HCL-01", name: "Hydrochloric acid 1M", category: "reagent", quantity: 18, unit: "L", location: "Lab store", reorderLevel: 10 },
  { id: "i_5", sku: "CN-BAG-050", name: "50kg storage sacks", category: "consumable", quantity: 240, unit: "pcs", location: "Warehouse A", reorderLevel: 100 },
];

export type LabResult = {
  id: string;
  projectId: string;
  batchId?: string;
  testName: string;
  labName: string;
  sampleDate: string;
  reportDate: string;
  result: string;
  status: "reported" | "in_progress";
};

export const LAB_RESULTS: LabResult[] = [
  { id: "l_1", projectId: "p_003", batchId: "b_1", testName: "Fixed carbon %", labName: "SGS Nairobi", sampleDate: "2025-05-28", reportDate: "2025-06-02", result: "72.4%", status: "reported" },
  { id: "l_2", projectId: "p_003", batchId: "b_2", testName: "H:C organic ratio", labName: "SGS Nairobi", sampleDate: "2025-05-24", reportDate: "2025-05-29", result: "0.38", status: "reported" },
  { id: "l_3", projectId: "p_001", testName: "PAH screen", labName: "Eurofins", sampleDate: "2025-05-10", reportDate: "2025-05-18", result: "Below LOQ", status: "reported" },
  { id: "l_4", projectId: "p_004", batchId: "b_4", testName: "Volatile matter", labName: "In-house", sampleDate: "2025-05-30", reportDate: "", result: "—", status: "in_progress" },
];

export type EmissionActivity = {
  id: string;
  projectId: string;
  scope: "scope1" | "scope2" | "scope3" | "removals";
  activity: string;
  period: string;
  tco2e: number;
  category?: EmissionCategory;
};

export type EmissionCategory = "transport" | "energy" | "loss";

export const EMISSION_CATEGORIES: { key: EmissionCategory; label: string; description: string }[] = [
  { key: "transport", label: "Transport", description: "Feedstock, product & staff movement" },
  { key: "energy", label: "Energy", description: "Electricity, fuels & thermal energy" },
  { key: "loss", label: "Loss", description: "Process losses, leakage & spoilage" },
];

export const EMISSIONS: EmissionActivity[] = [
  { id: "em_1", projectId: "p_001", scope: "removals", activity: "Biochar carbon storage", period: "2025-Q1", tco2e: 1204 },
  { id: "em_2", projectId: "p_001", scope: "scope1", activity: "Diesel generator", period: "2025-Q1", tco2e: 42, category: "energy" },
  { id: "em_3", projectId: "p_001", scope: "scope2", activity: "Grid electricity", period: "2025-Q1", tco2e: 18, category: "energy" },
  { id: "em_4", projectId: "p_001", scope: "scope3", activity: "Feedstock transport", period: "2025-Q1", tco2e: 61, category: "transport" },
  { id: "em_5", projectId: "p_002", scope: "removals", activity: "Biochar carbon storage", period: "2025-Q1", tco2e: 480 },
  { id: "em_6", projectId: "p_001", scope: "scope1", activity: "Volatile matter loss", period: "2025-Q1", tco2e: 12, category: "loss" },
];