import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, Circle, Upload, Lock } from "lucide-react";
import { CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEPARTMENTS, EVIDENCE, PROJECTS, type Department, type EvidenceItem } from "@/lib/mock-data";
import { useChecklist } from "@/lib/checklist-store";
import { useAuth, type Role } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/evidence")({
  component: EvidencePage,
});

// Map a department-lead role to the department it owns.
const ROLE_TO_DEPT: Partial<Record<Role, Department>> = {
  dept_ic: "ic",
  dept_mechanical: "mechanical",
  dept_chemical: "chemical",
  dept_mrv: "mrv",
  dept_admin: "admin",
};

function useCanUploadFor() {
  const { user, can } = useAuth();
  return (dept: Department) => {
    if (!can("evidence:upload")) return false;
    // Admin & MRV can upload for any department.
    if (user.role === "admin" || user.role === "dept_mrv") return true;
    // Project managers may upload evidence across departments.
    if (user.role === "project_manager") return true;
    // Department leads may only upload for their own department.
    const owned = ROLE_TO_DEPT[user.role];
    return owned === dept;
  };
}

function EvidencePage() {
  const canUploadFor = useCanUploadFor();
  const [tick, setTick] = useState(0);
  const [projectId, setProjectId] = useState<string>(PROJECTS[0]?.id ?? "");
  const selectedProject = PROJECTS.find((p) => p.id === projectId);
  return (
    <AppShell title="Evidence Repository">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Evidence Repository</h2>
            <p className="text-sm text-muted-foreground">
              All departments can view every submission. Uploads are restricted to the owning department.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-[280px]"><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>
                {PROJECTS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedProject && <ProjectCompletionBanner projectId={projectId} key={`banner-${tick}`} />}

        <Tabs defaultValue="ic">
          <TabsList className="flex-wrap h-auto">
            {DEPARTMENTS.map((d) => (
              <TabsTrigger key={d.key} value={d.key}>{d.label}</TabsTrigger>
            ))}
          </TabsList>

          {DEPARTMENTS.map((d) => (
            <TabsContent key={d.key} value={d.key} className="mt-4 space-y-4">
              <ChecklistCard dept={d.key} projectId={projectId} key={`c-${tick}-${projectId}`} />
              <EvidenceTable
                dept={d.key}
                projectId={projectId}
                canUpload={canUploadFor(d.key)}
                onUploaded={() => setTick((t) => t + 1)}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppShell>
  );
}

function ProjectCompletionBanner({ projectId }: { projectId: string }) {
  const { checklist } = useChecklist();
  const project = PROJECTS.find((p) => p.id === projectId)!;
  const perDept = DEPARTMENTS.map((d) => {
    const required = checklist[d.key];
    const submitted = new Set(
      EVIDENCE.filter((e) => e.projectId === projectId && e.department === d.key).map((e) => e.documentType),
    );
    const done = required.filter((r) => submitted.has(r)).length;
    return { dept: d, done, total: required.length };
  });
  const totalDone = perDept.reduce((s, x) => s + x.done, 0);
  const totalReq = perDept.reduce((s, x) => s + x.total, 0);
  const complete = totalReq > 0 && totalDone === totalReq;
  return (
    <Card className={complete ? "border-primary" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">{project.code} — {project.name}</CardTitle>
          <CardDescription>
            {totalDone} of {totalReq} required documents submitted across all departments.
          </CardDescription>
        </div>
        {complete ? (
          <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> All documents submitted</Badge>
        ) : (
          <Badge variant="secondary">In progress</Badge>
        )}
      </CardHeader>
      <CardContent className="grid gap-2 md:grid-cols-5">
        {perDept.map(({ dept, done, total }) => {
          const deptDone = total > 0 && done === total;
          return (
            <div key={dept.key} className="rounded-md border p-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium">{dept.label}</span>
                {deptDone && <Check className="h-3 w-3 text-primary" />}
              </div>
              <div className="text-muted-foreground">{done}/{total}</div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ChecklistCard({ dept, projectId }: { dept: Department; projectId: string }) {
  const { checklist } = useChecklist();
  const required = checklist[dept];
  const items = EVIDENCE.filter((e) => e.department === dept && e.projectId === projectId);
  const submittedTypes = new Set(items.map((i) => i.documentType));
  const allDone = required.length > 0 && required.every((r) => submittedTypes.has(r));
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Verification checklist</CardTitle>
          <CardDescription>
            Required documents for {DEPARTMENTS.find((d) => d.key === dept)!.label}. Additional documents can also be uploaded.
          </CardDescription>
        </div>
        {allDone && (
          <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Complete</Badge>
        )}
      </CardHeader>
      <CardContent className="grid gap-2 md:grid-cols-2">
        {required.map((r) => {
          const done = submittedTypes.has(r);
          return (
            <div key={r} className="flex items-center gap-2 rounded-md border p-2 text-sm">
              {done ? <Check className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
              <span className={done ? "" : "text-muted-foreground"}>{r}</span>
              {done && <Badge variant="secondary" className="ml-auto">submitted</Badge>}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function EvidenceTable({ dept, projectId, canUpload, onUploaded }: { dept: Department; projectId: string; canUpload: boolean; onUploaded: () => void }) {
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(false);
  const items = useMemo(
    () => EVIDENCE.filter((e) => e.department === dept && e.projectId === projectId),
    [dept, projectId, tick],
  );
  const deptLabel = DEPARTMENTS.find((d) => d.key === dept)!.label;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Submitted documents</CardTitle>
          <CardDescription>All documents across projects, including "Other".</CardDescription>
        </div>
        {canUpload ? (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Upload className="h-4 w-4 mr-1" /> Upload evidence
          </Button>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <Lock className="h-3 w-3" /> View only — {deptLabel} uploads
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Project</TableHead><TableHead>Document type</TableHead><TableHead>File</TableHead><TableHead>Uploaded by</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {items.map((e) => {
              const proj = PROJECTS.find((p) => p.id === e.projectId);
              return (
                <TableRow key={e.id}>
                  <TableCell>{proj?.code}</TableCell>
                  <TableCell>{e.documentType}</TableCell>
                  <TableCell className="text-muted-foreground">{e.fileName}</TableCell>
                  <TableCell>{e.uploadedBy}</TableCell>
                  <TableCell>{e.uploadedAt}</TableCell>
                  <TableCell><Badge variant={e.status === "verified" ? "default" : e.status === "pending" ? "secondary" : "destructive"}>{e.status}</Badge></TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No documents submitted yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <UploadEvidenceDialog
        open={open}
        onOpenChange={setOpen}
        dept={dept}
        onSubmitted={() => {
          setTick((t) => t + 1);
          onUploaded();
        }}
      />
    </Card>
  );
}

function UploadEvidenceDialog({
  open,
  onOpenChange,
  dept,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dept: Department;
  onSubmitted: () => void;
}) {
  const { user } = useAuth();
  const { checklist } = useChecklist();
  const required = checklist[dept];
  const deptLabel = DEPARTMENTS.find((d) => d.key === dept)!.label;

  const [projectId, setProjectId] = useState<string>(PROJECTS[0]?.id ?? "");
  const [docType, setDocType] = useState<string>(required[0] ?? "__other");
  const [otherName, setOtherName] = useState("");
  const [fileName, setFileName] = useState("");

  const isOther = docType === "__other";

  const reset = () => {
    setProjectId(PROJECTS[0]?.id ?? "");
    setDocType(required[0] ?? "__other");
    setOtherName("");
    setFileName("");
  };

  const submit = () => {
    const finalType = isOther ? otherName.trim() : docType;
    if (!projectId || !finalType || !fileName.trim()) {
      toast.error("Fill in project, document type and a file");
      return;
    }
    const item: EvidenceItem = {
      id: `e_${Date.now()}`,
      projectId,
      department: dept,
      documentType: finalType,
      fileName: fileName.trim(),
      uploadedBy: user.name,
      uploadedAt: new Date().toISOString().slice(0, 10),
      status: "pending",
      isOther,
    };
    EVIDENCE.unshift(item);
    toast.success("Evidence uploaded");
    reset();
    onOpenChange(false);
    onSubmitted();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload evidence — {deptLabel}</DialogTitle>
          <DialogDescription>
            Attach a document to a project. Pick a checklist item, or choose "Other" to submit supporting material.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>
                {PROJECTS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Document type</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {required.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
                <SelectItem value="__other">Other (supporting document)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isOther && (
            <div className="grid gap-2">
              <Label>Describe the document</Label>
              <Input value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="e.g. Vendor spec sheet" />
            </div>
          )}
          <div className="grid gap-2">
            <Label>File</Label>
            <Input
              type="file"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
            />
            {fileName && <p className="text-xs text-muted-foreground">Selected: {fileName}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}><Upload className="h-4 w-4 mr-1" /> Upload</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}