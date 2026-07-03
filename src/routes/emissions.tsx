import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Truck, Zap, Droplets, Leaf } from "lucide-react";
import { EMISSIONS, EMISSION_CATEGORIES, PROJECTS, type EmissionActivity, type EmissionCategory } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/emissions")({
  component: EmissionsPage,
});

type CategoryFilter = "all" | EmissionCategory;

const CATEGORY_ICON: Record<EmissionCategory, typeof Truck> = {
  transport: Truck,
  energy: Zap,
  loss: Droplets,
};

function EmissionsPage() {
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState<CategoryFilter>("all");

  const rows = useMemo(() => {
    if (filter === "all") return EMISSIONS;
    return EMISSIONS.filter((e) => e.category === filter);
    // tick forces re-eval after new inserts
     
  }, [filter, tick]);

  const removals = EMISSIONS.filter((e) => e.scope === "removals").reduce((a, b) => a + b.tco2e, 0);
  const gross = EMISSIONS.filter((e) => e.scope !== "removals").reduce((a, b) => a + b.tco2e, 0);

  const byCategory = useMemo(() => {
    const map: Record<EmissionCategory, number> = { transport: 0, energy: 0, loss: 0 };
    for (const e of EMISSIONS) if (e.category) map[e.category] += e.tco2e;
    return map;
     
  }, [tick]);

  return (
    <AppShell title="Emissions Activities">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Emissions activities</h2>
            <p className="text-sm text-muted-foreground">Track removals and Scope 1/2/3 emissions across every project.</p>
          </div>
          <AddActivityDialog onAdded={() => setTick((t) => t + 1)} />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard label="Total removals" value={removals} accent />
          <SummaryCard label="Total gross emissions" value={gross} />
          <SummaryCard label="Net (tCO₂e)" value={removals - gross} accent />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {EMISSION_CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICON[c.key];
            return (
              <Card key={c.key}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                    <Icon className="h-4 w-4" /> {c.label}
                  </div>
                  <div className="text-2xl font-semibold mt-1">{byCategory[c.key].toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">{c.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader className="gap-3">
            <div>
              <CardTitle>Activity log</CardTitle>
              <CardDescription>All logged activities across projects.</CardDescription>
            </div>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as CategoryFilter)}>
              <TabsList>
                <TabsTrigger value="all"><Leaf className="h-4 w-4 mr-1" /> All</TabsTrigger>
                {EMISSION_CATEGORIES.map((c) => {
                  const Icon = CATEGORY_ICON[c.key];
                  return (
                    <TabsTrigger key={c.key} value={c.key}>
                      <Icon className="h-4 w-4 mr-1" /> {c.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Project</TableHead><TableHead>Scope</TableHead><TableHead>Category</TableHead><TableHead>Activity</TableHead><TableHead>Period</TableHead><TableHead className="text-right">tCO₂e</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((e) => {
                  const p = PROJECTS.find((x) => x.id === e.projectId);
                  return (
                    <TableRow key={e.id}>
                      <TableCell>{p?.code}</TableCell>
                      <TableCell><Badge variant={e.scope === "removals" ? "default" : "outline"}>{e.scope}</Badge></TableCell>
                      <TableCell>
                        {e.category ? (
                          <Badge variant="secondary" className="capitalize">{e.category}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{e.activity}</TableCell>
                      <TableCell>{e.period}</TableCell>
                      <TableCell className="text-right font-medium">{e.tco2e.toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">No activities in this category yet.</TableCell>
                  </TableRow>
                )}
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

function AddActivityDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(PROJECTS[0]?.id ?? "");
  const [category, setCategory] = useState<EmissionCategory>("transport");
  const [scope, setScope] = useState<EmissionActivity["scope"]>("scope1");
  const [activity, setActivity] = useState("");
  const [period, setPeriod] = useState("2025-Q2");
  const [tco2e, setTco2e] = useState("");

  const reset = () => {
    setProjectId(PROJECTS[0]?.id ?? "");
    setCategory("transport");
    setScope("scope1");
    setActivity("");
    setPeriod("2025-Q2");
    setTco2e("");
  };

  const submit = () => {
    const value = Number(tco2e);
    if (!projectId || !activity.trim() || !period.trim() || Number.isNaN(value)) {
      toast.error("Fill in project, activity, period and a numeric tCO₂e");
      return;
    }
    EMISSIONS.unshift({
      id: `em_${Date.now()}`,
      projectId,
      scope,
      category,
      activity: activity.trim(),
      period: period.trim(),
      tco2e: value,
    });
    toast.success("Activity added");
    reset();
    setOpen(false);
    onAdded();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-1" /> Add activity</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log emission activity</DialogTitle>
          <DialogDescription>Record a new emission source and categorise it.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROJECTS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as EmissionCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EMISSION_CATEGORIES.map((c) => (
                    <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Scope</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as EmissionActivity["scope"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scope1">Scope 1</SelectItem>
                  <SelectItem value="scope2">Scope 2</SelectItem>
                  <SelectItem value="scope3">Scope 3</SelectItem>
                  <SelectItem value="removals">Removals</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Activity</Label>
            <Input value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="e.g. Feedstock haulage — Nakuru to Nairobi" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Period</Label>
              <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="e.g. 2025-Q2" />
            </div>
            <div className="grid gap-2">
              <Label>tCO₂e</Label>
              <Input type="number" value={tco2e} onChange={(e) => setTco2e(e.target.value)} placeholder="0" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit}><Plus className="h-4 w-4 mr-1" /> Add activity</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}