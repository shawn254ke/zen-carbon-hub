import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderKanban,
  FileCheck2,
  Boxes,
  FlaskConical,
  Gauge,
  UserCircle2,
  Leaf,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { ROLE_LABELS, useAuth, type Role } from "@/lib/auth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/evidence", label: "Evidence Repository", icon: FileCheck2 },
  { to: "/verification", label: "Verification Readiness", icon: ShieldCheck },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/lab-results", label: "Lab Results", icon: FlaskConical },
  { to: "/emissions", label: "Emissions Activities", icon: Gauge },
  { to: "/profile", label: "Profile & Settings", icon: UserCircle2 },
] as const;

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

export function AppShell({ children, title }: { children: ReactNode; title: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user, setRole } = useAuth();

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <div className="flex items-center gap-2 px-2 py-2">
              <div className="h-8 w-8 rounded-md bg-sidebar-primary flex items-center justify-center">
                <Leaf className="h-4 w-4 text-sidebar-primary-foreground" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-sidebar-foreground">Zen Carbon</div>
                <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
                  DMRV · Inventory
                </div>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Workspace</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={isActive(item.to)}>
                        <Link to={item.to} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <div className="px-2 py-2 text-xs text-sidebar-foreground/70">
              Signed in as
              <div className="text-sidebar-foreground font-medium">{user.name}</div>
              <div className="truncate">{user.email}</div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b bg-card px-4">
            <SidebarTrigger />
            <h1 className="text-base font-semibold text-foreground">{title}</h1>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-muted-foreground hidden sm:inline">Preview as</span>
              <Select value={user.role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger className="h-9 w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}