"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import StatsCard from "../../../ui/StatsCard";
import DateRangePicker from "../../../ui/DateRangePicker";
import { RESTAURANTS, Branch } from "../data/restaurants";
import {
  TrendingUp,
  Users,
  ShoppingBag,
  DollarSign,
  Menu,
  Bell,
  ArrowUpRight,
  Hand,
  ChevronDown,
  CalendarDays,
  Store,
} from "lucide-react";

interface StoredLiveOrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface StoredLiveOrder {
  id: string;
  table: string;
  items: StoredLiveOrderItem[];
  status: string;
  branchId: string;
  branchName: string;
}

interface RecentOrder {
  id: string;
  table: string;
  items: string;
  total: string;
  status: string;
  time: string;
  branchId: string;
  branchName: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState("Last 30 Days");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Dynamic user roles and branch states
  const [userRole, setUserRole] = useState("admin");
  const [userDisplayName, setUserDisplayName] = useState("Color Hut Admin");
  const [selectedBranchId, setSelectedBranchId] = useState("all");
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isLoggedIn = localStorage.getItem("isLoggedIn");
      if (isLoggedIn !== "true") {
        router.replace("/login");
        return;
      }

      const role = localStorage.getItem("userRole") || "admin";
      const name = localStorage.getItem("userDisplayName") || "Color Hut Admin";
      const branchId = localStorage.getItem("userAssignedBranchId") || "";

      setUserRole(role);
      setUserDisplayName(name);

      if (role === "manager" && branchId) {
        setSelectedBranchId(branchId);
      }
    }
  }, [router]);

  // Load default branches + dynamically added branches from Settings
  useEffect(() => {
    fetch("/api/tenant/branches")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAllBranches(data);
        }
      })
      .catch((err) => console.error("Error loading branches:", err));
  }, []);

  const [liveRecentOrders, setLiveRecentOrders] = useState<RecentOrder[]>([]);

  useEffect(() => {
    fetch("/api/tenant/orders")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const mappedLive = data.map((l: any) => ({
            id: l.id,
            table: l.table,
            items: l.items.map((i: any) => `${i.quantity}x ${i.name}`).join(", "),
            total: `$${l.total.toFixed(2)}`,
            status: l.status,
            time: new Date(l.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            branchId: l.branchId,
            branchName: l.branchName,
          }));
          setLiveRecentOrders(mappedLive);
        }
      })
      .catch((err) => console.error("Error loading orders:", err));
  }, []);

  const displayNameTwoWords = userDisplayName.split(" ").slice(0, 2).join(" ");

  const handleLogout = () => {
    router.push("/login");
  };

  // Calculate Dashboard Stats dynamically from real database orders
  const getBranchStats = () => {
    const filteredOrders =
      selectedBranchId === "all"
        ? liveRecentOrders
        : liveRecentOrders.filter((o) => o.branchId === selectedBranchId);

    const activeOrdersCount = filteredOrders.filter(
      (o) => o.status === "Pending" || o.status === "Preparing" || o.status === "Ready",
    ).length;

    const completedOrders = filteredOrders.filter((o) => o.status !== "Cancelled");
    const totalRev = completedOrders.reduce((sum, o) => {
      const val = parseFloat(o.total.replace("$", ""));
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

    const filteredBranches =
      selectedBranchId === "all"
        ? allBranches
        : allBranches.filter((b) => b.id === selectedBranchId);

    const totalTables = filteredBranches.reduce((sum, b) => sum + (b.tables?.length || 0), 0);
    const occupiedTables = Math.min(activeOrdersCount, totalTables);

    const avgBillVal = completedOrders.length > 0 ? totalRev / completedOrders.length : 0;

    return [
      {
        label: "Total Revenue",
        value: `$${totalRev.toFixed(2)}`,
        icon: DollarSign,
        iconColorClass: "text-[#10B981]",
        iconBgClass: "bg-[#E6F4EA]",
      },
      {
        label: "Active Orders",
        value: activeOrdersCount.toString(),
        icon: ShoppingBag,
        iconColorClass: "text-[#EA580C]",
        iconBgClass: "bg-[#FFF3D2]",
      },
      {
        label: "Table Occupancy",
        value: `${occupiedTables} / ${totalTables || 12}`,
        icon: Users,
        iconColorClass: "text-[#1A73E8]",
        iconBgClass: "bg-[#E8F0FE]",
      },
      {
        label: "Average Bill",
        value: `$${avgBillVal.toFixed(2)}`,
        icon: TrendingUp,
        iconColorClass: "text-[#E11D48]",
        iconBgClass: "bg-[#FCE8E6]",
      },
    ];
  };

  const stats = getBranchStats();

  // Mock Chart Data (Days and heights in %)
  const getWeeklyRevenue = () => {
    const base = [
      { day: "Mon", amount: "$520", height: "45%" },
      { day: "Tue", amount: "$680", height: "60%" },
      { day: "Wed", amount: "$840", height: "75%" },
      { day: "Thu", amount: "$710", height: "65%" },
      { day: "Fri", amount: "$1,120", height: "95%" },
      { day: "Sat", amount: "$1,250", height: "100%" },
      { day: "Sun", amount: "$980", height: "85%" },
    ];
    if (selectedBranchId === "dhanmondi") {
      return base.map((b) => ({
        ...b,
        amount: `$${Math.round(parseInt(b.amount.replace("$", "").replace(",", "")) * 0.51)}`,
        height: `${Math.round(parseInt(b.height) * 0.51)}%`,
      }));
    }
    if (selectedBranchId === "gulshan") {
      return base.map((b) => ({
        ...b,
        amount: `$${Math.round(parseInt(b.amount.replace("$", "").replace(",", "")) * 0.35)}`,
        height: `${Math.round(parseInt(b.height) * 0.35)}%`,
      }));
    }
    if (selectedBranchId === "uttara") {
      return base.map((b) => ({
        ...b,
        amount: `$${Math.round(parseInt(b.amount.replace("$", "").replace(",", "")) * 0.15)}`,
        height: `${Math.round(parseInt(b.height) * 0.15)}%`,
      }));
    }
    if (selectedBranchId !== "all") {
      // Dynamic branch fallback
      return base.map((b) => ({
        ...b,
        amount: `$${Math.round(parseInt(b.amount.replace("$", "").replace(",", "")) * 0.05)}`,
        height: `${Math.round(parseInt(b.height) * 0.05)}%`,
      }));
    }
    return base;
  };

  const weeklyRevenue = getWeeklyRevenue();

  // Mock Recent Orders
  const rawRecentOrders = [
    {
      id: "ORD-8821",
      table: "04",
      items: "2x Classic Burger, 1x Truffle Fries",
      total: "$27.00",
      status: "Preparing",
      time: "5 min ago",
      branchId: "dhanmondi",
      branchName: "Dhanmondi",
    },
    {
      id: "ORD-8820",
      table: "02",
      items: "1x Truffle Mushroom Pizza, 1x Mint Lemonade",
      total: "$21.50",
      status: "Pending",
      time: "8 min ago",
      branchId: "gulshan",
      branchName: "Gulshan",
    },
    {
      id: "ORD-8819",
      table: "08",
      items: "1x Dragon Roll, 1x Sichuan Wontons",
      total: "$33.50",
      status: "Served",
      time: "15 min ago",
      branchId: "uttara",
      branchName: "Uttara",
    },
    {
      id: "ORD-8818",
      table: "02",
      items: "3x Carbonara Pasta, 3x Soft Drinks",
      total: "$62.00",
      status: "Paid",
      time: "22 min ago",
      branchId: "dhanmondi",
      branchName: "Dhanmondi",
    },
  ];

  const recentOrders =
    selectedBranchId === "all"
      ? [...liveRecentOrders, ...rawRecentOrders]
      : [...liveRecentOrders, ...rawRecentOrders].filter((o) => o.branchId === selectedBranchId);

  // Mock Popular Items
  const popularItems = [
    { name: "Smoked BBQ Bacon Burger", orders: 142, revenue: "$1,775", rating: 4.9 },
    { name: "Truffle Mushroom Pizza", orders: 118, revenue: "$2,124", rating: 4.8 },
    { name: "Dragon Sushi Roll Platter", orders: 96, revenue: "$2,160", rating: 5.0 },
    { name: "Truffle Parmesan Fries", orders: 84, revenue: "$420", rating: 4.7 },
  ];

  const getSelectedBranchName = () => {
    if (selectedBranchId === "all") return "All Branches";
    const found = allBranches.find((b) => b.id === selectedBranchId);
    return found ? found.name : "Branch";
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex text-slate-800 font-sans overflow-hidden">
      {/* Desktop Sidebar (Left side, sticky) */}
      <div className="hidden lg:flex h-screen shrink-0">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          ordersCount={0}
          handleLogout={handleLogout}
          isCollapsed={isCollapsed}
          onToggleSidebar={() => setIsCollapsed(!isCollapsed)}
        />
      </div>

      {/* Mobile Drawer Sidebar overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden bg-black/60 backdrop-blur-sm transition-opacity duration-300">
          <div className="relative animate-in slide-in-from-left duration-200">
            <Sidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              ordersCount={0}
              handleLogout={handleLogout}
              isMobile={true}
              isCollapsed={false}
              onCloseMobile={() => setIsMobileOpen(false)}
            />
          </div>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="flex-1 h-full cursor-default focus:outline-none"
            aria-label="Close menu"
          />
        </div>
      )}

      {/* Main Dashboard Panel */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Top Navbar */}
        <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 text-slate-650 transition-colors"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-[17px] font-semibold tracking-wide text-slate-800 ml-4 lg:ml-6">
              Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-850 transition-colors relative">
                <Bell className="w-[18px] h-[18px]" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#ff7a00] ring-2 ring-white" />
              </button>
            </div>

            <div className="h-8 w-px bg-slate-205" />

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-linear-to-tr from-[#ff7a00] to-amber-500 flex items-center justify-center font-bold text-xs text-white">
                CH
              </div>
              <span className="hidden md:inline text-xs font-semibold text-slate-600">
                {userDisplayName}
              </span>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="p-6 w-full flex-1 flex flex-col gap-6">
          {/* Section: Welcome */}
          <div className="bg-linear-to-r from-[#1c2b4a] to-[#f97415] text-white p-6 sm:p-8 rounded-xl shadow-xl print:hidden">
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center">
              Welcome {displayNameTwoWords}{" "}
              <Hand className="ml-2 h-7 w-7 transform rotate-20 text-yellow-300" />
            </h1>
            <p className="text-sm sm:text-base text-white/90 mt-1">
              Here&apos;s an overview of your business activity.
            </p>
          </div>

          {/* Section: Filter Controls */}
          <div
            className={`${userRole === "admin" ? "grid grid-cols-2 gap-3 sm:gap-4" : "flex justify-end"} mb-6 print:hidden`}
          >
            {userRole === "admin" && (
              <div className="border text-card-foreground shadow-sm bg-card rounded-xl sm:rounded-lg">
                <div className="p-2.5 sm:p-4 flex flex-col sm:flex-row items-center sm:justify-between space-y-2 sm:space-y-0 text-center sm:text-left">
                  <div className="flex items-center text-[10px] sm:text-sm text-muted-foreground font-semibold sm:font-normal uppercase sm:capitalize tracking-wider sm:tracking-normal">
                    <Store className="h-3.5 w-3.5 sm:h-5 sm:w-5 mr-1.5 sm:mr-2 text-primary/80" />
                    <span>Select Branch</span>
                  </div>
                  <div className="relative w-full sm:w-auto flex justify-center sm:justify-end">
                    <button
                      onClick={() => {
                        if (userRole === "admin") {
                          setIsBranchDropdownOpen(!isBranchDropdownOpen);
                        }
                      }}
                      disabled={userRole !== "admin"}
                      className={`inline-flex items-center justify-between gap-2 whitespace-nowrap font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-[#E1E7EF] rounded-[10px] px-3 text-xs h-9 sm:h-10 truncate w-full sm:w-[160px] ${
                        userRole === "admin"
                          ? "bg-[#EEEFF2] hover:bg-[#E2E4E8] cursor-pointer text-slate-800"
                          : "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                      }`}
                      type="button"
                    >
                      <span>{getSelectedBranchName()}</span>
                      {userRole === "admin" && (
                        <ChevronDown className="ml-1.5 h-3.5 w-3.5 opacity-70" />
                      )}
                    </button>

                    {isBranchDropdownOpen && (
                      <div className="absolute right-0 top-11 z-50 w-full sm:w-[180px] bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                        {userRole === "admin" && (
                          <button
                            onClick={() => {
                              setSelectedBranchId("all");
                              setIsBranchDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-slate-50 transition-colors ${
                              selectedBranchId === "all" ? "text-[#ff7a00]" : "text-slate-700"
                            }`}
                          >
                            All Branches
                          </button>
                        )}
                        {allBranches.map((branch) => (
                          <button
                            key={branch.id}
                            onClick={() => {
                              setSelectedBranchId(branch.id);
                              setIsBranchDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-slate-50 transition-colors ${
                              selectedBranchId === branch.id ? "text-[#ff7a00]" : "text-slate-700"
                            }`}
                          >
                            {branch.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div
              className={`border text-card-foreground shadow-sm bg-card rounded-xl sm:rounded-lg ${userRole !== "admin" ? "w-full sm:w-[320px]" : ""}`}
            >
              <div className="p-2.5 sm:p-4 flex flex-col sm:flex-row items-center sm:justify-between space-y-2 sm:space-y-0 text-center sm:text-left">
                <div className="flex items-center text-[10px] sm:text-sm text-muted-foreground font-semibold sm:font-normal uppercase sm:capitalize tracking-wider sm:tracking-normal">
                  <CalendarDays className="h-3.5 w-3.5 sm:h-5 sm:w-5 mr-1.5 sm:mr-2 text-primary/80" />
                  <span>Filter</span>
                </div>
                <div className="relative w-full sm:w-auto">
                  <button
                    onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                    className="inline-flex items-center justify-between gap-2 whitespace-nowrap font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-[#E1E7EF] bg-[#EEEFF2] hover:bg-[#E2E4E8] rounded-[10px] px-3 text-xs h-9 sm:h-10 truncate w-full sm:w-auto"
                    type="button"
                    id="radix-_r_1p_"
                    aria-haspopup="menu"
                    aria-expanded={isDatePickerOpen}
                    data-state={isDatePickerOpen ? "open" : "closed"}
                  >
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 opacity-85" />
                      <span className="truncate">{selectedRange}</span>
                    </div>
                    <ChevronDown className="ml-1.5 h-3.5 w-3.5 opacity-70" />
                  </button>

                  {/* Date Range Picker Dropdown Popover */}
                  <DateRangePicker
                    selectedRange={selectedRange}
                    onRangeChange={setSelectedRange}
                    isOpen={isDatePickerOpen}
                    onClose={() => setIsDatePickerOpen(false)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section: Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            {stats.map((stat, i) => (
              <StatsCard
                key={i}
                label={stat.label}
                value={stat.value}
                icon={stat.icon}
                iconColorClass={stat.iconColorClass}
                iconBgClass={stat.iconBgClass}
              />
            ))}
          </div>

          {/* Section: Chart & Popular Items */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Chart Block */}
            <div className="bg-white border border-slate-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-4 xl:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-wide">
                    Weekly Revenue Trend
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Track earnings growth across the week
                  </p>
                </div>
                <div className="px-3 py-1 bg-slate-100 rounded-lg text-[11px] font-medium text-slate-655">
                  This Week
                </div>
              </div>

              {/* Custom SVG/HTML Bar Chart */}
              <div className="h-[210px] w-full flex items-end gap-3 px-2 pt-6 pb-2 select-none">
                {weeklyRevenue.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center gap-2 group h-full justify-end relative"
                  >
                    {/* Tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute translate-y-[-140%] bg-slate-850 text-white font-semibold text-[10px] py-1 px-2 rounded shadow-md pointer-events-none z-10">
                      {item.amount}
                    </div>
                    {/* Bar */}
                    <div
                      style={{ height: item.height }}
                      className="w-full rounded-[8px] bg-linear-to-t from-[#ff7a00]/70 to-[#ff7a00] group-hover:from-amber-500 group-hover:to-[#ff7a00] transition-all duration-300 relative shadow-[0_2px_8px_rgba(255,122,0,0.15)] overflow-hidden"
                    >
                      {/* Highlight sweep */}
                      <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    </div>
                    {/* Label */}
                    <span className="text-[10px] font-semibold text-slate-500 group-hover:text-slate-800 transition-colors">
                      {item.day}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Popular Items Block */}
            <div className="bg-white border border-slate-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-wide">Popular Choices</h3>
                <p className="text-[11px] text-slate-500">Most requested dishes today</p>
              </div>

              <div className="flex flex-col gap-3.5">
                {popularItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
                  >
                    <div className="flex flex-col gap-1 max-w-[70%]">
                      <span className="text-xs font-semibold text-slate-800 truncate">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1.5">
                        <span>{item.orders} orders</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span className="text-[#ff7a00] font-medium">★ {item.rating}</span>
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs font-bold text-slate-900">{item.revenue}</span>
                      <span className="text-[9px] text-emerald-600 font-bold uppercase flex items-center">
                        Active <ArrowUpRight className="w-2.5 h-2.5 ml-0.5" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section: Recent Live Orders */}
          <div className="bg-white border border-slate-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-wide flex items-center gap-2">
                  <span>Recent Activity Log</span>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Live order state notifications from tablet scans
                </p>
              </div>
              <button
                onClick={() => router.push("/orders")}
                className="text-[10px] font-bold text-[#ff7a00] hover:text-slate-800 uppercase tracking-wider transition-colors"
              >
                View All Orders
              </button>
            </div>

            <div className="overflow-x-auto scrollbar-none">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold tracking-wider uppercase text-slate-500">
                    <th className="pb-3 pl-2">Order ID</th>
                    {selectedBranchId === "all" && <th className="pb-3">Branch</th>}
                    <th className="pb-3">Table</th>
                    <th className="pb-3">Items</th>
                    <th className="pb-3 text-right">Price</th>
                    <th className="pb-3 text-center">Status</th>
                    <th className="pb-3 text-right pr-2">Elapsed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {recentOrders.map((ord, idx) => {
                    let statusColor = "text-slate-500 bg-slate-100 border-slate-200/50";
                    if (ord.status === "Preparing")
                      statusColor = "text-amber-600 bg-amber-50 border-amber-200/50";
                    if (ord.status === "Pending")
                      statusColor = "text-[#ff7a00] bg-orange-550/10 border-orange-200/50";
                    if (ord.status === "Served")
                      statusColor = "text-blue-600 bg-blue-50 border-blue-200/50";
                    if (ord.status === "Paid")
                      statusColor = "text-emerald-600 bg-emerald-50 border-emerald-200/50";

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="py-3.5 pl-2 font-semibold text-slate-700 group-hover:text-slate-900">
                          {ord.id}
                        </td>
                        {selectedBranchId === "all" && (
                          <td className="py-3.5 font-semibold text-slate-500">
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-medium">
                              {ord.branchName}
                            </span>
                          </td>
                        )}
                        <td className="py-3.5 font-bold text-[#ff7a00]">Table {ord.table}</td>
                        <td className="py-3.5 text-slate-600 max-w-[200px] truncate">
                          {ord.items}
                        </td>
                        <td className="py-3.5 text-right font-bold text-slate-900">{ord.total}</td>
                        <td className="py-3.5 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor}`}
                          >
                            {ord.status}
                          </span>
                        </td>
                        <td className="py-3.5 text-right pr-2 text-slate-550">{ord.time}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
