import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EMISSIONS, PROJECTS } from "@/lib/mock-data";

export const Route = createFileRoute("/emissions")({
  component: EmissionsPage,
});

function EmissionsPage() {
  const removals = EMISSIONS.filter((e) => e.scope === "removals").reduce((a, b) => a + b.tco2e, 0);
  const gross = EMISSIONS.filter((e) => e.scope !== "removals").reduce((a, b) => a + b.tco2e, 0);
  return (
    <AppShell title="Emissions Activities">
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Emissions activities</h2>
          <p className="text-sm text-muted-foreground">Track removals and Scope 1/2/3 emissions across every project.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard label="Total removals" value={removals} accent />
          <SummaryCard label="Total gross emissions" value={gross} />
          <SummaryCard label="Net (tCO₂e)" value={removals - gross} accent />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Activity log</CardTitle>
            <CardDescription>All logged activities across projects.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Project</TableHead><TableHead>Scope</TableHead><TableHead>Activity</TableHead><TableHead>Period</TableHead><TableHead className="text-right">tCO₂e</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {EMISSIONS.map((e) => {
                  const p = PROJECTS.find((x) => x.id === e.projectId);
                  return (
                    <TableRow key={e.id}>
                      <TableCell>{p?.code}</TableCell>
                      <TableCell><Badge variant={e.scope === "removals" ? "default" : "outline"}>{e.scope}</Badge></TableCell>
                      <TableCell>{e.activity}</TableCell>
                      <TableCell>{e.period}</TableCell>
                      <TableCell className="text-right font-medium">{e.tco2e.toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={"text-2xl font-semibold mt-1 " + (accent ? "text-primary" : "")}>{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}