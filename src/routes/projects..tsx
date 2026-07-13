
function ProjectSettingsDialog({ pathway, onSave }: { pathway: Pathway; onSave: (p: Pathway) => void }) {
  const [p, setP] = useState<Pathway>(pathway);
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Project settings</DialogTitle>
        <DialogDescription>Choose the mineralisation pathway used by this project. This controls which batch data is captured.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <Label>Pathway</Label>
        <RadioGroup value={p} onValueChange={(v) => setP(v as Pathway)} className="space-y-2">
          <div className="flex items-start gap-2 rounded-md border p-3">
            <RadioGroupItem value="liquid_co2" id="pw-liquid" className="mt-0.5" />
            <div>
              <Label htmlFor="pw-liquid" className="font-medium">Liquid CO₂</Label>
              <p className="text-xs text-muted-foreground">Records amount of CO₂ injected and timestamp per event.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-md border p-3">
            <RadioGroupItem value="carbonated_water" id="pw-water" className="mt-0.5" />
            <div>
              <Label htmlFor="pw-water" className="font-medium">Carbonated water</Label>
              <p className="text-xs text-muted-foreground">Records water use, pH, dissolved CO₂, temperature, pressure, flow rate and energy.</p>
            </div>
          </div>
        </RadioGroup>
      </div>
      <DialogFooter>
        <Button onClick={() => onSave(p)}>Save settings</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function BatchDataPanel({
  pathway, entries, canEdit, onAdd,
}: {
  pathway: Pathway;
  entries: BatchDataEntry[];
  canEdit: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Batch data · {pathway === "liquid_co2" ? "Liquid CO₂" : "Carbonated water"}
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add entry
          </Button>
        )}
      </div>
      <div className="rounded-md border bg-background overflow-x-auto">
        {pathway === "liquid_co2" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">CO₂ injected (g)</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 && (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground text-xs">No entries yet.</TableCell></TableRow>
              )}
              {(entries as LiquidCo2Entry[]).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-right">{e.co2InjectedG}</TableCell>
                  <TableCell>{e.timestamp}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">Water used</TableHead>
                <TableHead className="text-right">Initial pH</TableHead>
                <TableHead className="text-right">Final pH</TableHead>
                <TableHead className="text-right">Initial dCO₂</TableHead>
                <TableHead className="text-right">Final dCO₂</TableHead>
                <TableHead className="text-right">Initial T</TableHead>
                <TableHead className="text-right">Final T</TableHead>
                <TableHead className="text-right">Initial P</TableHead>
                <TableHead className="text-right">Final P</TableHead>
                <TableHead className="text-right">Initial flow</TableHead>
                <TableHead className="text-right">Final flow</TableHead>
                <TableHead className="text-right">Energy</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 && (
                <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground text-xs">No entries yet.</TableCell></TableRow>
              )}
              {(entries as CarbonatedWaterEntry[]).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-right">{e.waterUsed}</TableCell>
                  <TableCell className="text-right">{e.initialPh}</TableCell>
                  <TableCell className="text-right">{e.finalPh}</TableCell>
                  <TableCell className="text-right">{e.initialDissolvedCo2}</TableCell>
                  <TableCell className="text-right">{e.finalDissolvedCo2}</TableCell>
                  <TableCell className="text-right">{e.initialTemp}</TableCell>
                  <TableCell className="text-right">{e.finalTemp}</TableCell>
                  <TableCell className="text-right">{e.initialPressure}</TableCell>
                  <TableCell className="text-right">{e.finalPressure}</TableCell>
                  <TableCell className="text-right">{e.initialFlowRate}</TableCell>
                  <TableCell className="text-right">{e.finalFlowRate}</TableCell>
                  <TableCell className="text-right">{e.energyUsed}</TableCell>
                  <TableCell>{e.timestamp}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function AddBatchDataDialog({ pathway, onAdd }: { pathway: Pathway; onAdd: (e: BatchDataEntry) => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [ts, setTs] = useState(new Date().toISOString().slice(0, 16));
  const set = (k: string) => (v: string) => setValues((s) => ({ ...s, [k]: v }));
  const n = (k: string) => Number(values[k] ?? "");

  const submit = () => {
    if (pathway === "liquid_co2") {
      if (!values.co2InjectedG) { toast.error("Enter CO₂ injected"); return; }
      onAdd({ id: `e_${Date.now()}`, co2InjectedG: n("co2InjectedG"), timestamp: ts });
    } else {
      const required = ["waterUsed","initialPh","finalPh","initialDissolvedCo2","finalDissolvedCo2","initialTemp","finalTemp","initialPressure","finalPressure","initialFlowRate","finalFlowRate","energyUsed"];
      for (const k of required) {
        if (values[k] === undefined || values[k] === "") { toast.error("Fill all fields"); return; }
      }
      onAdd({
        id: `e_${Date.now()}`,
        waterUsed: n("waterUsed"),
        initialPh: n("initialPh"),
        finalPh: n("finalPh"),
        initialDissolvedCo2: n("initialDissolvedCo2"),
        finalDissolvedCo2: n("finalDissolvedCo2"),
        initialTemp: n("initialTemp"),
        finalTemp: n("finalTemp"),
        initialPressure: n("initialPressure"),
        finalPressure: n("finalPressure"),
        initialFlowRate: n("initialFlowRate"),
        finalFlowRate: n("finalFlowRate"),
        energyUsed: n("energyUsed"),
        timestamp: ts,
      });
    }
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Add batch data entry</DialogTitle>
        <DialogDescription>{pathway === "liquid_co2" ? "Liquid CO₂ pathway" : "Carbonated water pathway"}</DialogDescription>
      </DialogHeader>
      {pathway === "liquid_co2" ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="CO₂ injected (g)" type="number" value={values.co2InjectedG ?? ""} onChange={set("co2InjectedG")} />
          <Field label="Timestamp" type="datetime-local" value={ts} onChange={setTs} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
          <Field label="Water used" type="number" value={values.waterUsed ?? ""} onChange={set("waterUsed")} />
          <Field label="Initial pH" type="number" value={values.initialPh ?? ""} onChange={set("initialPh")} />
          <Field label="Final pH" type="number" value={values.finalPh ?? ""} onChange={set("finalPh")} />
          <Field label="Initial dissolved CO₂" type="number" value={values.initialDissolvedCo2 ?? ""} onChange={set("initialDissolvedCo2")} />
          <Field label="Final dissolved CO₂" type="number" value={values.finalDissolvedCo2 ?? ""} onChange={set("finalDissolvedCo2")} />
          <Field label="Initial temperature" type="number" value={values.initialTemp ?? ""} onChange={set("initialTemp")} />
          <Field label="Final temperature" type="number" value={values.finalTemp ?? ""} onChange={set("finalTemp")} />
          <Field label="Initial pressure" type="number" value={values.initialPressure ?? ""} onChange={set("initialPressure")} />
          <Field label="Final pressure" type="number" value={values.finalPressure ?? ""} onChange={set("finalPressure")} />
          <Field label="Initial flow rate" type="number" value={values.initialFlowRate ?? ""} onChange={set("initialFlowRate")} />
          <Field label="Final flow rate" type="number" value={values.finalFlowRate ?? ""} onChange={set("finalFlowRate")} />
          <Field label="Energy used" type="number" value={values.energyUsed ?? ""} onChange={set("energyUsed")} />
          <Field label="Timestamp" type="datetime-local" value={ts} onChange={setTs} />
        </div>
      )}
      <DialogFooter>
        <Button onClick={submit}>Add entry</Button>
      </DialogFooter>
    </DialogContent>
  );
}
