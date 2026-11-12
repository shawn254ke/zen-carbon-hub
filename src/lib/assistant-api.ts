import { addDays, format } from "date-fns";
import { expireSession } from "@/lib/auth";

export type PlannerTaskDraft = {
  id: string;
  title: string;
  description: string;
  deliverable: string;
  priority: string;
  basis?: string;
};

export type PlannerDayDraft = {
  day: string;
  date: string;
  tasks: PlannerTaskDraft[];
};

export type PlannerDraft = {
  requestId: string;
  status: string;
  employee: { name: string; department: string };
  weekStart: string;
  weekEnd: string;
  objectives: string[];
  days: PlannerDayDraft[];
  carriedOver?: string[];
  sources?: Array<{
    fileName: string;
    type?: string;
    link?: string;
    modifiedAt?: string;
  }>;
  warnings?: string[];
};

export type PlannerProgress = {
  day: string;
  date: string;
  taskId: string;
  backendTaskId: number;
  updateId?: number;
  title: string;
  description: string;
  deliverable: string;
  priority: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED";
  progress: number;
  blocker: string;
  notes: string;
};

export type ReportStats = {
  planned: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  blocked: number;
  noUpdate: number;
  overallProgress: number;
};

export type ReportNextWeekItem = {
  title: string;
  reason: string;
  priority: string;
};

/** Draft returned by the n8n `report/generate` webhook, reviewed and edited by the user. */
export type WeeklyReportDraft = {
  reportId: string;
  requestId: string | null;
  status: string;
  employee: { name: string; department: string; role: string };
  submittedBy: string;
  weekStart: string;
  weekEnd: string;
  objectives: string[];
  stats: ReportStats;
  headline: string;
  executiveSummary: string;
  progress: string[];
  metrics: string[];
  blockers: string[];
  supportRequired: string[];
  proposedNextWeek: ReportNextWeekItem[];
  keyAchievements: string[];
  challenges: string[];
  recurringBlockers: string[];
  recommendations: string[];
  activitiesCompleted: unknown[];
  activitiesInProgress: unknown[];
  activitiesNotCompleted: unknown[];
  warnings: string[];
  generatedAt: string;
};

export type ApprovedReportResult = {
  status: string;
  reportId: string | null;
  file: { fileName: string; mimeType: string; base64: string } | null;
  zoho: { fileId: string | null; permalink: string | null; fileName: string } | null;
  warnings: string[];
};

// The Planner Generator workflow is still run from the n8n editor, so the test webhook is
// the default. Set VITE_N8N_WEBHOOK_BASE_URL to ".../webhook" once the workflow is published.
const N8N_WEBHOOK_BASE = (
  import.meta.env.VITE_N8N_WEBHOOK_BASE_URL?.trim() || "https://shawn254.app.n8n.cloud/webhook"
).replace(/\/$/, "");
const SUGGESTIONS_URL = `${N8N_WEBHOOK_BASE}/planner/suggestions`;
const APPROVE_URL = `${N8N_WEBHOOK_BASE}/planner/approve`;
const REPORT_GENERATE_URL = `${N8N_WEBHOOK_BASE}/report/generate`;
const REPORT_APPROVE_URL = `${N8N_WEBHOOK_BASE}/report/approve`;
const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

type BackendPlanner = { id: number };
type BackendPlannerTask = { id: number };
type BackendTaskUpdate = { id: number };
type LoadedWeeklyPlanner = {
  plannerId: number;
  planner: PlannerDraft;
  progress: PlannerProgress[];
  taskIds: number[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function requestBackend<T>(
  path: string,
  token: string | null,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    expireSession();
    throw new Error("Your session has expired. Please sign in again.");
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      error?: string;
      details?: string;
    } | null;
    throw new Error(
      body?.message || body?.error || body?.details || `Request failed (${response.status})`,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function requireBackendId(value: unknown, resource: string): number {
  if (!isRecord(value) || (typeof value.id !== "number" && typeof value.id !== "string")) {
    throw new Error(`The backend saved the ${resource} but did not return its ID.`);
  }
  const id = Number(value.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error(`The backend returned an invalid ${resource} ID.`);
  }
  return id;
}

function getBackendId(value: Record<string, unknown>, resource: string): number {
  const id = value.id ?? value.plannerId ?? value.taskId;
  return requireBackendId({ id }, resource);
}

function getTaskUpdate(value: Record<string, unknown>) {
  const updates = Array.isArray(value.updates) ? value.updates : [];
  const latest =
    updates.length > 0 ? updates[updates.length - 1] : (value.latestUpdate ?? value.taskUpdate);
  return isRecord(latest) ? latest : {};
}

function getTaskStatus(value: unknown): PlannerProgress["status"] {
  if (
    value === "NOT_STARTED" ||
    value === "IN_PROGRESS" ||
    value === "COMPLETED" ||
    value === "BLOCKED"
  ) {
    return value;
  }
  return "NOT_STARTED";
}

export async function loadOpenWeeklyPlanner(
  userId: string,
  employee: PlannerDraft["employee"],
  token: string | null,
): Promise<LoadedWeeklyPlanner | null> {
  if (!/^\d+$/.test(userId)) {
    throw new Error("Your account ID is missing. Sign out and sign in again to load your planner.");
  }

  const weeklyPlanners = await requestBackend<unknown>(
    `/api/weekly-planners?userId=${encodeURIComponent(userId)}`,
    token,
  );
  if (!Array.isArray(weeklyPlanners)) {
    throw new Error("The backend returned an invalid weekly planner list.");
  }

  const planners = weeklyPlanners.filter((item): item is Record<string, unknown> => isRecord(item));
  planners.sort((left, right) => {
    const leftId = Number(left.id ?? left.plannerId);
    const rightId = Number(right.id ?? right.plannerId);
    return Number.isFinite(leftId) && Number.isFinite(rightId)
      ? rightId - leftId
      : String(right.weekStart ?? "").localeCompare(String(left.weekStart ?? ""));
  });
  const latestPlanner = planners[0];
  const activePlanner = latestPlanner?.hasReportSubmitted === false ? latestPlanner : undefined;

  if (!activePlanner) return null;

  const plannerId = getBackendId(activePlanner, "planner");
  const plannerRecord = await requestBackend<unknown>(`/api/weekly-planners/${plannerId}`, token);
  if (!isRecord(plannerRecord)) {
    throw new Error("The backend returned an invalid weekly planner.");
  }

  const weekStart = typeof plannerRecord.weekStart === "string" ? plannerRecord.weekStart : "";
  const weekEnd = typeof plannerRecord.weekEnd === "string" ? plannerRecord.weekEnd : "";
  if (!weekStart || !weekEnd) {
    throw new Error("The saved planner is missing its week start or end date.");
  }

  const rawTasks = Array.isArray(plannerRecord.tasks)
    ? plannerRecord.tasks
    : Array.isArray(plannerRecord.plannerTasks)
      ? plannerRecord.plannerTasks
      : null;
  if (!rawTasks) {
    throw new Error("The saved planner response did not include its tasks.");
  }

  const taskIds: number[] = [];
  const progress: PlannerProgress[] = [];
  const days = new Map<string, PlannerDayDraft>();
  const weekdays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

  for (const [index, rawTask] of rawTasks.entries()) {
    if (!isRecord(rawTask)) {
      throw new Error("The saved planner contains an invalid task.");
    }

    const backendTaskId = getBackendId(rawTask, "planner task");
    const day = String(rawTask.dayOfTheWeek ?? rawTask.day ?? "MONDAY").toUpperCase();
    const dayIndex = Math.max(0, weekdays.indexOf(day));
    const taskText = typeof rawTask.task === "string" ? rawTask.task : "";
    const separator = taskText.indexOf(": ");
    const title =
      typeof rawTask.title === "string"
        ? rawTask.title
        : separator >= 0
          ? taskText.slice(0, separator)
          : taskText || `Task ${index + 1}`;
    const description =
      typeof rawTask.description === "string"
        ? rawTask.description
        : separator >= 0
          ? taskText.slice(separator + 2)
          : "";
    const taskId = String(backendTaskId);
    const taskDate = format(addDays(new Date(`${weekStart}T12:00:00`), dayIndex), "yyyy-MM-dd");
    const task: PlannerTaskDraft = {
      id: taskId,
      title,
      description,
      deliverable: typeof rawTask.deliverable === "string" ? rawTask.deliverable : "",
      priority: typeof rawTask.priority === "string" ? rawTask.priority : "MEDIUM",
    };
    const dayDraft = days.get(day) ?? { day, date: taskDate, tasks: [] };
    dayDraft.tasks.push(task);
    days.set(day, dayDraft);

    const update = getTaskUpdate(rawTask);
    const status = getTaskStatus(update.status ?? rawTask.status);
    const savedProgress = update.progress ?? rawTask.progress;
    const comment = typeof update.comment === "string" ? update.comment : "";
    taskIds.push(backendTaskId);
    progress.push({
      day,
      date: taskDate,
      taskId,
      backendTaskId,
      updateId:
        typeof update.id === "number" && Number.isSafeInteger(update.id) ? update.id : undefined,
      title,
      description,
      deliverable: task.deliverable,
      priority: task.priority,
      status,
      progress:
        typeof savedProgress === "number" && Number.isFinite(savedProgress)
          ? Math.min(100, Math.max(0, savedProgress))
          : 0,
      // A task update has one comment field: the blocker when BLOCKED, otherwise notes.
      blocker: status === "BLOCKED" ? comment : "",
      notes: status === "BLOCKED" ? "" : comment,
    });
  }

  return {
    plannerId,
    planner: {
      requestId: String(plannerId),
      status: "APPROVED",
      employee,
      weekStart,
      weekEnd,
      objectives: [],
      days: [...days.values()],
    },
    progress,
    taskIds,
  };
}

export async function persistApprovedPlanner(
  planner: PlannerDraft,
  userId: string,
  token: string | null,
): Promise<{ plannerId: number; taskIds: number[] }> {
  if (!/^\d+$/.test(userId)) {
    throw new Error(
      "Your account ID is missing. Sign out and sign in again before saving this planner.",
    );
  }

  const savedPlanner = await requestBackend<BackendPlanner>("/api/weekly-planners", token, {
    method: "POST",
    body: JSON.stringify({
      userId: Number(userId),
      weekStart: planner.weekStart,
      weekEnd: planner.weekEnd,
      hasReportSubmitted: false,
    }),
  });
  const plannerId = requireBackendId(savedPlanner, "planner");
  const taskIds: number[] = [];

  try {
    for (const day of planner.days) {
      for (const task of day.tasks) {
        const backendTask = `${task.title.trim()}: ${task.description.trim()}`;
        if (backendTask.length > 500) {
          throw new Error(
            `Task "${task.title}" exceeds the backend's 500-character task limit. Shorten its title or description.`,
          );
        }
        const savedTask = await requestBackend<BackendPlannerTask>(
          `/api/v1/planner-tasks/weekly-planners/${plannerId}/tasks`,
          token,
          {
            method: "POST",
            body: JSON.stringify({
              task: backendTask,
              deliverable: task.deliverable.trim(),
              dayOfTheWeek: day.day,
            }),
          },
        );
        taskIds.push(requireBackendId(savedTask, "planner task"));
      }
    }
  } catch (error) {
    const cleanupResults = await Promise.allSettled([
      ...taskIds.map((taskId) =>
        requestBackend<void>(`/api/v1/planner-tasks/planner-tasks/${taskId}`, token, {
          method: "DELETE",
        }),
      ),
      requestBackend<void>(`/api/weekly-planners/${plannerId}`, token, { method: "DELETE" }),
    ]);
    const cleanupFailed = cleanupResults.some((result) => result.status === "rejected");
    if (cleanupFailed) {
      throw new Error(
        `${error instanceof Error ? error.message : "Unable to save planner tasks."} Some planner data could not be rolled back; planner ID ${plannerId}.`,
      );
    }
    throw error;
  }

  return { plannerId, taskIds };
}

export async function savePlannerTaskUpdate(
  taskId: number,
  updateId: number | undefined,
  input: {
    status: PlannerProgress["status"];
    progress: number;
    comment: string;
  },
  token: string | null,
): Promise<number> {
  const path = updateId ? `/api/task-updates/${updateId}` : `/api/planner-tasks/${taskId}/updates`;
  const savedUpdate = await requestBackend<BackendTaskUpdate>(path, token, {
    method: updateId ? "PUT" : "POST",
    body: JSON.stringify(input),
  });
  return requireBackendId(savedUpdate, "task update");
}

export async function saveWeeklyReport(
  plannerId: number,
  reportId: number | undefined,
  input: {
    blockers: string;
    supportRequired: string;
    status: PlannerProgress["status"];
    submittedAt: string;
    reportReference?: string;
    headline?: string;
    approvedBy?: string;
    fileName?: string;
    workDriveFileId?: string;
    workDriveLink?: string;
  },
  token: string | null,
) {
  const path = reportId
    ? `/api/weekly-reports/${reportId}`
    : `/api/weekly-planners/${plannerId}/reports`;
  const savedReport = await requestBackend<{ id: number }>(path, token, {
    method: reportId ? "PUT" : "POST",
    body: JSON.stringify(input),
  });
  return { id: requireBackendId(savedReport, "weekly report") };
}

async function postJson<T>(url: string, payload: unknown, token?: string | null): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 401) {
    expireSession();
    throw new Error("Your session has expired. Please sign in again.");
  }

  if (!response.ok) {
    throw new Error(await readN8nError(response));
  }

  return response.json() as Promise<T>;
}

/** n8n error bodies look like {error, message?, details?: string[]}. */
async function readN8nError(response: Response) {
  const text = (await response.text().catch(() => "")).trim();
  try {
    const body: unknown = JSON.parse(text);
    if (isRecord(body)) {
      const details = Array.isArray(body.details) ? body.details.map(String).join("; ") : "";
      const message = [body.message, details].filter(
        (part): part is string => typeof part === "string" && part.length > 0,
      );
      if (message.length) return message.join(" ");
      if (typeof body.error === "string") return body.error;
    }
  } catch {
    // Not JSON; fall through to the raw text.
  }
  if (response.status === 404) {
    return "The n8n service is not listening. Open the Planner Generator workflow and click “Execute workflow”, or publish it.";
  }
  return text || `Request failed (${response.status})`;
}

const RAG_SESSION_KEY = "rag-session-id";

function getRagSessionId() {
  try {
    let id = localStorage.getItem(RAG_SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(RAG_SESSION_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function resetRagSession() {
  try {
    localStorage.setItem(RAG_SESSION_KEY, crypto.randomUUID());
  } catch {
    // Storage unavailable; a fresh id is generated per request instead.
  }
}

export function isDocumentChatConfigured() {
  return Boolean(import.meta.env.VITE_N8N_CHAT_URL?.trim());
}

/**
 * Sends a question to the n8n RAG Chat Trigger. Conversation memory lives in n8n,
 * keyed on sessionId, so only the new message is sent. With streaming enabled the
 * response is newline-delimited JSON ({type: "item", content}); onChunk receives
 * each token. Resolves with the full answer text.
 */
export async function askDocuments(
  question: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const endpoint = import.meta.env.VITE_N8N_CHAT_URL?.trim();
  if (!endpoint) {
    throw new Error(
      "Document chat is not configured. Set VITE_N8N_CHAT_URL to the n8n chat endpoint.",
    );
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "sendMessage",
      sessionId: getRagSessionId(),
      chatInput: question,
    }),
    signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text.trim() || `Chat service returned ${response.status}`);
  }

  let answer = "";
  const emit = (text: string) => {
    if (!text) return;
    answer += text;
    onChunk(text);
  };

  if (!response.body) {
    emit(extractChatText(await response.text()));
    return answer;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let gotChunks = false;

  const handleLine = (line: string) => {
    if (!line.trim()) return;
    let chunk: unknown;
    try {
      chunk = JSON.parse(line);
    } catch {
      return;
    }
    if (!isRecord(chunk)) return;
    if (chunk.type === "item" && typeof chunk.content === "string") {
      gotChunks = true;
      emit(chunk.content);
    } else if (chunk.type === "error") {
      throw new Error(typeof chunk.content === "string" ? chunk.content : "Agent error");
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(handleLine);
  }
  buffer += decoder.decode();

  if (gotChunks) {
    handleLine(buffer);
  } else if (buffer.trim()) {
    // Non-streaming fallback: a single JSON object such as { output: "..." }.
    emit(extractChatText(buffer));
  }

  return answer;
}

function extractChatText(raw: string) {
  try {
    const data: unknown = JSON.parse(raw);
    const root = Array.isArray(data) ? data[0] : data;
    if (isRecord(root)) {
      for (const key of ["output", "text", "answer", "response", "message"]) {
        if (typeof root[key] === "string") return root[key] as string;
      }
    }
    return raw;
  } catch {
    return raw;
  }
}

export function generatePlannerSuggestions(payload: {
  employeeName: string;
  department: string;
  weekStart: string;
  notes: string;
}) {
  return postJson<unknown>(SUGGESTIONS_URL, payload);
}

export function approvePlanner(payload: PlannerDraft, approvedBy: string) {
  return fetch(APPROVE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId: payload.requestId,
      status: "APPROVED",
      approvedBy,
      employee: payload.employee,
      weekStart: payload.weekStart,
      weekEnd: payload.weekEnd,
      objectives: payload.objectives,
      days: payload.days.map((day) => ({
        day: day.day,
        date: day.date,
        tasks: day.tasks.map(({ id: _id, basis: _basis, ...task }) => task),
      })),
    }),
  });
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function toStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
    : [];
}

function toCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) ? count : 0;
}

function parseReportDraft(value: unknown): WeeklyReportDraft {
  const root = Array.isArray(value) ? value[0] : value;
  const data = isRecord(root) ? root : {};
  const reportId = readString(data.reportId);
  if (!reportId) {
    throw new Error("The report service response did not include a report ID.");
  }
  const employee = isRecord(data.employee) ? data.employee : {};
  const stats = isRecord(data.stats) ? data.stats : {};
  const list = (field: unknown) => (Array.isArray(field) ? field : []);

  return {
    reportId,
    requestId: readString(data.requestId) || null,
    status: readString(data.status) || "PENDING_APPROVAL",
    employee: {
      name: readString(employee.name),
      department: readString(employee.department),
      role: readString(employee.role),
    },
    submittedBy: readString(data.submittedBy),
    weekStart: readString(data.weekStart),
    weekEnd: readString(data.weekEnd),
    objectives: toStringList(data.objectives),
    stats: {
      planned: toCount(stats.planned),
      completed: toCount(stats.completed),
      inProgress: toCount(stats.inProgress),
      notStarted: toCount(stats.notStarted),
      blocked: toCount(stats.blocked),
      noUpdate: toCount(stats.noUpdate),
      overallProgress: toCount(stats.overallProgress),
    },
    headline: readString(data.headline),
    executiveSummary: readString(data.executiveSummary),
    progress: toStringList(data.progress),
    metrics: toStringList(data.metrics),
    blockers: toStringList(data.blockers),
    supportRequired: toStringList(data.supportRequired),
    proposedNextWeek: list(data.proposedNextWeek).flatMap((item): ReportNextWeekItem[] =>
      isRecord(item) && typeof item.title === "string"
        ? [
            {
              title: item.title,
              reason: readString(item.reason),
              priority: readString(item.priority).toUpperCase() || "MEDIUM",
            },
          ]
        : [],
    ),
    keyAchievements: toStringList(data.keyAchievements),
    challenges: toStringList(data.challenges),
    recurringBlockers: toStringList(data.recurringBlockers),
    recommendations: toStringList(data.recommendations),
    activitiesCompleted: list(data.activitiesCompleted),
    activitiesInProgress: list(data.activitiesInProgress),
    activitiesNotCompleted: list(data.activitiesNotCompleted),
    warnings: toStringList(data.warnings),
    generatedAt: readString(data.generatedAt),
  };
}

/** Sends the employee's task progress to n8n, which drafts the weekly report for review. */
export async function generateWeeklyReport(input: {
  planner: PlannerDraft;
  progress: PlannerProgress[];
  employee: { name: string; department: string; role: string };
  submittedBy: string;
  notes: string;
}): Promise<WeeklyReportDraft> {
  const { planner, progress } = input;
  const days = new Map<string, { day: string; date: string; tasks: unknown[] }>();
  for (const item of progress) {
    const day = days.get(item.day) ?? { day: item.day, date: item.date, tasks: [] };
    day.tasks.push({
      id: item.taskId,
      title: item.title,
      description: item.description,
      deliverable: item.deliverable,
      priority: item.priority,
      progress: {
        status: item.status,
        progressPercent: item.progress,
        comments: item.notes.trim(),
        blockers: item.status === "BLOCKED" ? item.blocker.trim() : "",
      },
    });
    days.set(item.day, day);
  }

  const result = await postJson<unknown>(REPORT_GENERATE_URL, {
    requestId: planner.requestId,
    employee: input.employee,
    submittedBy: input.submittedBy,
    weekStart: planner.weekStart,
    weekEnd: planner.weekEnd,
    notes: input.notes.trim(),
    planner: { objectives: planner.objectives, days: [...days.values()] },
  });
  return parseReportDraft(result);
}

/** Sends the user-approved report to n8n, which renders it and stores it in Zoho WorkDrive. */
export async function approveWeeklyReport(
  draft: WeeklyReportDraft,
  approvedBy: string,
): Promise<ApprovedReportResult> {
  const result = await postJson<unknown>(REPORT_APPROVE_URL, {
    ...draft,
    status: "APPROVED",
    approvedBy,
  });
  const data = isRecord(result) ? result : {};
  const file = isRecord(data.file) ? data.file : null;
  const zoho = isRecord(data.zoho) ? data.zoho : null;

  return {
    status: readString(data.status),
    reportId: readString(data.reportId) || null,
    file:
      file && readString(file.base64)
        ? {
            fileName: readString(file.fileName) || `weekly-report-${draft.weekStart}.docx`,
            mimeType: readString(file.mimeType) || "application/octet-stream",
            base64: readString(file.base64),
          }
        : null,
    zoho: zoho
      ? {
          fileId: readString(zoho.fileId) || null,
          permalink: readString(zoho.permalink) || null,
          fileName: readString(zoho.fileName),
        }
      : null,
    warnings: toStringList(data.warnings),
  };
}
