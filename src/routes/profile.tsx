import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { ShieldCheck, UserPlus, UserX } from "lucide-react";
import { useAuth, ROLE_LABELS, type Role } from "@/lib/auth";
import { createUserInviteApi, deactivateUserApi, getUsersApi, updateUserApi, type ApiUserRecord } from "@/lib/users-api";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

type ManagedUser = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone?: string;
  status?: string;
  role: Role;
  roleId?: number;
  active: boolean;
};

const API_ROLE_BY_UI_ROLE: Record<Role, string> = {
  admin: "ADMIN",
  inventory_manager: "INVENTORY_MANAGER",
  project_manager: "PROJECT_MANAGER",
  auditor: "AUDITOR",
  lab_technician: "LAB_TECHNICIAN",
  viewer: "VIEWER",
  client: "client",
  dept_ic: "DEPT_IC",
  dept_mechanical: "DEPT_MECHANICAL",
  dept_chemical: "DEPT_CHEMICAL",
  dept_mrv: "DEPT_MRV",
  dept_admin: "DEPT_ADMIN",
};

const ADMIN_MANAGED_ROLES: Role[] = [
  "admin",
  "dept_ic",
  "dept_mrv",
  "dept_mechanical",
  "dept_chemical",
  "client",
];

const SEEDED_ROLE_IDS: Partial<Record<Role, number>> = {
  admin: 1,
  dept_ic: 2,
  dept_mrv: 3,
  dept_mechanical: 4,
  dept_chemical: 5,
  client: 6,
};

function splitFullName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function normalizeRoleFromApi(rawRole: string | null | undefined): Role {
  const normalized = (rawRole || "").trim().toUpperCase().replace(/^ROLE_/, "");

  switch (normalized) {
    case "ADMIN":
      return "admin";
    case "INVENTORY_MANAGER":
      return "inventory_manager";
    case "PROJECT_MANAGER":
      return "project_manager";
    case "AUDITOR":
      return "auditor";
    case "LAB_TECHNICIAN":
      return "lab_technician";
    case "VIEWER":
      return "viewer";
    case "CLIENT":
      return "client";
    case "DEPT_IC":
      return "dept_ic";
    case "DEPT_MECHANICAL":
      return "dept_mechanical";
    case "DEPT_CHEMICAL":
      return "dept_chemical";
    case "DEPT_MRV":
      return "dept_mrv";
    case "DEPT_ADMIN":
      return "dept_admin";
    default:
      return "viewer";
  }
}

function mapApiUserToManagedUser(record: ApiUserRecord): ManagedUser {
  const firstName = record.firstName?.trim() ?? "";
  const lastName = record.lastName?.trim() ?? "";
  const fallbackName = (record.email || "").split("@")[0] || "Unknown user";
  const name = [firstName, lastName].filter(Boolean).join(" ").trim() || fallbackName;
  const status = record.status?.toUpperCase() ?? "ACTIVE";
  return {
    id: String(record.id),
    firstName,
    lastName,
    name,
    email: record.email?.trim() ?? "",
    phone: record.phone?.trim() || undefined,
    status,
    role: normalizeRoleFromApi(record.role),
    roleId: typeof record.roleId === "number" ? record.roleId : undefined,
    active: status !== "DEACTIVATED",
  };
}

function ProfilePage() {
  const { user, token, updateProfile } = useAuth();
  const isAdmin = user.role === "admin";
  const [fullName, setFullName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    setFullName(user.name);
    setEmail(user.email);
  }, [user.email, user.name]);

  const saveProfile = async () => {
    const normalizedName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedName || !normalizedEmail) {
      toast.error("Name and email are required");
      return;
    }

    const { firstName, lastName } = splitFullName(normalizedName);

    setIsSavingProfile(true);
    try {
      await updateUserApi(user.id, {
        firstName,
        lastName,
        email: normalizedEmail,
        phone: phone.trim() || undefined,
      }, token);

      updateProfile({ name: normalizedName, email: normalizedEmail });
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const savePassword = async () => {
    if (!newPassword) {
      toast.error("Enter a new password");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    const normalizedName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedName || !normalizedEmail) {
      toast.error("Name and email are required before changing password");
      return;
    }
    const { firstName, lastName } = splitFullName(normalizedName);

    setIsSavingPassword(true);
    try {
      await updateUserApi(user.id, {
        firstName,
        lastName,
        email: normalizedEmail,
        phone: phone.trim() || undefined,
        password: newPassword,
      }, token);
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update password");
    } finally {
      setIsSavingPassword(false);
    }
  };

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
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <div><Badge>{ROLE_LABELS[user.role]}</Badge></div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254..." />
              </div>
            </div>
            <Button onClick={saveProfile} disabled={isSavingProfile}>
              {isSavingProfile ? "Saving..." : "Save changes"}
            </Button>
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
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={savePassword} disabled={isSavingPassword}>
                {isSavingPassword ? "Updating password..." : "Update password"}
              </Button>
            <Button variant="outline">Sign out of all sessions</Button>
            </div>
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
  const { token } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [roleUpdateInFlightId, setRoleUpdateInFlightId] = useState<string | null>(null);
  const [deactivateInFlightId, setDeactivateInFlightId] = useState<string | null>(null);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const records = await getUsersApi(token);
      setUsers(records.map(mapApiUserToManagedUser));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load users");
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const roleIdByUiRole = users.reduce<Partial<Record<Role, number>>>((acc, user) => {
    if (typeof user.roleId === "number" && acc[user.role] == null) {
      acc[user.role] = user.roleId;
    }
    return acc;
  }, { ...SEEDED_ROLE_IDS });

  const updateRole = async (targetUser: ManagedUser, role: Role) => {
    if (targetUser.role === role) return;

    const roleId = roleIdByUiRole[role];
    if (roleId == null) {
      toast.error("Role id not available from backend data. Assign this role to one user first, then retry.");
      return;
    }

    setRoleUpdateInFlightId(targetUser.id);
    try {
      await updateUserApi(
        targetUser.id,
        {
          firstName: targetUser.firstName,
          lastName: targetUser.lastName,
          email: targetUser.email,
          phone: targetUser.phone,
          status: targetUser.status,
          roleId,
        },
        token,
      );

      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, role, roleId } : u)));
      toast.success("Role updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update role");
    } finally {
      setRoleUpdateInFlightId(null);
    }
  };

  const deactivate = async (targetUser: ManagedUser) => {
    setDeactivateInFlightId(targetUser.id);
    try {
      await deactivateUserApi(targetUser.id, token);
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, active: false, status: "DEACTIVATED" } : u)));
      toast.success("Account deactivated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to deactivate user");
    } finally {
      setDeactivateInFlightId(null);
    }
  };

  const addUser = async (u: { name: string; email: string; role: Role }) => {
    const { firstName, lastName } = splitFullName(u.name);
    if (!firstName || !lastName) {
      toast.error("Please provide both first and last name");
      return false;
    }

    setIsInviting(true);
    try {
      await createUserInviteApi(
        {
          firstName,
          lastName,
          email: u.email.trim().toLowerCase(),
          role: API_ROLE_BY_UI_ROLE[u.role],
        },
        token,
      );
      toast.success("User invited");
      await loadUsers();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to invite user");
      return false;
    } finally {
      setIsInviting(false);
    }
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
        <AddUserDialog onAdd={addUser} isSubmitting={isInviting} />
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoadingUsers ? (
          <div className="text-sm text-muted-foreground">Loading users...</div>
        ) : null}
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
                  <Select
                    value={u.role}
                    onValueChange={(v) => void updateRole(u, v as Role)}
                    disabled={!u.active || roleUpdateInFlightId === u.id}
                  >
                    <SelectTrigger className="w-55"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ADMIN_MANAGED_ROLES.map((r) => (
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
                  <div className="flex justify-end gap-2">
                    {u.active ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="text-destructive" disabled={deactivateInFlightId === u.id}>
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
                          <AlertDialogAction onClick={() => void deactivate(u)}>
                            Deactivate
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AddUserDialog({ onAdd, isSubmitting }: { onAdd: (u: { name: string; email: string; role: Role }) => Promise<boolean>; isSubmitting: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("client");

  const submit = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }

    const ok = await onAdd({ name: name.trim(), email: email.trim(), role });
    if (!ok) return;
    setName(""); setEmail(""); setRole("client");
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
                {ADMIN_MANAGED_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={isSubmitting}>{isSubmitting ? "Inviting..." : "Send invite"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}