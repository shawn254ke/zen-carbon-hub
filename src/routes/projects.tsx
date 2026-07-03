import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PROJECTS, type Project, type ProjectCategory } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { LayoutGrid, List, Plus, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/projects")({
  component: ProjectsLayout,
});

type StatusFilter = "all" | Project["status"];
type ViewMode = "grid" | "table";

function ProjectsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { can } = useAuth();
  const [, setTick] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [view, setView] = useState<ViewMode>("grid");
  const [tab, setTab] = useState<ProjectCategory>("industrial");

  if (pathname !== "/projects" && pathname !== "/projects/") {
    return <Outlet />;
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PROJECTS.filter((p) => p.category === tab)
      .filter((p) => (status === "all" ? true : p.status === status))
      .filter((p) =>
        !q
          ? true
          : [p.name, p.code, p.location, p.methodology ?? "", p.registry ?? ""]
              .join(" ")
              .toLowerCase()
              .includes(q),
      );
  }, [query, status, tab]);

  const canCreate = can("projects:create");

  return (
    <AppShell title="Projects">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Projects</h2>
            <p className="text-sm text-muted-foreground">
              Industrial Isometric-registered projects and internal test projects.
            </p>
          </div>
          {canCreate && (
            <AddProjectDialog
              defaultCategory={tab}
              onCreated={() => setTick((t) => t + 1)}
            />
          )}
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as ProjectCategory)}>
          <TabsList>
            <TabsTrigger value="industrial">Industrial (Isometric)</TabsTrigger>
            <TabsTrigger value="internal">Internal test</TabsTrigger>
          </TabsList>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, code, location…"
                className="pl-8"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="verification">Verification</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(v) => v && setView(v as ViewMode)}
              variant="outline"
              className="ml-auto"
            >
              <ToggleGroupItem value="grid" aria-label="Grid view">
                <LayoutGrid />
              </ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="Table view">
                <List />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <TabsContent value="industrial" className="mt-4">
            <ProjectResults list={filtered} view={view} />
          </TabsContent>
          <TabsContent value="internal" className="mt-4">
            <ProjectResults list={filtered} view={view} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function ProjectResults({ list, view }: { list: Project[]; view: ViewMode }) {
  if (list.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
        No projects match your filters.
      </div>
    );
  }
  return view === "grid" ? <ProjectGrid list={list} /> : <ProjectTable list={list} />;
}

function ProjectGrid({ list }: { list: Project[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {list.map((p) => (
        <Link key={p.id} to="/projects/$projectId" params={{ projectId: p.id }}>
          <Card className="hover:border-primary/60 transition">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <CardDescription>{p.code}</CardDescription>
                </div>
                <Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <div>{p.location}</div>
              {p.methodology && <div>Methodology: {p.methodology}</div>}
              <div className="flex justify-between pt-2 text-foreground">
                <span>{p.batchesRun} batches</span>
                <span>{p.emissionsAvoidedTco2e.toLocaleString()} tCO₂e</span>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function ProjectTable({ list }: { list: Project[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Batches</TableHead>
            <TableHead className="text-right">tCO₂e</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((p) => (
            <TableRow key={p.id} className="cursor-pointer">
              <TableCell className="font-mono text-xs">
                <Link to="/projects/$projectId" params={{ projectId: p.id }} className="hover:underline">
                  {p.code}
                </Link>
              </TableCell>
              <TableCell>
                <Link to="/projects/$projectId" params={{ projectId: p.id }} className="hover:underline">
                  {p.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{p.location}</TableCell>
              <TableCell>
                <Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge>
              </TableCell>
              <TableCell className="text-right">{p.batchesRun}</TableCell>
              <TableCell className="text-right">{p.emissionsAvoidedTco2e.toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AddProjectDialog({
  defaultCategory,
  onCreated,
}: {
  defaultCategory: ProjectCategory;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState<ProjectCategory>(defaultCategory);
  const [location, setLocation] = useState("");
  const [methodology, setMethodology] = useState("");
  const [status, setStatus] = useState<Project["status"]>("planning");

  const submit = () => {
    if (!name.trim() || !code.trim()) return;
    PROJECTS.unshift({
      id: `p_${Date.now()}`,
      code: code.trim(),
      name: name.trim(),
      category,
      status,
      location: location.trim() || "—",
      registry: category === "industrial" ? "Isometric" : undefined,
      methodology: methodology.trim() || undefined,
      startDate: new Date().toISOString().slice(0, 10),
      emissionsAvoidedTco2e: 0,
      batchesRun: 0,
    });
    setName("");
    setCode("");
    setLocation("");
    setMethodology("");
    setStatus("planning");
    setOpen(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Add project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Register a new industrial or internal test project.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="np-name">Name</Label>
            <Input id="np-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kisumu Biochar Facility" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="np-code">Code</Label>
              <Input id="np-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ZC-IND-003" />
            </div>
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ProjectCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="industrial">Industrial (Isometric)</SelectItem>
                  <SelectItem value="internal">Internal test</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="np-loc">Location</Label>
              <Input id="np-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, Country" />
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Project["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="verification">Verification</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="np-meth">Methodology (optional)</Label>
            <Input id="np-meth" value={methodology} onChange={(e) => setMethodology(e.target.value)} placeholder="Isometric Biochar v1.0" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!name.trim() || !code.trim()}>Create project</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}