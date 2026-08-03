import { EvidenceDocument } from "./EvidenceDocument.model";

export interface EvidenceChecklist {

    id: number;

    // Department
    departmentId: number;
    departmentName: string;

    // Project
    projectId: number;
    projectName: string;

    // Checklist Item
    item: string;

    // Documents
    documents: EvidenceDocument[];

    // Audit
    createdAt: string;

    updatedAt: string;
}

export interface CreateEvidenceChecklist {
    // Department
    departmentId: number;
    departmentName?: string;

    // Project
    projectId?: number;
    projectName?: string;

    // Checklist Item
    item: string;
}