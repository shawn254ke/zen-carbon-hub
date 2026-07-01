import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { LAB_RESULTS, PROJECTS } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/lab-results")({
  component: LabResultsPage,
});

function LabResultsPage() {
  const { can } = useAuth();
  return (
    <AppShell title="Lab Results">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Laboratory results</h2>
            <p className="text-sm text-muted-foreground">Every result is tracked to a project and, where applicable, a specific batch.</p>
          </div>
          {can("lab:upload") && <Button><Upload className="h-4 w-4 mr-1" /> Upload result</Button>}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All results</CardTitle>
            <CardDescription>{LAB_RESULTS.length} total records</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Project</TableHead><TableHead>Batch</TableHead><TableHead>Test</TableHead><TableHead>Lab</TableHead><TableHead>Sample date</TableHead><TableHead>Result</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {LAB_RESULTS.map((l) => {
                  const p = PROJECTS.find((x) => x.id === l.projectId);
                  return (
                    <TableRow key={l.id}>
                      <TableCell>{p?.code}</TableCell>
                      <TableCell>{l.batchId ?? "—"}</TableCell>
                      <TableCell className="font-medium">{l.testName}</TableCell>
                      <TableCell>{l.labName}</TableCell>
                      <TableCell>{l.sampleDate}</TableCell>
                      <TableCell>{l.result}</TableCell>
                      <TableCell><Badge variant={l.status === "reported" ? "default" : "secondary"}>{l.status}</Badge></TableCell>
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