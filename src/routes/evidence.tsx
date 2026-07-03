import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, Circle, Upload, FilePlus2 } from "lucide-react";
import { DEPARTMENTS, EVIDENCE, PROJECTS, type Department } from "@/lib/mock-data";
import { useChecklist } from "@/lib/checklist-store";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/evidence")({
  component: EvidencePage,
});

function EvidencePage() {
  const { can } = useAuth();
  return (
    <AppShell title="Evidence Repository">
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Evidence Repository</h2>
          <p className="text-sm text-muted-foreground">
            Verification checklists per department, plus other supporting documents.
          </p>
        </div>

        <Tabs defaultValue="ic">
          <TabsList className="flex-wrap h-auto">
            {DEPARTMENTS.map((d) => (
              <TabsTrigger key={d.key} value={d.key}>{d.label}</TabsTrigger>
            ))}
          </TabsList>

          {DEPARTMENTS.map((d) => (
            <TabsContent key={d.key} value={d.key} className="mt-4 space-y-4">
              <ChecklistCard dept={d.key} />
              <EvidenceTable dept={d.key} canUpload={can("evidence:upload")} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppShell>
  );
}

function ChecklistCard({ dept }: { dept: Department }) {
  const { checklist } = useChecklist();
  const required = checklist[dept];
  const items = EVIDENCE.filter((e) => e.department === dept);
  const submittedTypes = new Set(items.map((i) => i.documentType));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Verification checklist</CardTitle>
        <CardDescription>
          Required documents for {DEPARTMENTS.find((d) => d.key === dept)!.label}. Additional documents can also be uploaded.
        </CardDescription>
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

function EvidenceTable({ dept, canUpload }: { dept: Department; canUpload: boolean }) {
  const items = EVIDENCE.filter((e) => e.department === dept);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Submitted documents</CardTitle>
          <CardDescription>All documents across projects, including "Other".</CardDescription>
        </div>
        {canUpload && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline"><FilePlus2 className="h-4 w-4 mr-1" /> Other document</Button>
            <Button size="sm"><Upload className="h-4 w-4 mr-1" /> Upload</Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Project</TableHead><TableHead>Document type</TableHead><TableHead>File</TableHead><TableHead>Uploaded by</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {items.map((e) => {
              const proj = PROJECTS.find((p) => p.id === e.projectId);
              return (
                <TableRow key={e.id}>
                  <TableCell>{proj?.code}</TableCell>
                  <TableCell>{e.documentType}</TableCell>
                  <TableCell className="text-muted-foreground">{e.fileName}</TableCell>
                  <TableCell>{e.uploadedBy}</TableCell>
                  <TableCell>{e.uploadedAt}</TableCell>
                  <TableCell><Badge variant={e.status === "verified" ? "default" : e.status === "pending" ? "secondary" : "destructive"}>{e.status}</Badge></TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No documents submitted yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}