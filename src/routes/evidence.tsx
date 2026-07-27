import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, Circle, Upload, Lock, Pencil, Trash2, Loader2 } from "lucide-react";
import { CheckCircle2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createEvidenceApi, deleteEvidenceApi, fetchEvidenceApi, type EvidenceItem, updateEvidenceApi } from "@/lib/evidence-api";
import { type Department } from "@/lib/evidence-config-api";
import { useChecklist } from "@/lib/checklist-store";
import { useAuth, type Role } from "@/lib/auth";
import { toast } from "sonner";
import { useProjects } from "@/lib/projects-context";
import { type Project } from "@/lib/projects-api";

type ProjectRecord = Project;

type CreateEvidenceDocumentDtoFields = {
  checklistId: string;
  uploadedById: string;
  documentType: string;
  version: string;
};

type UploadState = "idle" | "uploading" | "success" | "error";

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

function useEvidenceItems() {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvidence = async () => {
    try {
      const nextItems = await fetchEvidenceApi();
      setItems(nextItems);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load evidence.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadEvidence();
  }, []);

  return { items, isLoading, error, reload: loadEvidence };
}

function EvidencePage() {
  const canUploadFor = useCanUploadFor();
  const { departments, error: checklistError, getChecklistForProject } = useChecklist();
  const { items: evidenceItems, isLoading: isEvidenceLoading, error: evidenceError, reload: reloadEvidence } = useEvidenceItems();
  const { projects, isLoading: isProjectsLoading, error: projectsError } = useProjects();
  const [projectId, setProjectId] = useState<string>("");
  const checklist = getChecklistForProject(projectId);

  useEffect(() => {
    if (projects.length > 0 && !projects.some((project) => project.id === projectId)) {
      setProjectId(projects[0].id);
    }
  }, [projectId, projects]);

  const selectedProject = projects.find((p) => p.id === projectId);
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
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {checklistError && <p className="text-sm text-destructive">{checklistError}</p>}
        {projectsError && <p className="text-sm text-destructive">{projectsError}</p>}
        {evidenceError && <p className="text-sm text-destructive">{evidenceError}</p>}
        {isProjectsLoading && <p className="text-sm text-muted-foreground">Loading projects...</p>}
        {isEvidenceLoading && <p className="text-sm text-muted-foreground">Loading evidence...</p>}

        {selectedProject && <ProjectCompletionBanner projectId={projectId} projects={projects} departments={departments} checklist={checklist} evidenceItems={evidenceItems} />}

        <Tabs defaultValue="ic">
          <TabsList className="flex-wrap h-auto">
            {departments.map((department) => (
              <TabsTrigger key={department.key} value={department.key}>{department.label}</TabsTrigger>
            ))}
          </TabsList>

          {departments.map((department) => (
            <TabsContent key={department.key} value={department.key} className="mt-4 space-y-4">
              <ChecklistCard dept={department.key} deptLabel={department.label} projectId={projectId} required={checklist[department.key]} evidenceItems={evidenceItems} />
              <EvidenceTable
                dept={department.key}
                deptLabel={department.label}
                projectId={projectId}
                projects={projects}
                required={checklist[department.key]}
                canUpload={canUploadFor(department.key)}
                evidenceItems={evidenceItems}
                onUploaded={reloadEvidence}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppShell>
  );
}

function ProjectCompletionBanner({
  projectId,
  projects,
  departments,
  checklist,
  evidenceItems,
}: {
  projectId: string;
  projects: ProjectRecord[];
  departments: { key: Department; label: string }[];
  checklist: Record<Department, string[]>;
  evidenceItems: EvidenceItem[];
}) {
  const project = projects.find((p) => p.id === projectId);
  if (!project) return null;
  const perDept = departments.map((department) => {
    const required = checklist[department.key];
    const submitted = new Set(
      evidenceItems.filter((e) => e.projectId === projectId && e.department === department.key).map((e) => e.documentType),
    );
    const done = required.filter((r) => submitted.has(r)).length;
    return { dept: department, done, total: required.length };
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

function ChecklistCard({
  dept,
  deptLabel,
  projectId,
  required,
  evidenceItems,
}: {
  dept: Department;
  deptLabel: string;
  projectId: string;
  required: string[];
  evidenceItems: EvidenceItem[];
}) {
  const items = evidenceItems.filter((e) => e.department === dept && e.projectId === projectId);
  const submittedTypes = new Set(items.map((i) => i.documentType));
  const allDone = required.length > 0 && required.every((r) => submittedTypes.has(r));
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Verification checklist</CardTitle>
          <CardDescription>
            Required documents for {deptLabel}. Additional documents can also be uploaded.
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

function EvidenceTable({
  dept,
  deptLabel,
  projectId,
  projects,
  required,
  canUpload,
  evidenceItems,
  onUploaded,
}: {
  dept: Department;
  deptLabel: string;
  projectId: string;
  projects: ProjectRecord[];
  required: string[];
  canUpload: boolean;
  evidenceItems: EvidenceItem[];
  onUploaded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<EvidenceItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<EvidenceItem | null>(null);
  const { user } = useAuth();
  const items = useMemo(
    () => evidenceItems.filter((e) => e.department === dept && e.projectId === projectId),
    [dept, evidenceItems, projectId],
  );
  const canManage = (e: EvidenceItem) =>
    canUpload && (user.role === "admin" || user.role === "dept_mrv" || e.uploadedBy === user.name);
  const bump = () => onUploaded();
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
            <TableHead>Project</TableHead><TableHead>Document type</TableHead><TableHead>File</TableHead><TableHead>Uploaded by</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {items.map((e) => {
              const proj = projects.find((p) => p.id === e.projectId);
              return (
                <TableRow key={e.id}>
                  <TableCell>{proj?.code}</TableCell>
                  <TableCell>{e.documentType}</TableCell>
                  <TableCell className="text-muted-foreground">{e.fileName}</TableCell>
                  <TableCell>{e.uploadedBy}</TableCell>
                  <TableCell>{e.uploadedAt}</TableCell>
                  <TableCell><Badge variant={e.status === "verified" ? "default" : e.status === "pending" ? "secondary" : "destructive"}>{e.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    {canManage(e) ? (
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setEditItem(e)} aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteItem(e)} aria-label="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No documents submitted yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <UploadEvidenceDialog
        open={open}
        onOpenChange={setOpen}
        dept={dept}
        deptLabel={deptLabel}
        projects={projects}
        required={required}
        evidenceItems={evidenceItems}
        onSubmitted={bump}
      />
      <EditEvidenceDialog
        item={editItem}
        onOpenChange={(v) => { if (!v) setEditItem(null); }}
        dept={dept}
        projects={projects}
        required={required}
        onSaved={bump}
      />
      <AlertDialog open={!!deleteItem} onOpenChange={(v) => { if (!v) setDeleteItem(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this evidence?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteItem && <>Permanently remove <span className="font-medium">{deleteItem.fileName}</span> ({deleteItem.documentType}). This cannot be undone.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteItem) return;
                try {
                  await deleteEvidenceApi(deleteItem.documentId ?? deleteItem.id);
                  toast.success("Evidence deleted");
                  setDeleteItem(null);
                  bump();
                } catch (deleteError) {
                  toast.error(deleteError instanceof Error ? deleteError.message : "Unable to delete evidence.");
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function EditEvidenceDialog({
  item,
  onOpenChange,
  dept,
  projects,
  required,
  onSaved,
}: {
  item: EvidenceItem | null;
  onOpenChange: (v: boolean) => void;
  dept: Department;
  projects: ProjectRecord[];
  required: string[];
  onSaved: () => void;
}) {
  const [projectId, setProjectId] = useState<string>("");
  const [docType, setDocType] = useState<string>("");
  const [otherName, setOtherName] = useState("");
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<EvidenceItem["status"]>("pending");

  const isOther = docType === "__other";

  // Sync when item opens
  useEffect(() => {
    if (item) {
      setProjectId(item.projectId);
      const known = required.includes(item.documentType);
      setDocType(known ? item.documentType : "__other");
      setOtherName(known ? "" : item.documentType);
      setFileName(item.fileName);
      setStatus(item.status);
    }
  }, [item, required]);

  useEffect(() => {
    if (!item && projects.length > 0 && !projects.some((project) => project.id === projectId)) {
      setProjectId(projects[0].id);
    }
  }, [item, projectId, projects]);

  const save = async () => {
    if (!item) return;
    const finalType = isOther ? otherName.trim() : docType;
    if (!projectId || !finalType || !fileName.trim()) {
      toast.error("Fill in project, document type and a file");
      return;
    }
    try {
      await updateEvidenceApi(item.id, {
        projectId,
        department: dept,
        documentType: finalType,
        fileName: fileName.trim(),
        uploadedBy: item.uploadedBy,
        uploadedAt: item.uploadedAt,
        status,
        isOther,
      });
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Unable to update evidence.");
      return;
    }
    toast.success("Evidence updated");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit evidence</DialogTitle>
          <DialogDescription>Update the project, document type, file, or status.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
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
            <Label>File name</Label>
            <Input value={fileName} onChange={(e) => setFileName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as EvidenceItem["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">pending</SelectItem>
                <SelectItem value="verified">verified</SelectItem>
                <SelectItem value="rejected">rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadEvidenceDialog({
  open,
  onOpenChange,
  dept,
  deptLabel,
  projects,
  required,
  evidenceItems,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dept: Department;
  deptLabel: string;
  projects: ProjectRecord[];
  required: string[];
  evidenceItems: EvidenceItem[];
  onSubmitted: () => void;
}) {
  const { user } = useAuth();

  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? "");
  const [docType, setDocType] = useState<string>(required[0] ?? "__other");
  const [otherName, setOtherName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string>("");

  const submittedTypesForProject = useMemo(
    () => new Set(
      evidenceItems
        .filter((item) => item.department === dept && item.projectId === projectId)
        .map((item) => item.documentType),
    ),
    [dept, evidenceItems, projectId],
  );

  const availableRequiredTypes = useMemo(
    () => required.filter((type) => !submittedTypesForProject.has(type)),
    [required, submittedTypesForProject],
  );

  const isOther = docType === "__other";
  const selectedFileName = selectedFile?.name ?? "";
  const isSubmitting = uploadState === "uploading";

  const reset = () => {
    setProjectId(projects[0]?.id ?? "");
    setDocType("__other");
    setOtherName("");
    setSelectedFile(null);
    setUploadState("idle");
    setUploadErrorMessage("");
  };

  useEffect(() => {
    if (projects.length > 0 && !projects.some((project) => project.id === projectId)) {
      setProjectId(projects[0].id);
    }
  }, [projectId, projects]);

  useEffect(() => {
    if (docType === "__other") return;
    if (!availableRequiredTypes.includes(docType)) {
      setDocType(availableRequiredTypes[0] ?? "__other");
    }
  }, [availableRequiredTypes, docType]);

  useEffect(() => {
    if (!open) return;
    if (docType === "__other") return;
    if (availableRequiredTypes.length === 0) {
      setDocType("__other");
    }
  }, [availableRequiredTypes, docType, open]);

  const submit = async () => {
    setUploadErrorMessage("");
    const finalType = isOther ? otherName.trim() : docType;
    if (!projectId || !finalType || !selectedFile) {
      setUploadState("error");
      setUploadErrorMessage("Fill in project, document type and a file");
      toast.error("Fill in project, document type and a file");
      return;
    }

    const uploadedById = /^\d+$/.test(user.id) ? user.id : "";
    if (!uploadedById) {
      setUploadState("error");
      setUploadErrorMessage("Unable to determine uploader id for this account.");
      toast.error("Unable to determine uploader id for this account.");
      return;
    }

    const selectedProject = projects.find((project) => project.id === projectId);
    const checklistId = !isOther
      ? selectedProject?.checklistTemplates?.find((template) =>
        template.department === dept
        && template.label === finalType
        && (template.projectId == null || template.projectId === projectId),
      )?.id ?? ""
      : "";

    if (!isOther && !checklistId) {
      setUploadState("error");
      setUploadErrorMessage("Unable to determine checklist id for the selected document type.");
      toast.error("Unable to determine checklist id for the selected document type.");
      return;
    }

    const createEvidenceDocumentDto: CreateEvidenceDocumentDtoFields = {
      checklistId,
      uploadedById,
      documentType: finalType,
      version: "v1",
    };

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("file", selectedFile);
    (Object.entries(createEvidenceDocumentDto) as [keyof CreateEvidenceDocumentDtoFields, string][]).forEach(([key, value]) => {
      formData.append(key, value);
    });

    try {
      setUploadState("uploading");
      await createEvidenceApi(formData);
    } catch (submitError) {
      const errorMessage = submitError instanceof Error ? submitError.message : "Unable to upload evidence.";
      setUploadState("error");
      setUploadErrorMessage(errorMessage);
      // Keep a detailed trace in dev tools for troubleshooting multipart failures.
      console.error("Evidence upload failed", submitError);
      toast.error(errorMessage);
      return;
    }

    setUploadState("success");
    toast.success("Evidence uploaded");
    await new Promise((resolve) => window.setTimeout(resolve, 700));
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
                {projects.map((p) => (
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
                {availableRequiredTypes.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
                <SelectItem value="__other">Other (supporting document)</SelectItem>
              </SelectContent>
            </Select>
            {availableRequiredTypes.length === 0 && (
              <p className="text-xs text-muted-foreground">All required checklist documents are already submitted for this project.</p>
            )}
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
              onChange={(e) => {
                setSelectedFile(e.target.files?.[0] ?? null);
                if (uploadState !== "uploading") {
                  setUploadState("idle");
                  setUploadErrorMessage("");
                }
              }}
            />
            {selectedFileName && <p className="text-xs text-muted-foreground">Selected: {selectedFileName}</p>}
            {uploadState === "uploading" && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Uploading file...
              </p>
            )}
            {uploadState === "success" && (
              <p className="flex items-center gap-2 text-xs text-primary animate-pulse">
                <CheckCircle2 className="h-3 w-3" /> File uploaded successfully.
              </p>
            )}
            {uploadState === "error" && uploadErrorMessage && (
              <p className="text-xs text-destructive wrap-break-word">{uploadErrorMessage}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={submit} disabled={isSubmitting}>
            {uploadState === "uploading" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            {uploadState === "uploading" ? "Uploading..." : uploadState === "success" ? "Uploaded" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}