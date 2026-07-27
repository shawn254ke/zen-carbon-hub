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

type AuthCtx = {
  user: User;
  token: string | null;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  login: (credentials: { email: string; password: string }) => Promise<User>;
  logout: () => void;
  setRole: (r: Role) => void;
  updateProfile: (nextValues: Partial<Pick<User, "name" | "email">>) => void;
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

const STORAGE_USER_KEY = "zc_user";
const STORAGE_TOKEN_KEY = "zc_token";
const AUTH_EXPIRED_EVENT = "zc:auth-expired";

const DEFAULT_USER: User = {
  id: "guest",
  name: "Guest User",
  email: "",
  role: "viewer",
};

type LoginApiUser = {
  id?: string | number | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
};

type LoginApiResponse = {
  token?: string | null;
  accessToken?: string | null;
  user?: LoginApiUser | null;
  message?: string | null;
};

function parseJwtExpiry(token: string): number | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = JSON.parse(window.atob(padded)) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string) {
  const expiry = parseJwtExpiry(token);
  if (!expiry) return false;
  return expiry * 1000 <= Date.now();
}

function getStoredSession() {
  if (typeof window === "undefined") {
    return { user: DEFAULT_USER, token: null, isAuthenticated: false };
  }

  const rawUser = window.localStorage.getItem(STORAGE_USER_KEY);
  const token = window.localStorage.getItem(STORAGE_TOKEN_KEY);

  if (!rawUser || !token) {
    return { user: DEFAULT_USER, token: null, isAuthenticated: false };
  }

  if (isTokenExpired(token)) {
    clearSession();
    return { user: DEFAULT_USER, token: null, isAuthenticated: false };
  }

  try {
    return { user: JSON.parse(rawUser) as User, token, isAuthenticated: true };
  } catch {
    return { user: DEFAULT_USER, token: null, isAuthenticated: false };
  }
}

function persistSession(user: User, token: string | null) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
  if (token) {
    window.localStorage.setItem(STORAGE_TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(STORAGE_TOKEN_KEY);
  }
}

function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_USER_KEY);
  window.localStorage.removeItem(STORAGE_TOKEN_KEY);
}

function broadcastAuthExpired() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}

export function expireSession() {
  clearSession();
  broadcastAuthExpired();
}

function normalizeRole(rawRole: string | null | undefined): Role {
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
      if (typeof rawRole === "string") {
        const fallback = rawRole.trim().toLowerCase();
        if (fallback === "inventory_manager") return "inventory_manager";
        if (fallback === "project_manager") return "project_manager";
        if (fallback === "lab_technician") return "lab_technician";
        if (fallback === "dept_ic") return "dept_ic";
        if (fallback === "dept_mechanical") return "dept_mechanical";
        if (fallback === "dept_chemical") return "dept_chemical";
        if (fallback === "dept_mrv") return "dept_mrv";
        if (fallback === "dept_admin") return "dept_admin";
      }
      return "viewer";
  }
}

function buildUserFromApi(payload: LoginApiResponse, fallbackEmail = ""): User {
  const apiUser = payload.user ?? {};
  const fullName = [apiUser.firstName, apiUser.lastName].filter(Boolean).join(" ").trim();
  const email = (apiUser.email || fallbackEmail).trim();

  return {
    id: String(apiUser.id ?? `u_${Date.now()}`),
    name: fullName || apiUser.name || email.split("@")[0] || "Zen User",
    email,
    role: normalizeRole(apiUser.role ?? payload.user?.role ?? undefined),
  };
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(DEFAULT_USER);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);

  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(DEFAULT_USER);
      setToken(null);
      setIsAuthenticated(false);
      setIsAuthReady(true);
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);

    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    };
  }, []);

  useEffect(() => {
    const stored = getStoredSession();
    if (stored.user && stored.token) {
      setUser(stored.user);
      setToken(stored.token);
      setIsAuthenticated(true);
    } else {
      setUser(DEFAULT_USER);
      setToken(null);
      setIsAuthenticated(false);
    }
    setIsAuthReady(true);
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    const email = credentials.email.trim();
    const password = credentials.password;

    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    const candidates = [
      import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")}/auth/login` : "/api/auth/login",
      "/auth/login",
      "/login",
    ];

    let lastError: Error | null = null;

    for (const endpoint of candidates) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = (await response.json().catch(() => null)) as LoginApiResponse | null;
        const authToken = data?.token ?? data?.accessToken ?? null;

        if (response.ok && authToken) {
          const nextUser = buildUserFromApi(data ?? {}, email);
          setUser(nextUser);
          setToken(authToken);
          setIsAuthenticated(true);
          persistSession(nextUser, authToken);
          return nextUser;
        }

        if (data?.message) {
          lastError = new Error(data.message);
        } else if (response.status === 401) {
          lastError = new Error("Invalid credentials");
        } else if (response.status === 403) {
          lastError = new Error("User account is not active");
        } else if (response.status >= 400) {
          lastError = new Error("Unable to sign in right now.");
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unable to sign in right now.");
      }
    }

    throw lastError ?? new Error("Unable to sign in right now.");
  };

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      token,
      isAuthenticated,
      isAuthReady,
      login,
      logout: () => {
        expireSession();
      },
      setRole: (role) => {
        const next = { ...user, role };
        setUser(next);
        persistSession(next, token);
      },
      updateProfile: (nextValues) => {
        const next = {
          ...user,
          ...(nextValues.name != null ? { name: nextValues.name } : {}),
          ...(nextValues.email != null ? { email: nextValues.email } : {}),
        };
        setUser(next);
        persistSession(next, token);
      },
      can: (perm) => PERMS[user.role].includes(perm) || PERMS[user.role].includes("admin:all"),
    }),
    [isAuthReady, isAuthenticated, token, user],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
export { getStoredSession };