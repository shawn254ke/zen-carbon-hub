
export enum LaboratoryResultStatus {
    PENDING = "PENDING",
    RECEIVED = "RECEIVED",
    VERIFIED = "VERIFIED",
    REJECTED = "REJECTED",
    COMPLETED = "COMPLETED",
}
export interface LaboratoryResult {

    id: number;

    // Project
    projectId: number;
    projectName: string;

    // Batch
    batchId: number;
    batchName: string;

    // Laboratory
    laboratoryId: number;
    laboratoryName: string;

    // Test Information
    test: string;
    results: number;

    // Files
    resultFile: string;
    file: string;

    // Status
    status: LaboratoryResultStatus;

    // Dates
    sampleDate: string;
    reportDate: string;

    // Uploaded By
    uploadedById: number;
    uploadedByName: string;

    // Analysis
    laboratoryAnalysisId: number | null;

    // Audit
    createdAt: string;
    updatedAt: string;
}