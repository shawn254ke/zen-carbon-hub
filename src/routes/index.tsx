import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth, ROLE_LABELS } from "@/lib/auth";
import { INVENTORY } from "@/lib/mock-data";
import { type Department, getDefaultDepartments } from "@/lib/evidence-config-api";
import { useProjects } from "@/lib/projects-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpRight, TrendingUp, AlertTriangle, FileCheck2, Leaf } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Stat({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon: React.ComponentType<{ className?: string }> }) {
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

function DashboardLoading() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={`kpi-skeleton-${index}`}>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-3 w-28" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent projects</CardTitle>
              <CardDescription>Latest activity across your portfolio</CardDescription>
            </div>
            <Skeleton className="h-4 w-16" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`project-skeleton-${index}`} className="rounded-md border p-3 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent batches</CardTitle>
            <CardDescription>From internal test projects</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`batch-skeleton-${index}`} className="rounded-md border p-3 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-52" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { projects, evidence, labResults, batches, kpis, isLoading } = useProjects();
  const role = user.role;

  useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: "/login", replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) {
    return null;
  }

  const totalRemovals = kpis.totalRemovalsTco2e;
  const pendingEvidence = kpis.pendingEvidenceCount;
  const lowStock = INVENTORY.filter((i) => i.quantity <= i.reorderLevel).length;
  const activeProjects = kpis.activeProjects;
  const departments = getDefaultDepartments();

  const deptMap: Partial<Record<typeof role, Department>> = {
    dept_ic: "ic",
    dept_mechanical: "mechanical",
    dept_chemical: "chemical",
    dept_mrv: "mrv",
    dept_admin: "admin",
  };

  return (
    <AppShell title="Dashboard">
      <div className="space-y-6">
        <div>
          <div className="text-sm text-muted-foreground">Welcome back, {user.name.split(" ")[0]}</div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {ROLE_LABELS[role]} overview
          </h2>
        </div>

        {isLoading ? (
          <DashboardLoading />
        ) : (
          <>

            {/* Role-tailored KPI row */}
            {role === "inventory_manager" ? (
              <div className="grid gap-4 md:grid-cols-4">
                <Stat label="SKUs tracked" value={String(INVENTORY.length)} icon={Leaf} />
                <Stat label="Items low on stock" value={String(lowStock)} hint="Below reorder level" icon={AlertTriangle} />
                <Stat label="Feedstock (kg)" value={INVENTORY.filter(i => i.category === "feedstock").reduce((a, b) => a + b.quantity, 0).toLocaleString()} icon={TrendingUp} />
                <Stat label="Warehouses" value="2" icon={FileCheck2} />
              </div>
            ) : role === "lab_technician" ? (
              <div className="grid gap-4 md:grid-cols-4">
                <Stat label="Results reported" value={String(kpis.reportedLabResultsCount)} icon={FileCheck2} />
                <Stat label="Pending analysis" value={String(kpis.inProgressLabResultsCount)} icon={AlertTriangle} />
                <Stat label="Batches sampled" value={String(new Set(labResults.map(l => l.batchId).filter(Boolean)).size)} icon={TrendingUp} />
                <Stat label="Projects covered" value={String(new Set(labResults.map(l => l.projectId)).size)} icon={Leaf} />
              </div>
            ) : deptMap[role] ? (
              <div className="grid gap-4 md:grid-cols-4">
                <Stat label="My department" value={departments.find(d => d.key === deptMap[role])!.label} icon={FileCheck2} />
                <Stat label="Docs submitted" value={String(evidence.filter(e => e.department === deptMap[role]).length)} icon={FileCheck2} />
                <Stat label="Pending review" value={String(evidence.filter(e => e.department === deptMap[role] && e.status === "pending").length)} icon={AlertTriangle} />
                <Stat label="Projects assigned" value={String(activeProjects)} icon={Leaf} />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-4">
                <Stat label="Active projects" value={String(activeProjects)} icon={Leaf} />
                <Stat label="tCO₂e removed (YTD)" value={totalRemovals.toLocaleString()} hint="Across all projects" icon={TrendingUp} />
                <Stat label="Pending evidence" value={String(pendingEvidence)} hint="Awaiting verification" icon={AlertTriangle} />
                <Stat label="Inventory alerts" value={String(lowStock)} hint="Items low on stock" icon={AlertTriangle} />
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Recent projects</CardTitle>
                    <CardDescription>Latest activity across your portfolio</CardDescription>
                  </div>
                  <Link to="/projects" className="text-xs text-primary hover:underline flex items-center gap-1">
                    View all <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </CardHeader>
                <CardContent className="space-y-3">
                  {projects.slice(0, 4).map((p) => (
                    <Link
                      key={p.id}
                      to="/projects/$projectId"
                      params={{ projectId: p.id }}
                      className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/40 transition"
                    >
                      <div>
                        <div className="text-sm font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.code} · {p.location}</div>
                      </div>
                      <Badge variant={p.category === "industrial" ? "default" : "secondary"}>
                        {p.category === "industrial" ? "Industrial" : "Internal test"}
                      </Badge>
                    </Link>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent batches</CardTitle>
                  <CardDescription>From internal test projects</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {batches.slice(0, 4).map((b) => {
                    const proj = projects.find((p) => p.id === b.projectId);
                    return (
                      <div key={b.id} className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <div className="text-sm font-medium">{b.code}</div>
                          <div className="text-xs text-muted-foreground">{proj?.name} · {b.status}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{b.code}</div>
                          <div className="text-xs text-muted-foreground">{b.runDate}</div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
