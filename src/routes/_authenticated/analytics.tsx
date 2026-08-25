import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ModernDatePicker } from "@/components/menuverse/modern-calendar";
import { StatCard } from "@/components/menuverse/stat-card";
import { getCurrencySymbol } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getCurrentUser,
  getBranchesServer,
  getOrdersServer,
  getFoodItemsServer,
  getCategoriesServer,
  getAnalyticsSummaryServer,
  getRestaurantProfile,
} from "@/lib/db-queries.server";
import { SkeletonAnalytics } from "@/components/menuverse/skeletons";
import {
  DollarSign,
  ShoppingBag,
  Clock,
  TrendingUp,
  Eye,
  QrCode,
  Trophy,
  Smartphone,
  Download,
  Utensils,
  ArrowDown,
  Building2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  LineChart,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/analytics")({ component: AnalyticsPage });

const PIE_COLORS = [
  "var(--color-primary)",
  "hsl(28 96% 58%)",
  "hsl(45 96% 62%)",
  "hsl(12 82% 58%)",
  "hsl(340 74% 60%)",
  "hsl(200 74% 58%)",
];

function toCsv(rows: Record<string, string | number>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join(
    "\n",
  );
}
function downloadCsv(name: string, rows: Record<string, string | number>[]) {
  if (!rows || rows.length === 0) {
    toast.error(`No data available to export for ${name}.`);
    return;
  }
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${name}.csv`);
}

const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
} as const;

function AnalyticsPage() {
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const [customDate, setCustomDate] = useState("");
  const [dbOrders, setDbOrders] = useState<Record<string, unknown>[]>([]);
  const [dbFoodItems, setDbFoodItems] = useState<Record<string, unknown>[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    role: string | null;
    branch?: string | null;
    full_name?: string | null;
  } | null>(null);
  const [branchesList, setBranchesList] = useState<
    Array<{ id: string; name: string; manager?: string; isDefault?: boolean }>
  >([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("All Branches");
  const [dbAnalytics, setDbAnalytics] = useState<{
    totalScans: number;
    totalViews: number;
    hourlyData: { hour: string; orders: number; scans: number }[];
    devices: { name: string; value: number }[];
    countries: { name: string; value: number }[];
    languages: { name: string; value: number }[];
  }>({
    totalScans: 0,
    totalViews: 0,
    hourlyData: [],
    devices: [],
    countries: [],
    languages: [],
  });

  const [loading, setLoading] = useState(true);
  const [activeCurrency, setActiveCurrency] = useState("BDT");
  const cs = useMemo(() => getCurrencySymbol(activeCurrency), [activeCurrency]);

  useEffect(() => {
    async function loadDb() {
      let loggedUser: {
        role: string | null;
        branch?: string | null;
        full_name?: string | null;
      } | null = null;

      try {
        const u = await getCurrentUser();
        if (u) {
          loggedUser = u;
          setCurrentUser(u);
        }
      } catch {
        /* ignore */
      }

      try {
        const prof = await getRestaurantProfile().catch(() => null);
        if (prof && typeof prof === "object" && (prof as Record<string, unknown>).currency) {
          setActiveCurrency(String((prof as Record<string, unknown>).currency));
        }
      } catch {
        /* ignore */
      }

      try {
        const brs = await getBranchesServer();
        if (brs && Array.isArray(brs)) {
          setBranchesList(
            brs as Array<{ id: string; name: string; manager?: string; isDefault?: boolean }>,
          );

          if (loggedUser) {
            const rClean = (loggedUser.role || "").toLowerCase().trim();
            const isOwnerRole =
              rClean === "super_admin" || rClean === "superadmin" || rClean === "owner";
            if (!isOwnerRole) {
              const uName = (loggedUser.full_name || "").toLowerCase().trim();
              const managedBranch = (
                brs as Array<{ id: string; name: string; manager?: string }>
              ).find((b) => {
                const mClean = (b.manager || "")
                  .replace(/\s*\([^)]*\)/g, "")
                  .toLowerCase()
                  .trim();
                return (
                  mClean &&
                  uName &&
                  (mClean === uName || mClean.includes(uName) || uName.includes(mClean))
                );
              });
              if (managedBranch) {
                setCurrentUser({ ...loggedUser, branch: managedBranch.name });
                setSelectedBranch(managedBranch.name);
              }
            }
          }
        }
      } catch {
        /* ignore */
      }

      try {
        const orders = await getOrdersServer({ data: {} });
        if (orders && Array.isArray(orders)) setDbOrders(orders as Record<string, unknown>[]);
      } catch {
        /* ignore */
      }
      try {
        const items = await getFoodItemsServer();
        if (items && Array.isArray(items)) setDbFoodItems(items as Record<string, unknown>[]);
      } catch {
        /* ignore */
      }
      try {
        const summary = await getAnalyticsSummaryServer();
        if (summary) {
          setDbAnalytics(
            summary as {
              totalScans: number;
              totalViews: number;
              hourlyData: { hour: string; orders: number; scans: number }[];
              devices: { name: string; value: number }[];
              countries: { name: string; value: number }[];
              languages: { name: string; value: number }[];
            },
          );
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    loadDb();
  }, []);

  const userRole = (currentUser?.role || "owner").toLowerCase().trim().replace(/ /g, "_");
  const isGlobalOwner =
    userRole === "super_admin" || userRole === "superadmin" || userRole === "owner";
  const isStaffScoped = !isGlobalOwner;

  const staffBranchName = useMemo(() => {
    if (!isStaffScoped) return null;
    if (currentUser?.branch) {
      const bClean = currentUser.branch
        .replace(/\s*\((Manager|Owner|Cashier|Chef|Waiter|Host)\)/gi, "")
        .trim();
      if (bClean) return bClean;
    }
    const uName = (currentUser?.full_name || "").toLowerCase().trim();
    if (uName && branchesList.length > 0) {
      const matched = branchesList.find((b) => {
        const mClean = (b.manager || "")
          .replace(/\s*\([^)]*\)/g, "")
          .toLowerCase()
          .trim();
        return mClean && (mClean === uName || mClean.includes(uName) || uName.includes(mClean));
      });
      if (matched) return matched.name;
    }
    return branchesList[0]?.name || "Main Branch";
  }, [isStaffScoped, currentUser, branchesList]);

  const branchFilteredAllOrders = useMemo(() => {
    let list = dbOrders;

    if (isStaffScoped && staffBranchName) {
      const mbLower = staffBranchName.toLowerCase().trim();
      const matchedB = branchesList.find((b) => b.name.toLowerCase() === mbLower);
      const targetIds = [mbLower, matchedB?.id?.toLowerCase()].filter(Boolean) as string[];
      const isDefaultBranch = matchedB?.isDefault || matchedB?.name === branchesList[0]?.name;

      list = list.filter((o) => {
        const oBranch = String(o.branchId || o.branch_id || "")
          .toLowerCase()
          .trim();
        const oNotes = String(o.notes || "")
          .toLowerCase()
          .trim();
        const oTable = String(o.tableNumber || o.table_number || "")
          .toLowerCase()
          .trim();

        if (oBranch) {
          return targetIds.some((t) => oBranch === t || oBranch.includes(t) || t.includes(oBranch));
        }
        if (targetIds.some((t) => oNotes.includes(t) || oTable.includes(t))) {
          return true;
        }
        return isDefaultBranch;
      });
    } else if (selectedBranch && selectedBranch !== "All Branches") {
      const sfLower = selectedBranch.toLowerCase().trim();
      const matchedB = branchesList.find((b) => b.name.toLowerCase() === sfLower);
      const targetIds = [sfLower, matchedB?.id?.toLowerCase()].filter(Boolean) as string[];
      const isDefaultBranch = matchedB?.isDefault || matchedB?.name === branchesList[0]?.name;

      list = list.filter((o) => {
        const oBranch = String(o.branchId || o.branch_id || "")
          .toLowerCase()
          .trim();
        const oNotes = String(o.notes || "")
          .toLowerCase()
          .trim();
        const oTable = String(o.tableNumber || o.table_number || "")
          .toLowerCase()
          .trim();

        if (oBranch) {
          return targetIds.some((t) => oBranch === t || oBranch.includes(t) || t.includes(oBranch));
        }
        if (targetIds.some((t) => oNotes.includes(t) || oTable.includes(t))) {
          return true;
        }
        return isDefaultBranch;
      });
    }

    return list;
  }, [dbOrders, isStaffScoped, staffBranchName, selectedBranch, branchesList]);

  const [isFiltering, setIsFiltering] = useState(false);

  useEffect(() => {
    if (loading) return;
    setIsFiltering(true);
    const timer = setTimeout(async () => {
      try {
        const activeBranch =
          isStaffScoped && staffBranchName
            ? staffBranchName
            : selectedBranch !== "All Branches"
              ? selectedBranch
              : undefined;
        const [orders, summary] = await Promise.all([
          getOrdersServer({
            data: {
              branchId: activeBranch,
              startDate: customDate || undefined,
              endDate: customDate || undefined,
            },
          }),
          getAnalyticsSummaryServer({
            data: {
              branchId: activeBranch,
              startDate: customDate || undefined,
              endDate: customDate || undefined,
            },
          }),
        ]);
        if (orders && Array.isArray(orders)) setDbOrders(orders as Record<string, unknown>[]);
        if (summary) {
          setDbAnalytics(
            summary as {
              totalScans: number;
              totalViews: number;
              hourlyData: { hour: string; orders: number; scans: number }[];
              devices: { name: string; value: number }[];
              countries: { name: string; value: number }[];
              languages: { name: string; value: number }[];
            },
          );
        }
      } catch (err) {
        console.warn("[Analytics] Server fetch error:", err);
      } finally {
        setIsFiltering(false);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [loading, selectedBranch, customDate, isStaffScoped, staffBranchName]);

  const filteredOrders = useMemo(() => {
    const list = branchFilteredAllOrders;
    if (!list.length) return [];
    if (customDate) {
      return list.filter(
        (o) => typeof o.createdAt === "string" && o.createdAt.startsWith(customDate),
      );
    }
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return list.filter((o) => new Date(String(o.createdAt || "")).getTime() >= cutoff);
  }, [branchFilteredAllOrders, range, customDate]);

  const computedRevenue = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  }, [filteredOrders]);

  const computedOrdersCount = useMemo(() => {
    return filteredOrders.length;
  }, [filteredOrders]);

  const previousPeriodOrders = useMemo(() => {
    const list = branchFilteredAllOrders;
    if (!list.length) return [];
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const now = Date.now();
    const cutoffEnd = now - days * 24 * 60 * 60 * 1000;
    const cutoffStart = now - 2 * days * 24 * 60 * 60 * 1000;
    return list.filter((o) => {
      const t = new Date(String(o.createdAt || "")).getTime();
      return t >= cutoffStart && t < cutoffEnd;
    });
  }, [branchFilteredAllOrders, range]);

  const ordersTrend = useMemo(() => {
    const cur = filteredOrders.length;
    const prev = previousPeriodOrders.length;
    if (prev === 0) return cur > 0 ? "+100%" : "0%";
    const pct = Math.round(((cur - prev) / prev) * 100);
    return (pct >= 0 ? "+" : "") + pct + "%";
  }, [filteredOrders, previousPeriodOrders]);

  const revenueTrend = useMemo(() => {
    const cur = computedRevenue;
    const prev = previousPeriodOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    if (prev === 0) return cur > 0 ? "+100%" : "0%";
    const pct = Math.round(((cur - prev) / prev) * 100);
    return (pct >= 0 ? "+" : "") + pct + "%";
  }, [computedRevenue, previousPeriodOrders]);

  const totalScans = useMemo(() => {
    return dbAnalytics.totalScans || 0;
  }, [dbAnalytics.totalScans]);

  const totalViews = useMemo(() => {
    return dbAnalytics.totalViews || 0;
  }, [dbAnalytics.totalViews]);

  const dynamicHours = useMemo(() => {
    if (dbAnalytics.hourlyData && dbAnalytics.hourlyData.length > 0) {
      return dbAnalytics.hourlyData;
    }
    const hoursMap: Record<string, { hour: string; orders: number; scans: number }> = {};
    for (let i = 8; i <= 21; i++) {
      const hStr = `${i}:00`;
      hoursMap[hStr] = { hour: hStr, orders: 0, scans: 0 };
    }
    for (const o of filteredOrders) {
      if (o.createdAt) {
        const d = new Date(String(o.createdAt));
        if (!isNaN(d.getTime())) {
          const h = d.getHours();
          const key = `${h}:00`;
          if (hoursMap[key]) {
            hoursMap[key].orders += 1;
          }
        }
      }
    }
    return Object.values(hoursMap);
  }, [dbAnalytics.hourlyData, filteredOrders]);

  const dynamicMonthly = useMemo(() => {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const mData = months.map((m) => ({ m, r: 0 }));
    for (const o of branchFilteredAllOrders) {
      if (o.createdAt) {
        const d = new Date(String(o.createdAt));
        if (!isNaN(d.getTime())) {
          const monthIdx = d.getMonth();
          mData[monthIdx].r += Number(o.total || 0);
        }
      }
    }
    return mData;
  }, [branchFilteredAllOrders]);

  const dynamicFoodStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of filteredOrders) {
      const lines = o.lines as Record<string, unknown>[] | undefined;
      if (Array.isArray(lines)) {
        for (const line of lines) {
          const name = String(line.name || "Item");
          const q = Number(line.qty ?? line.quantity ?? 1);
          counts[name] = (counts[name] || 0) + (isNaN(q) ? 1 : q);
        }
      }
    }
    return dbFoodItems.map((item) => {
      const name = String(item.name || "Food Item");
      const orderCount = counts[name] || 0;
      return {
        name,
        views: orderCount,
        orders: orderCount,
      };
    });
  }, [filteredOrders, dbFoodItems]);

  const dynamicCategories = useMemo(() => {
    const catMap: Record<string, { name: string; views: number; orders: number }> = {};
    for (const item of dbFoodItems) {
      const cat = String(item.category || "General");
      if (!catMap[cat]) catMap[cat] = { name: cat, views: 0, orders: 0 };
    }
    for (const o of filteredOrders) {
      const lines = o.lines as Record<string, unknown>[] | undefined;
      if (Array.isArray(lines)) {
        for (const line of lines) {
          const name = String(line.name || "");
          const q = Number(line.qty ?? line.quantity ?? 1);
          const qty = isNaN(q) ? 1 : q;
          const matchedItem = dbFoodItems.find((fi) => String(fi.name) === name);
          const cat = matchedItem ? String(matchedItem.category || "General") : "General";
          if (!catMap[cat]) catMap[cat] = { name: cat, views: 0, orders: 0 };
          catMap[cat].orders += qty;
          catMap[cat].views += qty;
        }
      }
    }
    return Object.values(catMap);
  }, [filteredOrders, dbFoodItems]);

  const dynMostViewed = useMemo(
    () => [...dynamicFoodStats].sort((a, b) => b.views - a.views).slice(0, 5),
    [dynamicFoodStats],
  );
  const dynMostOrdered = useMemo(
    () => [...dynamicFoodStats].sort((a, b) => b.orders - a.orders).slice(0, 5),
    [dynamicFoodStats],
  );
  const dynLeastOrdered = useMemo(
    () => [...dynamicFoodStats].sort((a, b) => a.orders - b.orders).slice(0, 5),
    [dynamicFoodStats],
  );

  const exportAll = () => {
    downloadCsv(
      "analytics-food",
      dynamicFoodStats.map((f) => ({ item: f.name, views: f.views, orders: f.orders })),
    );
  };

  if (loading) {
    return <SkeletonAnalytics />;
  }

  return (
    <div
      className="-m-6 md:-m-8 p-6 md:p-8 min-h-screen space-y-6"
      style={{ backgroundColor: "#EEEFF2" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isStaffScoped && staffBranchName ? (
            <div className="flex items-center gap-2 rounded-xl bg-card border border-border/80 px-3.5 py-1.5 shadow-2xs">
              <Building2 className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-semibold text-foreground">{staffBranchName}</span>
            </div>
          ) : branchesList.length > 1 ? (
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="h-9 w-48 text-xs bg-card border-border/80 shadow-2xs rounded-xl cursor-pointer">
                <Building2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="All Branches">All Branches</SelectItem>
                {branchesList.map((b) => (
                  <SelectItem key={b.id || b.name} value={b.name}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={range} onValueChange={(v) => setRange(v as typeof range)}>
            <TabsList>
              <TabsTrigger value="7d">7d</TabsTrigger>
              <TabsTrigger value="30d">30d</TabsTrigger>
              <TabsTrigger value="90d">90d</TabsTrigger>
            </TabsList>
          </Tabs>
          <ModernDatePicker
            value={customDate}
            onChange={setCustomDate}
            placeholder="Custom Date"
            className="w-38 rounded-lg shadow-2xs border-gray-300"
          />
          <Button variant="outline" onClick={exportAll} className="cursor-pointer">
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="QR Scans"
          value={totalScans.toLocaleString()}
          trend={totalScans > 0 ? ordersTrend : "0%"}
          icon={QrCode}
          isLoading={loading || isFiltering}
        />
        <StatCard
          label="Menu Views"
          value={totalViews.toLocaleString()}
          trend={totalViews > 0 ? ordersTrend : "0%"}
          icon={Eye}
          isLoading={loading || isFiltering}
        />
        <StatCard
          label="Orders"
          value={computedOrdersCount.toLocaleString()}
          trend={ordersTrend}
          icon={ShoppingBag}
          isLoading={loading || isFiltering}
        />
        <StatCard
          label="Revenue"
          value={`${cs}${computedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          trend={revenueTrend}
          icon={DollarSign}
          isLoading={loading || isFiltering}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="glass rounded-2xl p-6 shadow-card">
          <SectionTitle
            icon={QrCode}
            title="QR scans & menu views"
            subtitle="Popular time of day"
          />
          <div className="mt-6 h-64">
            <ResponsiveContainer>
              <BarChart data={dynamicHours}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
                <XAxis dataKey="hour" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="scans" name="QR scans" fill="hsl(28 96% 58%)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="orders" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass rounded-2xl p-6 shadow-card">
          <SectionTitle icon={TrendingUp} title="Revenue trend" subtitle="Last 12 months" />
          <div className="mt-6 h-64">
            <ResponsiveContainer>
              <LineChart data={dynamicMonthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
                <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="r"
                  stroke="var(--color-primary)"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <FoodRankCard
          icon={Eye}
          title="Most viewed food"
          rows={dynMostViewed}
          metricKey="views"
          metricLabel="views"
          onExport={() =>
            downloadCsv(
              "most-viewed-food",
              dynMostViewed.map((r) => ({ item: r.name, views: r.views })),
            )
          }
        />
        <FoodRankCard
          icon={Trophy}
          title="Most ordered food"
          rows={dynMostOrdered}
          metricKey="orders"
          metricLabel="orders"
          onExport={() =>
            downloadCsv(
              "most-ordered-food",
              dynMostOrdered.map((r) => ({ item: r.name, orders: r.orders })),
            )
          }
        />
        <FoodRankCard
          icon={ArrowDown}
          title="Least ordered food"
          rows={dynLeastOrdered}
          metricKey="orders"
          metricLabel="orders"
          onExport={() =>
            downloadCsv(
              "least-ordered-food",
              dynLeastOrdered.map((r) => ({ item: r.name, orders: r.orders })),
            )
          }
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="glass rounded-2xl p-6 shadow-card lg:col-span-2">
          <div className="flex items-center justify-between">
            <SectionTitle icon={Utensils} title="Top categories" subtitle="Views vs orders" />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => downloadCsv("top-categories", dynamicCategories)}
            >
              <Download className="mr-1 h-4 w-4" /> CSV
            </Button>
          </div>
          <div className="mt-6 h-72">
            <ResponsiveContainer>
              <BarChart data={dynamicCategories} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
                <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  width={90}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="views" name="Views" fill="hsl(28 96% 58%)" radius={[0, 6, 6, 0]} />
                <Bar
                  dataKey="orders"
                  name="Orders"
                  fill="var(--color-primary)"
                  radius={[0, 6, 6, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass rounded-2xl p-6 shadow-card">
          <SectionTitle icon={Smartphone} title="Device type" subtitle="Menu access split" />
          <div className="mt-4 h-56">
            <ResponsiveContainer>
              <PieChart>
                <Tooltip contentStyle={tooltipStyle} />
                <Pie
                  data={dbAnalytics.devices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                >
                  {dbAnalytics.devices.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-6 glass rounded-2xl p-6 shadow-card">
        <SectionTitle icon={Clock} title="Popular time" subtitle="Orders across the day" />
        <div className="mt-6 h-56">
          <ResponsiveContainer>
            <BarChart data={dynamicHours}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
              <XAxis dataKey="hour" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="orders" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof QrCode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h3 className="font-display text-lg font-semibold leading-tight">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

function FoodRankCard({
  icon,
  title,
  rows,
  metricKey,
  metricLabel,
  onExport,
}: {
  icon: typeof Eye;
  title: string;
  rows: { name: string; views: number; orders: number }[];
  metricKey: "views" | "orders";
  metricLabel: string;
  onExport: () => void;
}) {
  const max = Math.max(...rows.map((r) => r[metricKey]));
  return (
    <div className="glass rounded-2xl p-6 shadow-card">
      <div className="flex items-center justify-between">
        <SectionTitle icon={icon} title={title} />
        <Button size="sm" variant="ghost" onClick={onExport} aria-label={`Export ${title} as CSV`}>
          <Download className="h-4 w-4" />
        </Button>
      </div>
      <ul className="mt-4 space-y-3">
        {rows.map((r, i) => (
          <li key={r.name} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-muted text-[10px] font-semibold">
                  {i + 1}
                </span>
                <span className="font-medium">{r.name}</span>
              </span>
              <span className="tabular-nums text-muted-foreground">
                {r[metricKey].toLocaleString()} {metricLabel}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full gradient-warm"
                style={{ width: `${(r[metricKey] / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
