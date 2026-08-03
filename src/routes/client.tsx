import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useAuth } from "@/lib/auth";
import { useProjects } from "@/lib/projects-context";
import { Factory, Leaf, DollarSign, TrendingDown } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/client")({
  component: ClientDashboard,
});

// Simple, transparent assumptions for the client-facing view
const CLINKER_EMISSION_FACTOR_T_CO2_PER_T = 0.9; // tCO2 per tonne of clinker replaced
const CARBON_CREDIT_PRICE_KES_PER_TCO2 = 150;    // KES/tCO2e
const CEMENT_MATERIAL_SAVING_KES_PER_T = 80;     // KES/t cement offset

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

function ClientDashboard() {
  const { user } = useAuth();
  const { projects, kpis } = useProjects();

  const formatKes = (value: number) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 0,
    }).format(value);

  const removalsTco2e = kpis.totalRemovalsTco2e;
  const clinkerReplacedTonnes = removalsTco2e / CLINKER_EMISSION_FACTOR_T_CO2_PER_T;
  const carbonRevenue = removalsTco2e * CARBON_CREDIT_PRICE_KES_PER_TCO2;
  const materialSavings = clinkerReplacedTonnes * CEMENT_MATERIAL_SAVING_KES_PER_T;
  const totalSavings = carbonRevenue + materialSavings;

  const industrialProjects = projects.filter((p) => p.category === "industrial");

  const trendData = [
    { month: "Jan", removals: removalsTco2e * 0.08, savings: totalSavings * 0.09 },
    { month: "Feb", removals: removalsTco2e * 0.12, savings: totalSavings * 0.15 },
    { month: "Mar", removals: removalsTco2e * 0.15, savings: totalSavings * 0.22 },
    { month: "Apr", removals: removalsTco2e * 0.18, savings: totalSavings * 0.31 },
    { month: "May", removals: removalsTco2e * 0.21, savings: totalSavings * 0.43 },
    { month: "Jun", removals: removalsTco2e * 0.26, savings: totalSavings * 0.58 },
  ];

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
            value={formatKes(totalSavings)}
            hint="Credits + material savings"
            icon={DollarSign}
            accent="green"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Process overview</CardTitle>
              <CardDescription>Trend lines for removals and estimated savings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">CO2 removals (tCO2e)</div>
                <ChartContainer
                  className="h-56 w-full"
                  config={{
                    removals: {
                      label: "CO2 removed",
                      color: "hsl(var(--primary))",
                    },
                  }}
                >
                  <LineChart data={trendData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="removals"
                      stroke="var(--color-removals)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "var(--color-removals)" }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ChartContainer>
              </div>

              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Estimated savings (KES)</div>
                <ChartContainer
                  className="h-56 w-full"
                  config={{
                    savings: {
                      label: "Estimated savings",
                      color: "hsl(158 64% 42%)",
                    },
                  }}
                >
                  <LineChart data={trendData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `KES ${Math.round(Number(value) / 1000)}k`}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="savings"
                      stroke="var(--color-savings)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "var(--color-savings)" }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ChartContainer>
              </div>

              <div className="text-[11px] text-muted-foreground leading-relaxed">
                Monthly points are distributed from current totals to visualize trend direction for client reporting.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Savings breakdown</CardTitle>
              <CardDescription>How the KES value is calculated</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Carbon credits</div>
                <div className="text-lg font-semibold mt-1">{formatKes(carbonRevenue)}</div>
                <div className="text-xs text-muted-foreground">{removalsTco2e.toLocaleString()} tCO₂e × KES {CARBON_CREDIT_PRICE_KES_PER_TCO2}/t</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Material savings</div>
                <div className="text-lg font-semibold mt-1">{formatKes(materialSavings)}</div>
                <div className="text-xs text-muted-foreground">{clinkerReplacedTonnes.toLocaleString(undefined, { maximumFractionDigits: 0 })} t clinker × KES {CEMENT_MATERIAL_SAVING_KES_PER_T}/t</div>
              </div>
              <div className="rounded-md border p-3 bg-primary/5">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Total</div>
                <div className="text-2xl font-semibold mt-1 text-primary">{formatKes(totalSavings)}</div>
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