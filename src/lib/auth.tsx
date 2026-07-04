import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Role =
  | "admin"
  | "inventory_manager"
  | "project_manager"
  | "auditor"
  | "lab_technician"
  | "viewer"
  | "client"
  | "dept_ic"
  | "dept_mechanical"
  | "dept_chemical"
  | "dept_mrv"
  | "dept_admin";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  inventory_manager: "Inventory Manager",
  project_manager: "Project Manager",
  auditor: "Auditor",
  lab_technician: "Lab Technician",
  viewer: "Viewer",
  client: "Client",
  dept_ic: "Instrumentation & Control",
  dept_mechanical: "Mechanical Dept.",
  dept_chemical: "Chemical Dept.",
  dept_mrv: "MRV Dept.",
  dept_admin: "Administration Dept.",
};

export type User = { id: string; name: string; email: string; role: Role };

const DEFAULT_USER: User = {
  id: "u_1",
  name: "Amara Njoroge",
  email: "amara@zencarbon.io",
  role: "admin",
};

type AuthCtx = {
  user: User;
  setRole: (r: Role) => void;
  can: (perm: Permission) => boolean;
};

export type Permission =
  | "inventory:edit"
  | "projects:edit"
  | "projects:create"
  | "evidence:upload"
  | "evidence:verify"
  | "lab:upload"
  | "verification:manage"
  | "admin:all";

const PERMS: Record<Role, Permission[]> = {
  admin: ["inventory:edit", "projects:edit", "projects:create", "evidence:upload", "evidence:verify", "lab:upload", "verification:manage", "admin:all"],
  inventory_manager: ["inventory:edit"],
  project_manager: ["projects:edit", "evidence:upload"],
  auditor: ["evidence:verify"],
  lab_technician: ["lab:upload"],
  viewer: [],
  client: [],
  dept_ic: ["evidence:upload"],
  dept_mechanical: ["evidence:upload"],
  dept_chemical: ["evidence:upload"],
  dept_mrv: ["evidence:upload", "evidence:verify", "verification:manage", "projects:create"],
  dept_admin: ["evidence:upload"],
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(DEFAULT_USER);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem("zc_user") : null;
    if (raw) {
      try {
        setUser(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    }
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      setRole: (role) => {
        const next = { ...user, role };
        setUser(next);
        window.localStorage.setItem("zc_user", JSON.stringify(next));
      },
      can: (perm) => PERMS[user.role].includes(perm) || PERMS[user.role].includes("admin:all"),
    }),
    [user],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}