export enum BatchStatus {
    PENDING = "PENDING",
    ASSIGNED = "ASSIGNED",
    LOADED = "LOADED",
    RUNNING = "RUNNING",
    PAUSED = "PAUSED",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED"
}

export interface Batch {

    projectId: number;

    batchNumber: string;

    cement: number;

    fines: number;

    coarse: number;

    addMixture: number;

    initialPH: number;

    finalPH: number;

    co2Injected: number;

    dissolvedCO2: number;

    waterUsed: number;

    energy: string;

    timestamp: string;

    status: BatchStatus;
}

export interface CreateBatch {

    projectId: number;

    batchNumber: string;

    cement: number;

    fines: number;

    coarse: number;

    addMixture: number;

    initialPH: number;

    finalPH: number;

    co2Injected: number;

    dissolvedCO2: number;

    waterUsed: number;

    energy: string;

    timestamp: string;

    status: BatchStatus;
}