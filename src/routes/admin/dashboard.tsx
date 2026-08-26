import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAdminContext } from "@/lib/admin-context";
import { KpiCard } from "../admin";
import { PLAN_COLORS, tooltipStyle } from "@/lib/admin-data";
import { apiGet } from "@/lib/api-client";
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
import { Store, CreditCard, DollarSign, Users } from "lucide-react";

export const Route = createFileRoute("/admin/dashboard")({
  component: DashboardIndexComponent,
});

interface AdminStats {
  totalRestaurants: number;
  activeSubs: number;
  mrr: number;
  totalUsers: number;
  totalOrders: number;
  totalVolume: number;
  planMix: Array<{ name: string; value: number }>;
  revenueTrend: Array<{ m: string; mrr: number; growth?: number }>;
}

function DashboardIndexComponent() {
  const { restaurantsList } = useAdminContext();
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await apiGet<AdminStats>("/api/admin-stats");
        if (res) {
          setStats(res);
        }
      } catch (err) {
        console.warn("Failed to load admin stats from DB:", err);
      }
    }
    loadStats();
  }, []);

  const totalRestaurants = stats?.totalRestaurants ?? restaurantsList.length;
  const activeSubs =
    stats?.activeSubs ??
    restaurantsList.filter((r) => r.status === "active" && r.plan !== "Free").length;
  const mrr = stats?.mrr ?? restaurantsList.reduce((s, r) => s + (r.mrr || 0), 0);
  const totalUsers = stats?.totalUsers ?? 0;

  const revenueTrendData =
    stats?.revenueTrend && stats.revenueTrend.length > 0
      ? stats.revenueTrend
      : [
          { m: "Jan", mrr: Math.round(mrr * 0.4) },
          { m: "Feb", mrr: Math.round(mrr * 0.5) },
          { m: "Mar", mrr: Math.round(mrr * 0.6) },
          { m: "Apr", mrr: Math.round(mrr * 0.7) },
          { m: "May", mrr: Math.round(mrr * 0.8) },
          { m: "Jun", mrr: Math.round(mrr * 0.9) },
          { m: "Jul", mrr: mrr },
        ];

  const planMixData =
    stats?.planMix && stats.planMix.some((p) => p.value > 0)
      ? stats.planMix
      : [
          { name: "Free", value: restaurantsList.filter((r) => r.plan === "Free").length },
          {
            name: "Starter",
            value: restaurantsList.filter((r) => r.plan === "Starter" || !r.plan).length,
          },
          { name: "Business", value: restaurantsList.filter((r) => r.plan === "Business").length },
          {
            name: "Enterprise",
            value: restaurantsList.filter((r) => r.plan === "Enterprise").length,
          },
        ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Restaurants"
          value={String(totalRestaurants)}
          delta={`${totalRestaurants} active in DB`}
          icon={Store}
          tone="warm"
        />
        <KpiCard
          label="Active subs"
          value={String(activeSubs)}
          delta={`${activeSubs} paying`}
          icon={CreditCard}
          tone="cool"
        />
        <KpiCard
          label="MRR"
          value={`$${mrr.toLocaleString()}`}
          delta="Authoritative MySQL"
          icon={DollarSign}
          tone="mint"
        />
        <KpiCard
          label="Users"
          value={totalUsers.toLocaleString()}
          delta={`${totalUsers} total DB users`}
          icon={Users}
          tone="rose"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass rounded-2xl p-6 shadow-card">
          <h3 className="font-display text-base font-semibold">MRR trend</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrendData}>
                <defs>
                  <linearGradient id="mrrFillDashboard" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="m" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip {...tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="mrr"
                  stroke="hsl(var(--primary))"
                  fill="url(#mrrFillDashboard)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="glass rounded-2xl p-6 shadow-card">
          <h3 className="font-display text-base font-semibold">Plan distribution</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={planMixData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {planMixData.map((_, i) => (
                    <Cell key={i} fill={PLAN_COLORS[i % PLAN_COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
