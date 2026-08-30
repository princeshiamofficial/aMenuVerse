"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams, useParams } from "next/navigation";

import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import type { DateRange } from "react-day-picker";
import { cn, formatCurrency, getCurrencySymbol } from "@/lib/utils";
import { StatCard } from "@/components/menuverse/stat-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Wallet,
  ShoppingBag,
  Users,
  Star,
  TrendingUp,
  QrCode,
  Activity,
  Tags,
  Utensils,
  FileDown,
  MessageSquareHeart,
  Sparkles,
  CalendarDays,
  ChevronDown,
  Building2,
  Check,
  CalendarCheck,
  UserCheck,
  Armchair,
  Clock,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  getBranchesServer,
  getCurrentUser,
  getOrdersServer,
  getFoodItemsServer,
  getReservationsServer,
  getRestaurantProfile,
  type FullOrderRecord,
  type ReservationRecord,
} from "@/lib/db-queries.server";

import { Skeleton } from "@/components/ui/skeleton";

const ALL_QUICK_ACTIONS = [
  {
    label: "Create Promotion",
    icon: Sparkles,
    to: "/promotions" as const,
    roles: ["owner", "super_admin", "superadmin", "manager"],
  },
  {
    label: "Generate QR",
    icon: QrCode,
    to: "/branches" as const,
    roles: ["owner", "super_admin", "superadmin"],
  },
  {
    label: "Download PDF Menu",
    icon: FileDown,
    to: "/food-items" as const,
    roles: ["owner", "super_admin", "superadmin"],
  },
  {
    label: "Create Category",
    icon: Tags,
    to: "/categories" as const,
    roles: ["owner", "super_admin", "superadmin"],
  },
  {
    label: "Create Food Item",
    icon: Utensils,
    to: "/food-items" as const,
    roles: ["owner", "super_admin", "superadmin"],
  },
  {
    label: "Manage Staff",
    icon: Users,
    to: "/staff" as const,
    roles: ["manager"],
  },
  {
    label: "View Orders",
    icon: ShoppingBag,
    to: "/orders" as const,
    roles: ["manager", "cashier", "chef", "waiter"],
  },
  {
    label: "Reservations",
    icon: CalendarDays,
    to: "/reservations" as const,
    roles: ["manager", "cashier", "host", "waiter"],
  },
  {
    label: "Analytics",
    icon: TrendingUp,
    to: "/analytics" as const,
    roles: ["manager"],
  },
];

const DATE_PRESETS = [
  {
    label: "Today",
    getValue: () => ({ from: new Date(), to: new Date() }),
  },
  {
    label: "Yesterday",
    getValue: () => {
      const y = subDays(new Date(), 1);
      return { from: y, to: y };
    },
  },
  {
    label: "This Week",
    getValue: () => ({
      from: startOfWeek(new Date(), { weekStartsOn: 1 }),
      to: endOfWeek(new Date(), { weekStartsOn: 1 }),
    }),
  },
  {
    label: "Last 7 Days",
    getValue: () => ({ from: subDays(new Date(), 6), to: new Date() }),
  },
  {
    label: "This Month",
    getValue: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    }),
  },
  {
    label: "Last 30 Days",
    getValue: () => ({ from: subDays(new Date(), 29), to: new Date() }),
  },
];

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [orders, setOrders] = useState<FullOrderRecord[]>([]);
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [topFoodItem, setTopFoodItem] = useState("None yet");

  const [selectedBranch, setSelectedBranch] = useState("All Branches");
  const [selectedDatePreset, setSelectedDatePreset] = useState("Today");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  });
  const [currentUser, setCurrentUser] = useState<{
    full_name?: string | null;
    role?: string | null;
    branch?: string | null;
  } | null>(null);
  const [activeCurrency, setActiveCurrency] = useState("BDT");
  const cs = useMemo(() => getCurrencySymbol(activeCurrency), [activeCurrency]);

  const userRole = (currentUser?.role || "owner").toLowerCase().trim().replace(/ /g, "_");
  const visibleQuickActions = useMemo(() => {
    const isOwner = userRole === "owner" || userRole === "super_admin" || userRole === "superadmin";
    return ALL_QUICK_ACTIONS.filter((a) => !a.roles || a.roles.includes(userRole) || isOwner).slice(
      0,
      6,
    );
  }, [userRole]);

  useEffect(() => {
    async function loadDashboardData() {
      let loggedUser: {
        full_name?: string | null;
        role?: string | null;
        branch?: string | null;
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
        const dbBranches = await getBranchesServer({ data: {} });
        if (dbBranches && Array.isArray(dbBranches) && dbBranches.length > 0) {
          setBranches(dbBranches.map((b) => ({ id: b.id, name: b.name })));

          if (loggedUser) {
            const rClean = (loggedUser.role || "").toLowerCase().trim();
            const isOwnerRole =
              rClean === "super_admin" || rClean === "superadmin" || rClean === "owner";

            if (!isOwnerRole) {
              const uName = (loggedUser.full_name || "").toLowerCase().trim();
              const managedBranch = dbBranches.find((b) => {
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
                setSelectedBranch(managedBranch.name);
              } else if (
                loggedUser.branch &&
                dbBranches.some((b) => b.name === loggedUser.branch)
              ) {
                setSelectedBranch(loggedUser.branch);
              } else {
                const defaultB = dbBranches.find((b) => b.isDefault) || dbBranches[0];
                if (defaultB) setSelectedBranch(defaultB.name);
              }
            }
          }
        }
      } catch {
        /* ignore */
      }

      try {
        const dbOrders = await getOrdersServer({ data: {} });
        if (dbOrders && Array.isArray(dbOrders)) {
          setOrders(dbOrders);
        }
      } catch {
        /* ignore */
      }

      try {
        const dbRes = await getReservationsServer({ data: {} });
        if (dbRes && Array.isArray(dbRes)) {
          setReservations(dbRes);
        }
      } catch {
        /* ignore */
      }

      try {
        const dbItems = await getFoodItemsServer({ data: {} });
        if (dbItems && Array.isArray(dbItems) && dbItems.length > 0) {
          const popular = dbItems.find((i) => i.bestSeller || i.popular) || dbItems[0];
          if (popular?.name) setTopFoodItem(popular.name);
        } else {
          setTopFoodItem("None yet");
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  const [isFiltering, setIsFiltering] = useState(false);

  useEffect(() => {
    if (loading) return;
    setIsFiltering(true);
    const timer = setTimeout(async () => {
      try {
        const branchParam = selectedBranch !== "All Branches" ? selectedBranch : undefined;
        const [dbOrders, dbRes] = await Promise.all([
          getOrdersServer({ data: { branchId: branchParam } }),
          getReservationsServer({ data: { branchId: branchParam } }),
        ]);
        if (dbOrders && Array.isArray(dbOrders)) setOrders(dbOrders);
        if (dbRes && Array.isArray(dbRes)) setReservations(dbRes);
      } catch (err) {
        console.warn("[Dashboard] Server fetch error:", err);
      } finally {
        setIsFiltering(false);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [loading, selectedBranch]);

  const isGlobalOwner =
    userRole === "owner" || userRole === "super_admin" || userRole === "superadmin";
  const isBranchUser = !isGlobalOwner;

  const branchOptions = useMemo(() => {
    if (isGlobalOwner) {
      return ["All Branches", ...branches.map((b) => b.name)];
    }
    return branches.map((b) => b.name);
  }, [isGlobalOwner, branches]);

  const filteredOrders = useMemo(() => {
    let result = orders;

    if (selectedBranch !== "All Branches") {
      const selectedBObj = branches.find((b) => b.name === selectedBranch);
      const targetIds = [
        selectedBranch.toLowerCase().trim(),
        selectedBObj?.id?.toLowerCase().trim(),
      ].filter(Boolean) as string[];

      const isDefaultBranch = selectedBObj?.name === branches[0]?.name || !selectedBObj;

      result = result.filter((o) => {
        const oBranch = (o.branchId || "").toLowerCase().trim();
        const oNotes = (o.notes || "").toLowerCase().trim();
        const oTable = (o.tableNumber || "").toLowerCase().trim();

        if (oBranch) {
          return targetIds.some((t) => oBranch === t || oBranch.includes(t) || t.includes(oBranch));
        }

        if (targetIds.some((t) => oNotes.includes(t) || oTable.includes(t))) {
          return true;
        }

        return isDefaultBranch;
      });
    }

    if (dateRange?.from) {
      const fromStart = new Date(dateRange.from);
      fromStart.setHours(0, 0, 0, 0);
      const toEnd = new Date(dateRange.to || dateRange.from);
      toEnd.setHours(23, 59, 59, 999);

      result = result.filter((o) => {
        if (!o.createdAt) return true;
        const oDate = new Date(o.createdAt);
        return oDate >= fromStart && oDate <= toEnd;
      });
    }

    return result;
  }, [orders, selectedBranch, branches, dateRange]);

  const filteredReservations = useMemo(() => {
    if (selectedBranch === "All Branches") return reservations;
    const selectedBObj = branches.find((b) => b.name === selectedBranch);
    const targetIds = [
      selectedBranch.toLowerCase().trim(),
      selectedBObj?.id?.toLowerCase().trim(),
    ].filter(Boolean) as string[];

    const isDefaultBranch = selectedBObj?.name === branches[0]?.name || !selectedBObj;

    return reservations.filter((r) => {
      const rBranch = ((r as { branchName?: string }).branchName || "").toLowerCase().trim();
      if (rBranch) {
        return targetIds.some((t) => rBranch === t || rBranch.includes(t) || t.includes(rBranch));
      }
      return isDefaultBranch;
    });
  }, [reservations, selectedBranch, branches]);

  const totalRevenue = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  }, [filteredOrders]);

  const totalOrdersCount = useMemo(() => {
    return filteredOrders.length;
  }, [filteredOrders]);

  const totalCustomers = useMemo(() => {
    const customerSet = new Set<string>();
    for (const o of filteredOrders) {
      if (o.customerName && o.customerName !== "Guest") {
        customerSet.add(o.customerName.toLowerCase().trim());
      } else if (o.phone) {
        customerSet.add(o.phone.trim());
      }
    }
    return customerSet.size;
  }, [filteredOrders]);

  const todaysBookingsCount = useMemo(() => {
    return filteredReservations.length;
  }, [filteredReservations]);

  const expectedGuestsCount = useMemo(() => {
    return filteredReservations.reduce((sum, r) => sum + (r.partySize || 0), 0);
  }, [filteredReservations]);

  const currentlySeatedCount = useMemo(() => {
    return filteredReservations.filter((r) => r.status === "seated" || r.status === "confirmed")
      .length;
  }, [filteredReservations]);

  const pendingRequestsCount = useMemo(() => {
    return filteredReservations.filter((r) => r.status === "pending").length;
  }, [filteredReservations]);

  const revenueChartData = useMemo(() => {
    const daysMap: Record<string, number> = {
      Mon: 0,
      Tue: 0,
      Wed: 0,
      Thu: 0,
      Fri: 0,
      Sat: 0,
      Sun: 0,
    };
    for (const o of filteredOrders) {
      if (o.createdAt) {
        const dayStr = format(new Date(o.createdAt), "EEE");
        if (daysMap[dayStr] !== undefined) {
          daysMap[dayStr] += o.total || 0;
        }
      }
    }
    return Object.entries(daysMap).map(([day, value]) => ({ day, value }));
  }, [filteredOrders]);

  const liveActivity = useMemo(() => {
    if (filteredOrders.length === 0) return [];
    return filteredOrders.slice(0, 5).map((o) => ({
      icon: ShoppingBag,
      text: `Order #${o.number} (${o.type.toUpperCase()}) — ${formatCurrency(o.total, activeCurrency)} (${o.customerName})`,
      time: o.createdAt ? format(new Date(o.createdAt), "hh:mm a") : "Recently",
    }));
  }, [filteredOrders, activeCurrency]);

  const getDateFilterButtonText = () => {
    if (selectedDatePreset !== "Custom") {
      return selectedDatePreset;
    }
    if (dateRange?.from) {
      if (dateRange.to) {
        return `${format(dateRange.from, "LLL dd")} - ${format(dateRange.to, "LLL dd")}`;
      }
      return format(dateRange.from, "LLL dd, yyyy");
    }
    return "Pick a date";
  };

  const isDataLoading = loading || isFiltering;

  return (
    <div
      className="dashboard-root -m-6 md:-m-8 p-6 md:p-8 min-h-screen"
      style={{ backgroundColor: "#EEEFF2", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      <style>{`
        .dashboard-root, .dashboard-root *:not(.stat-card-value) {
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
        }
        .stat-card-value {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
        }
      `}</style>

      {/* Filters Bar — Separated compact cards placed at opposite ends */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 mb-6 print:hidden">
        {/* Card 1: Select Branch Dropdown / Assigned Branch Welcome Card */}
        <div className="border text-card-foreground shadow-2xs bg-card rounded-lg">
          <div className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 flex items-center justify-between gap-3 sm:gap-6 text-left">
            {isBranchUser && branches.length <= 1 ? (
              <>
                <div className="flex items-center text-xs text-muted-foreground font-medium shrink-0">
                  <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 text-amber-500 shrink-0" />
                  <span>
                    Welcome,{" "}
                    <strong className="text-foreground font-semibold">
                      {currentUser?.full_name?.split(" ")[0] || "Staff"}
                    </strong>
                    !
                  </span>
                </div>
                <div className="inline-flex items-center gap-1 font-semibold border border-primary/20 bg-primary/10 text-primary rounded-md px-2.5 text-xs h-7 sm:h-7.5 shrink-0 shadow-2xs">
                  <Building2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span>{selectedBranch || "No Branch"}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center text-xs text-muted-foreground font-medium shrink-0">
                  <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 text-primary/80" />
                  <span>Select Branch</span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md px-2.5 text-xs h-7 sm:h-7.5 truncate cursor-pointer transition-colors"
                    >
                      {selectedBranch} <ChevronDown className="ml-1 h-3 w-3 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    {branchOptions.map((branch) => (
                      <DropdownMenuItem
                        key={branch}
                        onClick={() => setSelectedBranch(branch)}
                        className="flex items-center justify-between cursor-pointer"
                      >
                        <span>{branch}</span>
                        {selectedBranch === branch && <Check className="h-4 w-4 text-primary" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>

        {/* Card 2: ERP Date Range Picker Dropdown */}
        <div className="border text-card-foreground shadow-2xs bg-card rounded-lg">
          <div className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 flex items-center justify-between gap-3 sm:gap-6 text-left">
            <div className="flex items-center text-xs text-muted-foreground font-medium shrink-0">
              <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 text-primary/80" />
              <span>Filter</span>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md text-xs border border-input bg-background hover:bg-accent hover:text-accent-foreground px-2.5 justify-center font-normal h-7 sm:h-7.5 cursor-pointer transition-colors"
                >
                  <CalendarDays className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span>{getDateFilterButtonText()}</span>
                  <ChevronDown className="ml-1 h-3 w-3 opacity-70" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-3 shadow-xl">
                <div className="flex flex-col md:flex-row gap-3">
                  {/* ERP Presets Column */}
                  <div className="flex flex-col gap-1 border-b md:border-b-0 md:border-r border-border pb-3 md:pb-0 md:pr-3 min-w-32.5">
                    <span className="text-[11px] font-bold text-muted-foreground/80 mb-1 px-2 uppercase tracking-wider">
                      Date Ranges
                    </span>
                    {DATE_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          const range = preset.getValue();
                          setDateRange(range);
                          setSelectedDatePreset(preset.label);
                        }}
                        className={cn(
                          "text-left text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer",
                          selectedDatePreset === preset.label
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "hover:bg-accent hover:text-accent-foreground text-foreground",
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Calendar view for custom range */}
                  <div className="flex flex-col items-center">
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={(range) => {
                        setDateRange(range);
                        setSelectedDatePreset("Custom");
                      }}
                      numberOfMonths={1}
                      className="p-0"
                    />
                    {dateRange?.from && (
                      <div className="mt-2 text-xs font-mono text-muted-foreground text-center">
                        {format(dateRange.from, "LLL dd, yyyy")}
                        {dateRange.to ? ` - ${format(dateRange.to, "LLL dd, yyyy")}` : ""}
                      </div>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Main Operations Stat Cards Row 1 (1: Revenue, 2: Total Orders, 3: Total Customers, 4: Total QR Scans) */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Revenue"
          value={`${cs}${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={Wallet}
          color="emerald"
          isLoading={isDataLoading}
        />
        <StatCard
          label="Total Orders"
          value={totalOrdersCount.toLocaleString()}
          icon={ShoppingBag}
          color="orange"
          isLoading={isDataLoading}
        />
        <StatCard
          label="Total Customers"
          value={totalCustomers.toLocaleString()}
          icon={Users}
          color="indigo"
          isLoading={isDataLoading}
        />
        <StatCard
          label="Total QR Scans"
          value="0"
          icon={QrCode}
          color="cyan"
          isLoading={isDataLoading}
        />
      </div>

      {/* Operations Stat Cards Row 2 (5: Today's Bookings, 6: Expected Guests Today, 7: Currently Seated, 8: Pending Requests) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today's Bookings"
          value={todaysBookingsCount.toLocaleString()}
          icon={CalendarCheck}
          color="teal"
          isLoading={isDataLoading}
        />
        <StatCard
          label="Expected Guests Today"
          value={expectedGuestsCount.toLocaleString()}
          icon={UserCheck}
          color="blue"
          isLoading={isDataLoading}
        />
        <StatCard
          label="Currently Seated"
          value={currentlySeatedCount.toLocaleString()}
          icon={Armchair}
          color="violet"
          isLoading={isDataLoading}
        />
        <StatCard
          label="Pending Requests"
          value={pendingRequestsCount.toLocaleString()}
          icon={Clock}
          color="rose"
          isLoading={isDataLoading}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="glass rounded-2xl p-6 shadow-card lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold">Revenue this week</h3>
              <p className="text-sm text-muted-foreground">
                {selectedBranch === "All Branches" ? "Across all branches" : selectedBranch}
              </p>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <TrendingUp className="h-3 w-3" /> 0.0%
            </div>
          </div>
          {isDataLoading ? (
            <div className="mt-6 h-64 flex items-center justify-center">
              <Skeleton className="h-full w-full rounded-xl" />
            </div>
          ) : (
            <div className="mt-6 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChartData}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    fill="url(#rev)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-6 shadow-card">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg font-semibold">Recent Activity</h3>
          </div>
          {isDataLoading ? (
            <div className="mt-4 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-xl border bg-background/60 p-3"
                >
                  <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1 space-y-2 py-0.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : liveActivity.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {liveActivity.slice(0, 5).map((a, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl border bg-background/60 p-3"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <a.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{a.text}</div>
                    <div className="text-xs text-muted-foreground">{a.time}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-8 text-center text-sm text-muted-foreground py-6">
              No recent activity recorded yet.
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="glass rounded-2xl p-6 shadow-card lg:col-span-1">
          <h3 className="font-display text-lg font-semibold">Quick Actions</h3>
          <p className="text-sm text-muted-foreground">Jump straight to what matters</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {visibleQuickActions.map((q) => (
              <Link
                key={q.label}
                href={q.to}
                className="group flex flex-col items-start gap-2 rounded-xl border bg-background/60 p-4 transition hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg gradient-warm text-primary-foreground shadow-glow">
                  <q.icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium">{q.label}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl p-6 shadow-card lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquareHeart className="h-4 w-4 text-primary" />
              <h3 className="font-display text-lg font-semibold">Latest Feedback</h3>
            </div>
            <Link href="/feedback" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-8 text-center text-sm text-muted-foreground py-8 border rounded-xl bg-background/40">
            No customer feedback recorded yet.
          </div>
        </div>
      </div>
    </div>
  );
}
