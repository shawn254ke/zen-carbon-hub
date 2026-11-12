import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertCircle, Loader2, Plus, RefreshCw, Truck, Zap, Leaf, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
type EmissionCategory = "transport" | "energy";

const EMISSION_CATEGORIES: { key: EmissionCategory; label: string; description: string }[] = [
  {
    key: "transport",
    label: "Transport",
    description: "Shipment fuel and distance-based emissions and allocation factors.",
  },
  {
    key: "energy",
    label: "Energy",
    description: "Grid and generator electricity emissions by batch meter and fuel intensity.",
  },
] as const;
import {
  createEmissionActivity,
  deleteEmissionActivity,
  fetchEmissionActivities,
  type CdrInclusionStatus,
  type CreateEmissionActivityRequest,
  type EmissionActivityRecord,
  type EnergySource,
  type TransportMethod,
} from "@/lib/emissions-api";
import { useProjects } from "@/lib/projects-context";
import { toast } from "sonner";

export const Route = createFileRoute("/emissions")({
  component: EmissionsPage,
});

type CategoryFilter = "all" | EmissionCategory;
type DisplayActivity = {
  id: string;
  projectId: string;
  scope: string;
  category?: EmissionCategory;
  activity: string;
  period: string;
  emissionsKgCo2e: number | null;
  status: "COMPLETE" | "PENDING";
  fullShipmentEmissionsKgCo2e?: number | null;
  unallocatedEmissionsKgCo2e?: number | null;
  details?: Record<string, unknown>;
};

const CATEGORY_ICON: Record<EmissionCategory, typeof Truck> = {
  transport: Truck,
  energy: Zap,
};

function EmissionsPage() {
  const { projects, isLoading: isProjectsLoading, error: projectsError } = useProjects();
  const [activities, setActivities] = useState<EmissionActivityRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<DisplayActivity | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    fetchEmissionActivities(controller.signal)
      .then(setActivities)
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load emission activities.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [refreshKey]);

  const rows = useMemo<DisplayActivity[]>(() => {
    const mapped = activities.map((entry) => ({
      id: String(entry.id),
      projectId: entry.projectId,
      scope: entry.scope,
      category: entry.category,
      activity: entry.activity,
      period: entry.period,
      emissionsKgCo2e: entry.emissionsKgCo2e,
      status: entry.status,
      fullShipmentEmissionsKgCo2e: entry.fullShipmentEmissionsKgCo2e,
      unallocatedEmissionsKgCo2e: entry.unallocatedEmissionsKgCo2e,
      details: entry.details,
    }));
    return filter === "all" ? mapped : mapped.filter((entry) => entry.category === filter);
  }, [activities, filter]);

  const allEntries: DisplayActivity[] = useMemo(
    () =>
      activities.map((entry) => ({
        id: String(entry.id),
        projectId: entry.projectId,
        scope: entry.scope,
        category: entry.category,
        activity: entry.activity,
        period: entry.period,
        emissionsKgCo2e: entry.emissionsKgCo2e,
        status: entry.status,
        fullShipmentEmissionsKgCo2e: entry.fullShipmentEmissionsKgCo2e,
        unallocatedEmissionsKgCo2e: entry.unallocatedEmissionsKgCo2e,
        details: entry.details,
      })),
    [activities],
  );

  const removals = 0;
  const gross = allEntries.reduce((sum, entry) => sum + (entry.emissionsKgCo2e ?? 0), 0);
  const byCategory = useMemo(() => {
    const totals: Record<EmissionCategory, number> = { transport: 0, energy: 0 };
    for (const entry of allEntries) {
      if (entry.category && entry.emissionsKgCo2e !== null) {
        totals[entry.category] += entry.emissionsKgCo2e;
      }
    }
    return totals;
  }, [allEntries]);
  const projectCodes = useMemo(
    () => new Map(projects.map((project) => [project.id, project.code])),
    [projects],
  );

  const handleAdded = (activity: EmissionActivityRecord) => {
    setActivities((current) => [activity, ...current]);
    toast.success(activity.status === "PENDING" ? "Activity saved as pending" : "Activity added");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const id = Number(deleteTarget.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      toast.error("This activity has an invalid ID and cannot be deleted.");
      return;
    }

    setDeletingId(id);
    try {
      await deleteEmissionActivity(id);
      setActivities((current) => current.filter((entry) => entry.id !== id));
      setDeleteTarget(null);
      toast.success("Emission activity deleted.");
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error ? deleteError.message : "Unable to delete emission activity.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AppShell title="Emissions Activities">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Emissions activities</h2>
            <p className="text-sm text-muted-foreground">
              Calculate shipment transport and batch energy emissions in kgCO₂e.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setRefreshKey((key) => key + 1)}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
            <AddActivityDialog projects={projects} onAdded={handleAdded} />
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">{error}</div>
            <Button variant="outline" size="sm" onClick={() => setRefreshKey((key) => key + 1)}>
              Retry
            </Button>
          </div>
        )}
        {projectsError && <p className="text-sm text-destructive">{projectsError}</p>}

        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard label="Total removals (tCO₂e)" value={removals / 1000} accent />
          <SummaryCard label="Total gross emissions (tCO₂e)" value={gross / 1000} />
          <SummaryCard label="Net (tCO₂e)" value={(removals - gross) / 1000} accent />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {EMISSION_CATEGORIES.map((category) => {
            const Icon = CATEGORY_ICON[category.key];
            return (
              <Card key={category.key}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                    <Icon className="h-4 w-4" /> {category.label}
                  </div>
                  <div className="mt-1 text-2xl font-semibold">
                    {(byCategory[category.key] / 1000).toLocaleString(undefined, {
                      maximumFractionDigits: 3,
                    })}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">tCO₂e</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{category.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader className="gap-3">
            <div>
              <CardTitle>Activity log</CardTitle>
              <CardDescription>
                Transport and energy calculations with factor and allocation details.
              </CardDescription>
            </div>
            <Tabs value={filter} onValueChange={(value) => setFilter(value as CategoryFilter)}>
              <TabsList>
                <TabsTrigger value="all">
                  <Leaf className="mr-1 h-4 w-4" /> All
                </TabsTrigger>
                {EMISSION_CATEGORIES.map((category) => {
                  const Icon = CATEGORY_ICON[category.key];
                  return (
                    <TabsTrigger key={category.key} value={category.key}>
                      <Icon className="mr-1 h-4 w-4" /> {category.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">kgCO₂e</TableHead>
                  <TableHead className="text-right">Unallocated kgCO₂e</TableHead>
                  <TableHead className="w-16 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((entry) => (
                  <TableRow key={`${entry.status}-${entry.id}`}>
                    <TableCell>{projectCodes.get(entry.projectId) ?? entry.projectId}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.scope}</Badge>
                    </TableCell>
                    <TableCell>
                      {entry.category ? (
                        <Badge variant="secondary" className="capitalize">
                          {entry.category}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="min-w-52">
                      <div>{entry.activity}</div>
                      {entry.details && (
                        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                          {entry.category === "transport" ? (
                            <>
                              <div>
                                {detailText(entry.details, "shipmentReference")}
                                {detailText(entry.details, "batchReference")
                                  ? ` · Batch ${detailText(entry.details, "batchReference")}`
                                  : ""}
                              </div>
                              <div>
                                {[
                                  detailText(entry.details, "route"),
                                  detailText(entry.details, "vehicleClass") ||
                                    detailText(entry.details, "fuelType"),
                                  detailText(entry.details, "factorSource"),
                                  detailText(entry.details, "cdrInclusionStatus"),
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            </>
                          ) : (
                            <div>
                              {[
                                detailText(entry.details, "site"),
                                detailText(entry.details, "batchReference"),
                                detailText(entry.details, "batchWindow"),
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{entry.period}</TableCell>
                    <TableCell>
                      {entry.status === "PENDING" ? (
                        <Badge variant="outline">Energy data pending</Badge>
                      ) : (
                        <Badge variant="secondary">Complete</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {entry.emissionsKgCo2e === null
                        ? "Pending"
                        : entry.emissionsKgCo2e.toLocaleString(undefined, {
                            maximumFractionDigits: 3,
                          })}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.unallocatedEmissionsKgCo2e == null
                        ? "—"
                        : entry.unallocatedEmissionsKgCo2e.toLocaleString(undefined, {
                            maximumFractionDigits: 3,
                          })}
                    </TableCell>
                    <TableCell className="text-right">
                          <AlertDialog
                            open={deleteTarget?.id === entry.id}
                            onOpenChange={(open) => {
                              if (!open && deletingId === null) setDeleteTarget(null);
                            }}
                          >
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                aria-label={`Delete ${entry.activity}`}
                                title="Delete activity"
                                onClick={() => setDeleteTarget(entry)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this emission activity?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This permanently deletes “{entry.activity}”. This action cannot be
                                  undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={deletingId !== null}>
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  disabled={deletingId !== null}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    void handleDelete();
                                  }}
                                >
                                  {deletingId === Number(entry.id) ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="mr-2 h-4 w-4" />
                                  )}
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      {isLoading ? "Loading activities…" : "No activities in this category yet."}
                    </TableCell>
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
        <div className={"mt-1 text-2xl font-semibold " + (accent ? "text-primary" : "")}>
          {value.toLocaleString(undefined, { maximumFractionDigits: 3 })}
        </div>
      </CardContent>
    </Card>
  );
}

function detailText(details: Record<string, unknown>, key: string) {
  const value = details[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function AddActivityDialog({
  projects,
  onAdded,
}: {
  projects: ReturnType<typeof useProjects>["projects"];
  onAdded: (activity: EmissionActivityRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<"transport" | "energy">("transport");
  const [transportMethod, setTransportMethod] = useState<TransportMethod>("fuel");
  const [energySource, setEnergySource] = useState<EnergySource>("kenya_grid");
  const [values, setValues] = useState<Record<string, string>>({});
  const [cdrInclusionStatus, setCdrInclusionStatus] =
    useState<CdrInclusionStatus>("PENDING_DECISION");
  const [proxyUsed, setProxyUsed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const get = (field: string) => values[field] ?? "";
  const set = (field: string, value: string) =>
    setValues((current) => ({ ...current, [field]: value }));
  const reset = () => {
    setCategory("transport");
    setTransportMethod("fuel");
    setEnergySource("kenya_grid");
    setValues({ period: new Date().toISOString().slice(0, 7) });
    setCdrInclusionStatus("PENDING_DECISION");
    setProxyUsed(false);
    setIsSaving(false);
  };

  const payload = (): CreateEmissionActivityRequest | null => {
    const projectId = get("projectId");
    const activity = get("activity").trim();
    const period = get("period").trim();
    if (!projectId || !activity || !period) {
      toast.error("Choose a project and enter an activity and period.");
      return null;
    }

    const numeric = (field: string, label: string, required = false): number | undefined => {
      const raw = get(field).trim();
      if (!raw) {
        if (required) throw new Error(`${label} is required.`);
        return undefined;
      }
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`${label} must be a non-negative number.`);
      }
      return value;
    };

    try {
      const common = {
        projectId,
        category,
        activity,
        period,
      };
      if (category === "transport") {
        const materialReceived = numeric("materialMassReceivedKg", "Material mass received", true);
        const batchConsumed = numeric(
          "batchMaterialMassConsumedKg",
          "Batch material consumed",
          true,
        );
        if (materialReceived === 0)
          throw new Error("Material mass received must be greater than zero.");
        if (
          batchConsumed !== undefined &&
          materialReceived !== undefined &&
          batchConsumed > materialReceived
        ) {
          throw new Error("Batch material consumed cannot exceed material mass received.");
        }
        if (!get("batchReference").trim())
          throw new Error("Enter the batch or material lot receiving this allocation.");
        if (!get("shipmentReference").trim())
          throw new Error("Enter the shipment reference to reconcile batch allocations.");
        const route = get("route").trim();
        if (!route) throw new Error("Enter the actual shipment route.");
        const factorSource = get("factorSource").trim();
        if (!factorSource) throw new Error("Enter the source of the transport emission factor.");
        const transport: CreateEmissionActivityRequest = {
          ...common,
          transportMethod,
          shipmentReference: get("shipmentReference").trim() || undefined,
          batchReference: get("batchReference").trim() || undefined,
          route: route || undefined,
          materialMassReceivedKg: materialReceived,
          batchMaterialMassConsumedKg: batchConsumed,
          factorSource,
          factorEvidence: get("factorEvidence").trim() || undefined,
          ukToKenyaProxyUsed: proxyUsed,
          cdrInclusionStatus,
        };
        transport.vehicleClass = get("vehicleClass").trim();
        transport.vehicleModelYear = numeric("vehicleModelYear", "Vehicle model year");
        transport.fuelType = get("fuelType").trim();
        transport.payloadCapacityKg = numeric("payloadCapacityKg", "Vehicle payload capacity");
        transport.capacityUtilizationPercent = numeric(
          "capacityUtilizationPercent",
          "Capacity utilization",
        );
        if (!transport.vehicleClass || !transport.fuelType) {
          throw new Error("Enter the actual vehicle class and fuel type.");
        }
        if (
          transport.capacityUtilizationPercent !== undefined &&
          transport.capacityUtilizationPercent > 100
        ) {
          throw new Error("Capacity utilization cannot exceed 100%.");
        }
        if (transportMethod === "fuel") {
          if (transport.fuelType.toLowerCase() !== "diesel") {
            throw new Error(
              "This fuel-based calculation uses diesel factors; enter Diesel as the trip fuel.",
            );
          }
          transport.fuelUsedLitres = numeric("fuelUsedLitres", "Fuel used", true);
          transport.dieselDirectEmissionFactor = numeric(
            "dieselDirectEmissionFactor",
            "Diesel direct EF",
            true,
          );
          transport.dieselWttEmissionFactor = numeric(
            "dieselWttEmissionFactor",
            "Diesel WTT EF",
            true,
          );
        } else {
          transport.shipmentLoadKg = numeric("shipmentLoadKg", "Actual shipment load", true);
          transport.distanceKm = numeric("distanceKm", "Distance travelled", true);
          transport.freightDirectEmissionFactor = numeric(
            "freightDirectEmissionFactor",
            "Freight direct EF",
            true,
          );
          transport.freightWttEmissionFactor = numeric(
            "freightWttEmissionFactor",
            "Freight WTT EF",
            true,
          );
        }
        return transport;
      }

      const energy: CreateEmissionActivityRequest = {
        ...common,
        energySource,
        site: get("site").trim() || (energySource === "kenya_grid" ? "Gen 3" : "Flamingo"),
        batchReference: get("batchReference").trim() || undefined,
        batchWindow: get("batchWindow").trim() || undefined,
        meterStartKwh: numeric("meterStartKwh", "Energy meter start"),
        meterEndKwh: numeric("meterEndKwh", "Energy meter end"),
      };
      if (!energy.batchReference)
        throw new Error("Enter the batch reference for this energy reading.");
      if (
        energy.meterStartKwh !== undefined &&
        energy.meterEndKwh !== undefined &&
        energy.meterEndKwh < energy.meterStartKwh
      ) {
        throw new Error("Energy meter end must be greater than or equal to the start reading.");
      }
      if (energySource === "kenya_grid") {
        energy.gridEmissionFactorKgPerKwh = numeric(
          "gridEmissionFactorKgPerKwh",
          "Kenya grid emission factor",
        );
      } else {
        if (!energy.batchWindow) {
          throw new Error("Enter the generator measurement period used for fuel and output data.");
        }
        energy.generatorDieselUsedLitres = numeric(
          "generatorDieselUsedLitres",
          "Generator diesel used",
        );
        energy.generatorElectricityProducedKwh = numeric(
          "generatorElectricityProducedKwh",
          "Generator electricity produced",
        );
        energy.dieselDirectEmissionFactor = numeric(
          "dieselDirectEmissionFactor",
          "Diesel direct EF",
        );
        energy.dieselWttEmissionFactor = numeric("dieselWttEmissionFactor", "Diesel WTT EF");
      }
      return energy;
    } catch (validationError) {
      toast.error(
        validationError instanceof Error ? validationError.message : "Check the entered values.",
      );
      return null;
    }
  };

  const previewEmissions = () => {
    const number = (field: string) => (get(field).trim() ? Number(get(field)) : undefined);
    if (category === "transport") {
      if (transportMethod === "fuel") {
        const litres = number("fuelUsedLitres");
        const direct = number("dieselDirectEmissionFactor");
        const wtt = number("dieselWttEmissionFactor");
        if (litres === undefined || direct === undefined || wtt === undefined) return null;
        const full = litres * (direct + wtt);
        return allocatePreview(
          full,
          number("batchMaterialMassConsumedKg"),
          number("materialMassReceivedKg"),
        );
      }
      const load = number("shipmentLoadKg");
      const distance = number("distanceKm");
      const direct = number("freightDirectEmissionFactor");
      const wtt = number("freightWttEmissionFactor");
      if (load === undefined || distance === undefined || direct === undefined || wtt === undefined)
        return null;
      const full = (load / 1000) * distance * (direct + wtt);
      return allocatePreview(
        full,
        number("batchMaterialMassConsumedKg"),
        number("materialMassReceivedKg"),
      );
    }

    const start = number("meterStartKwh");
    const end = number("meterEndKwh");
    if (start === undefined || end === undefined) return null;
    const batchKwh = end - start;
    if (batchKwh < 0) return null;
    if (energySource === "kenya_grid") {
      const factor = number("gridEmissionFactorKgPerKwh");
      return factor === undefined
        ? null
        : { emissions: batchKwh * factor, note: `${batchKwh} kWh × Kenya grid EF` };
    }
    const fuel = number("generatorDieselUsedLitres");
    const generated = number("generatorElectricityProducedKwh");
    const direct = number("dieselDirectEmissionFactor");
    const wtt = number("dieselWttEmissionFactor");
    if (!fuel || !generated || direct === undefined || wtt === undefined) return null;
    return {
      emissions: batchKwh * (fuel / generated) * (direct + wtt),
      note: `${batchKwh} kWh × generator fuel intensity × diesel direct + WTT EF`,
    };
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    const request = payload();
    if (!request) return;

    setIsSaving(true);
    try {
      const saved = await createEmissionActivity(request);
      onAdded(saved);
      reset();
      setOpen(false);
    } catch (saveError) {
      toast.error(
        saveError instanceof Error ? saveError.message : "Unable to save emission activity.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const preview = previewEmissions();
  const updateOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen && !isSaving) reset();
  };

  return (
    <Dialog open={open} onOpenChange={updateOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1 h-4 w-4" /> Add activity
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Log transport or energy activity</DialogTitle>
            <DialogDescription>
              Enter measured activity data and emission factors. The API calculates emissions and
              stores the source inputs.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Project">
                <Select value={get("projectId")} onValueChange={(value) => set("projectId", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.code} — {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Activity period">
                <Input
                  value={get("period")}
                  onChange={(event) => set("period", event.target.value)}
                  placeholder="YYYY-MM or YYYY-Qn"
                  required
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category">
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as "transport" | "energy")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transport">Transport</SelectItem>
                    <SelectItem value="energy">Energy</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Activity name">
                <Input
                  value={get("activity")}
                  onChange={(event) => set("activity", event.target.value)}
                  placeholder={
                    category === "transport"
                      ? "e.g. Feedstock shipment"
                      : "e.g. Batch energy — Gen 3"
                  }
                  required
                />
              </Field>
            </div>

            {category === "transport" ? (
              <TransportFields
                get={get}
                set={set}
                transportMethod={transportMethod}
                setTransportMethod={setTransportMethod}
                proxyUsed={proxyUsed}
                setProxyUsed={setProxyUsed}
              />
            ) : (
              <EnergyFields
                get={get}
                set={set}
                energySource={energySource}
                setEnergySource={setEnergySource}
              />
            )}

            {category === "transport" && (
              <AllocationFields
                get={get}
                set={set}
                cdrInclusionStatus={cdrInclusionStatus}
                setCdrInclusionStatus={setCdrInclusionStatus}
              />
            )}

            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="font-medium">Calculation preview</div>
              {preview ? (
                <div className="mt-1 text-muted-foreground">
                  {preview.note}:{" "}
                  <strong className="text-foreground">
                    {preview.emissions.toLocaleString(undefined, { maximumFractionDigits: 3 })}{" "}
                    kgCO₂e
                  </strong>
                </div>
              ) : category === "energy" ? (
                <div className="mt-1 text-muted-foreground">
                  Energy data pending until the meter readings and required source data are
                  available.
                </div>
              ) : (
                <div className="mt-1 text-muted-foreground">
                  Enter the calculation inputs to preview shipment and allocated emissions.
                </div>
              )}
              {category === "energy" && energySource === "flamingo_generator" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Generator emissions use diesel direct + WTT factors only; no grid factor is
                  substituted.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => updateOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || projects.length === 0}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-1 h-4 w-4" />
              )}
              Save activity
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function NumericField({
  label,
  field,
  get,
  set,
  required = false,
  step = "any",
}: {
  label: string;
  field: string;
  get: (field: string) => string;
  set: (field: string, value: string) => void;
  required?: boolean;
  step?: string;
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        min="0"
        step={step}
        value={get(field)}
        onChange={(event) => set(field, event.target.value)}
        required={required}
      />
    </Field>
  );
}

function TransportFields({
  get,
  set,
  transportMethod,
  setTransportMethod,
  proxyUsed,
  setProxyUsed,
}: {
  get: (field: string) => string;
  set: (field: string, value: string) => void;
  transportMethod: TransportMethod;
  setTransportMethod: (method: TransportMethod) => void;
  proxyUsed: boolean;
  setProxyUsed: (used: boolean) => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-semibold">Shipment transport</h3>
        <p className="text-xs text-muted-foreground">
          Fuel method: litres × (diesel direct EF + diesel WTT EF). Use distance method when trip
          fuel is unavailable.
        </p>
      </div>
      <Field label="Calculation method">
        <Select
          value={transportMethod}
          onValueChange={(value) => setTransportMethod(value as TransportMethod)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fuel">Fuel — trip fuel records available</SelectItem>
            <SelectItem value="distance">Distance — trip fuel unavailable</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Shipment reference">
          <Input
            value={get("shipmentReference")}
            onChange={(event) => set("shipmentReference", event.target.value)}
            placeholder="Delivery or shipment ID"
            required
          />
        </Field>
        <Field label="Route">
          <Input
            value={get("route")}
            onChange={(event) => set("route", event.target.value)}
            placeholder="Origin — destination"
            required
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Actual vehicle class">
          <Input
            value={get("vehicleClass")}
            onChange={(event) => set("vehicleClass", event.target.value)}
            placeholder="e.g. Heavy goods vehicle"
            required
          />
        </Field>
        <Field label="Vehicle model year (if available)">
          <Input
            type="number"
            min="1900"
            max="2100"
            value={get("vehicleModelYear")}
            onChange={(event) => set("vehicleModelYear", event.target.value)}
          />
        </Field>
        <Field label="Fuel type">
          <Input
            value={get("fuelType")}
            onChange={(event) => set("fuelType", event.target.value)}
            placeholder="e.g. Diesel"
            required
          />
        </Field>
        <NumericField
          label="Vehicle payload capacity (kg)"
          field="payloadCapacityKg"
          get={get}
          set={set}
        />
        <NumericField
          label="Capacity utilization (%)"
          field="capacityUtilizationPercent"
          get={get}
          set={set}
        />
      </div>

      {transportMethod === "fuel" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <NumericField
              label="Fuel used for actual trip (L)"
              field="fuelUsedLitres"
              get={get}
              set={set}
              required
            />
            <NumericField
              label="Diesel direct EF (kgCO₂e/L)"
              field="dieselDirectEmissionFactor"
              get={get}
              set={set}
              required
            />
            <NumericField
              label="Diesel upstream / WTT EF (kgCO₂e/L)"
              field="dieselWttEmissionFactor"
              get={get}
              set={set}
              required
            />
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumericField
              label="Actual shipment load (kg)"
              field="shipmentLoadKg"
              get={get}
              set={set}
              required
            />
            <NumericField
              label="Distance travelled (km, include relevant return movements)"
              field="distanceKm"
              get={get}
              set={set}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumericField
              label="Vehicle-matched freight direct EF (kgCO₂e/tonne-km)"
              field="freightDirectEmissionFactor"
              get={get}
              set={set}
              required
            />
            <NumericField
              label="Freight WTT EF (kgCO₂e/tonne-km)"
              field="freightWttEmissionFactor"
              get={get}
              set={set}
              required
            />
          </div>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Emission factor source">
          <Input
            value={get("factorSource")}
            onChange={(event) => set("factorSource", event.target.value)}
            placeholder="Dataset, publication or source ID"
            required
          />
        </Field>
        <Field label="Evidence / source reference">
          <Input
            value={get("factorEvidence")}
            onChange={(event) => set("factorEvidence", event.target.value)}
            placeholder="Document URL, page or evidence ID"
          />
        </Field>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={proxyUsed}
          onChange={(event) => setProxyUsed(event.target.checked)}
          className="mt-1"
        />
        <span>
          A UK-to-Kenya proxy factor is used
          <span className="block text-xs text-muted-foreground">
            Explain the proxy and its evidence in the source reference above.
          </span>
        </span>
      </label>
    </div>
  );
}

function AllocationFields({
  get,
  set,
  cdrInclusionStatus,
  setCdrInclusionStatus,
}: {
  get: (field: string) => string;
  set: (field: string, value: string) => void;
  cdrInclusionStatus: CdrInclusionStatus;
  setCdrInclusionStatus: (status: CdrInclusionStatus) => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-semibold">Batch allocation</h3>
        <p className="text-xs text-muted-foreground">
          Full shipment emissions are calculated first. Allocate by consumed mass ÷ material
          received; the remaining share stays unallocated.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Batch / material lot">
          <Input
            value={get("batchReference")}
            onChange={(event) => set("batchReference", event.target.value)}
            placeholder="Batch or lot reference"
            required
          />
        </Field>
        <NumericField
          label="Material mass received (kg)"
          field="materialMassReceivedKg"
          get={get}
          set={set}
          required
        />
        <NumericField
          label="Batch material mass consumed (kg)"
          field="batchMaterialMassConsumedKg"
          get={get}
          set={set}
          required
        />
      </div>
      <Field label="CDR inclusion treatment">
        <Select
          value={cdrInclusionStatus}
          onValueChange={(value) => setCdrInclusionStatus(value as CdrInclusionStatus)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="INCLUDED">Included</SelectItem>
            <SelectItem value="EXCLUDED_BY_BOUNDARY">Excluded by boundary</SelectItem>
            <SelectItem value="EXCLUDED_AFTER_MATERIALITY">
              Excluded after materiality assessment
            </SelectItem>
            <SelectItem value="PENDING_DECISION">Pending decision</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

function EnergyFields({
  get,
  set,
  energySource,
  setEnergySource,
}: {
  get: (field: string) => string;
  set: (field: string, value: string) => void;
  energySource: EnergySource;
  setEnergySource: (source: EnergySource) => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-semibold">Batch energy</h3>
        <p className="text-xs text-muted-foreground">
          Batch electricity is meter end minus meter start. Readings are taken from the live
          dashboard for the batch window.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Energy source">
          <Select
            value={energySource}
            onValueChange={(value) => setEnergySource(value as EnergySource)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kenya_grid">Gen 3 — Kenya grid</SelectItem>
              <SelectItem value="flamingo_generator">Flamingo — generator</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Site">
          <Input
            value={get("site")}
            onChange={(event) => set("site", event.target.value)}
            placeholder={energySource === "kenya_grid" ? "Gen 3" : "Flamingo"}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Batch reference">
          <Input
            value={get("batchReference")}
            onChange={(event) => set("batchReference", event.target.value)}
            placeholder="Batch ID or code"
            required
          />
        </Field>
        <Field label="Batch window">
          <Input
            value={get("batchWindow")}
            onChange={(event) => set("batchWindow", event.target.value)}
            placeholder="Start and end time or date range"
            required={energySource === "flamingo_generator"}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumericField
          label="Zen energy meter start (kWh)"
          field="meterStartKwh"
          get={get}
          set={set}
        />
        <NumericField label="Zen energy meter end (kWh)" field="meterEndKwh" get={get} set={set} />
      </div>
      {energySource === "kenya_grid" ? (
        <NumericField
          label="Applicable Kenya grid EF (kgCO₂e/kWh)"
          field="gridEmissionFactorKgPerKwh"
          get={get}
          set={set}
        />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Generator fuel intensity = period diesel ÷ period generator output. Both values must
            cover the same period.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumericField
              label="Generator diesel used during period (L)"
              field="generatorDieselUsedLitres"
              get={get}
              set={set}
            />
            <NumericField
              label="Generator electricity produced during period (kWh)"
              field="generatorElectricityProducedKwh"
              get={get}
              set={set}
            />
            <NumericField
              label="Diesel direct EF (kgCO₂e/L)"
              field="dieselDirectEmissionFactor"
              get={get}
              set={set}
            />
            <NumericField
              label="Diesel WTT EF (kgCO₂e/L)"
              field="dieselWttEmissionFactor"
              get={get}
              set={set}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Generator emissions remain pending until generator fuel and output data are present. A
            grid factor is never substituted for diesel.
          </p>
        </>
      )}
    </div>
  );
}

function allocatePreview(
  fullShipment: number,
  batchConsumed: number | undefined,
  massReceived: number | undefined,
) {
  if (batchConsumed === undefined || massReceived === undefined || massReceived === 0) {
    return {
      emissions: fullShipment,
      note: `Full shipment emissions (${fullShipment.toLocaleString(undefined, { maximumFractionDigits: 3 })} kgCO₂e); no batch allocation yet`,
    };
  }
  const allocated = fullShipment * (batchConsumed / massReceived);
  return {
    emissions: allocated,
    note: `Allocated batch emissions; full shipment ${fullShipment.toLocaleString(undefined, { maximumFractionDigits: 3 })} kgCO₂e, unallocated ${(fullShipment - allocated).toLocaleString(undefined, { maximumFractionDigits: 3 })} kgCO₂e`,
  };
}
