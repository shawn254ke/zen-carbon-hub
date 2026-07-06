import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, ShieldAlert, Plus, Pencil, Trash2, Check, X, Lock, Leaf, Send, FileCheck2, AlertTriangle, CheckCircle2, Download } from "lucide-react";
import { DEPARTMENTS, EVIDENCE, EMISSIONS, PROJECTS, type Department, type EvidenceItem } from "@/lib/mock-data";
import { useChecklist } from "@/lib/checklist-store";
import { useAuth } from "@/lib/auth";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/verification")({
  component: VerificationReadinessPage,
});

function VerificationReadinessPage() {
  const { can, user } = useAuth();
  const allowed = can("verification:manage");

  if (!allowed) {
    return (
      <AppShell title="Verification Readiness">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4" /> Restricted
            </CardTitle>
            <CardDescription>
              This workspace is limited to the MRV lead and administrators. Your current role
              ({user.role}) does not have access. Switch roles from the header to preview.
            </CardDescription>
          </CardHeader>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Verification Readiness">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Verification Readiness</h2>
          <p className="text-sm text-muted-foreground">
            Track document submission progress and CO₂ removals across all projects, and manage
            the departmental verification checklists.
          </p>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Project overview</TabsTrigger>
            <TabsTrigger value="checklists">Manage checklists</TabsTrigger>
            <TabsTrigger value="submit">Submit to Isometric</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            <ProjectOverview />
          </TabsContent>

          <TabsContent value="checklists" className="mt-4 space-y-4">
            <ChecklistManager />
          </TabsContent>

          <TabsContent value="submit" className="mt-4 space-y-4">
            <IsometricSubmission />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

/* ---------- Overview ---------- */

function ProjectOverview() {
  const { checklist } = useChecklist();

  const rows = useMemo(() => {
    return PROJECTS.map((p) => {
      const perDept = DEPARTMENTS.map((d) => {
        const required = checklist[d.key];
        const submitted = new Set(
          EVIDENCE.filter((e) => e.projectId === p.id && e.department === d.key).map(
            (e) => e.documentType,
          ),
        );
        const done = required.filter((r) => submitted.has(r)).length;
        return { dept: d.key, label: d.label, done, total: required.length };
      });
      const totalReq = perDept.reduce((s, x) => s + x.total, 0);
      const totalDone = perDept.reduce((s, x) => s + x.done, 0);
      const pct = totalReq === 0 ? 0 : Math.round((totalDone / totalReq) * 100);
      const removals = EMISSIONS.filter(
        (e) => e.projectId === p.id && e.scope === "removals",
      ).reduce((s, e) => s + e.tco2e, 0);
      const gross = EMISSIONS.filter(
        (e) => e.projectId === p.id && e.scope !== "removals",
      ).reduce((s, e) => s + e.tco2e, 0);
      return { project: p, perDept, pct, totalDone, totalReq, removals, gross, net: removals - gross };
    });
  }, [checklist]);

  const portfolioRemovals = rows.reduce((s, r) => s + r.removals, 0);
  const portfolioNet = rows.reduce((s, r) => s + r.net, 0);
  const avgReadiness = Math.round(rows.reduce((s, r) => s + r.pct, 0) / (rows.length || 1));
  const readyCount = rows.filter((r) => r.pct === 100).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryStat
          label="Avg. readiness"
          value={`${avgReadiness}%`}
          hint={`${readyCount}/${rows.length} projects at 100%`}
          icon={ShieldCheck}
        />
        <SummaryStat
          label="Gross CO₂ removals"
          value={`${portfolioRemovals.toLocaleString()} tCO₂e`}
          hint="Across all projects, latest period"
          icon={Leaf}
        />
        <SummaryStat
          label="Net removals"
          value={`${portfolioNet.toLocaleString()} tCO₂e`}
          hint="Removals minus scopes 1–3"
          icon={Leaf}
        />
        <SummaryStat
          label="Projects at risk"
          value={String(rows.filter((r) => r.pct < 60).length)}
          hint="Readiness below 60%"
          icon={ShieldAlert}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-project readiness</CardTitle>
          <CardDescription>
            Document submission progress by department and CO₂ removals reported.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="min-w-[200px]">Overall readiness</TableHead>
                {DEPARTMENTS.map((d) => (
                  <TableHead key={d.key} className="text-center whitespace-nowrap">
                    {shortDeptLabel(d.key)}
                  </TableHead>
                ))}
                <TableHead className="text-right whitespace-nowrap">Removals (tCO₂e)</TableHead>
                <TableHead className="text-right whitespace-nowrap">Net (tCO₂e)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.project.id}>
                  <TableCell>
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: r.project.id }}
                      className="font-medium hover:underline"
                    >
                      {r.project.code}
                    </Link>
                    <div className="text-xs text-muted-foreground">{r.project.name}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.project.category === "industrial" ? "default" : "secondary"}>
                      {r.project.category === "industrial" ? "Isometric" : "Internal"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={r.pct} className="w-32" />
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {r.totalDone}/{r.totalReq}
                      </span>
                    </div>
                  </TableCell>
                  {r.perDept.map((d) => (
                    <TableCell key={d.dept} className="text-center">
                      <DeptChip done={d.done} total={d.total} />
                    </TableCell>
                  ))}
                  <TableCell className="text-right tabular-nums">
                    {r.removals.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.net.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function shortDeptLabel(d: Department) {
  return d === "ic" ? "I&C" : d === "mrv" ? "MRV" : d[0].toUpperCase() + d.slice(1);
}

function DeptChip({ done, total }: { done: number; total: number }) {
  if (total === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const complete = done === total;
  const empty = done === 0;
  return (
    <span
      className={
        "inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs tabular-nums " +
        (complete
          ? "bg-primary/15 text-primary"
          : empty
            ? "bg-destructive/10 text-destructive"
            : "bg-warning/15 text-warning border border-warning/30")
      }
    >
      {done}/{total}
    </span>
  );
}

function SummaryStat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="text-2xl font-semibold text-foreground mt-1">{value}</div>
            {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
          </div>
          <div className="h-9 w-9 rounded-md bg-accent/60 flex items-center justify-center">
            <Icon className="h-4 w-4 text-accent-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Checklist editor ---------- */

function ChecklistManager() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {DEPARTMENTS.map((d) => (
        <DeptChecklistEditor key={d.key} dept={d.key} label={d.label} description={d.description} />
      ))}
    </div>
  );
}

function DeptChecklistEditor({
  dept,
  label,
  description,
}: {
  dept: Department;
  label: string;
  description: string;
}) {
  const { checklist, addItem, removeItem, renameItem } = useChecklist();
  const items = checklist[dept];
  const [newItem, setNewItem] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-1.5">
          {items.map((it) => {
            const isEditing = editing === it;
            return (
              <li
                key={it}
                className="flex items-center gap-2 rounded-md border p-2 text-sm"
              >
                {isEditing ? (
                  <>
                    <Input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="h-8"
                      autoFocus
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => {
                        renameItem(dept, it, draft);
                        setEditing(null);
                      }}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setEditing(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1">{it}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => {
                        setEditing(it);
                        setDraft(it);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeItem(dept, it)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </li>
            );
          })}
          {items.length === 0 && (
            <li className="text-sm text-muted-foreground italic">No required documents yet.</li>
          )}
        </ul>

        <form
          className="flex gap-2 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            addItem(dept, newItem);
            setNewItem("");
          }}
        >
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Add required document type…"
            className="h-9"
          />
          <Button type="submit" size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* ---------- Isometric submission ---------- */

type SubmissionRecord = {
  submittedAt: string;
  itemIds: string[];
  reference: string;
};

const SUBMISSIONS: Record<string, SubmissionRecord> = {};

function IsometricSubmission() {
  const { checklist } = useChecklist();
  const isometricProjects = useMemo(
    () => PROJECTS.filter((p) => p.category === "industrial"),
    [],
  );
  const [projectId, setProjectId] = useState<string>(isometricProjects[0]?.id ?? "");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tick, setTick] = useState(0);

  const project = isometricProjects.find((p) => p.id === projectId);
  const lastSubmission = SUBMISSIONS[projectId];

  const groups = useMemo(() => {
    return DEPARTMENTS.map((d) => {
      const required = checklist[d.key];
      const items = EVIDENCE.filter(
        (e) => e.projectId === projectId && e.department === d.key,
      );
      const submittedTypes = new Set(items.map((i) => i.documentType));
      const missing = required.filter((r) => !submittedTypes.has(r));
      return { dept: d, required, items, missing };
    });
  }, [projectId, checklist, tick]);

  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const verifiedCount = allItems.filter((i) => i.status === "verified").length;
  const rejectedCount = allItems.filter((i) => i.status === "rejected").length;
  const pendingCount = allItems.filter((i) => i.status === "pending").length;
  const totalMissing = groups.reduce((s, g) => s + g.missing.length, 0);
  const reviewedCount = allItems.filter((i) => checked[i.id]).length;
  const allReviewed = allItems.length > 0 && reviewedCount === allItems.length;
  const canSubmit = allReviewed && rejectedCount === 0 && totalMissing === 0;

  function toggleAll(v: boolean) {
    const next: Record<string, boolean> = {};
    if (v) allItems.forEach((i) => (next[i.id] = true));
    setChecked(next);
  }

  function doSubmit() {
    if (!project) return;
    SUBMISSIONS[project.id] = {
      submittedAt: new Date().toISOString(),
      itemIds: allItems.map((i) => i.id),
      reference: `ISO-${Date.now().toString(36).toUpperCase()}`,
    };
    setTick((t) => t + 1);
    setConfirmOpen(false);
    setChecked({});
    toast.success("Submitted to Isometric", {
      description: `Reference ${SUBMISSIONS[project.id].reference}`,
    });
  }

  if (isometricProjects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">No Isometric projects</CardTitle>
          <CardDescription>
            Only industrial projects registered under Isometric can be submitted here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4" /> Submit evidence to Isometric API
          </CardTitle>
          <CardDescription>
            Review every submitted document for an Isometric project, then submit the complete
            evidence package to the Isometric registry.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:justify-between">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Project</label>
              <Select value={projectId} onValueChange={(v) => { setProjectId(v); setChecked({}); }}>
                <SelectTrigger className="w-[320px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isometricProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {project && (
                <div className="text-xs text-muted-foreground">
                  Registry: {project.registry ?? "—"} · Methodology:{" "}
                  {project.methodology ?? "—"}
                </div>
              )}
            </div>
            {lastSubmission && (
              <div className="text-xs text-muted-foreground text-right">
                <div>Last submitted {new Date(lastSubmission.submittedAt).toLocaleString()}</div>
                <div className="font-mono">Ref: {lastSubmission.reference}</div>
              </div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <MiniStat label="Documents" value={String(allItems.length)} />
            <MiniStat label="Verified" value={String(verifiedCount)} tone="success" />
            <MiniStat label="Pending" value={String(pendingCount)} tone={pendingCount ? "warn" : "muted"} />
            <MiniStat label="Missing required" value={String(totalMissing)} tone={totalMissing ? "danger" : "success"} />
          </div>

          {(totalMissing > 0 || rejectedCount > 0) && (
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                {totalMissing > 0 && <div>{totalMissing} required document(s) missing across departments.</div>}
                {rejectedCount > 0 && <div>{rejectedCount} document(s) marked rejected — resolve before submission.</div>}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Reviewed <span className="font-medium text-foreground">{reviewedCount}</span> of{" "}
              {allItems.length}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => toggleAll(true)} disabled={!allItems.length}>
                Mark all reviewed
              </Button>
              <Button variant="ghost" size="sm" onClick={() => toggleAll(false)} disabled={!reviewedCount}>
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {groups.map((g) => (
        <Card key={g.dept.key}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">{g.dept.label}</CardTitle>
                <CardDescription className="text-xs">
                  {g.items.length} submitted · {g.missing.length} missing
                </CardDescription>
              </div>
              {g.missing.length === 0 && g.required.length > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Complete
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {g.items.length === 0 ? (
              <div className="text-sm text-muted-foreground italic">No documents submitted.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">Ok</TableHead>
                    <TableHead>Document type</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Uploaded by</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell>
                        <Checkbox
                          checked={!!checked[it.id]}
                          onCheckedChange={(v) =>
                            setChecked((prev) => ({ ...prev, [it.id]: !!v }))
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">{it.documentType}</TableCell>
                      <TableCell className="text-muted-foreground">{it.fileName}</TableCell>
                      <TableCell>{it.uploadedBy}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            it.status === "verified"
                              ? "default"
                              : it.status === "rejected"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {it.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadEvidence(it)}
                        >
                          <Download className="h-3.5 w-3.5 mr-1" /> Download
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {g.items.length > 0 && (
              <div className="mt-3 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => g.items.forEach(downloadEvidence)}
                >
                  <Download className="h-3.5 w-3.5 mr-1" /> Download all ({g.items.length})
                </Button>
              </div>
            )}
            {g.missing.length > 0 && (
              <div className="mt-3 text-xs text-destructive">
                Missing: {g.missing.join(", ")}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <div className="sticky bottom-4 z-10">
        <Card className="border-primary/40">
          <CardContent className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-medium flex items-center gap-2">
                <FileCheck2 className="h-4 w-4" /> Ready for submission
              </div>
              <div className="text-xs text-muted-foreground">
                {canSubmit
                  ? "All documents reviewed and complete."
                  : "Review every document and resolve any issues to enable submission."}
              </div>
            </div>
            <Button disabled={!canSubmit} onClick={() => setConfirmOpen(true)}>
              <Send className="h-4 w-4 mr-1" /> Submit to Isometric
            </Button>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit to Isometric?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send {allItems.length} document(s) for {project?.code} to the Isometric
              registry API. You have confirmed all evidence has been reviewed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doSubmit}>Confirm submission</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MiniStat({

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

function MiniStatInner({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "muted" | "success" | "warn" | "danger";
}) {
  const toneCls =
    tone === "success"
      ? "text-primary"
      : tone === "warn"
        ? "text-warning"
        : tone === "danger"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={"text-xl font-semibold mt-0.5 tabular-nums " + toneCls}>{value}</div>
    </div>
  );
}
