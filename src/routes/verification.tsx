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
import { ShieldCheck, ShieldAlert, Plus, Pencil, Trash2, Check, X, Lock, Leaf } from "lucide-react";
import { DEPARTMENTS, EVIDENCE, EMISSIONS, PROJECTS, type Department, type Project } from "@/lib/mock-data";
import { useChecklist } from "@/lib/checklist-store";
import { useAuth } from "@/lib/auth";

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
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            <ProjectOverview />
          </TabsContent>

          <TabsContent value="checklists" className="mt-4 space-y-4">
            <ChecklistManager />
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
            : "bg-warning/15 text-warning-foreground border border-warning/30")
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

// keep unused imports referenced to avoid TS errors during scaffold edits
void ((): Project | undefined => undefined);