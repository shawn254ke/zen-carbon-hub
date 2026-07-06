import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PROJECTS, BATCHES, LAB_RESULTS, EVIDENCE, EMISSIONS, DEPARTMENTS, type EvidenceItem } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Download } from "lucide-react";
import { useAuth } from "@/lib/auth";

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

function ProjectDetail() {
  const project = Route.useLoaderData();
  const { can } = useAuth();
  const batches = BATCHES.filter((b) => b.projectId === project.id);
  const labs = LAB_RESULTS.filter((l) => l.projectId === project.id);
  const evidence = EVIDENCE.filter((e) => e.projectId === project.id);
  const emissions = EMISSIONS.filter((e) => e.projectId === project.id);

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
                    <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add batch</Button>
                  )}
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Batch</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Feedstock</TableHead>
                        <TableHead>Mass (kg)</TableHead>
                        <TableHead>Yield (kg)</TableHead>
                        <TableHead>Temp (°C)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Attachments</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batches.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium">{b.code}</TableCell>
                          <TableCell>{b.runDate}</TableCell>
                          <TableCell>{b.feedstock}</TableCell>
                          <TableCell>{b.massKg}</TableCell>
                          <TableCell>{b.yieldKg}</TableCell>
                          <TableCell>{b.temperatureC}</TableCell>
                          <TableCell><Badge variant={b.status === "complete" ? "default" : "secondary"}>{b.status}</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline">Upload lab / photos</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {batches.length === 0 && (
                        <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No batches yet.</TableCell></TableRow>
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
                  <CardHeader>
                    <CardTitle className="text-base">{d.label}</CardTitle>
                    <CardDescription>{items.length} document(s)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No documents submitted.</p>
                    ) : (
                      <ul className="text-sm space-y-1">
                        {items.map((e) => (
                          <li key={e.id} className="flex justify-between border-b py-1.5 last:border-0">
                            <span>{e.documentType} — {e.fileName}</span>
                            <Badge variant={e.status === "verified" ? "default" : e.status === "pending" ? "secondary" : "destructive"}>{e.status}</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="lab" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Lab results</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Test</TableHead><TableHead>Batch</TableHead><TableHead>Lab</TableHead><TableHead>Sampled</TableHead><TableHead>Result</TableHead><TableHead>Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {labs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.testName}</TableCell>
                        <TableCell>{l.batchId ?? "—"}</TableCell>
                        <TableCell>{l.labName}</TableCell>
                        <TableCell>{l.sampleDate}</TableCell>
                        <TableCell>{l.result}</TableCell>
                        <TableCell><Badge variant={l.status === "reported" ? "default" : "secondary"}>{l.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                    {labs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No lab results yet.</TableCell></TableRow>}
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