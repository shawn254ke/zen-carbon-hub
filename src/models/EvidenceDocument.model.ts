export interface EvidenceDocument {

    id: number;

    // Document Type
    documentType: string;

    // Checklist
    checklistId: number;

    // Uploaded By
    uploadedById: number;
    uploadedByName: string;

    // Document Information
    fileName: string;
    version: string;
    uploadURL: string;
    uploadDate: string;

    // Audit Fields
    createdAt: string;
    updatedAt: string;
}