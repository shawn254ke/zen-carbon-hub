import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Upload, Plus, FileText, Trash2, Building2, Mail, Phone, MapPin, Download } from "lucide-react";
import { LAB_RESULTS, PROJECTS, type LabResult } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/lab-results")({
  component: LabResultsPage,
});

type LabDoc = { id: string; name: string; type: string; expiresOn?: string };
type Lab = {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  documents: LabDoc[];
};

const SEED_LABS: Lab[] = [
  {
    id: "lab_1",
    name: "SGS Nairobi",
    contactPerson: "Grace Wanjiru",
    email: "nairobi.lab@sgs.com",
    phone: "+254 700 000 111",
    address: "Industrial Area, Nairobi, Kenya",
    notes: "Primary lab for proximate & ultimate analysis.",
    documents: [
      { id: "d1", name: "ISO 17025 Accreditation.pdf", type: "ISO 17025", expiresOn: "2026-08-14" },
      { id: "d2", name: "Scope of Accreditation.pdf", type: "Scope document" },
    ],
  },
  {
    id: "lab_2",
    name: "Eurofins",
    contactPerson: "David Müller",
    email: "kenya@eurofins.com",
    phone: "+49 30 123 4567",
    address: "Berlin, Germany",
    documents: [
      { id: "d3", name: "ISO 17025 Certificate.pdf", type: "ISO 17025", expiresOn: "2027-02-01" },
    ],
  },
  {
    id: "lab_3",
    name: "In-house",
    contactPerson: "Zen Carbon R&D",
    email: "lab@zencarbon.io",
    address: "R&D Lab, Nakuru",
    documents: [],
  },
];

const STORAGE_KEY = "zc_labs_v1";

function useLabs() {
  const [labs, setLabs] = useState<Lab[]>(SEED_LABS);
  useEffect(() => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      try { setLabs(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }, []);
  const persist = (next: Lab[]) => {
    setLabs(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };
  return { labs, persist };
}

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
        </div>

        <Tabs defaultValue="results">
          <TabsList>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="labs">Registered Labs</TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="space-y-4">
            <div className="flex justify-end gap-2">
              {LAB_RESULTS.length > 0 && (
                <Button variant="outline" onClick={() => LAB_RESULTS.forEach(downloadLabResult)}>
                  <Download className="h-4 w-4 mr-1" /> Download all
                </Button>
              )}
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
                <TableHead>Project</TableHead><TableHead>Batch</TableHead><TableHead>Test</TableHead><TableHead>Lab</TableHead><TableHead>Sample date</TableHead><TableHead>Result</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead>
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
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => downloadLabResult(l)}>
                          <Download className="h-4 w-4 mr-1" /> Download
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="labs" className="space-y-4">
            <RegisteredLabs canManage={can("lab:upload") || can("admin:all")} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function RegisteredLabs({ canManage }: { canManage: boolean }) {
  const { labs, persist } = useLabs();
  const [open, setOpen] = useState(false);

  const addLab = (lab: Lab) => persist([lab, ...labs]);
  const removeLab = (id: string) => persist(labs.filter((l) => l.id !== id));
  const addDoc = (labId: string, doc: LabDoc) =>
    persist(labs.map((l) => (l.id === labId ? { ...l, documents: [...l.documents, doc] } : l)));
  const removeDoc = (labId: string, docId: string) =>
    persist(labs.map((l) => (l.id === labId ? { ...l, documents: l.documents.filter((d) => d.id !== docId) } : l)));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Registered laboratories</h3>
          <p className="text-sm text-muted-foreground">
            Central directory of external and internal labs, their contacts, and compliance documents (ISO 17025 and related accreditations).
          </p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Register lab</Button>
            </DialogTrigger>
            <RegisterLabDialog onSubmit={(l) => { addLab(l); setOpen(false); }} />
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {labs.map((lab) => (
          <Card key={lab.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    {lab.name}
                  </CardTitle>
                  {lab.contactPerson && (
                    <CardDescription>{lab.contactPerson}</CardDescription>
                  )}
                </div>
                {canManage && (
                  <Button variant="ghost" size="icon" onClick={() => removeLab(lab.id)} aria-label="Remove lab">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-1 text-sm text-muted-foreground">
                {lab.email && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {lab.email}</div>}
                {lab.phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {lab.phone}</div>}
                {lab.address && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {lab.address}</div>}
                {lab.notes && <div className="pt-1 text-foreground/80">{lab.notes}</div>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">Compliance documents</h4>
                  <Badge variant="secondary">{lab.documents.length}</Badge>
                </div>
                {lab.documents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No documents uploaded yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {lab.documents.map((d) => (
                      <li key={d.id} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{d.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {d.type}{d.expiresOn ? ` · expires ${d.expiresOn}` : ""}
                            </div>
                          </div>
                        </div>
                        {canManage && (
                          <Button variant="ghost" size="icon" onClick={() => removeDoc(lab.id, d.id)} aria-label="Remove document">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {canManage && (
                  <AddDocForm onAdd={(doc) => addDoc(lab.id, doc)} />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function RegisterLabDialog({ onSubmit }: { onSubmit: (lab: Lab) => void }) {
  const [form, setForm] = useState({
    name: "", contactPerson: "", email: "", phone: "", address: "", notes: "",
  });
  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Register a laboratory</DialogTitle>
        <DialogDescription>Add lab contacts. You can upload compliance documents after creating the record.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="lab-name">Lab name</Label>
          <Input id="lab-name" value={form.name} onChange={update("name")} placeholder="e.g. SGS Nairobi" />
        </div>
        <div className="grid gap-1.5 grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="lab-contact">Contact person</Label>
            <Input id="lab-contact" value={form.contactPerson} onChange={update("contactPerson")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lab-phone">Phone</Label>
            <Input id="lab-phone" value={form.phone} onChange={update("phone")} />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lab-email">Email</Label>
          <Input id="lab-email" type="email" value={form.email} onChange={update("email")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lab-address">Address</Label>
          <Input id="lab-address" value={form.address} onChange={update("address")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lab-notes">Notes</Label>
          <Textarea id="lab-notes" value={form.notes} onChange={update("notes")} rows={2} />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={!form.name.trim()}
          onClick={() =>
            onSubmit({
              id: `lab_${Date.now()}`,
              name: form.name.trim(),
              contactPerson: form.contactPerson || undefined,
              email: form.email || undefined,
              phone: form.phone || undefined,
              address: form.address || undefined,
              notes: form.notes || undefined,
              documents: [],
            })
          }
        >
          Save lab
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

const DOC_TYPES = [
  "ISO 17025",
  "ISO 9001",
  "Scope document",
  "Method validation",
  "Insurance",
  "Other",
];

function AddDocForm({ onAdd }: { onAdd: (doc: LabDoc) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState(DOC_TYPES[0]);
  const [expires, setExpires] = useState("");

  return (
    <div className="mt-3 rounded-md border border-dashed p-3 space-y-2">
      <div className="grid gap-2 sm:grid-cols-3">
        <Input placeholder="Document file name" value={name} onChange={(e) => setName(e.target.value)} />
        <select
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
      </div>
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          disabled={!name.trim()}
          onClick={() => {
            onAdd({ id: `d_${Date.now()}`, name: name.trim(), type, expiresOn: expires || undefined });
            setName(""); setExpires("");
          }}
        >
          <Upload className="h-3.5 w-3.5 mr-1" /> Add document
        </Button>
      </div>
    </div>
  );
}