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
  SidebarRail,
  SidebarTrigger,
  useSidebar,
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

function NavItem({
  to,
  label,
  icon: Icon,
  isActive,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
}) {
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
        <Link
          to={to}
          className="flex items-center gap-2"
          onClick={() => {
            if (isMobile) setOpenMobile(false);
          }}
        >
          <Icon className="h-4 w-4" />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function SidebarUserFooter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <SidebarFooter>
      <div className="px-2 py-3">
        <div className={`flex items-center gap-3 mb-3 ${collapsed ? "justify-center" : ""}`}>
          <Avatar className="h-9 w-9 border border-sidebar-border shrink-0">
            <AvatarImage
              src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}&backgroundColor=3b82f6`}
              alt={user.name}
            />
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className={`min-w-0 flex-1 leading-tight ${collapsed ? "hidden" : ""}`}>
            <div className="truncate text-sm font-medium text-sidebar-foreground">{user.name}</div>
            <div className="truncate text-xs text-sidebar-foreground/70">{user.email}</div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className={`gap-2 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive ${collapsed ? "w-9 justify-center px-0" : "w-full justify-start"}`}
          onClick={() => {
            window.localStorage.removeItem("zc_user");
            navigate({ to: "/" });
          }}
          title="Log out"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Log out</span>}
        </Button>
      </div>
    </SidebarFooter>
  );
}

export function AppShell({ children, title }: { children: ReactNode; title: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
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
                    <NavItem
                      key={item.to}
                      to={item.to}
                      label={item.label}
                      icon={item.icon}
                      isActive={isActive(item.to)}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarRail />
          <SidebarUserFooter />
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
