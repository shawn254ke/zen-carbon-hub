import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Upload, Plus, FileText, Trash2, Building2, Mail, Phone, MapPin, Download, FlaskConical, Paperclip } from "lucide-react";
import { LAB_RESULTS, PROJECTS, type LabResult } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useEffect, useState, useMemo } from "react";

export const Route = createFileRoute("/lab-results")({
  component: LabResultsPage,
});

type LabDoc = { id: string; name: string; type: string; expiresOn?: string };
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

const SEED_LABS: Lab[] = [
  {
    id: "lab_1",
    name: "SGS Nairobi",
    contactPerson: "Grace Wanjiru",
    email: "nairobi.lab@sgs.com",
    phone: "+254 700 000 111",
    address: "Industrial Area, Nairobi, Kenya",
    notes: "Primary lab for proximate & ultimate analysis.",
    documents: [
      { id: "d1", name: "ISO 17025 Accreditation.pdf", type: "ISO 17025", expiresOn: "2026-08-14" },
      { id: "d2", name: "Scope of Accreditation.pdf", type: "Scope document" },
    ],
  },
  {
    id: "lab_2",
    name: "Eurofins",
    contactPerson: "David Müller",
    email: "kenya@eurofins.com",
    phone: "+49 30 123 4567",
    address: "Berlin, Germany",
    documents: [
      { id: "d3", name: "ISO 17025 Certificate.pdf", type: "ISO 17025", expiresOn: "2027-02-01" },
    ],
  },
  {
    id: "lab_3",
    name: "In-house",
    contactPerson: "Zen Carbon R&D",
    email: "lab@zencarbon.io",
    address: "R&D Lab, Nakuru",
    documents: [],
  },
];

const STORAGE_KEY = "zc_labs_v1";

function useLabs() {
  const [labs, setLabs] = useState<Lab[]>(SEED_LABS);
  useEffect(() => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      try { setLabs(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }, []);
  const persist = (next: Lab[]) => {
    setLabs(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };
  return { labs, persist };
}

function LabResultsPage() {
  const { can } = useAuth();
  const { analyses, save, remove } = useAnalyses();
  const canEditAnalysis = can("admin:all") || can("lab:upload");
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
                <Button variant="outline" onClick={() => downloadAllAnalyses(analyses)}>
                  <Download className="h-4 w-4 mr-1" /> Download all analyses
                </Button>
              )}
              {LAB_RESULTS.length > 0 && (
                <Button variant="outline" onClick={() => LAB_RESULTS.forEach(downloadLabResult)}>
                  <Download className="h-4 w-4 mr-1" /> Download all reports
                </Button>
              )}
              {can("lab:upload") && <Button><Upload className="h-4 w-4 mr-1" /> Upload result</Button>}
            </div>
            <Card>
          <CardHeader>
            <CardTitle>All results</CardTitle>
            <CardDescription>{LAB_RESULTS.length} total records</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Project</TableHead><TableHead>Batch</TableHead><TableHead>Test</TableHead><TableHead>Lab</TableHead><TableHead>Sample date</TableHead><TableHead>Result</TableHead><TableHead>Status</TableHead><TableHead>Analysis</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {LAB_RESULTS.map((l) => {
                  const p = PROJECTS.find((x) => x.id === l.projectId);
                  const a = analyses[l.id];
                  return (
                    <TableRow key={l.id}>
                      <TableCell>{p?.code}</TableCell>
                      <TableCell>{l.batchId ?? "—"}</TableCell>
                      <TableCell className="font-medium">{l.testName}</TableCell>
                      <TableCell>{l.labName}</TableCell>
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
                            <Button size="sm" variant="outline" onClick={() => downloadAnalysis(l, a)}>
                              <Download className="h-4 w-4 mr-1" /> Analysis
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => downloadLabResult(l)}>
                            <Download className="h-4 w-4 mr-1" /> Report
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
            </Card>

            <AnalysisSummaryCard analyses={analyses} />
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
  const { labs, persist } = useLabs();
  const [open, setOpen] = useState(false);

  const addLab = (lab: Lab) => persist([lab, ...labs]);
  const removeLab = (id: string) => persist(labs.filter((l) => l.id !== id));
  const addDoc = (labId: string, doc: LabDoc) =>
    persist(labs.map((l) => (l.id === labId ? { ...l, documents: [...l.documents, doc] } : l)));
  const removeDoc = (labId: string, docId: string) =>
    persist(labs.map((l) => (l.id === labId ? { ...l, documents: l.documents.filter((d) => d.id !== docId) } : l)));

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
            <RegisterLabDialog onSubmit={(l) => { addLab(l); setOpen(false); }} />
          </Dialog>
        )}
      </div>

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
                  <Button variant="ghost" size="icon" onClick={() => removeLab(lab.id)} aria-label="Remove lab">
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
                      <li key={d.id} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{d.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {d.type}{d.expiresOn ? ` · expires ${d.expiresOn}` : ""}
                            </div>
                          </div>
                        </div>
                        {canManage && (
                          <Button variant="ghost" size="icon" onClick={() => removeDoc(lab.id, d.id)} aria-label="Remove document">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {canManage && (
                  <AddDocForm onAdd={(doc) => addDoc(lab.id, doc)} />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function RegisterLabDialog({ onSubmit }: { onSubmit: (lab: Lab) => void }) {
  const [form, setForm] = useState({
    name: "", contactPerson: "", email: "", phone: "", address: "", notes: "",
  });
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
      <DialogFooter>
        <Button
          disabled={!form.name.trim()}
          onClick={() =>
            onSubmit({
              id: `lab_${Date.now()}`,
              name: form.name.trim(),
              contactPerson: form.contactPerson || undefined,
              email: form.email || undefined,
              phone: form.phone || undefined,
              address: form.address || undefined,
              notes: form.notes || undefined,
              documents: [],
            })
          }
        >
          Save lab
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

function AddDocForm({ onAdd }: { onAdd: (doc: LabDoc) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState(DOC_TYPES[0]);
  const [expires, setExpires] = useState("");

  return (
    <div className="mt-3 rounded-md border border-dashed p-3 space-y-2">
      <div className="grid gap-2 sm:grid-cols-3">
        <Input placeholder="Document file name" value={name} onChange={(e) => setName(e.target.value)} />
        <select
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
      </div>
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          disabled={!name.trim()}
          onClick={() => {
            onAdd({ id: `d_${Date.now()}`, name: name.trim(), type, expiresOn: expires || undefined });
            setName(""); setExpires("");
          }}
        >
          <Upload className="h-3.5 w-3.5 mr-1" /> Add document
        </Button>
      </div>
    </div>
  );
}

function downloadLabResult(l: LabResult) {
  const project = PROJECTS.find((p) => p.id === l.projectId);
  const content =
    `Zen Carbon — Laboratory Result (mock)\n` +
    `====================================\n\n` +
    `Test:          ${l.testName}\n` +
    `Project:       ${project?.code ?? l.projectId} — ${project?.name ?? ""}\n` +
    `Batch:         ${l.batchId ?? "—"}\n` +
    `Lab:           ${l.labName}\n` +
    `Sample date:   ${l.sampleDate}\n` +
    `Report date:   ${l.reportDate || "—"}\n` +
    `Result:        ${l.result}\n` +
    `Status:        ${l.status}\n` +
    `Reference id:  ${l.id}\n\n` +
    `This is a placeholder for the original lab report, provided so\n` +
    `reviewers can counter-check lab results before verification.\n`;
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${l.testName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${l.id}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadAnalysis(l: LabResult, a: Analysis) {
  const project = PROJECTS.find((p) => p.id === l.projectId);
  const content =
    `Zen Carbon — Lab Result Analysis (mock)\n` +
    `=====================================\n\n` +
    `Analysis file: ${a.fileName}\n` +
    `Test:          ${l.testName}\n` +
    `Project:       ${project?.code ?? l.projectId} — ${project?.name ?? ""}\n` +
    `Batch:         ${l.batchId ?? "—"}\n` +
    `Lab:           ${l.labName}\n` +
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

function downloadAllAnalyses(analyses: Record<string, Analysis>) {
  Object.entries(analyses).forEach(([id, a]) => {
    const l = LAB_RESULTS.find((x) => x.id === id);
    if (l) downloadAnalysis(l, a);
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

function AnalysisDialog({
  result, existing, onSave, onRemove, canEdit,
}: {
  result: LabResult;
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

function AnalysisSummaryCard({ analyses }: { analyses: Record<string, Analysis> }) {
  const entries = Object.entries(analyses);
  const total = LAB_RESULTS.length;
  const withAnalysis = entries.length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Analysis summaries</CardTitle>
        <CardDescription>
          {withAnalysis} of {total} results have an uploaded analysis.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No analyses uploaded yet. Use “Add analysis” on any result to attach a file and a summary.</p>
        ) : (
          <ul className="space-y-3">
            {entries.map(([id, a]) => {
              const l = LAB_RESULTS.find((x) => x.id === id);
              if (!l) return null;
              const p = PROJECTS.find((x) => x.id === l.projectId);
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
                      <Button size="sm" variant="outline" onClick={() => downloadAnalysis(l, a)}>
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