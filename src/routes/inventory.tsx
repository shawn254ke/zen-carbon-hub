import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Pencil, Plus } from "lucide-react";
import { INVENTORY } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/inventory")({
  component: InventoryPage,
});

function InventoryPage() {
  const { can } = useAuth();
  const editable = can("inventory:edit");
  return (
    <AppShell title="Inventory">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Inventory</h2>
            <p className="text-sm text-muted-foreground">Feedstock, spares, consumables and reagents.</p>
          </div>
          {editable && (
            <Button><Plus className="h-4 w-4 mr-1" /> Add item</Button>
          )}
        </div>

        {!editable && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Read-only</AlertTitle>
            <AlertDescription>Only the Inventory Manager can edit inventory records.</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Stock levels</CardTitle>
            <CardDescription>Items at or below their reorder level are flagged.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>SKU</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Location</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead>Status</TableHead>
                {editable && <TableHead className="text-right">Actions</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {INVENTORY.map((i) => {
                  const low = i.quantity <= i.reorderLevel;
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="font-mono text-xs">{i.sku}</TableCell>
                      <TableCell className="font-medium">{i.name}</TableCell>
                      <TableCell className="capitalize">{i.category.replace("_", " ")}</TableCell>
                      <TableCell>{i.location}</TableCell>
                      <TableCell className="text-right">{i.quantity.toLocaleString()} {i.unit}</TableCell>
                      <TableCell>{low ? <Badge variant="destructive">Low</Badge> : <Badge variant="secondary">OK</Badge>}</TableCell>
                      {editable && (
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline"><Pencil className="h-3 w-3 mr-1" /> Edit</Button>
                        </TableCell>
                      )}
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