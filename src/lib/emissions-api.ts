import { expireSession, getStoredSession } from "@/lib/auth";

export type TransportMethod = "fuel" | "distance";
export type EnergySource = "kenya_grid" | "flamingo_generator";
export type EmissionRecordStatus = "COMPLETE" | "PENDING";
export type CdrInclusionStatus =
  "INCLUDED" | "EXCLUDED_BY_BOUNDARY" | "EXCLUDED_AFTER_MATERIALITY" | "PENDING_DECISION";

export type CreateEmissionActivityRequest = {
  projectId: string;
  category: "transport" | "energy";
  activity: string;
  period: string;
  transportMethod?: TransportMethod;
  shipmentReference?: string;
  batchReference?: string;
  route?: string;
  fuelUsedLitres?: number;
  dieselDirectEmissionFactor?: number;
  dieselWttEmissionFactor?: number;
  shipmentLoadKg?: number;
  distanceKm?: number;
  freightDirectEmissionFactor?: number;
  freightWttEmissionFactor?: number;
  vehicleClass?: string;
  vehicleModelYear?: number;
  fuelType?: string;
  payloadCapacityKg?: number;
  capacityUtilizationPercent?: number;
  materialMassReceivedKg?: number;
  batchMaterialMassConsumedKg?: number;
  factorSource?: string;
  factorEvidence?: string;
  ukToKenyaProxyUsed?: boolean;
  cdrInclusionStatus?: CdrInclusionStatus;
  energySource?: EnergySource;
  site?: string;
  batchWindow?: string;
  meterStartKwh?: number;
  meterEndKwh?: number;
  gridEmissionFactorKgPerKwh?: number;
  generatorDieselUsedLitres?: number;
  generatorElectricityProducedKwh?: number;
};

export type EmissionActivityRecord = {
  id: number;
  projectId: string;
  category: "transport" | "energy";
  scope: "scope1" | "scope2" | "scope3";
  activity: string;
  period: string;
  emissionsKgCo2e: number | null;
  fullShipmentEmissionsKgCo2e: number | null;
  allocatedBatchEmissionsKgCo2e: number | null;
  unallocatedEmissionsKgCo2e: number | null;
  activityQuantityKwh: number | null;
  status: EmissionRecordStatus;
  details: Record<string, unknown>;
  createdAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseActivity(value: unknown): EmissionActivityRecord {
  if (!isRecord(value)) throw new Error("The emissions service returned an unexpected response.");
  const numericFields = ["id"] as const;
  if (
    !numericFields.every((field) => typeof value[field] === "number") ||
    typeof value.projectId !== "string" ||
    (value.category !== "transport" && value.category !== "energy") ||
    (value.scope !== "scope1" && value.scope !== "scope2" && value.scope !== "scope3") ||
    typeof value.activity !== "string" ||
    typeof value.period !== "string" ||
    (value.status !== "COMPLETE" && value.status !== "PENDING")
  ) {
    throw new Error("The emissions service returned an activity in an unexpected format.");
  }

  const nullableNumber = (field: string) => {
    const item = value[field];
    if (item === null || item === undefined) return null;
    if (typeof item !== "number" || !Number.isFinite(item)) {
      throw new Error(`The emissions service returned an invalid ${field} value.`);
    }
    return item;
  };

  return {
    id: value.id as number,
    projectId: value.projectId,
    category: value.category,
    scope: value.scope,
    activity: value.activity,
    period: value.period,
    emissionsKgCo2e: nullableNumber("emissionsKgCo2e"),
    fullShipmentEmissionsKgCo2e: nullableNumber("fullShipmentEmissionsKgCo2e"),
    allocatedBatchEmissionsKgCo2e: nullableNumber("allocatedBatchEmissionsKgCo2e"),
    unallocatedEmissionsKgCo2e: nullableNumber("unallocatedEmissionsKgCo2e"),
    activityQuantityKwh: nullableNumber("activityQuantityKwh"),
    status: value.status,
    details: isRecord(value.details) ? value.details : {},
    createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
  };
}

function getEmissionsEndpoint() {
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}/api/emissions`;
}

function getHeaders(includeJson = false) {
  const token = getStoredSession().token;
  return {
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function throwForHttpError(response: Response) {
  if (response.status === 401) {
    expireSession();
    throw new Error("Your session has expired. Please sign in again.");
  }
  if (!response.ok) {
    throw new Error(`Unable to save emissions data (HTTP ${response.status}).`);
  }
}

export async function fetchEmissionActivities(signal?: AbortSignal) {
  const response = await fetch(getEmissionsEndpoint(), {
    headers: getHeaders(),
    signal,
  });
  throwForHttpError(response);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("The emissions service returned an unexpected list.");
  }
  return payload.map(parseActivity);
}

export async function createEmissionActivity(payload: CreateEmissionActivityRequest) {
  const response = await fetch(getEmissionsEndpoint(), {
    method: "POST",
    headers: getHeaders(true),
    body: JSON.stringify(payload),
  });
  throwForHttpError(response);
  return parseActivity(await response.json());
}

export async function deleteEmissionActivity(id: number) {
  const response = await fetch(`${getEmissionsEndpoint()}/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (response.status === 401) {
    expireSession();
    throw new Error("Your session has expired. Please sign in again.");
  }
  if (!response.ok) {
    throw new Error(`Unable to delete emission activity (HTTP ${response.status}).`);
  }
}
