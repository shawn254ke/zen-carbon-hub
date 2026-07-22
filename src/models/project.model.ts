import { EvidenceChecklist } from "./evidence-checklist.model";
import { LaboratoryResult } from "./laboratory-result.model";
import { EmissionActivity } from "./emission-activity.model";
import { Batch } from "./batch.model";
import { LaboratoryAnalysis } from "./laboratory-analysis.model";
export interface Project {
    id: number;

    name: string;

    code: string;

    location: string;

    methodology: string;

    batches: string;

    tCo2mineralized: number;

    category: string;

    pathway: string;

    status: string;

    evidencesCount: string;

    labCount: string;

    evidences: EvidenceChecklist[];

    labResults: LaboratoryResult[];

    emissions: EmissionActivity[];

    batch: Batch[];

    labAnalysis: LaboratoryAnalysis[];
}