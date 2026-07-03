import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ShieldCheck, UserPlus, UserX, UserCheck } from "lucide-react";
import { useAuth, ROLE_LABELS, type Role } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
};

const INITIAL_USERS: ManagedUser[] = [
  { id: "u_1", name: "Amara Njoroge", email: "amara@zencarbon.io", role: "admin", active: true },
  { id: "u_2", name: "Joseph Mwangi", email: "joseph@zencarbon.io", role: "dept_ic", active: true },
  { id: "u_3", name: "Lilian Otieno", email: "lilian@zencarbon.io", role: "dept_mechanical", active: true },
  { id: "u_4", name: "Sarah Kariuki", email: "sarah@zencarbon.io", role: "dept_chemical", active: true },
  { id: "u_5", name: "Nadia Achieng", email: "nadia@zencarbon.io", role: "dept_mrv", active: true },
  { id: "u_6", name: "Tom Wafula", email: "tom@zencarbon.io", role: "dept_admin", active: true },
  { id: "u_7", name: "Peter Kimani", email: "peter@zencarbon.io", role: "inventory_manager", active: true },
  { id: "u_8", name: "Grace Muthoni", email: "grace@zencarbon.io", role: "project_manager", active: true },
  { id: "u_9", name: "Daniel Osei", email: "daniel@zencarbon.io", role: "lab_technician", active: true },
  { id: "u_10", name: "Mary Njeri", email: "mary@zencarbon.io", role: "auditor", active: false },
];

function ProfilePage() {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";
  return (
    <AppShell title="Profile & Settings">
      <div className="max-w-3xl space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Profile & settings</h2>
          <p className="text-sm text-muted-foreground">Manage your personal information and preferences.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Personal info</CardTitle>
            <CardDescription>Only you and administrators can see this.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" defaultValue={user.name} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" defaultValue={user.email} />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <div><Badge>{ROLE_LABELS[user.role]}</Badge></div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" placeholder="+254…" />
              </div>
            </div>
            <Button>Save changes</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Choose what you want to be notified about.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow label="Evidence verification updates" defaultChecked />
            <ToggleRow label="New lab results on my projects" defaultChecked />
            <ToggleRow label="Inventory low-stock alerts" />
            <ToggleRow label="Weekly emissions digest" defaultChecked />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Password and session preferences.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="outline">Change password</Button>
            <Button variant="outline">Sign out of all sessions</Button>
          </CardContent>
        </Card>

        {isAdmin && <UserManagementCard />}
      </div>
    </AppShell>
  );
}

function ToggleRow({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <span className="text-sm">{label}</span>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}

function UserManagementCard() {
  const [users, setUsers] = useState<ManagedUser[]>(INITIAL_USERS);

  const updateRole = (id: string, role: Role) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
    toast.success("Role updated");
  };

  const toggleActive = (id: string) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, active: !u.active } : u)));
  };

  const addUser = (u: Omit<ManagedUser, "id" | "active">) => {
    setUsers((prev) => [{ ...u, id: `u_${Date.now()}`, active: true }, ...prev]);
    toast.success("User invited");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> User management
          </CardTitle>
          <CardDescription>Admin only — assign roles, review access, deactivate accounts.</CardDescription>
        </div>
        <AddUserDialog onAdd={addUser} />
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} className={u.active ? "" : "opacity-60"}>
                <TableCell>
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </TableCell>
                <TableCell>
                  <Select value={u.role} onValueChange={(v) => updateRole(u.id, v as Role)} disabled={!u.active}>
                    <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                        <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {u.active ? (
                    <Badge variant="secondary">Active</Badge>
                  ) : (
                    <Badge variant="destructive">Deactivated</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {u.active ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="text-destructive">
                          <UserX className="h-4 w-4 mr-1" /> Deactivate
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Deactivate {u.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            They will lose access immediately. You can reactivate them later.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => { toggleActive(u.id); toast.success("Account deactivated"); }}>
                            Deactivate
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => { toggleActive(u.id); toast.success("Account reactivated"); }}>
                      <UserCheck className="h-4 w-4 mr-1" /> Reactivate
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AddUserDialog({ onAdd }: { onAdd: (u: Omit<ManagedUser, "id" | "active">) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("viewer");

  const submit = () => {
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    onAdd({ name: name.trim(), email: email.trim(), role });
    setName(""); setEmail(""); setRole("viewer");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><UserPlus className="h-4 w-4 mr-1" /> Invite user</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a new user</DialogTitle>
          <DialogDescription>They will receive an email invitation to join Zen Carbon.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="grid gap-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@zencarbon.io" />
          </div>
          <div className="grid gap-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit}>Send invite</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}