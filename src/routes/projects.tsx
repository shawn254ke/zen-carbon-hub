import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PROJECTS } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/projects")({
  component: ProjectsLayout,
});

function ProjectsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/projects" && pathname !== "/projects/") {
    return <Outlet />;
  }
  return (
    <AppShell title="Projects">
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Projects</h2>
          <p className="text-sm text-muted-foreground">Industrial Isometric-registered projects and internal test projects.</p>
        </div>
        <Tabs defaultValue="industrial">
          <TabsList>
            <TabsTrigger value="industrial">Industrial (Isometric)</TabsTrigger>
            <TabsTrigger value="internal">Internal test</TabsTrigger>
          </TabsList>
          <TabsContent value="industrial" className="mt-4">
            <ProjectGrid category="industrial" />
          </TabsContent>
          <TabsContent value="internal" className="mt-4">
            <ProjectGrid category="internal" />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function ProjectGrid({ category }: { category: "industrial" | "internal" }) {
  const list = PROJECTS.filter((p) => p.category === category);
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