import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { LayoutGrid, List, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { expireSession } from "@/lib/auth";
import {
  deleteProjectApi,
  fetchProjectsApi,
  getProjectsCache,
  removeProjectFromCache,
  type Project,
  type ProjectCategory,
  updateProjectApi,
  upsertProjectCache,
} from "@/lib/projects-api";

type CreateProjectPayload = {
  name: string;
  code: string;
  location: string;
  methodology: string;
  project_type_id: string;
  status: string;
  pathway: Pathway;
};

type UpdateProjectPayload = {
  name: string;
  code: string;
  location: string;
  methodology: string;
  project_type_id: string;
  status: string;
  pathway: Pathway;
};

type Pathway = "liquid_co2" | "carbonated_water";

const PATHWAY_OPTIONS: Array<{ value: Pathway; label: string; description: string }> = [
  {
    value: "liquid_co2",
    label: "Liquid CO2",
    description: "Use when the project records injected liquid CO2 events.",
  },
  {
    value: "carbonated_water",
    label: "Carbonated water",
    description: "Use when the project records carbonated water process data.",
  },
];

const PROJECT_TYPE_ID_BY_CATEGORY: Record<ProjectCategory, string> = {
  industrial: "1",
  internal: "2",
};

async function getApiErrorMessage(response: Response, fallback: string) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const data = await response
      .json()
      .catch(() => null) as { message?: string; error?: string; details?: string } | null;

    if (data?.message?.trim()) return data.message;
    if (data?.error?.trim()) return data.error;
    if (data?.details?.trim()) return data.details;
  } else {
    const text = await response.text().catch(() => "");
    if (text.trim()) return text;
  }

  if (response.status === 401) {
    expireSession();
    return "Your session has expired. Please sign in again.";
  }
  if (response.status === 403) return "You do not have permission to create projects.";
  if (response.status === 409) return "A project with that code already exists.";
  if (response.status >= 500) return "Server error while creating project. Please try again.";

  return fallback;
}

async function createProjectApi(payload: CreateProjectPayload, token?: string | null) {
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
  const endpoints = base ? [`${base}/api/projects`, "/api/projects"] : ["/api/projects"];

  let lastMessage = "Unable to create project right now.";

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text().catch(() => "");

      if (response.ok) {
        return;
      }

      lastMessage = await getApiErrorMessage(response, `Create project failed (${response.status})`);
    } catch {
      lastMessage = "Unable to reach the project service.";
    }
  }

  throw new Error(lastMessage);
}

export const Route = createFileRoute("/projects")({
  component: ProjectsLayout,
});

type StatusFilter = "all" | Project["status"];
type ViewMode = "grid" | "table";

function ProjectsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { can } = useAuth();
  const [projects, setProjects] = useState<Project[]>(() => getProjectsCache());
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [view, setView] = useState<ViewMode>("grid");
  const [tab, setTab] = useState<ProjectCategory>("industrial");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadProjects = async () => {
      setIsLoading(true);
      try {
        const nextProjects = await fetchProjectsApi();
        if (!cancelled) {
          setProjects(nextProjects);
          setLoadError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setProjects(getProjectsCache());
          setLoadError(error instanceof Error ? error.message : "Unable to load projects.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadProjects();

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshProjects = async () => {
    try {
      const nextProjects = await fetchProjectsApi();
      setProjects(nextProjects);
      setLoadError(null);
    } catch (error) {
      setProjects(getProjectsCache());
      setLoadError(error instanceof Error ? error.message : "Unable to load projects.");
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => p.category === tab)
      .filter((p) => (status === "all" ? true : p.status === status))
      .filter((p) =>
        !q
          ? true
          : [p.name, p.code, p.location, p.methodology ?? "", p.registry ?? ""]
              .join(" ")
              .toLowerCase()
              .includes(q),
      );
  }, [projects, query, status, tab]);

  const canCreate = can("projects:create");

  if (pathname !== "/projects" && pathname !== "/projects/") {
    return <Outlet />;
  }

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
            <ProjectFormDialog
              defaultCategory={tab}
              onSaved={refreshProjects}
            />
          )}
        </div>
        {loadError && (
          <p className="text-sm text-destructive">{loadError}</p>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as ProjectCategory)}>
          <TabsList>
            <TabsTrigger value="industrial">Industrial (Isometric)</TabsTrigger>
            <TabsTrigger value="internal">Internal test</TabsTrigger>
          </TabsList>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-55 max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, code, location…"
                className="pl-8"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <SelectTrigger className="w-42.5">
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
            <ProjectResults list={filtered} view={view} isLoading={isLoading} onChanged={refreshProjects} />
          </TabsContent>
          <TabsContent value="internal" className="mt-4">
            <ProjectResults list={filtered} view={view} isLoading={isLoading} onChanged={refreshProjects} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function ProjectResults({
  list,
  view,
  isLoading,
  onChanged,
}: {
  list: Project[];
  view: ViewMode;
  isLoading: boolean;
  onChanged: () => void | Promise<void>;
}) {
  if (isLoading && list.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
        Loading projects...
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
        No projects match your filters.
      </div>
    );
  }
  return view === "grid" ? (
    <ProjectGrid list={list} onChanged={onChanged} />
  ) : (
    <ProjectTable list={list} onChanged={onChanged} />
  );
}

function ProjectGrid({ list, onChanged }: { list: Project[]; onChanged: () => void }) {
  const { can } = useAuth();
  const canEdit = can("projects:create");
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {list.map((p) => (
        <Card key={p.id} className="hover:border-primary/60 transition relative">
          {canEdit && (
            <div className="absolute top-2 right-2 z-10">
              <RowActions project={p} onChanged={onChanged} />
            </div>
          )}
          <Link to="/projects/$projectId" params={{ projectId: p.id }} className="block">
            <CardHeader>
              <div className="flex items-start justify-between gap-2 pr-8">
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
                <span>{(p.emissionsAvoidedTco2e ?? 0).toLocaleString()} tCO₂e</span>
              </div>
            </CardContent>
          </Link>
        </Card>
      ))}
    </div>
  );
}

function ProjectTable({ list, onChanged }: { list: Project[]; onChanged: () => void }) {
  const { can } = useAuth();
  const canEdit = can("projects:create");
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
            {canEdit && <TableHead className="w-10" />}
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
              <TableCell className="text-right">{(p.emissionsAvoidedTco2e ?? 0).toLocaleString()}</TableCell>
              {canEdit && (
                <TableCell className="text-right">
                  <RowActions project={p} onChanged={onChanged} />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RowActions({ project, onChanged }: { project: Project; onChanged: () => void | Promise<void> }) {
  const { token } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const remove = async () => {
    setDeleteError(null);
    setIsDeleting(true);

    try {
      await deleteProjectApi(project.id, token);
      removeProjectFromCache(project.id);
      setConfirmOpen(false);
      await onChanged();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Unable to delete project right now.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => e.preventDefault()}
            aria-label="Project actions"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setEditOpen(true);
            }}
          >
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={(e) => {
              e.preventDefault();
              setConfirmOpen(true);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProjectFormDialog
        project={project}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={onChanged}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{project.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the project from the workspace. Related batches, evidence, and lab
              results will no longer be linked to a project.
            </AlertDialogDescription>
            {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          </AlertDialogHeader>
          <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
                disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
                {isDeleting ? "Deleting..." : "Delete project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ProjectFormDialog({
  defaultCategory,
  project,
  open: controlledOpen,
  onOpenChange,
  onSaved,
}: {
  defaultCategory?: ProjectCategory;
  project?: Project;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  onSaved: () => void | Promise<void>;
}) {
  const { token } = useAuth();
  const isEdit = !!project;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const [name, setName] = useState(project?.name ?? "");
  const [code, setCode] = useState(project?.code ?? "");
  const [category, setCategory] = useState<ProjectCategory>(project?.category ?? defaultCategory ?? "industrial");
  const [location, setLocation] = useState(project?.location ?? "");
  const [methodology, setMethodology] = useState(project?.methodology ?? "");
  const [status, setStatus] = useState<Project["status"]>(project?.status ?? "planning");
  const [pathway, setPathway] = useState<Pathway>(project?.pathway ?? "liquid_co2");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when opening for a different project
  useMemo(() => {
    if (open && project) {
      setName(project.name);
      setCode(project.code);
      setCategory(project.category);
      setLocation(project.location);
      setMethodology(project.methodology ?? "");
      setStatus(project.status);
      setPathway(project.pathway ?? "carbonated_water");
    }

    if (open && !project) {
      setPathway("carbonated_water");
    }
  }, [open, project]);

  const submit = async () => {
    if (!name.trim() || !code.trim()) return;
    setSubmitError(null);

    setIsSubmitting(true);

    try {
      if (isEdit && project) {
        const payload: UpdateProjectPayload = {
          name: name.trim(),
          code: code.trim(),
          location: location.trim(),
          methodology: methodology.trim(),
          project_type_id: PROJECT_TYPE_ID_BY_CATEGORY[category],
          status,
          pathway,
        };

        await updateProjectApi(
          project.id,
          payload,
          token,
        );

        upsertProjectCache({
          ...project,
          name: name.trim(),
          code: code.trim(),
          category,
          pathway,
          status,
          location: location.trim() || "—",
          registry: category === "industrial" ? project.registry ?? "Isometric" : undefined,
          methodology: methodology.trim(),
        });
      } else {
        const nextProject: Project = {
          id: code.trim(),
          code: code.trim(),
          name: name.trim(),
          category,
          pathway,
          status,
          location: location.trim() || "—",
          registry: category === "industrial" ? "Isometric" : undefined,
          methodology: methodology.trim(),
          startDate: new Date().toISOString().slice(0, 10),
          emissionsAvoidedTco2e: 0,
          batchesRun: 0,
        };

        await createProjectApi(
          {
            name: nextProject.name,
            code: nextProject.code,
            location: location.trim(),
            methodology: methodology.trim(),
            project_type_id: PROJECT_TYPE_ID_BY_CATEGORY[category],
            status,
            pathway,
          },
          token,
        );

        upsertProjectCache(nextProject);
        setName("");
        setCode("");
        setLocation("");
        setMethodology("");
        setStatus("planning");
      }
      setOpen(false);
      await onSaved();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to save project right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isEdit && controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button>
            <Plus /> Add project
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update project details and status."
              : "Register a new industrial or internal test project."}
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
            <Label>Pathway</Label>
            <Select value={pathway} onValueChange={(v) => setPathway(v as Pathway)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a pathway" />
              </SelectTrigger>
              <SelectContent>
                {PATHWAY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {PATHWAY_OPTIONS.find((option) => option.value === pathway)?.description}
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="np-meth">Methodology (optional)</Label>
            <Input id="np-meth" value={methodology} onChange={(e) => setMethodology(e.target.value)} placeholder="Isometric Biochar v1.0" />
          </div>
          {submitError && <p className="text-xs text-destructive">{submitError}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={submit} disabled={!name.trim() || !code.trim() || isSubmitting}>
            {isEdit ? "Save changes" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}