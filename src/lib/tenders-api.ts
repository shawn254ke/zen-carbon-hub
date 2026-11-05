const TENDERS_ENDPOINT = "https://shawn254.app.n8n.cloud/webhook/kenya-tenders";

export type Tender = {
  tender_id: string;
  tender_ref: string;
  title: string;
  procuring_entity: string;
  entity_type: string;
  venue: string;
  published_at: string;
  close_at: string;
  tender_fee: number | null;
  tender_url: string;
  source: string;
  last_seen: string;
};

export type TenderResponse = {
  count: number;
  generated_at: string;
  tenders: Tender[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTender(value: unknown): value is Tender {
  if (!isRecord(value)) return false;

  const stringFields = [
    "tender_id",
    "tender_ref",
    "title",
    "procuring_entity",
    "entity_type",
    "venue",
    "published_at",
    "close_at",
    "tender_url",
    "source",
    "last_seen",
  ] as const;

  return (
    stringFields.every((field) => typeof value[field] === "string") &&
    (typeof value.tender_fee === "number" || value.tender_fee === null)
  );
}

function isTenderResponse(value: unknown): value is TenderResponse {
  return (
    isRecord(value) &&
    typeof value.count === "number" &&
    Number.isFinite(value.count) &&
    typeof value.generated_at === "string" &&
    Array.isArray(value.tenders) &&
    value.tenders.every(isTender)
  );
}

export async function fetchTenders(signal?: AbortSignal): Promise<TenderResponse> {
  const response = await fetch(TENDERS_ENDPOINT, { signal });
  if (!response.ok) {
    throw new Error(`Unable to load tenders (HTTP ${response.status}).`);
  }

  const payload: unknown = await response.json();
  if (!isTenderResponse(payload)) {
    throw new Error("The tenders service returned data in an unexpected format.");
  }

  return payload;
}
