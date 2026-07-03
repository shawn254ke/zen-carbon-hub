import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth, ROLE_LABELS, type Role } from "@/lib/auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import logoAsset from "@/assets/zen-logo.png.asset.json";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const ROLE_OPTIONS: Role[] = [
  "admin",
  "project_manager",
  "inventory_manager",
  "auditor",
  "lab_technician",
  "dept_ic",
  "dept_mechanical",
  "dept_chemical",
  "dept_mrv",
  "dept_admin",
  "viewer",
];

function LoginPage() {
  const navigate = useNavigate();
  const { setRole } = useAuth();
  const [email, setEmail] = useState("amara@zencarbon.io");
  const [password, setPassword] = useState("");
  const [role, setLocalRole] = useState<Role>("admin");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    const name = email
      .split("@")[0]
      .split(/[._-]/)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");
    const user = { id: `u_${Date.now()}`, name: name || "Zen User", email, role };
    window.localStorage.setItem("zc_user", JSON.stringify(user));
    setRole(role);
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <img src={logoAsset.url} alt="Zen Carbon" className="h-20 w-20 object-contain" />
          <h1 className="mt-3 text-xl font-semibold tracking-tight">Zen Carbon</h1>
          <p className="text-xs text-muted-foreground">DMRV & Inventory Platform</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Access your workspace to manage projects, evidence and inventory.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@zencarbon.io" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="space-y-1.5">
                <Label>Sign in as</Label>
                <Select value={role} onValueChange={(v) => setLocalRole(v as Role)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button type="submit" className="w-full">Sign in</Button>
              <p className="text-[11px] text-center text-muted-foreground">
                Demo login — any email and password will work.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}