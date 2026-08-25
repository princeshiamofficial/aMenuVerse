import { createFileRoute, useNavigate, Outlet, useLocation, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect, createContext, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LayoutDashboard,
  Store,
  CreditCard,
  DollarSign,
  Users,
  QrCode,
  BarChart3,
  LifeBuoy,
  Megaphone,
  ScrollText,
  Search,
  Plus,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Send,
  MoreHorizontal,
  LogOut,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { redirect } from "@tanstack/react-router";
import { getCurrentUser, signOutAction, getAdminRestaurantsServer } from "@/lib/db-queries.server";

import {
  AdminContext,
  useAdminContext,
  type Ticket,
  type Flag,
  type Announcement,
  type AdminContextType,
} from "@/lib/admin-context";

// -------- Parent Layout Route Definition --------
export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    let token: string | undefined;
    if (typeof window !== "undefined") {
      token = localStorage.getItem("menuverse_session") || undefined;
    }
    const user = await getCurrentUser({ data: { token } });
    if (!user) {
      throw redirect({ to: "/auth" });
    }

    const normalizedRole = (user.role || "").toLowerCase().trim().replace(/ /g, "_");
    const isSuperAdmin = normalizedRole === "super_admin";

    if (!isSuperAdmin) {
      throw redirect({ to: "/dashboard" });
    }

    return { user };
  },
  component: AdminLayoutComponent,
});

import {
  SidebarProvider,
  SidebarTrigger,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { CoolThemeToggle } from "@/components/menuverse/cool-theme-toggle";

function AdminSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  const signOut = async () => {
    await signOutAction();
    toast.success("Signed out from Admin Console");
    window.location.href = "/auth";
  };

  const menuItems = [
    { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/restaurants", label: "Restaurants", icon: Store },
    { to: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
    { to: "/admin/revenue", label: "Revenue", icon: DollarSign },
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/admin/qr", label: "QR Usage", icon: QrCode },
    { to: "/admin/seo", label: "SEO & Metadata", icon: Globe },
    { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/admin/support", label: "Support", icon: LifeBuoy },
    { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
    { to: "/admin/logs", label: "Logs", icon: ScrollText },
  ];

  return (
    <Sidebar
      collapsible="icon"
      className="**:data-[sidebar=sidebar]:bg-card **:data-[sidebar=sidebar]:text-card-foreground **:data-[sidebar=sidebar]:border-border/60"
    >
      <SidebarHeader className="border-b border-border/60 p-4">
        <div className="flex items-center gap-2.5 font-display text-base font-bold text-foreground">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span>MV Admin</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="py-4">
        <SidebarGroup>
          <SidebarMenu>
            {menuItems.map((item) => {
              // Exact match for dashboard variations, prefix match for others
              const isActive =
                item.to === "/admin/dashboard"
                  ? pathname === "/admin" ||
                    pathname === "/admin/" ||
                    pathname === "/admin/dashboard"
                  : pathname.startsWith(item.to);
              return (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    className="w-full hover:bg-accent hover:text-accent-foreground data-[active=true]:bg-primary data-[active=true]:text-primary-foreground transition-colors"
                  >
                    <Link to={item.to}>
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-border/60 p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              className="hover:bg-destructive/15 hover:text-destructive transition-colors text-muted-foreground"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function AdminDashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full" style={{ backgroundColor: "#EEEFF2" }}>
        <AdminSidebar />
        <div
          className="flex flex-1 flex-col overflow-x-hidden"
          style={{ backgroundColor: "#EEEFF2" }}
        >
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/40 backdrop-blur-md px-6">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="ml-auto flex items-center gap-3">
              <CoolThemeToggle size="md" />
              <div className="h-8.5 w-8.5 rounded-full bg-primary flex items-center justify-center font-bold text-primary-foreground shadow-md text-xs select-none">
                AD
              </div>
            </div>
          </header>
          <main
            className="flex-1 p-6 md:p-8 min-h-[calc(100vh-4rem)]"
            style={{ backgroundColor: "#EEEFF2" }}
          >
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AdminLayoutComponent() {
  const [restaurantsList, setRestaurantsList] = useState<any[]>([]);
  const [tickets, setTickets] = useState(INITIAL_TICKETS);
  const [flags, setFlags] = useState(INITIAL_FLAGS);
  const [announcements, setAnnouncements] = useState(INITIAL_ANNOUNCEMENTS);
  const [logLevel, setLogLevel] = useState("all");

  useEffect(() => {
    async function loadDbData() {
      try {
        const rows = await getAdminRestaurantsServer();
        if (rows) {
          setRestaurantsList(rows);
        }
      } catch (err) {
        console.warn("[AdminLayoutComponent] Error loading DB restaurants:", err);
      }
    }
    loadDbData();
  }, []);

  const contextValue = useMemo(
    () => ({
      restaurantsList,
      setRestaurantsList,
      tickets,
      setTickets,
      flags,
      setFlags,
      announcements,
      setAnnouncements,
      logLevel,
      setLogLevel,
    }),
    [restaurantsList, tickets, flags, announcements, logLevel],
  );

  return (
    <AdminContext.Provider value={contextValue}>
      <AdminDashboardShell>
        <Outlet />
      </AdminDashboardShell>
    </AdminContext.Provider>
  );
}

import {
  RESTAURANTS,
  INITIAL_TICKETS,
  INITIAL_FLAGS,
  INITIAL_ANNOUNCEMENTS,
} from "@/lib/admin-data";

// -------- UI Helpers & Components --------
export function KpiCard({
  label,
  value,
  delta,
  tone = "warm",
  icon: Icon,
}: {
  label: string;
  value: string;
  delta?: string;
  tone?: "warm" | "cool" | "mint" | "rose";
  icon: typeof TrendingUp;
}) {
  const bg = {
    warm: "from-orange-500/15 to-red-500/10",
    cool: "from-sky-500/15 to-indigo-500/10",
    mint: "from-emerald-500/15 to-teal-500/10",
    rose: "from-rose-500/15 to-pink-500/10",
  }[tone];
  return (
    <div className={cn("glass relative overflow-hidden rounded-2xl p-5 shadow-card")}>
      <div className={cn("pointer-events-none absolute inset-0 bg-linear-to-br", bg)} />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 font-display text-2xl font-bold">{value}</div>
          {delta && <div className="mt-1 text-xs text-emerald-600">{delta}</div>}
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-background/70 shadow-sm">
          <Icon className="h-4 w-4 text-primary" />
        </span>
      </div>
    </div>
  );
}

export function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
    trial: "bg-sky-500/10 text-sky-700 border-sky-500/30",
    demo: "bg-violet-500/10 text-violet-700 border-violet-500/30",
    suspended: "bg-red-500/10 text-red-700 border-red-500/30",
    open: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    pending: "bg-sky-500/10 text-sky-700 border-sky-500/30",
    resolved: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  };
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
        map[s] ?? "",
      )}
    >
      {s}
    </span>
  );
}

export function PriorityDot({ p }: { p: Ticket["priority"] }) {
  const c = p === "high" ? "bg-rose-500" : p === "med" ? "bg-amber-500" : "bg-slate-400";
  return <span className={cn("inline-block h-2 w-2 rounded-full", c)} />;
}
