import { expireSession, getStoredSession } from "@/lib/auth";

export type BatchDataSyncEntry = {
  totalWaterVolume: number;
  influentPressurePT101: number;
  influentFlowRateFT101: number;
  influentPhAIT101: number;
  influentDissolvedCo2AT101: number;
  co2MassFlowFIT101: number;
  effluentFlowFT102: number;
  effluentFlowFT103: number;
  effluentDissolvedCo2AT102: number;
  effluentPhAIT103: number;
  injectedCo2: number;
  dissolvedCo2: number;
  co2Weight: number;
  systemRuntime: string;
  timestamp: string;
  systemStatus: boolean;
};

export type BatchSyncItem = {
  batchCode: string;
  co2Injected: string;
  startTime: string;
  endTime: string;
  batchData: BatchDataSyncEntry[];
};

type BackendBatchDataSyncDto = Partial<BatchDataSyncEntry> & {
  Co2weight?: string | number | null;
  co2Weight?: string | number | null;
};
type BackendBatchSyncDto = {
  batchCode?: string | null;
  co2Injected?: string | number | null;
  startTime?: string | null;
  endTime?: string | null;
  batchData?: BackendBatchDataSyncDto[] | null;
};

function getBatchesEndpoint() {
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  return base ? `${base}/api/batches` : "/api/batches";
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapBatchData(dto: BackendBatchDataSyncDto): BatchDataSyncEntry {
  const co2WeightValue = dto.co2Weight ?? dto.Co2weight ?? dto.co2Weight ?? 0;

  return {
    totalWaterVolume: toNumber(dto.totalWaterVolume),
    influentPressurePT101: toNumber(dto.influentPressurePT101),
    influentFlowRateFT101: toNumber(dto.influentFlowRateFT101),
    influentPhAIT101: toNumber(dto.influentPhAIT101),
    influentDissolvedCo2AT101: toNumber(dto.influentDissolvedCo2AT101),
    co2MassFlowFIT101: toNumber(dto.co2MassFlowFIT101),
    effluentFlowFT102: toNumber(dto.effluentFlowFT102),
    effluentFlowFT103: toNumber(dto.effluentFlowFT103),
    effluentDissolvedCo2AT102: toNumber(dto.effluentDissolvedCo2AT102),
    effluentPhAIT103: toNumber(dto.effluentPhAIT103),
    injectedCo2: toNumber(dto.injectedCo2),
    dissolvedCo2: toNumber(dto.dissolvedCo2),
    co2Weight: toNumber(co2WeightValue),
    systemRuntime: String(dto.systemRuntime ?? "").trim(),
    timestamp: String(dto.timestamp ?? "").trim(),
    systemStatus: Boolean(dto.systemStatus),
  };
}

function mapBatch(dto: BackendBatchSyncDto): BatchSyncItem {
  return {
    batchCode: (dto.batchCode ?? "").trim(),
    co2Injected: String(dto.co2Injected ?? "").trim(),
    startTime: (dto.startTime ?? "").trim(),
    endTime: (dto.endTime ?? "").trim(),
    batchData: (dto.batchData ?? []).map(mapBatchData),
  };
}

export async function fetchBatchesApi(token?: string | null) {
  const authToken = token ?? getStoredSession().token;
  const response = await fetch(getBatchesEndpoint(), {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
  });

  if (!response.ok) {
    if (response.status === 401) {
      expireSession();
      throw new Error("Your session has expired. Please sign in again.");
    }
    throw new Error(`Unable to load batches (${response.status})`);
  }

  const data = (await response.json()) as BackendBatchSyncDto[];
  return data.map(mapBatch).filter((batch) => batch.batchCode);
}