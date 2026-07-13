import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PROJECTS, BATCHES, LAB_RESULTS, EVIDENCE, EMISSIONS, DEPARTMENTS, type EvidenceItem, type LabResult } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Download, FlaskConical } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type ExtraBatch = {
  id: string;
  projectId: string;
  code: string;
  runDate: string;
  finesKg: number;
  coarseKg: number;
  biocharKg?: number;
  cementKg: number;
  waterKg: number;
  pathway: "liquid_co2" | "other";
  co2Kg?: number;
  admixtureKg?: number;
  createdBy: string;
  status: "complete" | "in_progress" | "failed";
};

const EXTRA_BATCH_KEY = "zc_extra_batches_v1";

type Analysis = {
  fileName: string;
  summary: string;
  keyFindings?: string;
  recommendation?: string;
  author: string;
  uploadedOn: string;
};

const ANALYSIS_KEY = "zc_lab_analyses_v1";

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectDetail,
  notFoundComponent: () => (
    <AppShell title="Project not found">
      <p className="text-muted-foreground">This project doesn't exist.</p>
    </AppShell>
  ),
  errorComponent: () => (
    <AppShell title="Error">
      <p className="text-muted-foreground">Something went wrong loading this project.</p>
    </AppShell>
  ),
  loader: ({ params }) => {
    const p = PROJECTS.find((x) => x.id === params.projectId);
    if (!p) throw notFound();
    return p;
  },
});


function useAnalyses() {
  const [analyses, setAnalyses] = useState<Record<string, Analysis>>({});
  useEffect(() => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(ANALYSIS_KEY) : null;
    if (raw) {
      try { setAnalyses(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }, []);
  return { analyses };
}

function ProjectDetail() {
  const project = Route.useLoaderData();
  const { can, user } = useAuth();
  const { analyses } = useAnalyses();
  const [extraBatches, setExtraBatches] = useState<ExtraBatch[]>([]);
  useEffect(() => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(EXTRA_BATCH_KEY) : null;
    if (raw) { try { setExtraBatches(JSON.parse(raw)); } catch { /* ignore */ } }
  }, []);
  const persistExtra = (next: ExtraBatch[]) => {
    setExtraBatches(next);
    window.localStorage.setItem(EXTRA_BATCH_KEY, JSON.stringify(next));
  };
  const mockBatches = BATCHES.filter((b) => b.projectId === project.id);
  const projectExtras = extraBatches.filter((b) => b.projectId === project.id);
  const allBatches = useMemo(() => [
    ...projectExtras.map((b) => ({
      id: b.id, code: b.code, runDate: b.runDate,
      massKg: b.finesKg + b.coarseKg + (b.biocharKg ?? 0) + b.cementKg,
      status: b.status, createdBy: b.createdBy, extra: b as ExtraBatch | undefined,
    })),
    ...mockBatches.map((b) => ({
      id: b.id, code: b.code, runDate: b.runDate,
      massKg: b.massKg, status: b.status, createdBy: "—", extra: undefined as ExtraBatch | undefined,
    })),
  ], [projectExtras, mockBatches]);
  const [addOpen, setAddOpen] = useState(false);
  const labs = LAB_RESULTS.filter((l) => l.projectId === project.id);
  const evidence = EVIDENCE.filter((e) => e.projectId === project.id);
  const emissions = EMISSIONS.filter((e) => e.projectId === project.id);

  const projectAnalyses = labs.filter((l) => analyses[l.id]);

  return (
    <AppShell title={project.name}>
      <div className="space-y-6">
        <div className="space-y-2">
          <Link to="/projects" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> All projects
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-semibold tracking-tight">{project.name}</h2>
            <Badge variant={project.category === "industrial" ? "default" : "secondary"}>
              {project.category === "industrial" ? "Industrial · " + (project.registry ?? "") : "Internal test"}
            </Badge>
            <Badge variant="outline">{project.status}</Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            {project.code} · {project.location} · started {project.startDate}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <MiniStat label="Batches run" value={String(project.batchesRun)} />
          <MiniStat label="Removals (tCO₂e)" value={project.emissionsAvoidedTco2e.toLocaleString()} />
          <MiniStat label="Evidence docs" value={String(evidence.length)} />
          <MiniStat label="Lab results" value={String(labs.length)} />
        </div>

        <Tabs defaultValue="operations">
          <TabsList>
            <TabsTrigger value="operations">Operations</TabsTrigger>
            {project.category === "internal" && <TabsTrigger value="batches">Batches</TabsTrigger>}
            <TabsTrigger value="evidence">Evidence</TabsTrigger>
            <TabsTrigger value="lab">Lab results</TabsTrigger>
            <TabsTrigger value="emissions">Emissions</TabsTrigger>
          </TabsList>

          <TabsContent value="operations" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Operational sensor data</CardTitle>
                <CardDescription>Latest readings and process telemetry (mock).</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3 text-sm">
                <SensorTile label="Reactor temperature" value="512 °C" trend="stable" />
                <SensorTile label="Feed rate" value="118 kg/h" trend="↑ 2%" />
                <SensorTile label="Residence time" value="24 min" trend="stable" />
                <SensorTile label="O₂ level" value="1.8 %" trend="↓ 0.3" />
                <SensorTile label="Flue gas T" value="380 °C" trend="stable" />
                <SensorTile label="Uptime (30d)" value="94.2 %" trend="↑" />
              </CardContent>
            </Card>
          </TabsContent>

          {project.category === "internal" && (
            <TabsContent value="batches" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Batches</CardTitle>
                    <CardDescription>Every batch supports lab result and supporting document uploads.</CardDescription>
                  </div>
                  {can("projects:edit") && (
                    <Dialog open={addOpen} onOpenChange={setAddOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add batch</Button>
                      </DialogTrigger>
                      <AddBatchDialog
                        projectId={project.id}
                        createdBy={user.name}
                        onAdd={(b) => {
                          persistExtra([b, ...extraBatches]);
                          setAddOpen(false);
                          toast.success(`Batch ${b.code} added`);
                        }}
                      />
                    </Dialog>
                  )}
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Batch</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Total mass (kg)</TableHead>
                        <TableHead>Created by</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allBatches.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium">{b.code}</TableCell>
                          <TableCell>{b.runDate}</TableCell>
                          <TableCell>{b.massKg}</TableCell>
                          <TableCell>{b.createdBy}</TableCell>
                          <TableCell><Badge variant={b.status === "complete" ? "default" : "secondary"}>{b.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                      {allBatches.length === 0 && (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No batches yet.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="evidence" className="mt-4 space-y-4">
            {DEPARTMENTS.map((d) => {
              const items = evidence.filter((e) => e.department === d.key);
              return (
                <Card key={d.key}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{d.label}</CardTitle>
                      <CardDescription>{items.length} document(s)</CardDescription>
                    </div>
                    {items.length > 0 && (
                      <Button variant="outline" size="sm" onClick={() => items.forEach(downloadEvidence)}>
                        <Download className="h-4 w-4 mr-1" /> Download all
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No documents submitted.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Document</TableHead>
                            <TableHead>File</TableHead>
                            <TableHead>Uploaded by</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((e) => (
                            <TableRow key={e.id}>
                              <TableCell className="font-medium">{e.documentType}</TableCell>
                              <TableCell>{e.fileName}</TableCell>
                              <TableCell>{e.uploadedBy}</TableCell>
                              <TableCell>{e.uploadedAt}</TableCell>
                              <TableCell>
                                <Badge variant={e.status === "verified" ? "default" : e.status === "pending" ? "secondary" : "destructive"}>{e.status}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" variant="outline" onClick={() => downloadEvidence(e)}>
                                  <Download className="h-4 w-4 mr-1" /> Download
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="lab" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Lab results</CardTitle>
                <div className="flex gap-2">
                  {projectAnalyses.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => projectAnalyses.forEach((l) => {
                      const a = analyses[l.id];
                      if (a) downloadAnalysis(l, a);
                    })}>
                      <Download className="h-4 w-4 mr-1" /> Download all analyses
                    </Button>
                  )}
                  {labs.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => labs.forEach(downloadLabResult)}>
                      <Download className="h-4 w-4 mr-1" /> Download all reports
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Test</TableHead><TableHead>Batch</TableHead><TableHead>Lab</TableHead><TableHead>Sampled</TableHead><TableHead>Result</TableHead><TableHead>Status</TableHead><TableHead>Analysis</TableHead><TableHead className="text-right">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {labs.map((l) => {
                      const a = analyses[l.id];
                      return (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium">{l.testName}</TableCell>
                          <TableCell>{l.batchId ?? "—"}</TableCell>
                          <TableCell>{l.labName}</TableCell>
                          <TableCell>{l.sampleDate}</TableCell>
                          <TableCell>{l.result}</TableCell>
                          <TableCell><Badge variant={l.status === "reported" ? "default" : "secondary"}>{l.status}</Badge></TableCell>
                          <TableCell>
                            {a ? (
                              <div className="flex items-center gap-1.5 text-xs">
                                <FlaskConical className="h-3.5 w-3.5 text-primary" />
                                <span className="truncate max-w-[160px]" title={a.fileName}>{a.fileName}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">No analysis</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
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
                    {labs.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No lab results yet.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="emissions" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Emissions activities</CardTitle>
                <CardDescription>Removals and emissions tracked per scope.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Scope</TableHead><TableHead>Activity</TableHead><TableHead>Period</TableHead><TableHead className="text-right">tCO₂e</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {emissions.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell><Badge variant={e.scope === "removals" ? "default" : "outline"}>{e.scope}</Badge></TableCell>
                        <TableCell>{e.activity}</TableCell>
                        <TableCell>{e.period}</TableCell>
                        <TableCell className="text-right font-medium">{e.tco2e.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {emissions.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No emissions activities.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function SensorTile({ label, value, trend }: { label: string; value: string; trend: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{trend}</div>
    </div>
  );
}

function downloadEvidence(it: EvidenceItem) {
  const dept = DEPARTMENTS.find((d) => d.key === it.department)?.label ?? it.department;
  const project = PROJECTS.find((p) => p.id === it.projectId);
  const content =
    `Zen Carbon — Evidence Document (mock)\n` +
    `====================================\n\n` +
    `File name:      ${it.fileName}\n` +
    `Document type:  ${it.documentType}\n` +
    `Department:     ${dept}\n` +
    `Project:        ${project?.code ?? it.projectId} — ${project?.name ?? ""}\n` +
    `Uploaded by:    ${it.uploadedBy}\n` +
    `Uploaded at:    ${it.uploadedAt}\n` +
    `Status:         ${it.status}\n` +
    `Reference id:   ${it.id}\n\n` +
    `This is a placeholder for the original uploaded document, provided so\n` +
    `reviewers can counter-check submissions before sending them to Isometric.\n`;
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = it.fileName.endsWith(".txt") ? it.fileName : `${it.fileName}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function AddBatchDialog({
  projectId,
  createdBy,
  onAdd,
}: {
  projectId: string;
  createdBy: string;
  onAdd: (b: ExtraBatch) => void;
}) {
  const [code, setCode] = useState("");
  const [runDate, setRunDate] = useState(new Date().toISOString().slice(0, 10));
  const [fines, setFines] = useState("");
  const [coarse, setCoarse] = useState("");
  const [biochar, setBiochar] = useState("");
  const [cement, setCement] = useState("");
  const [water, setWater] = useState("");
  const [pathway, setPathway] = useState<"liquid_co2" | "other">("liquid_co2");
  const [co2, setCo2] = useState("");
  const [admixture, setAdmixture] = useState("");

  const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

  const submit = () => {
    if (!code.trim() || !fines || !coarse || !cement || !water) {
      toast.error("Fill batch code, fines, coarse, cement and water");
      return;
    }
    onAdd({
      id: `bx_${Date.now()}`,
      projectId,
      code: code.trim(),
      runDate,
      finesKg: Number(fines),
      coarseKg: Number(coarse),
      biocharKg: num(biochar),
      cementKg: Number(cement),
      waterKg: Number(water),
      pathway,
      co2Kg: pathway === "liquid_co2" ? num(co2) : undefined,
      admixtureKg: num(admixture),
      createdBy,
      status: "complete",
    });
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Add batch</DialogTitle>
        <DialogDescription>Record mix design and process parameters for a new batch.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Batch code" value={code} onChange={setCode} placeholder="B-014-025" />
        <Field label="Run date" type="date" value={runDate} onChange={setRunDate} />
        <Field label="Fines (kg)" type="number" value={fines} onChange={setFines} />
        <Field label="Coarse (kg)" type="number" value={coarse} onChange={setCoarse} />
        <Field label="Biochar (kg, optional)" type="number" value={biochar} onChange={setBiochar} />
        <Field label="Cement (kg)" type="number" value={cement} onChange={setCement} />
        <Field label="Water (kg)" type="number" value={water} onChange={setWater} />
        <div className="space-y-1.5">
          <Label>Pathway</Label>
          <Select value={pathway} onValueChange={(v) => setPathway(v as "liquid_co2" | "other")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="liquid_co2">Liquid CO₂ injection</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {pathway === "liquid_co2" && (
          <Field label="CO₂ injected (kg)" type="number" value={co2} onChange={setCo2} />
        )}
        <Field label="Admixture (kg, optional)" type="number" value={admixture} onChange={setAdmixture} />
      </div>
      <DialogFooter>
        <Button onClick={submit}>Add batch</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function downloadLabResult(it: LabResult) {
  const project = PROJECTS.find((p) => p.id === it.projectId);
  const content =
    `Zen Carbon — Lab Result (mock)\n` +
    `==============================\n\n` +
    `Test name:      ${it.testName}\n` +
    `Project:        ${project?.code ?? it.projectId} — ${project?.name ?? ""}\n` +
    `Batch:          ${it.batchId ?? "—"}\n` +
    `Lab name:       ${it.labName}\n` +
    `Sample date:    ${it.sampleDate}\n` +
    `Report date:    ${it.reportDate || "—"}\n` +
    `Result:         ${it.result}\n` +
    `Status:         ${it.status}\n` +
    `Reference id:   ${it.id}\n\n` +
    `This is a placeholder for the original lab report, provided so\n` +
    `reviewers can counter-check submissions before sending them to Isometric.\n`;
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${it.testName}_${it.id}.txt`;
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