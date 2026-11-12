import { ChatMarkdown } from "@/components/chat-markdown";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  LoaderCircle,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ROLE_LABELS, useAuth } from "@/lib/auth";
import {
  approvePlanner,
  approveWeeklyReport,
  askDocuments,
  isDocumentChatConfigured,
  resetRagSession,
  generatePlannerSuggestions,
  generateWeeklyReport,
  loadOpenWeeklyPlanner,
  persistApprovedPlanner,
  savePlannerTaskUpdate,
  saveWeeklyReport,
  type PlannerDayDraft,
  type PlannerDraft,
  type PlannerProgress,
  type PlannerTaskDraft,
  type ReportNextWeekItem,
  type WeeklyReportDraft,
} from "@/lib/assistant-api";

export const Route = createFileRoute("/assistant")({
  component: AssistantPage,
});

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ title: string; url?: string }>;
};

type PlannerView = "setup" | "draft" | "progress" | "report";

type ReportListField =
  | "progress"
  | "metrics"
  | "blockers"
  | "supportRequired"
  | "keyAchievements"
  | "challenges"
  | "recommendations";

const REPORT_LIST_FIELDS: Array<{ field: ReportListField; label: string; hint: string }> = [
  { field: "progress", label: "Progress this week", hint: "Completed and progressed work" },
  { field: "metrics", label: "Metrics", hint: "Only numbers you actually reported" },
  { field: "keyAchievements", label: "Key achievements", hint: "" },
  { field: "blockers", label: "Blockers", hint: "Issue and what is needed to resolve it" },
  { field: "supportRequired", label: "Support required", hint: "Requests to management or teams" },
  { field: "challenges", label: "Challenges", hint: "" },
  { field: "recommendations", label: "Recommendations", hint: "" },
];
type PersistedPlanner = {
  plannerId: number;
  taskIds: number[];
  reportId?: number;
};

const PRIORITIES = ["HIGH", "MEDIUM", "LOW"];
const STATUSES: Array<{ value: PlannerProgress["status"]; label: string }> = [
  { value: "NOT_STARTED", label: "Not started" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "BLOCKED", label: "Blocked" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function parsePlannerResponse(value: unknown): PlannerDraft {
  const root = isRecord(value) ? value : {};
  const data = isRecord(root.data) ? root.data : isRecord(root.result) ? root.result : root;
  const employee = isRecord(data.employee) ? data.employee : {};
  const objectives = Array.isArray(data.objectives)
    ? data.objectives.filter((item): item is string => typeof item === "string")
    : [];
  const days = Array.isArray(data.days)
    ? data.days.flatMap((rawDay, dayIndex): PlannerDayDraft[] => {
        if (!isRecord(rawDay)) return [];
        const tasks = Array.isArray(rawDay.tasks)
          ? rawDay.tasks.flatMap((rawTask, taskIndex): PlannerTaskDraft[] => {
              if (!isRecord(rawTask)) return [];
              return [
                {
                  id: readText(rawTask.id, `${dayIndex}-${taskIndex}`),
                  title: readText(rawTask.title),
                  description: readText(rawTask.description),
                  deliverable: readText(rawTask.deliverable),
                  priority: readText(rawTask.priority, "MEDIUM").toUpperCase(),
                  basis: readText(rawTask.basis) || undefined,
                },
              ];
            })
          : [];
        return [
          {
            day: readText(rawDay.day, `DAY_${dayIndex + 1}`).toUpperCase(),
            date: readText(rawDay.date),
            tasks,
          },
        ];
      })
    : [];

  const requestId = readText(data.requestId);
  if (!requestId || days.length === 0) {
    throw new Error("The suggestions service response was missing a request ID or daily tasks.");
  }

  const sources = Array.isArray(data.sources)
    ? data.sources.flatMap((source) => {
        if (!isRecord(source)) return [];
        const fileName = readText(source.fileName);
        if (!fileName) return [];
        return [
          {
            fileName,
            type: readText(source.type) || undefined,
            link: readText(source.link) || undefined,
            modifiedAt: readText(source.modifiedAt) || undefined,
          },
        ];
      })
    : [];

  return {
    requestId,
    status: readText(data.status, "PENDING_APPROVAL"),
    employee: {
      name: readText(employee.name),
      department: readText(employee.department),
    },
    weekStart: readText(data.weekStart),
    weekEnd: readText(data.weekEnd),
    objectives,
    days,
    carriedOver: Array.isArray(data.carriedOver)
      ? data.carriedOver.filter((item): item is string => typeof item === "string")
      : [],
    sources,
    warnings: Array.isArray(data.warnings)
      ? data.warnings.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadBase64(encoded: string, mimeType: string, fileName: string) {
  let decoded: string;
  try {
    decoded = atob(encoded.replace(/\s/g, ""));
  } catch {
    throw new Error("The file was returned, but its base64 data is invalid.");
  }
  const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
  downloadBlob(new Blob([bytes], { type: mimeType }), fileName);
}

async function downloadApprovedFile(
  response: Response,
  requestId: string,
): Promise<{ status?: string; warnings?: string[] }> {
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail.trim() || `Planner approval failed (${response.status})`);
  }

  const disposition = response.headers.get("content-disposition") ?? "";
  const fileNameMatch = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  const fileName = fileNameMatch?.[1]?.replaceAll('"', "") || `weekly-planner-${requestId}.pdf`;
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const data = (await response.json()) as Record<string, unknown>;
    const file = isRecord(data.file) ? data.file : {};
    const fileUrl =
      readText(file.downloadUrl) ||
      readText(file.fileUrl) ||
      readText(file.url) ||
      readText(data.downloadUrl) ||
      readText(data.fileUrl) ||
      readText(data.url);
    if (fileUrl) {
      const fileResponse = await fetch(fileUrl);
      if (!fileResponse.ok)
        throw new Error(`Planner file download failed (${fileResponse.status})`);
      downloadBlob(
        await fileResponse.blob(),
        readText(file.fileName, readText(data.fileName, fileName)),
      );
      return {
        status: readText(data.status) || undefined,
        warnings: Array.isArray(data.warnings)
          ? data.warnings.filter((warning): warning is string => typeof warning === "string")
          : [],
      };
    }

    const encoded = readText(file.base64) || readText(data.fileBase64) || readText(data.base64);
    if (encoded) {
      downloadBase64(
        encoded,
        readText(file.mimeType) ||
          readText(file.contentType) ||
          readText(data.mimeType) ||
          readText(data.contentType) ||
          "application/octet-stream",
        readText(file.fileName, readText(data.fileName, fileName)),
      );
      return {
        status: readText(data.status) || undefined,
        warnings: Array.isArray(data.warnings)
          ? data.warnings.filter((warning): warning is string => typeof warning === "string")
          : [],
      };
    }

    throw new Error(
      "Planner approval succeeded, but the response did not contain a downloadable file.",
    );
  }

  downloadBlob(await response.blob(), fileName);
  return {};
}

function getWeekStart() {
  return format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

function getUserDepartment(user: ReturnType<typeof useAuth>["user"]) {
  if (user.department?.trim()) return user.department.trim();

  const departmentByRole: Partial<Record<typeof user.role, string>> = {
    dept_ic: "Instrumentation and Control",
    dept_mechanical: "Mechanical",
    dept_chemical: "Chemical",
    dept_mrv: "MRV",
    dept_admin: "Administration",
    dept_concrete: "Concrete",
  };
  return departmentByRole[user.role] ?? "";
}

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! Ask me about company SOPs, reports, and other internal documents. I’ll include source references when they’re available.",
};

function AssistantPage() {
  const { user, token, isAuthReady } = useAuth();
  const [activeTab, setActiveTab] = useState("documents");
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [question, setQuestion] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [plannerView, setPlannerView] = useState<PlannerView>("setup");
  const [employeeName, setEmployeeName] = useState(user.name);
  const [department, setDepartment] = useState(() => getUserDepartment(user));
  const [weekStart, setWeekStart] = useState(getWeekStart);
  const [notes, setNotes] = useState("");
  const [planner, setPlanner] = useState<PlannerDraft | null>(null);
  const [progress, setProgress] = useState<PlannerProgress[]>([]);
  const [persistedPlanner, setPersistedPlanner] = useState<PersistedPlanner | null>(null);
  const [asks, setAsks] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isApprovingReport, setIsApprovingReport] = useState(false);
  const [reportDraft, setReportDraft] = useState<WeeklyReportDraft | null>(null);
  const [isLoadingPlanner, setIsLoadingPlanner] = useState(false);
  const [approvalComplete, setApprovalComplete] = useState(false);

  useEffect(() => {
    setEmployeeName(user.name);
    setDepartment(getUserDepartment(user));
  }, [user.id, user.name, user.department, user.role]);

  useEffect(() => {
    if (!isAuthReady) return;

    let cancelled = false;
    setIsLoadingPlanner(true);
    void loadOpenWeeklyPlanner(
      user.id,
      { name: user.name, department: getUserDepartment(user) },
      token,
    )
      .then((loadedPlanner) => {
        if (cancelled || !loadedPlanner) return;
        setPlanner(loadedPlanner.planner);
        setProgress(loadedPlanner.progress);
        setPersistedPlanner({
          plannerId: loadedPlanner.plannerId,
          taskIds: loadedPlanner.taskIds,
        });
        setWeekStart(loadedPlanner.planner.weekStart);
        setPlannerView("progress");
        setApprovalComplete(true);
        setActiveTab("planner");
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast.error(getErrorMessage(error, "Unable to load your weekly planner."));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPlanner(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthReady, user.id, user.name, user.department, user.role, token]);

  const weekEnd = useMemo(
    () => format(addDays(new Date(`${weekStart}T12:00:00`), 4), "yyyy-MM-dd"),
    [weekStart],
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLTextAreaElement>(null);

  // Keep the newest message (including streamed tokens) in view.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  // Grow the composer with its content, up to a cap, instead of a manual resize handle.
  useEffect(() => {
    const field = questionRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 160)}px`;
  }, [question]);

  const sendQuestion = async () => {
    const text = question.trim();
    if (!text || isSending) return;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
    const replyId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      userMessage,
      { id: replyId, role: "assistant", content: "" },
    ]);
    setQuestion("");
    setIsSending(true);

    const updateReply = (update: (content: string) => string) =>
      setMessages((current) =>
        current.map((message) =>
          message.id === replyId ? { ...message, content: update(message.content) } : message,
        ),
      );

    try {
      const answer = await askDocuments(text, (chunk) => updateReply((content) => content + chunk));
      if (!answer.trim()) updateReply(() => "The assistant returned an empty response.");
    } catch (error) {
      const message = getErrorMessage(error, "Unable to get an answer right now.");
      toast.error(message);
      updateReply(() => `I couldn’t answer that just now. ${message}`);
    } finally {
      setIsSending(false);
    }
  };

  const startNewChat = () => {
    resetRagSession();
    setMessages([WELCOME_MESSAGE]);
  };

  const createSuggestions = async () => {
    if (!employeeName.trim() || !department.trim() || !weekStart) {
      toast.error("Enter the employee name, department, and week start date.");
      return;
    }
    setIsGenerating(true);
    try {
      const result = await generatePlannerSuggestions({
        employeeName: employeeName.trim(),
        department: department.trim(),
        weekStart,
        notes: notes.trim(),
      });
      const draft = parsePlannerResponse(result);
      setPlanner(draft);
      setPersistedPlanner(null);
      setWeekStart(draft.weekStart || weekStart);
      setPlannerView("draft");
      setApprovalComplete(false);
      toast.success("Planner suggestions are ready to review.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to generate planner suggestions."));
    } finally {
      setIsGenerating(false);
    }
  };

  const updatePlanner = (updater: (current: PlannerDraft) => PlannerDraft) => {
    setPlanner((current) => (current ? updater(current) : current));
  };

  const updateObjective = (index: number, value: string) => {
    updatePlanner((current) => ({
      ...current,
      objectives: current.objectives.map((objective, itemIndex) =>
        itemIndex === index ? value : objective,
      ),
    }));
  };

  const updateDay = (dayIndex: number, changes: Partial<PlannerDayDraft>) => {
    updatePlanner((current) => ({
      ...current,
      days: current.days.map((day, index) => (index === dayIndex ? { ...day, ...changes } : day)),
    }));
  };

  const updateTask = (dayIndex: number, taskIndex: number, changes: Partial<PlannerTaskDraft>) => {
    updatePlanner((current) => ({
      ...current,
      days: current.days.map((day, index) =>
        index === dayIndex
          ? {
              ...day,
              tasks: day.tasks.map((task, itemIndex) =>
                itemIndex === taskIndex ? { ...task, ...changes } : task,
              ),
            }
          : day,
      ),
    }));
  };

  const addObjective = () =>
    updatePlanner((current) => ({ ...current, objectives: [...current.objectives, ""] }));

  const removeObjective = (index: number) =>
    updatePlanner((current) => ({
      ...current,
      objectives: current.objectives.filter((_, itemIndex) => itemIndex !== index),
    }));

  const addTask = (dayIndex: number) => {
    const id = crypto.randomUUID();
    updatePlanner((current) => ({
      ...current,
      days: current.days.map((day, index) =>
        index === dayIndex
          ? {
              ...day,
              tasks: [
                ...day.tasks,
                { id, title: "", description: "", deliverable: "", priority: "MEDIUM" },
              ],
            }
          : day,
      ),
    }));
  };

  const removeTask = (dayIndex: number, taskIndex: number) =>
    updatePlanner((current) => ({
      ...current,
      days: current.days.map((day, index) =>
        index === dayIndex
          ? { ...day, tasks: day.tasks.filter((_, itemIndex) => itemIndex !== taskIndex) }
          : day,
      ),
    }));

  const approveAndDownload = async () => {
    if (!planner) return;
    if (!planner.days.some((day) => day.tasks.length > 0)) {
      toast.error("Add at least one task before approving the planner.");
      return;
    }
    if (
      planner.objectives.some((objective) => !objective.trim()) ||
      planner.days.some((day) =>
        day.tasks.some(
          (task) => !task.title.trim() || !task.description.trim() || !task.deliverable.trim(),
        ),
      )
    ) {
      toast.error("Complete or remove empty objective/task fields before approving.");
      return;
    }

    setIsApproving(true);
    try {
      let savedPlanner = persistedPlanner;
      if (!savedPlanner) {
        savedPlanner = await persistApprovedPlanner(planner, user.id, token);
        setPersistedPlanner(savedPlanner);
      }

      const response = await approvePlanner(planner, user.name);
      const approvalResult = await downloadApprovedFile(response, planner.requestId);
      setApprovalComplete(true);
      let taskIndex = 0;
      setProgress(
        planner.days.flatMap((day) =>
          day.tasks.map((task) => ({
            day: day.day,
            date: day.date,
            taskId: task.id,
            backendTaskId: savedPlanner.taskIds[taskIndex++],
            title: task.title,
            description: task.description,
            deliverable: task.deliverable,
            priority: task.priority,
            status: "NOT_STARTED" as const,
            progress: 0,
            blocker: "",
            notes: "",
          })),
        ),
      );
      setPlannerView("progress");
      if (approvalResult.status === "GENERATED_NOT_SAVED" || approvalResult.warnings?.length) {
        toast.warning(
          approvalResult.warnings?.[0] ??
            "The planner and tasks are saved. The document service did not save its file copy.",
        );
      } else {
        toast.success("Planner and tasks saved. Approved planner file downloaded.");
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to approve the planner."));
    } finally {
      setIsApproving(false);
    }
  };

  const updateProgress = (index: number, changes: Partial<PlannerProgress>) => {
    setProgress((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...changes } : item)),
    );
  };

  const downloadProgressReport = () => {
    if (!planner) return;
    const report = {
      requestId: planner.requestId,
      employee: planner.employee,
      weekStart: planner.weekStart,
      weekEnd: planner.weekEnd,
      progress,
      asks,
      generatedAt: new Date().toISOString(),
    };
    downloadBlob(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
      `weekly-progress-${planner.weekStart}.json`,
    );
    toast.success("Progress report downloaded.");
  };

  /** Saves every task's status/progress to the backend so progress survives a reload. */
  const saveProgressUpdates = async () => {
    for (let index = 0; index < progress.length; index += 1) {
      const item = progress[index];
      const updateId = await savePlannerTaskUpdate(
        item.backendTaskId,
        item.updateId,
        {
          status: item.status,
          progress: item.progress,
          comment: item.status === "BLOCKED" ? item.blocker.trim() : item.notes.trim(),
        },
        token,
      );
      setProgress((current) =>
        current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, updateId } : entry)),
      );
    }
  };

  const generateReport = async () => {
    if (!planner) return;
    if (!persistedPlanner) {
      toast.error("This planner has not been saved. Re-approve it before reporting progress.");
      return;
    }
    const blockedWithoutComment = progress.find(
      (item) => item.status === "BLOCKED" && !item.blocker.trim(),
    );
    if (blockedWithoutComment) {
      toast.error(`Add a blocker comment for "${blockedWithoutComment.title}".`);
      return;
    }

    setIsGeneratingReport(true);
    try {
      await saveProgressUpdates();
      const draft = await generateWeeklyReport({
        planner,
        progress,
        employee: {
          name: planner.employee.name || user.name,
          department: planner.employee.department || getUserDepartment(user),
          role: ROLE_LABELS[user.role] ?? user.role,
        },
        submittedBy: user.name,
        notes: asks,
      });
      setReportDraft(draft);
      setPlannerView("report");
      toast.success("Your report draft is ready. Review it, then approve to submit.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to generate the weekly report."));
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const updateReport = (changes: Partial<WeeklyReportDraft>) => {
    setReportDraft((current) => (current ? { ...current, ...changes } : current));
  };

  const approveReport = async () => {
    if (!planner || !persistedPlanner || !reportDraft) return;
    if (!reportDraft.headline.trim()) {
      toast.error("Add a headline before approving the report.");
      return;
    }
    const cleanDraft: WeeklyReportDraft = {
      ...reportDraft,
      headline: reportDraft.headline.trim(),
      executiveSummary: reportDraft.executiveSummary.trim(),
      ...Object.fromEntries(
        REPORT_LIST_FIELDS.map(({ field }) => [
          field,
          reportDraft[field].map((line) => line.trim()).filter(Boolean),
        ]),
      ),
      proposedNextWeek: reportDraft.proposedNextWeek
        .map((item) => ({ ...item, title: item.title.trim(), reason: item.reason.trim() }))
        .filter((item) => item.title),
    };

    setIsApprovingReport(true);
    try {
      const result = await approveWeeklyReport(cleanDraft, user.name);
      if (result.file) {
        downloadBase64(result.file.base64, result.file.mimeType, result.file.fileName);
      }
      if (result.status !== "SAVED" || !result.zoho) {
        // Keep the planner open so the user can retry once WorkDrive is reachable.
        toast.warning(
          result.warnings[0] ??
            "The report was generated but not saved to Zoho WorkDrive. Please try again.",
        );
        return;
      }

      const report = await saveWeeklyReport(
        persistedPlanner.plannerId,
        persistedPlanner.reportId,
        {
          blockers: cleanDraft.blockers.join("\n"),
          supportRequired: cleanDraft.supportRequired.join("\n") || asks.trim(),
          status: "COMPLETED",
          submittedAt: new Date().toISOString(),
          reportReference: result.reportId ?? cleanDraft.reportId,
          headline: cleanDraft.headline,
          approvedBy: user.name,
          fileName: result.zoho.fileName || result.file?.fileName,
          workDriveFileId: result.zoho.fileId ?? undefined,
          workDriveLink: result.zoho.permalink ?? undefined,
        },
        token,
      );
      setPersistedPlanner({ ...persistedPlanner, reportId: report.id });

      const permalink = result.zoho.permalink;
      toast.success("Report approved and saved to Zoho WorkDrive.", {
        description: result.warnings[0],
        action: permalink
          ? { label: "Open", onClick: () => window.open(permalink, "_blank", "noopener") }
          : undefined,
      });
      setWeekStart(format(addDays(new Date(`${planner.weekStart}T12:00:00`), 7), "yyyy-MM-dd"));
      setNotes("");
      resetPlanner();
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to approve the weekly report."));
    } finally {
      setIsApprovingReport(false);
    }
  };

  const resetPlanner = () => {
    setPlanner(null);
    setProgress([]);
    setPersistedPlanner(null);
    setAsks("");
    setReportDraft(null);
    setApprovalComplete(false);
    setPlannerView("setup");
  };

  return (
    <AppShell title="AI Assistant">
      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
        <div>
          <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
            <Sparkles className="h-4 w-4 text-primary" />
            Your workplace copilot
          </div>
          <h2 className="text-xl font-semibold tracking-tight sm:mt-1 sm:text-2xl">AI Assistant</h2>
          <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
            Find answers in company documents or prepare and report your weekly work.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid h-auto w-full max-w-lg grid-cols-2">
            <TabsTrigger value="documents" className="gap-2 py-2">
              <MessageCircle className="h-4 w-4" />
              <span className="sm:hidden">Ask documents</span>
              <span className="hidden sm:inline">Ask company documents</span>
            </TabsTrigger>
            <TabsTrigger value="planner" className="gap-2 py-2">
              <FileText className="h-4 w-4" />
              <span className="sm:hidden">Planner</span>
              <span className="hidden sm:inline">Planner & report</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="mt-3 sm:mt-5">
            {/* On phones the card runs edge to edge (cancelling the shell's p-6) and fills the
                remaining screen height; from sm up it is a regular card. */}
            <Card className="-mx-6 flex h-[calc(100dvh-13rem)] min-h-105 flex-col overflow-hidden rounded-none border-x-0 sm:mx-0 sm:h-[min(72vh,760px)] sm:min-h-135 sm:rounded-xl sm:border-x">
              <CardHeader className="border-b bg-card px-4 py-3 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:h-10 sm:w-10">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">
                      Company knowledge assistant
                    </CardTitle>
                    <CardDescription className="hidden sm:block">
                      Ask about SOPs, reports, and internal company documents.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="ml-auto hidden sm:inline-flex">
                    RAG
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-9 shrink-0 gap-1.5 px-2.5 sm:ml-0"
                    onClick={startNewChat}
                    disabled={isSending}
                    aria-label="Start a new chat"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">New chat</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col p-0">
                <div
                  className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-4 sm:space-y-5 sm:p-6"
                  aria-live="polite"
                >
                  {messages
                    .filter((message) => message.role === "user" || message.content)
                    .map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}
                      >
                        {message.role === "assistant" && (
                          <div className="mt-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:flex">
                            <Bot className="h-4 w-4" />
                          </div>
                        )}
                        <div
                          className={`min-w-0 space-y-3 rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed sm:px-4 sm:py-3 sm:text-sm ${
                            message.role === "user"
                              ? "max-w-[85%] rounded-br-sm bg-primary text-primary-foreground sm:max-w-[80%]"
                              : "max-w-full rounded-bl-sm border bg-muted/40 sm:max-w-[85%]"
                          }`}
                        >
                          {message.role === "assistant" ? (
                            <ChatMarkdown content={message.content} />
                          ) : (
                            <p className="whitespace-pre-wrap">{message.content}</p>
                          )}
                          {message.sources && message.sources.length > 0 && (
                            <div className="border-t border-border/70 pt-2">
                              <p className="mb-1 text-xs font-medium text-muted-foreground">
                                Sources
                              </p>
                              <ul className="space-y-1">
                                {message.sources.map((source, index) => (
                                  <li key={`${source.title}-${index}`}>
                                    {source.url ? (
                                      <a
                                        className="text-xs text-primary underline-offset-2 hover:underline"
                                        href={source.url}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        {source.title}
                                      </a>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">
                                        {source.title}
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        {message.role === "user" && (
                          <div className="mt-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-card text-xs font-semibold sm:flex">
                            {user.name
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((part) => part[0])
                              .join("")}
                          </div>
                        )}
                      </div>
                    ))}
                  {isSending && !messages[messages.length - 1]?.content && (
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <div className="hidden h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary sm:flex">
                        <Bot className="h-4 w-4" />
                      </div>
                      <span className="flex items-center gap-2">
                        <LoaderCircle className="h-4 w-4 animate-spin" /> Searching company
                        documents…
                      </span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div className="border-t bg-card px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
                  {!isDocumentChatConfigured() && (
                    <p className="mb-3 flex items-center gap-2 text-xs text-amber-700">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      Configure VITE_N8N_CHAT_URL to connect the document chat service.
                    </p>
                  )}
                  <div className="flex items-end gap-2">
                    {/* text-base on phones: inputs under 16px make iOS zoom the page on focus. */}
                    <Textarea
                      ref={questionRef}
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void sendQuestion();
                        }
                      }}
                      placeholder="Ask about a company document…"
                      rows={1}
                      enterKeyHint="send"
                      className="max-h-40 min-h-11 resize-none rounded-2xl py-2.5 text-base sm:text-sm"
                      aria-label="Your question"
                    />
                    <Button
                      size="icon"
                      className="h-11 w-11 shrink-0 rounded-full"
                      onClick={() => void sendQuestion()}
                      disabled={!question.trim() || isSending}
                      aria-label="Send question"
                    >
                      {isSending ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="mt-2 hidden text-center text-[11px] text-muted-foreground sm:block">
                    Answers are generated from company documents. Verify critical information
                    against its source.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="planner" className="mt-5 space-y-5">
            {isLoadingPlanner && (
              <Card>
                <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Checking for an unsubmitted weekly planner…
                </CardContent>
              </Card>
            )}

            {plannerView === "setup" && !isLoadingPlanner && (
              <Card>
                <CardHeader>
                  <CardTitle>Generate your weekly planner</CardTitle>
                  <CardDescription>
                    Tell the assistant who the planner is for, select Monday, and add context for
                    its suggestions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="planner-employee">
                        Employee name
                        <span className="ml-1 text-xs text-muted-foreground">
                          (from your profile)
                        </span>
                      </Label>
                      <Input
                        id="planner-employee"
                        value={employeeName}
                        onChange={(event) => setEmployeeName(event.target.value)}
                        placeholder="Employee name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="planner-department">
                        Department
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({user.department ? "from your profile" : "from your role"})
                        </span>
                      </Label>
                      <Input
                        id="planner-department"
                        value={department}
                        onChange={(event) => setDepartment(event.target.value)}
                        placeholder="e.g. Research and Development"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="planner-week">Week starting Monday</Label>
                      <Input
                        id="planner-week"
                        type="date"
                        value={weekStart}
                        onChange={(event) => setWeekStart(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="planner-notes">Focus or notes</Label>
                      <Textarea
                        id="planner-notes"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="What should the planner focus on?"
                        rows={3}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t pt-4">
                    <p className="text-xs text-muted-foreground">
                      Suggestions are editable; nothing is sent for approval until you approve it.
                    </p>
                    <Button onClick={() => void createSuggestions()} disabled={isGenerating}>
                      {isGenerating ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Generate suggestions
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {plannerView === "draft" && planner && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Button variant="ghost" size="sm" onClick={resetPlanner}>
                      <ArrowLeft className="mr-2 h-4 w-4" /> Start over
                    </Button>
                    <h3 className="mt-2 text-xl font-semibold">Review and edit your plan</h3>
                    <p className="text-sm text-muted-foreground">
                      {planner.employee.name} · {planner.employee.department} ·{" "}
                      {format(new Date(`${planner.weekStart}T12:00:00`), "MMM d")} –{" "}
                      {format(new Date(`${planner.weekEnd}T12:00:00`), "MMM d, yyyy")}
                    </p>
                  </div>
                  <Badge variant="outline">{planner.status.replaceAll("_", " ")}</Badge>
                </div>

                {planner.warnings && planner.warnings.length > 0 && (
                  <Card className="border-amber-500/40 bg-amber-50/60">
                    <CardContent className="flex gap-3 py-4">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                      <div className="space-y-1">
                        {planner.warnings.map((warning, index) => (
                          <p key={index} className="text-sm text-amber-900">
                            {warning}
                          </p>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Objectives</CardTitle>
                      <CardDescription>Edit, add, or remove weekly objectives.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={addObjective}>
                      <Plus className="mr-1 h-4 w-4" /> Add objective
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {planner.objectives.map((objective, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <Textarea
                          value={objective}
                          onChange={(event) => updateObjective(index, event.target.value)}
                          rows={2}
                          aria-label={`Objective ${index + 1}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove objective ${index + 1}`}
                          onClick={() => removeObjective(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {planner.objectives.length === 0 && (
                      <p className="text-sm text-muted-foreground">No objectives added yet.</p>
                    )}
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  {planner.days.map((day, dayIndex) => (
                    <Card key={`${day.day}-${dayIndex}`}>
                      <CardHeader className="flex flex-row items-center justify-between gap-3">
                        <div>
                          <CardTitle className="text-base">{day.day}</CardTitle>
                          <CardDescription>
                            {day.date
                              ? format(new Date(`${day.date}T12:00:00`), "EEEE, MMMM d")
                              : "Planned work"}
                          </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => addTask(dayIndex)}>
                          <Plus className="mr-1 h-4 w-4" /> Add task
                        </Button>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {day.tasks.map((task, taskIndex) => (
                          <TaskEditor
                            key={task.id}
                            task={task}
                            onChange={(changes) => updateTask(dayIndex, taskIndex, changes)}
                            onRemove={() => removeTask(dayIndex, taskIndex)}
                          />
                        ))}
                        {day.tasks.length === 0 && (
                          <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                            No tasks for {day.day}. Add one or leave the day empty.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {planner.sources && planner.sources.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Documents used for suggestions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {planner.sources.map((source, index) => (
                        <div
                          key={`${source.fileName}-${index}`}
                          className="flex items-center gap-2 text-sm"
                        >
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          {source.link ? (
                            <a
                              className="text-primary underline-offset-2 hover:underline"
                              href={source.link}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {source.fileName}
                            </a>
                          ) : (
                            <span>{source.fileName}</span>
                          )}
                          {source.modifiedAt && (
                            <span className="ml-auto text-xs text-muted-foreground">
                              Updated {format(new Date(source.modifiedAt), "MMM d, yyyy")}
                            </span>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/95 p-4 shadow-lg backdrop-blur">
                  <p className="text-sm text-muted-foreground">
                    Review all tasks before sending the approved plan.
                  </p>
                  <Button onClick={() => void approveAndDownload()} disabled={isApproving}>
                    {isApproving ? (
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    Approve planner & download file
                  </Button>
                </div>
              </>
            )}

            {plannerView === "progress" && planner && (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Button variant="ghost" size="sm" onClick={() => setPlannerView("draft")}>
                      <ArrowLeft className="mr-2 h-4 w-4" /> Back to planner
                    </Button>
                    <h3 className="mt-2 text-xl font-semibold">Weekly progress update</h3>
                    <p className="text-sm text-muted-foreground">
                      {planner.employee.name} · {planner.weekStart} – {planner.weekEnd}
                    </p>
                  </div>
                  {approvalComplete && (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Planner approved
                    </Badge>
                  )}
                </div>

                <div className="space-y-4">
                  {progress.map((item, index) => (
                    <ProgressEditor
                      key={item.taskId}
                      item={item}
                      onChange={(changes) => updateProgress(index, changes)}
                    />
                  ))}
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>What are you asking for?</CardTitle>
                    <CardDescription>
                      Describe the support, resources, or decisions that would help you move
                      forward. The assistant uses this and your task notes to draft the report.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      value={asks}
                      onChange={(event) => setAsks(event.target.value)}
                      placeholder="I need…"
                      rows={4}
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="outline" onClick={downloadProgressReport}>
                        <ArrowDownToLine className="mr-2 h-4 w-4" /> Download progress data
                      </Button>
                      {reportDraft && (
                        <Button variant="outline" onClick={() => setPlannerView("report")}>
                          <FileText className="mr-2 h-4 w-4" /> View report draft
                        </Button>
                      )}
                      <Button onClick={() => void generateReport()} disabled={isGeneratingReport}>
                        {isGeneratingReport ? (
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        {reportDraft ? "Regenerate report" : "Generate report"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {plannerView === "report" && planner && reportDraft && (
              <ReportReview
                draft={reportDraft}
                onChange={updateReport}
                onBack={() => setPlannerView("progress")}
                onRegenerate={() => void generateReport()}
                onApprove={() => void approveReport()}
                isRegenerating={isGeneratingReport}
                isApproving={isApprovingReport}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function TaskEditor({
  task,
  onChange,
  onRemove,
}: {
  task: PlannerTaskDraft;
  onChange: (changes: Partial<PlannerTaskDraft>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="rounded-xl border">
      <div className="flex items-center gap-2 p-3">
        <Badge variant={task.priority === "HIGH" ? "destructive" : "outline"} className="shrink-0">
          {task.priority || "PRIORITY"}
        </Badge>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {task.title || "New task"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={expanded ? "Collapse task" : "Expand task"}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          aria-label="Remove task"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {expanded && (
        <div className="grid gap-4 border-t p-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Task title</Label>
            <Input
              value={task.title}
              onChange={(event) => onChange({ title: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <select
              value={task.priority}
              onChange={(event) => onChange({ priority: event.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Description</Label>
            <Textarea
              value={task.description}
              onChange={(event) => onChange({ description: event.target.value })}
              rows={3}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Deliverable</Label>
            <Textarea
              value={task.deliverable}
              onChange={(event) => onChange({ deliverable: event.target.value })}
              rows={2}
            />
          </div>
          {task.basis && (
            <p className="text-xs text-muted-foreground md:col-span-2">
              Suggestion basis: {task.basis}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ProgressEditor({
  item,
  onChange,
}: {
  item: PlannerProgress;
  onChange: (changes: Partial<PlannerProgress>) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardDescription>
              {item.day} · {item.date ? format(new Date(`${item.date}T12:00:00`), "MMM d") : ""}
            </CardDescription>
            <CardTitle className="mt-1 text-base">{item.title}</CardTitle>
          </div>
          <Badge variant={item.priority === "HIGH" ? "destructive" : "outline"}>
            {item.priority}
          </Badge>
        </div>
        {item.deliverable && (
          <p className="pt-2 text-sm text-muted-foreground">Deliverable: {item.deliverable}</p>
        )}
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor={`task-progress-${item.taskId}`}>Progress</Label>
            <span className="text-sm font-medium">{item.progress}%</span>
          </div>
          <input
            id={`task-progress-${item.taskId}`}
            type="range"
            min="0"
            max="100"
            step="5"
            value={item.progress}
            onChange={(event) => onChange({ progress: Number(event.target.value) })}
            className="h-2 w-full cursor-pointer accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`task-status-${item.taskId}`}>Status</Label>
          <select
            id={`task-status-${item.taskId}`}
            value={item.status}
            onChange={(event) =>
              onChange({ status: event.target.value as PlannerProgress["status"] })
            }
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
        {item.status === "BLOCKED" ? (
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={`task-blocker-${item.taskId}`}>Blocker</Label>
            <Textarea
              id={`task-blocker-${item.taskId}`}
              value={item.blocker}
              onChange={(event) => onChange({ blocker: event.target.value })}
              placeholder="What is preventing this task from moving forward?"
              rows={2}
            />
          </div>
        ) : (
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={`task-notes-${item.taskId}`}>Notes & results (optional)</Label>
            <Textarea
              id={`task-notes-${item.taskId}`}
              value={item.notes}
              onChange={(event) => onChange({ notes: event.target.value })}
              placeholder="What was done, and any figures worth reporting (e.g. batches run, tonnes CO₂ stored)"
              rows={2}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const linesToList = (value: string) => value.split("\n");
const listToLines = (value: string[]) => value.join("\n");

function ReportReview({
  draft,
  onChange,
  onBack,
  onRegenerate,
  onApprove,
  isRegenerating,
  isApproving,
}: {
  draft: WeeklyReportDraft;
  onChange: (changes: Partial<WeeklyReportDraft>) => void;
  onBack: () => void;
  onRegenerate: () => void;
  onApprove: () => void;
  isRegenerating: boolean;
  isApproving: boolean;
}) {
  const busy = isRegenerating || isApproving;
  const { stats } = draft;
  const statTiles = [
    { label: "Overall", value: `${stats.overallProgress}%` },
    { label: "Completed", value: `${stats.completed}/${stats.planned}` },
    { label: "In progress", value: stats.inProgress },
    { label: "Blocked", value: stats.blocked },
    { label: "Not started", value: stats.notStarted + stats.noUpdate },
  ];

  const updateNext = (index: number, changes: Partial<ReportNextWeekItem>) =>
    onChange({
      proposedNextWeek: draft.proposedNextWeek.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...changes } : item,
      ),
    });

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack} disabled={busy}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to progress
          </Button>
          <h3 className="mt-2 text-xl font-semibold">Review weekly report</h3>
          <p className="text-sm text-muted-foreground">
            {draft.employee.name} · {draft.employee.role} · {draft.weekStart} – {draft.weekEnd}
          </p>
        </div>
        <Badge variant="outline">Pending your approval</Badge>
      </div>

      {draft.warnings.length > 0 && (
        <div className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <ul className="space-y-1">
            {draft.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {statTiles.map((tile) => (
          <Card key={tile.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{tile.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{tile.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>
            Generated from your task updates. Edit anything before approving — the approved version
            is what gets saved to Zoho WorkDrive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report-headline">Headline</Label>
            <Input
              id="report-headline"
              value={draft.headline}
              onChange={(event) => onChange({ headline: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-summary">Executive summary</Label>
            <Textarea
              id="report-summary"
              value={draft.executiveSummary}
              onChange={(event) => onChange({ executiveSummary: event.target.value })}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Report sections</CardTitle>
          <CardDescription>
            One item per line. Leave a section empty if it does not apply.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {REPORT_LIST_FIELDS.map(({ field, label, hint }) => (
            <div key={field} className="space-y-2">
              <Label htmlFor={`report-${field}`}>{label}</Label>
              <Textarea
                id={`report-${field}`}
                value={listToLines(draft[field])}
                onChange={(event) => onChange({ [field]: linesToList(event.target.value) })}
                placeholder={hint || "None"}
                rows={Math.min(8, Math.max(3, draft[field].length + 1))}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Proposed for next week</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {draft.proposedNextWeek.map((item, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-xl border p-3 md:grid-cols-[1fr_140px_auto]"
            >
              <div className="space-y-2">
                <Input
                  aria-label="Next week item"
                  value={item.title}
                  onChange={(event) => updateNext(index, { title: event.target.value })}
                />
                <Textarea
                  aria-label="Reason"
                  value={item.reason}
                  onChange={(event) => updateNext(index, { reason: event.target.value })}
                  placeholder="Why"
                  rows={2}
                />
              </div>
              <select
                aria-label="Priority"
                value={item.priority}
                onChange={(event) => updateNext(index, { priority: event.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-destructive"
                aria-label="Remove item"
                onClick={() =>
                  onChange({
                    proposedNextWeek: draft.proposedNextWeek.filter((_, i) => i !== index),
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                proposedNextWeek: [
                  ...draft.proposedNextWeek,
                  { title: "", reason: "", priority: "MEDIUM" },
                ],
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" /> Add item
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onRegenerate} disabled={busy}>
          {isRegenerating ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Regenerate
        </Button>
        <Button onClick={onApprove} disabled={busy}>
          {isApproving ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}
          Approve & submit report
        </Button>
      </div>
      <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
        <ExternalLink className="h-3 w-3" /> On approval the report is saved to Zoho WorkDrive and a
        copy is downloaded.
      </p>
    </>
  );
}
