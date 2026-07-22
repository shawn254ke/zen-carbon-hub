import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import { useProjects } from "@/lib/projects-context";
import { Factory, Leaf, DollarSign, TrendingDown, Truck, Flame, PackageCheck, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/client")({
  component: ClientDashboard,
});

// Simple, transparent assumptions for the client-facing view
const CLINKER_EMISSION_FACTOR_T_CO2_PER_T = 0.9; // tCO2 per tonne of clinker replaced
const CARBON_CREDIT_PRICE_USD_PER_TCO2 = 150;    // $/tCO2e
const CEMENT_MATERIAL_SAVING_USD_PER_T = 80;     // $/t cement offset

function Stat({
  label,
  value,
  hint,
  icon: Icon,
  accent = "primary",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "primary" | "green" | "amber";
}) {
  const colors =
    accent === "green"
      ? "bg-emerald-500/10 text-emerald-600"
      : accent === "amber"
      ? "bg-amber-500/10 text-amber-600"
      : "bg-primary/10 text-primary";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="text-2xl font-semibold mt-1">{value}</div>
            {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
          </div>
          <div className={`h-10 w-10 rounded-md flex items-center justify-center ${colors}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const PROCESS_STEPS = [
  { key: "feedstock", label: "Feedstock intake", icon: Truck, desc: "Agri-residues sourced from local farms and weighed on arrival.", progress: 100 },
  { key: "pyrolysis", label: "Pyrolysis", icon: Flame, desc: "Biomass converted to biochar in low-oxygen reactors (450–550°C).", progress: 100 },
  { key: "qc", label: "Quality control", icon: ShieldCheck, desc: "Fixed carbon, H:C ratio and contaminants tested by accredited labs.", progress: 90 },
  { key: "blend", label: "Cement blend", icon: PackageCheck, desc: "Biochar dosed into cement to replace a share of clinker.", progress: 70 },
  { key: "mrv", label: "MRV & credits", icon: ShieldCheck, desc: "Monitoring, reporting & verification against the Isometric protocol.", progress: 55 },
];

function ClientDashboard() {
  const { user } = useAuth();
  const { projects, kpis } = useProjects();

  const removalsTco2e = kpis.totalRemovalsTco2e;
  const clinkerReplacedTonnes = removalsTco2e / CLINKER_EMISSION_FACTOR_T_CO2_PER_T;
  const carbonRevenue = removalsTco2e * CARBON_CREDIT_PRICE_USD_PER_TCO2;
  const materialSavings = clinkerReplacedTonnes * CEMENT_MATERIAL_SAVING_USD_PER_T;
  const totalSavings = carbonRevenue + materialSavings;

  const industrialProjects = projects.filter((p) => p.category === "industrial");

  return (
    <AppShell title="Client Dashboard">
      <div className="space-y-6">
        <div>
          <div className="text-sm text-muted-foreground">Welcome, {user.name.split(" ")[0]}</div>
          <h2 className="text-2xl font-semibold tracking-tight">Your carbon & cement impact</h2>
          <p className="text-sm text-muted-foreground mt-1">
            A live view of how Zen Carbon's biochar process is reducing your cement footprint and translating it into savings.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Stat
            label="CO₂ removed"
            value={`${removalsTco2e.toLocaleString()} tCO₂e`}
            hint="Durable biochar carbon storage"
            icon={Leaf}
            accent="green"
          />
          <Stat
            label="Cement (clinker) replaced"
            value={`${clinkerReplacedTonnes.toLocaleString(undefined, { maximumFractionDigits: 0 })} t`}
            hint={`@ ${CLINKER_EMISSION_FACTOR_T_CO2_PER_T} tCO₂ / t clinker`}
            icon={Factory}
            accent="primary"
          />
          <Stat
            label="Emissions avoided in cement"
            value={`${(clinkerReplacedTonnes * CLINKER_EMISSION_FACTOR_T_CO2_PER_T).toLocaleString(undefined, { maximumFractionDigits: 0 })} tCO₂e`}
            hint="From clinker substitution"
            icon={TrendingDown}
            accent="amber"
          />
          <Stat
            label="Estimated cost savings"
            value={`$${totalSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            hint="Credits + material savings"
            icon={DollarSign}
            accent="green"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Process overview</CardTitle>
              <CardDescription>How your feedstock becomes verified cement reduction</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {PROCESS_STEPS.map((step, i) => (
                <div key={step.key} className="rounded-md border p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                      <step.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Step {i + 1}</span>
                        <span className="text-sm font-medium">{step.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                    </div>
                    <Badge variant={step.progress === 100 ? "default" : "secondary"} className="shrink-0">
                      {step.progress}%
                    </Badge>
                  </div>
                  <Progress value={step.progress} className="mt-3 h-1.5" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Savings breakdown</CardTitle>
              <CardDescription>How the dollar value is calculated</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Carbon credits</div>
                <div className="text-lg font-semibold mt-1">${carbonRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                <div className="text-xs text-muted-foreground">{removalsTco2e.toLocaleString()} tCO₂e × ${CARBON_CREDIT_PRICE_USD_PER_TCO2}/t</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Material savings</div>
                <div className="text-lg font-semibold mt-1">${materialSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                <div className="text-xs text-muted-foreground">{clinkerReplacedTonnes.toLocaleString(undefined, { maximumFractionDigits: 0 })} t clinker × ${CEMENT_MATERIAL_SAVING_USD_PER_T}/t</div>
              </div>
              <div className="rounded-md border p-3 bg-primary/5">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Total</div>
                <div className="text-2xl font-semibold mt-1 text-primary">${totalSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Illustrative figures based on posted market prices and standard clinker emission factors. Final settlement values follow the verified MRV report.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Contributing projects</CardTitle>
            <CardDescription>Facilities delivering your biochar supply</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {industrialProjects.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.code} · {p.location}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{(p.emissionsAvoidedTco2e ?? 0).toLocaleString()} tCO₂e</div>
                  <Badge variant="secondary" className="mt-1 capitalize">{p.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}