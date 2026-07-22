export interface LaboratoryAnalysis {

    id: number;

    file: string;

    summary: number;

    findings: string;

    recommendations: string;

    laboratoryResultId: number;

    laboratoryTest: string;

    uploadedById: number;

    uploadedByName: string;

    createdAt: string;

    updatedAt: string;
}
export interface CreateLaboratoryAnalysis {

    laboratoryResultId: number;

    file: string;

    summary: number;

    findings: string;

    recommendations: string;
}