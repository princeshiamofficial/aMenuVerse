"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAdminContext } from "@/lib/admin-context";
import { KpiCard, StatusBadge } from "@/app/admin/layout";
import { getAdminDashboardMetricsServer, getAdminRestaurantsServer } from "@/lib/db-queries.server";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Store, CreditCard, DollarSign, Users, ExternalLink, ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface DashboardData {
  totalRestaurants: number;
  activeRestaurants: number;
  newRestaurantsWeek: number;
  activeSubs: number;
  mrr: number;
  mrrDelta: string;
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  totalBranches: number;
  totalCategories: number;
  totalFoodItems: number;
  totalOrders: number;
  totalRevenue: number;
  planMix: Array<{ name: string; value: number; color: string; mrr: number }>;
  revenueTrend: Array<{ m: string; ym: string; mrr: number; orders: number }>;
  recentRestaurants: Array<{
    id: string;
    name: string;
    username: string;
    cuisine: string;
    location: string;
    plan: string;
    status: string;
    logoUrl: string;
    createdAt: string;
  }>;
  recentUsers: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    avatarUrl?: string;
    createdAt: string;
  }>;
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "hsl(var(--background))",
    borderColor: "hsl(var(--border))",
    borderRadius: "0.75rem",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
    fontSize: "12px",
    fontWeight: "500",
  },
};

export default function DashboardIndexComponent() {
  const { restaurantsList, setRestaurantsList } = useAdminContext();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardData | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const [dashMetrics, freshRestaurants] = await Promise.all([
          getAdminDashboardMetricsServer(),
          getAdminRestaurantsServer(),
        ]);

        if (mounted) {
          if (dashMetrics) {
            setMetrics(dashMetrics as unknown as DashboardData);
          }
          if (freshRestaurants && Array.isArray(freshRestaurants) && freshRestaurants.length > 0) {
            setRestaurantsList(freshRestaurants as any);
          }
        }
      } catch (err) {
        console.error("[AdminDashboard] Error loading metrics:", err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [setRestaurantsList]);

  const totalRestaurants = metrics?.totalRestaurants ?? restaurantsList.length;
  const activeSubs =
    metrics?.activeSubs ??
    restaurantsList.filter((r) => r.status === "active" && r.plan !== "Free").length;
  const mrr = metrics?.mrr ?? restaurantsList.reduce((s, r) => s + (r.mrr || 0), 0);
  const totalUsers = metrics?.totalUsers ?? 0;
  const revenueTrend = metrics?.revenueTrend ?? [];
  const planMix = metrics?.planMix ?? [];
  const recentRestaurants =
    metrics?.recentRestaurants && metrics.recentRestaurants.length > 0
      ? metrics.recentRestaurants
      : restaurantsList.slice(0, 5).map((r) => ({
          id: String(r.id),
          name: r.name,
          username: r.username,
          cuisine: r.cuisine || "Multi-Cuisine",
          location: r.location || "Main Location",
          plan: r.plan || "Starter",
          status: r.status || "active",
          logoUrl:
            (r as unknown as { logoImage?: string }).logoImage ||
            (typeof (r as unknown as { logo?: string }).logo === "string" &&
            (r as unknown as { logo?: string }).logo?.startsWith("http")
              ? (r as unknown as { logo?: string }).logo
              : "") ||
            "",
          createdAt: "Recent",
        }));
  const recentUsers = metrics?.recentUsers ?? [];

  if (loading && !metrics) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass rounded-2xl p-5 shadow-card space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Restaurants"
          value={String(totalRestaurants)}
          delta={
            metrics?.newRestaurantsWeek && metrics.newRestaurantsWeek > 0
              ? `+${metrics.newRestaurantsWeek} this week`
              : `${metrics?.activeRestaurants ?? totalRestaurants} active`
          }
          icon={Store}
          tone="warm"
        />
        <KpiCard
          label="Active Subscriptions"
          value={String(activeSubs)}
          delta={`${planMix.find((p) => p.name === "Business")?.value || 0} Pro / ${planMix.find((p) => p.name === "Enterprise")?.value || 0} Enterprise`}
          icon={CreditCard}
          tone="cool"
        />
        <KpiCard
          label="Total MRR"
          value={`$${mrr.toLocaleString()}`}
          delta={metrics?.mrrDelta || "Live from DB"}
          icon={DollarSign}
          tone="mint"
        />
        <KpiCard
          label="Registered Users"
          value={totalUsers.toLocaleString()}
          delta={
            metrics?.newUsersToday && metrics.newUsersToday > 0
              ? `+${metrics.newUsersToday} today`
              : `${metrics?.activeUsers ?? totalUsers} active accounts`
          }
          icon={Users}
          tone="rose"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* MRR Trend */}
        <section className="glass rounded-2xl p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold">Monthly MRR & Platform Trend</h3>
              <p className="text-xs text-muted-foreground">
                Revenue telemetry over the past 6 billing cycles
              </p>
            </div>
            <Badge variant="outline" className="text-[11px] font-medium">
              Live Sync
            </Badge>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend}>
                <defs>
                  <linearGradient id="mrrFillDashboard" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.6} />
                <XAxis dataKey="m" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip {...tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="mrr"
                  name="MRR / Total ($)"
                  stroke="hsl(var(--primary))"
                  fill="url(#mrrFillDashboard)"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Plan Distribution */}
        <section className="glass rounded-2xl p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold">Subscription Plan Mix</h3>
              <p className="text-xs text-muted-foreground">
                Distribution across all tenant subscriptions
              </p>
            </div>
            <span className="text-xs font-semibold text-primary">
              {totalRestaurants} Total Tenants
            </span>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={planMix}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={3}
                >
                  {planMix.map((entry, i) => (
                    <Cell key={`cell-${i}`} fill={entry.color || "#60a5fa"} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value, entry: any) => (
                    <span className="text-xs text-foreground font-medium">
                      {value} ({entry?.payload?.value || 0})
                    </span>
                  )}
                />
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Database Recent Entities Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Restaurants */}
        <section className="glass rounded-2xl p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" />
              <h3 className="font-display text-base font-semibold">Recent Restaurants</h3>
            </div>
            <Link
              href="/admin/restaurants"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <span>View all</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60 bg-background/50">
            {recentRestaurants.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No restaurants found in database.
              </div>
            ) : (
              recentRestaurants.map((r) => {
                const matchedFromContext = restaurantsList.find(
                  (x) => String(x.id) === String(r.id) || x.username === r.username,
                );
                const logo =
                  r.logoUrl && r.logoUrl.trim()
                    ? r.logoUrl
                    : matchedFromContext?.logoImage ||
                      (typeof matchedFromContext?.logo === "string" &&
                      matchedFromContext.logo.startsWith("http")
                        ? matchedFromContext.logo
                        : null);

                const hasValidLogo =
                  logo &&
                  typeof logo === "string" &&
                  (logo.startsWith("http") || logo.startsWith("/") || logo.startsWith("data:"));

                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3.5 hover:bg-accent/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {hasValidLogo ? (
                        <img
                          src={logo}
                          alt={r.name}
                          className="h-9 w-9 rounded-lg object-cover border border-border/60 shadow-xs shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            const fallback = e.currentTarget
                              .nextElementSibling as HTMLElement | null;
                            if (fallback) fallback.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary text-xs shrink-0 ${
                          hasValidLogo ? "hidden" : ""
                        }`}
                      >
                        {r.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">{r.name}</span>
                          <StatusBadge s={r.status.toLowerCase()} />
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {r.cuisine} • {r.location}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-right">
                      <Badge variant="secondary" className="text-[10px] font-medium">
                        {r.plan}
                      </Badge>
                      <Link
                        href={`/${r.username || r.id}`}
                        target="_blank"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:bg-background"
                        title="Preview public menu"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Recent User Accounts */}
        <section className="glass rounded-2xl p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="font-display text-base font-semibold">Recent Owners & Managers</h3>
            </div>
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <span>View all</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60 bg-background/50">
            {recentUsers.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No users found in database.
              </div>
            ) : (
              recentUsers.map((u) => {
                const avatar = u.avatarUrl || null;
                const hasValidAvatar =
                  avatar &&
                  typeof avatar === "string" &&
                  (avatar.startsWith("http") ||
                    avatar.startsWith("/") ||
                    avatar.startsWith("data:"));

                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-3.5 hover:bg-accent/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {hasValidAvatar ? (
                        <img
                          src={avatar}
                          alt={u.name}
                          className="h-9 w-9 rounded-full object-cover border border-border/60 shadow-xs shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            const fallback = e.currentTarget
                              .nextElementSibling as HTMLElement | null;
                            if (fallback) fallback.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 font-bold text-foreground text-xs shrink-0 ${
                          hasValidAvatar ? "hidden" : ""
                        }`}
                      >
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">{u.name}</span>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {u.role.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground">{u.email}</div>
                      </div>
                    </div>

                    <div className="text-right text-[11px] text-muted-foreground">
                      <StatusBadge s={u.status.toLowerCase()} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
