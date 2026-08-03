import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Upload, Plus, FileText, Trash2, Building2, Mail, Phone, MapPin, Download, FlaskConical, Paperclip, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  createLaboratoryApi,
  deleteLaboratoryApi,
  deleteLaboratoryDocumentApi,
  downloadLaboratoryDocumentApi,
  fetchLaboratoriesApi,
  uploadLaboratoryDocumentApi,
  type CreateLaboratoryPayload,
} from "@/lib/laboratories-api";
import {
  createLaboratoryResultApi,
  deleteLaboratoryResultApi,
  downloadLaboratoryResultApi,
  fetchLaboratoryResultsApi,
  type LaboratoryResultBackendStatus,
  type LaboratoryResultItem,
} from "@/lib/laboratory-results-api";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { useProjects } from "@/lib/projects-context";

export const Route = createFileRoute("/lab-results")({
  component: LabResultsPage,
});

type LabDoc = {
  id: string;
  name: string;
  type: string;
  url?: string;
  createdAt?: string;
  updatedAt?: string;
};
type Lab = {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  documents: LabDoc[];
};

function mapBackendLabToUi(lab: {
  id: string;
  name: string;
  contact?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  documents?: Array<{
    id: string;
    fileName: string;
    url?: string;
    documentType?: string;
    createdAt?: string;
    updatedAt?: string;
  }>;
}): Lab {
  return {
    id: lab.id,
    name: lab.name,
    contactPerson: lab.contact,
    email: lab.email,
    phone: lab.phone,
    address: lab.address,
    notes: lab.notes,
    documents: (lab.documents ?? []).map((doc) => ({
      id: doc.id,
      name: doc.fileName,
      type: doc.documentType ?? "Evidence document",
      url: doc.url,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    })),
  };
}

function useLabs() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchLaboratoriesApi();
      setLabs(data.map((lab) => mapBackendLabToUi(lab)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load laboratories.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // Initial fetch only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createLab = async (payload: CreateLaboratoryPayload) => {
    await createLaboratoryApi(payload);
    await refresh();
  };

  const removeLab = async (id: string) => {
    await deleteLaboratoryApi(id);
    await refresh();
  };

  const addDoc = async (lab: { id: string; name: string }, payload: { file: File; documentType: string }) => {
    await uploadLaboratoryDocumentApi({
      laboratoryId: lab.id,
      laboratoryName: lab.name,
      documentType: payload.documentType,
      file: payload.file,
    });
    await refresh();
  };

  const removeDoc = async (docId: string) => {
    await deleteLaboratoryDocumentApi(docId);
    await refresh();
  };

  const downloadDoc = async (doc: LabDoc) => {
    try {
      const result = await downloadLaboratoryDocumentApi(doc.id, undefined, doc.name);
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.fileName || doc.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download document.");
    }
  };

  return { labs, isLoading, error, refresh, createLab, removeLab, addDoc, removeDoc, downloadDoc };
}

function LabResultsPage() {
  const { can } = useAuth();
  const { projects } = useProjects();
  const { analyses, save, remove } = useAnalyses();
  const {
    results,
    isLoading: isLoadingResults,
    error: resultsError,
    addResult,
    removeResult,
    downloadResult,
    deletingId,
    downloadingId,
  } = useLabResults();
  const { labs } = useLabs();
  const canEditAnalysis = can("admin:all") || can("lab:upload");
  const canUploadResult = can("admin:all") || can("lab:upload");
  const allResults = useMemo(() => results, [results]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allResults.filter((l) => {
      if (projectFilter !== "all" && l.projectId !== projectFilter) return false;
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (!q) return true;
      const p = projects.find((x) => x.id === l.projectId);
      const a = analyses[l.id];
      const hay = [
        l.testName, l.laboratoryName, l.result, l.batchId ?? "", l.sampleDate, l.reportDate ?? "", l.projectName ?? "",
        p?.code ?? "", p?.name ?? "",
        a?.fileName ?? "", a?.summary ?? "", a?.keyFindings ?? "", a?.recommendation ?? "", a?.author ?? "",
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [allResults, analyses, query, projectFilter, statusFilter, projects]);
  return (
    <AppShell title="Lab Results">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Laboratory results</h2>
            <p className="text-sm text-muted-foreground">Every result is tracked to a project and, where applicable, a specific batch.</p>
          </div>
        </div>

        <Tabs defaultValue="results">
          <TabsList>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="labs">Registered Labs</TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="space-y-4">
            <div className="flex justify-end gap-2">
              {Object.keys(analyses).length > 0 && (
                <Button variant="outline" onClick={() => downloadAllAnalyses(analyses, allResults, projects)}>
                  <Download className="h-4 w-4 mr-1" /> Download all analyses
                </Button>
              )}
              {allResults.length > 0 && (
                <Button variant="outline" onClick={() => allResults.forEach((item) => void downloadResult(item))}>
                  <Download className="h-4 w-4 mr-1" /> Download all reports
                </Button>
              )}
              {canUploadResult && (
                <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                  <DialogTrigger asChild>
                    <Button><Upload className="h-4 w-4 mr-1" /> Upload result</Button>
                  </DialogTrigger>
                  <UploadLabResultDialog projects={projects} labs={labs} onSubmit={async (payload) => {
                    await addResult(payload);
                    setUploadOpen(false);
                  }} />
                </Dialog>
              )}
            </div>
            {resultsError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {resultsError}
              </div>
            )}
            {isLoadingResults && (
              <Card>
                <CardContent className="py-6 text-sm text-muted-foreground">Loading laboratory results…</CardContent>
              </Card>
            )}
            <Card>
          <CardHeader>
            <CardTitle>All results</CardTitle>
            <CardDescription>
              Showing {filteredResults.length} of {allResults.length} records
            </CardDescription>
            <div className="flex flex-col gap-2 pt-3 sm:flex-row sm:items-center">
              <Input
                placeholder="Search test, lab, result, project, analysis…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="sm:max-w-xs"
              />
              <select
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
              >
                <option value="all">All projects</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
              </select>
              <select
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="reported">Reported</option>
                <option value="in_progress">In progress</option>
              </select>
              {(query || projectFilter !== "all" || statusFilter !== "all") && (
                <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setProjectFilter("all"); setStatusFilter("all"); }}>
                  Clear
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[520px] overflow-auto rounded-md border">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Project</TableHead><TableHead>Batch</TableHead><TableHead>Test</TableHead><TableHead>Lab</TableHead><TableHead>Sample date</TableHead><TableHead>Result</TableHead><TableHead>Status</TableHead><TableHead>Analysis</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredResults.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                      No results match your search.
                    </TableCell>
                  </TableRow>
                )}
                {filteredResults.map((l) => {
                  const p = projects.find((x) => x.id === l.projectId);
                  const a = analyses[l.id];
                  return (
                    <TableRow key={l.id}>
                      <TableCell>{p?.code ?? l.projectName ?? l.projectId}</TableCell>
                      <TableCell>{l.batchName ?? l.batchId ?? "—"}</TableCell>
                      <TableCell className="font-medium">{l.testName}</TableCell>
                      <TableCell>{l.laboratoryName}</TableCell>
                      <TableCell>{l.sampleDate}</TableCell>
                      <TableCell>{l.result}</TableCell>
                      <TableCell><Badge variant={l.status === "reported" ? "default" : "secondary"}>{l.status}</Badge></TableCell>
                      <TableCell className="max-w-[280px]">
                        {a ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs">
                              <Paperclip className="h-3 w-3 text-primary" />
                              <span className="truncate font-medium">{a.fileName}</span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">{a.summary}</p>
                            <div className="text-[10px] text-muted-foreground">by {a.author} · {a.uploadedOn}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">No analysis</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canEditAnalysis && (
                            <AnalysisDialog result={l} existing={a} canEdit onSave={(v) => save(l.id, v)} onRemove={() => remove(l.id)} />
                          )}
                          {a && (
                            <Button size="sm" variant="outline" onClick={() => downloadAnalysis(l, a, projects)}>
                              <Download className="h-4 w-4 mr-1" /> Analysis
                            </Button>
                          )}
                          <Button size="sm" variant="outline" disabled={downloadingId === l.id} onClick={() => void downloadResult(l)}>
                            {downloadingId === l.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />} Report
                          </Button>
                          {canUploadResult && (
                            <Button size="sm" variant="ghost" disabled={deletingId === l.id} onClick={() => void removeResult(l.id)}>
                              {deletingId === l.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />} Delete
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          </CardContent>
            </Card>

            <AnalysisSummaryCard analyses={analyses} results={allResults} projects={projects} filteredIds={new Set(filteredResults.map((r) => r.id))} />
          </TabsContent>

          <TabsContent value="labs" className="space-y-4">
            <RegisteredLabs canManage={can("lab:upload") || can("admin:all")} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function RegisteredLabs({ canManage }: { canManage: boolean }) {
  const { labs, isLoading, error, refresh, createLab, removeLab, addDoc, removeDoc, downloadDoc } = useLabs();
  const [open, setOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Registered laboratories</h3>
          <p className="text-sm text-muted-foreground">
            Central directory of external and internal labs, their contacts, and compliance documents (ISO 17025 and related accreditations).
          </p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Register lab</Button>
            </DialogTrigger>
            <RegisterLabDialog onSubmit={async (payload) => {
              await createLab(payload);
              setOpen(false);
            }} />
          </Dialog>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
          <Button variant="link" className="h-auto px-2 py-0 text-destructive" onClick={() => refresh()}>
            Retry
          </Button>
        </div>
      )}

      {isLoading && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">Loading laboratories…</CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {labs.map((lab) => (
          <Card key={lab.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    {lab.name}
                  </CardTitle>
                  {lab.contactPerson && (
                    <CardDescription>{lab.contactPerson}</CardDescription>
                  )}
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={deletingId === lab.id}
                    onClick={async () => {
                      setDeletingId(lab.id);
                      try {
                        await removeLab(lab.id);
                        toast.success("Laboratory removed");
                      } catch (removeError) {
                        toast.error(removeError instanceof Error ? removeError.message : "Unable to remove laboratory.");
                      } finally {
                        setDeletingId(null);
                      }
                    }}
                    aria-label="Remove lab"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-1 text-sm text-muted-foreground">
                {lab.email && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {lab.email}</div>}
                {lab.phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {lab.phone}</div>}
                {lab.address && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {lab.address}</div>}
                {lab.notes && <div className="pt-1 text-foreground/80">{lab.notes}</div>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">Compliance documents</h4>
                  <Badge variant="secondary">{lab.documents.length}</Badge>
                </div>
                {lab.documents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No documents uploaded yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {lab.documents.map((d) => (
                      <li
                        key={d.id}
                        className={`flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 transition-opacity ${downloadingDocId === d.id || deletingDocId === d.id ? "opacity-60" : "opacity-100"}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{d.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {d.type}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={downloadingDocId === d.id || deletingDocId === d.id}
                            onClick={async () => {
                              setDownloadingDocId(d.id);
                              try {
                                await downloadDoc(d);
                                toast.success("Download started");
                              } finally {
                                setDownloadingDocId(null);
                              }
                            }}
                            aria-label="Download document"
                          >
                            {downloadingDocId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                          </Button>
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={deletingDocId === d.id || downloadingDocId === d.id}
                              onClick={async () => {
                                setDeletingDocId(d.id);
                                try {
                                  await removeDoc(d.id);
                                  toast.success("Document deleted");
                                } catch (removeError) {
                                  toast.error(removeError instanceof Error ? removeError.message : "Unable to delete document.");
                                } finally {
                                  setDeletingDocId(null);
                                }
                              }}
                              aria-label="Remove document"
                            >
                              {deletingDocId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin text-destructive" /> : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {canManage && (
                  <AddDocForm onAdd={(payload) => addDoc({ id: lab.id, name: lab.name }, payload)} />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function RegisterLabDialog({ onSubmit }: { onSubmit: (payload: CreateLaboratoryPayload) => Promise<void> }) {
  const [form, setForm] = useState({
    name: "", contactPerson: "", email: "", phone: "", address: "", notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Register a laboratory</DialogTitle>
        <DialogDescription>Add lab contacts. You can upload compliance documents after creating the record.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="lab-name">Lab name</Label>
          <Input id="lab-name" value={form.name} onChange={update("name")} placeholder="e.g. SGS Nairobi" />
        </div>
        <div className="grid gap-1.5 grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="lab-contact">Contact person</Label>
            <Input id="lab-contact" value={form.contactPerson} onChange={update("contactPerson")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lab-phone">Phone</Label>
            <Input id="lab-phone" value={form.phone} onChange={update("phone")} />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lab-email">Email</Label>
          <Input id="lab-email" type="email" value={form.email} onChange={update("email")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lab-address">Address</Label>
          <Input id="lab-address" value={form.address} onChange={update("address")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lab-notes">Notes</Label>
          <Textarea id="lab-notes" value={form.notes} onChange={update("notes")} rows={2} />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button
          disabled={!form.name.trim() || busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onSubmit({
              name: form.name.trim(),
              contact: form.contactPerson || undefined,
              email: form.email || undefined,
              phone: form.phone || undefined,
              address: form.address || undefined,
              notes: form.notes || undefined,
              });
            } catch (err) {
              setError(err instanceof Error ? err.message : "Unable to register laboratory.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving…" : "Save lab"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

const DOC_TYPES = [
  "ISO 17025",
  "ISO 9001",
  "Scope document",
  "Method validation",
  "Insurance",
  "Other",
];

function AddDocForm({ onAdd }: { onAdd: (payload: { file: File; documentType: string }) => Promise<void> }) {
  const [type, setType] = useState(DOC_TYPES[0]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useMemo(() => `doc-file-${Math.random().toString(36).slice(2, 8)}`, []);

  return (
    <div className={`mt-3 rounded-md border border-dashed p-3 space-y-2 transition-all ${busy ? "animate-pulse" : ""}`}>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input id={inputId} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <select
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      {file && (
        <p className="text-xs text-muted-foreground">Selected: {file.name} · {(file.size / 1024).toFixed(1)} KB</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          disabled={!file || busy}
          onClick={async () => {
            if (!file) return;
            setBusy(true);
            setError(null);
            try {
              await onAdd({ file, documentType: type });
              toast.success("Document uploaded");
              setFile(null);
              const el = document.getElementById(inputId) as HTMLInputElement | null;
              if (el) el.value = "";
            } catch (err) {
              setError(err instanceof Error ? err.message : "Unable to upload document.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />} {busy ? "Uploading…" : "Upload document"}
        </Button>
      </div>
    </div>
  );
}

function downloadAnalysis(l: LaboratoryResultItem, a: Analysis, projects: Array<{ id: string; code: string; name: string }>) {
  const project = projects.find((p) => p.id === l.projectId);
  const content =
    `Zen Carbon — Lab Result Analysis (mock)\n` +
    `=====================================\n\n` +
    `Analysis file: ${a.fileName}\n` +
    `Test:          ${l.testName}\n` +
    `Project:       ${project?.code ?? l.projectId} — ${project?.name ?? ""}\n` +
    `Batch:         ${l.batchId ?? "—"}\n` +
    `Lab:           ${l.laboratoryName}\n` +
    `Result:        ${l.result}\n` +
    `Status:        ${l.status}\n` +
    `Author:        ${a.author}\n` +
    `Uploaded on:   ${a.uploadedOn}\n\n` +
    `Summary:\n${a.summary}\n\n` +
    (a.keyFindings ? `Key findings:\n${a.keyFindings}\n\n` : "") +
    (a.recommendation ? `Recommendation:\n${a.recommendation}\n\n` : "") +
    `This is a placeholder for the uploaded analysis record, provided so\n` +
    `reviewers can counter-check the analysis before verification.\n`;
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const el = document.createElement("a");
  el.href = url;
  el.download = `analysis_${l.testName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${l.id}.txt`;
  document.body.appendChild(el);
  el.click();
  el.remove();
  URL.revokeObjectURL(url);
}

function downloadAllAnalyses(
  analyses: Record<string, Analysis>,
  results: LaboratoryResultItem[],
  projects: Array<{ id: string; code: string; name: string }>,
) {
  Object.entries(analyses).forEach(([id, analysis]) => {
    const result = results.find((item) => item.id === id);
    if (result) downloadAnalysis(result, analysis, projects);
  });
}

type Analysis = {
  fileName: string;
  summary: string;
  keyFindings?: string;
  recommendation?: string;
  author: string;
  uploadedOn: string;
};

const ANALYSIS_KEY = "zc_lab_analyses_v1";

function useAnalyses() {
  const [analyses, setAnalyses] = useState<Record<string, Analysis>>({});
  useEffect(() => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(ANALYSIS_KEY) : null;
    if (raw) {
      try { setAnalyses(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }, []);
  const persist = (next: Record<string, Analysis>) => {
    setAnalyses(next);
    window.localStorage.setItem(ANALYSIS_KEY, JSON.stringify(next));
  };
  return {
    analyses,
    save: (id: string, a: Analysis) => persist({ ...analyses, [id]: a }),
    remove: (id: string) => {
      const next = { ...analyses };
      delete next[id];
      persist(next);
    },
  };
}

function useLabResults() {
  const [results, setResults] = useState<LaboratoryResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchLaboratoryResultsApi();
      setResults(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load laboratory results.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const addResult = async (payload: UploadLaboratoryResultPayload) => {
    await createLaboratoryResultApi(payload);
    toast.success("Lab result uploaded");
    await refresh();
  };

  const removeResult = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteLaboratoryResultApi(id);
      toast.success("Lab result deleted");
      await refresh();
    } catch (removeError) {
      toast.error(removeError instanceof Error ? removeError.message : "Unable to delete lab result.");
    } finally {
      setDeletingId(null);
    }
  };

  const downloadResult = async (item: LaboratoryResultItem) => {
    setDownloadingId(item.id);
    try {
      const result = await downloadLaboratoryResultApi(item.id, item.fileName || `${item.testName}-${item.id}`);
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      toast.success("Download started");
    } catch (downloadError) {
      toast.error(downloadError instanceof Error ? downloadError.message : "Unable to download lab result.");
    } finally {
      setDownloadingId(null);
    }
  };

  return {
    results,
    isLoading,
    error,
    deletingId,
    downloadingId,
    addResult,
    removeResult,
    downloadResult,
  };
}

type UploadLaboratoryResultPayload = {
  projectId: string;
  projectName?: string;
  batchId?: string;
  laboratoryId: string;
  laboratoryName?: string;
  test: string;
  results: string;
  fileName: string;
  status: LaboratoryResultBackendStatus;
  sampleDate: string;
  reportDate?: string;
  uploadedById: string;
  uploadedByName?: string;
  file: File;
};

function UploadLabResultDialog({
  projects,
  labs,
  onSubmit,
}: {
  projects: Array<{ id: string; code: string; name: string; batch?: Array<{ id: string; code: string }> }>;
  labs: Array<{ id: string; name: string }>;
  onSubmit: (payload: UploadLaboratoryResultPayload) => Promise<void>;
}) {
  const { user } = useAuth();
  const [testName, setTestName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [batchId, setBatchId] = useState("");
  const [labId, setLabId] = useState(labs[0]?.id ?? "");
  const [sampleDate, setSampleDate] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [result, setResult] = useState("");
  const [status, setStatus] = useState<LaboratoryResultBackendStatus>("VERIFIED");
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId && projects.length > 0) {
      setProjectId(projects[0].id);
      setProjectName(projects[0].name);
    }
  }, [projectId, projects]);

  useEffect(() => {
    if (!labId && labs.length > 0) {
      setLabId(labs[0].id);
    }
  }, [labId, labs]);

  const selectedProject = projects.find((p) => p.id === projectId);
  const batches = selectedProject?.batch ?? [];
  const selectedLab = labs.find((lab) => lab.id === labId);

  const valid = testName.trim() && projectId.trim() && labId.trim() && sampleDate.trim() && result.trim() && fileName.trim() && !!file;

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Upload lab result</DialogTitle>
        <DialogDescription>Record a new lab result and attach the report file.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="lr-test">Test name</Label>
          <Input id="lr-test" value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="e.g. Fixed carbon %" />
        </div>
        <div className="grid gap-1.5 grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="lr-project">Project</Label>
            <select
              id="lr-project"
              className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                const project = projects.find((item) => item.id === e.target.value);
                setProjectName(project?.name ?? "");
                setBatchId("");
              }}
            >
              {projects.length === 0 && <option value="">No projects available</option>}
              {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lr-batch">Batch (optional)</Label>
            <select
              id="lr-batch"
              className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
            >
              <option value="">—</option>
              {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.code}</option>)}
            </select>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lr-lab">Laboratory</Label>
          <select
            id="lr-lab"
            className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
            value={labId}
            onChange={(e) => setLabId(e.target.value)}
          >
            {labs.length === 0 && <option value="">No registered laboratories found</option>}
            {labs.map((lab) => <option key={lab.id} value={lab.id}>{lab.name}</option>)}
          </select>
        </div>
        <div className="grid gap-1.5 grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="lr-sampled">Sample date</Label>
            <Input id="lr-sampled" type="date" value={sampleDate} onChange={(e) => setSampleDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lr-reported">Report date</Label>
            <Input id="lr-reported" type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lr-result">Result</Label>
          <Input id="lr-result" value={result} onChange={(e) => setResult(e.target.value)} placeholder="e.g. 72.4%" />
        </div>
        <div className="grid gap-1.5 grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="lr-status">Status</Label>
            <select
              id="lr-status"
              className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as LaboratoryResultBackendStatus)}
            >
              <option value="PENDING">PENDING</option>
              <option value="RECEIVED">RECEIVED</option>
              <option value="VERIFIED">VERIFIED</option>
              <option value="REJECTED">REJECTED</option>
              
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lr-file">Report file</Label>
            <Input
              id="lr-file"
              type="file"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0] ?? null;
                setFile(selectedFile);
                setFileName(selectedFile?.name ?? "");
              }}
            />
          </div>
        </div>
        {fileName && <p className="text-xs text-muted-foreground">Selected report: {fileName}</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button
          disabled={!valid || busy}
          onClick={async () => {
            if (!file) return;
            if (!/^\d+$/.test(user.id)) {
              setError("Current user id is not numeric. Please re-login with a synced backend account.");
              return;
            }

            setBusy(true);
            setError(null);
            try {
              await onSubmit({
                projectId,
                projectName: projectName || selectedProject?.name || undefined,
                batchId: batchId || undefined,
                laboratoryId: labId,
                laboratoryName: selectedLab?.name,
                test: testName.trim(),
                results: result.trim(),
                fileName,
                status,
                sampleDate,
                reportDate: reportDate || undefined,
                uploadedById: user.id,
                uploadedByName: user.name,
                file,
              });
            } catch (submitError) {
              setError(submitError instanceof Error ? submitError.message : "Unable to upload laboratory result.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />} Save result
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function AnalysisDialog({
  result, existing, onSave, onRemove, canEdit,
}: {
  result: LaboratoryResultItem;
  existing?: Analysis;
  onSave: (a: Analysis) => void;
  onRemove: () => void;
  canEdit?: boolean;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState(existing?.fileName ?? "");
  const [summary, setSummary] = useState(existing?.summary ?? "");
  const [keyFindings, setKeyFindings] = useState(existing?.keyFindings ?? "");
  const [recommendation, setRecommendation] = useState(existing?.recommendation ?? "");

  useEffect(() => {
    if (open) {
      setFileName(existing?.fileName ?? "");
      setSummary(existing?.summary ?? "");
      setKeyFindings(existing?.keyFindings ?? "");
      setRecommendation(existing?.recommendation ?? "");
    }
  }, [open, existing]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={existing ? "secondary" : "default"}>
          <FlaskConical className="h-4 w-4 mr-1" />
          {existing ? "Edit analysis" : "Add analysis"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Analysis — {result.testName}</DialogTitle>
          <DialogDescription>
            Upload the analysis file and record a summary so reviewers can quickly understand the outcome.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="an-file">Analysis file</Label>
            <Input
              id="an-file"
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFileName(f.name);
              }}
            />
            {fileName && <p className="text-xs text-muted-foreground">Selected: {fileName}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="an-summary">Summary</Label>
            <Textarea id="an-summary" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Overall interpretation of the result" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="an-key">Key findings</Label>
            <Textarea id="an-key" rows={2} value={keyFindings} onChange={(e) => setKeyFindings(e.target.value)} placeholder="Bullet points of critical values, deviations, etc." />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="an-rec">Recommendation</Label>
            <Textarea id="an-rec" rows={2} value={recommendation} onChange={(e) => setRecommendation(e.target.value)} placeholder="Next steps, e.g. accept batch, re-test, adjust process" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {existing ? (
            <Button variant="ghost" className="text-destructive" onClick={() => { onRemove(); setOpen(false); }}>
              <Trash2 className="h-4 w-4 mr-1" /> Remove
            </Button>
          ) : <span />}
          <Button
            disabled={!fileName.trim() || !summary.trim()}
            onClick={() => {
              onSave({
                fileName: fileName.trim(),
                summary: summary.trim(),
                keyFindings: keyFindings.trim() || undefined,
                recommendation: recommendation.trim() || undefined,
                author: user.name,
                uploadedOn: new Date().toISOString().slice(0, 10),
              });
              setOpen(false);
            }}
          >
            <Upload className="h-4 w-4 mr-1" /> Save analysis
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AnalysisSummaryCard({
  analyses,
  results,
  projects,
  filteredIds,
}: {
  analyses: Record<string, Analysis>;
  results: LaboratoryResultItem[];
  projects: Array<{ id: string; code: string; name: string }>;
  filteredIds?: Set<string>;
}) {
  const entries = Object.entries(analyses).filter(([id]) => !filteredIds || filteredIds.has(id));
  const total = results.length;
  const withAnalysis = Object.keys(analyses).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Analysis summaries</CardTitle>
        <CardDescription>
          {withAnalysis} of {total} results have an uploaded analysis{filteredIds ? ` · showing ${entries.length}` : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No analyses to show.</p>
        ) : (
          <ul className="space-y-3 max-h-[520px] overflow-auto pr-1">
            {entries.map(([id, a]) => {
              const l = results.find((x) => x.id === id);
              if (!l) return null;
              const p = projects.find((x) => x.id === l.projectId);
              return (
                <li key={id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{l.testName} <span className="text-muted-foreground font-normal">— {p?.code}</span></div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <Paperclip className="h-3 w-3" /> {a.fileName} · by {a.author} · {a.uploadedOn}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => downloadAnalysis(l, a, projects)}>
                        <Download className="h-3.5 w-3.5 mr-1" /> Analysis
                      </Button>
                      <Badge variant="outline">{l.result}</Badge>
                    </div>
                  </div>
                  <p className="text-sm mt-2">{a.summary}</p>
                  {a.keyFindings && (
                    <p className="text-xs text-muted-foreground mt-1"><span className="font-medium text-foreground/80">Findings:</span> {a.keyFindings}</p>
                  )}
                  {a.recommendation && (
                    <p className="text-xs text-muted-foreground mt-1"><span className="font-medium text-foreground/80">Recommendation:</span> {a.recommendation}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}