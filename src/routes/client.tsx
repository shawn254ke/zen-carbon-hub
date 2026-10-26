import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useAuth } from "@/lib/auth";
import { useProjects } from "@/lib/projects-context";
import { Factory, Leaf, DollarSign } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/client")({
  component: ClientDashboard,
});

const REMOVALS_TCO2E = 0.068;
const CEMENT_SAVINGS_KG = 68.4;
const CEMENT_SAVINGS_VALUE_KES = 38880;

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
  const { projects } = useProjects();

  const formatKes = (value: number) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 0,
    }).format(value);

  const industrialProjects = projects.filter((p) => p.category === "industrial");

  const monthlyData = [
    { month: "Jan", removals: 0.003, savings: 2140 },
    { month: "Feb", removals: 0.004, savings: 2340 },
    { month: "Mar", removals: 0.004, savings: 2540 },
    { month: "Apr", removals: 0.005, savings: 2740 },
    { month: "May", removals: 0.005, savings: 2940 },
    { month: "Jun", removals: 0.005, savings: 3140 },
    { month: "Jul", removals: 0.006, savings: 3340 },
    { month: "Aug", removals: 0.006, savings: 3540 },
    { month: "Sep", removals: 0.007, savings: 3740 },
    { month: "Oct", removals: 0.007, savings: 3940 },
    { month: "Nov", removals: 0.008, savings: 4140 },
    { month: "Dec", removals: 0.008, savings: 4340 },
  ];

  return (
    <AppShell title="Client Dashboard">
      <div className="space-y-6">
        <div>
          <div className="text-sm text-muted-foreground">Welcome, {user.name.split(" ")[0]}</div>
          <h2 className="text-2xl font-semibold tracking-tight">Your carbon & cement impact</h2>
          <p className="text-sm text-muted-foreground mt-1">
            A live view of how Zen Carbon's mineralization process is reducing your cement footprint and translating it into savings.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Stat
            label="CO₂ removed"
            value={`${REMOVALS_TCO2E} tCO₂`}
            hint="Durable carbon storage"
            icon={Leaf}
            accent="green"
          />
          <Stat
            label="Cement savings"
            value={`${CEMENT_SAVINGS_KG} kg`}
            hint="Material saved"
            icon={Factory}
            accent="primary"
          />
          <Stat
            label="Equivalent value"
            value={formatKes(CEMENT_SAVINGS_VALUE_KES)}
            hint="Cement savings value"
            icon={DollarSign}
            accent="green"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Process overview</CardTitle>
              <CardDescription>Illustrative monthly removals and savings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">CO₂ removals (tonnes CO₂e)</div>
                <ChartContainer
                  className="h-56 w-full"
                  config={{
                    removals: {
                      label: "CO₂ removed (tonnes)",
                      color: "hsl(var(--primary))",
                    },
                  }}
                >
                  <LineChart data={monthlyData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${Number(value).toFixed(3)} t`}
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
                  <LineChart data={monthlyData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
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
                Illustrative monthly values for presentation; monthly removals total {REMOVALS_TCO2E} tonnes CO₂e and savings total {formatKes(CEMENT_SAVINGS_VALUE_KES)}.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Savings breakdown</CardTitle>
              <CardDescription>Reported cement savings and equivalent value</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Cement saved</div>
                <div className="text-lg font-semibold mt-1">{CEMENT_SAVINGS_KG} kg</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Equivalent value</div>
                <div className="text-lg font-semibold mt-1">{formatKes(CEMENT_SAVINGS_VALUE_KES)}</div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Cement savings value is reported as KES 38,880.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Contributing projects</CardTitle>
            <CardDescription>Facilities delivering your Cement Savings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {industrialProjects.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-muted- foreground">{p.code} · {p.location}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{(p.emissionsAvoidedTco2e ?? 0).toLocaleString()} tCO₂e</div>
                  <div className="mt-1 flex justify-end gap-1">
                    {p.name.toLowerCase().includes("flamingo") && (
                      <Badge variant="secondary">0.068 tCO₂</Badge>
                    )}
                    <Badge variant="secondary" className="capitalize">{p.status}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}