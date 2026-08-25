"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  LayoutGrid,
  Store,
  Users,
  LogOut,
  Plus,
  Search,
  Edit,
  Trash2,
  Layers,
  ShoppingBag,
  DollarSign,
  Utensils,
  Store as StoreIcon,
  Shield,
  UserCheck,
  UserX,
  X,
  RefreshCw,
} from "lucide-react";
import StatsCard from "../../../ui/StatsCard";
import Button from "../../../ui/button";
import Toast from "../../../ui/toast";

interface Stats {
  restaurants: number;
  branches: number;
  menuItems: number;
  orders: number;
  revenue: number;
}

interface Restaurant {
  id: number;
  name: string;
  username: string;
  cuisine: string;
  rating: string;
  reviews: string;
  price: string;
  time: string;
  location: string;
  image: string;
  logo_image: string;
  logo?: string;
  logo_bg?: string;
  phone: string;
  operating_hours: string;
  facilities: string;
  branchCount: number;
  menuCount: number;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  restaurantId: number | null;
  restaurantName: string | null;
  assignedBranchId: string | null;
  avatar: string | null;
  status: string;
  created_at: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "restaurants" | "users">("overview");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [adminName, setAdminName] = useState("System Admin");
  const [adminEmail, setAdminEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Stats State
  const [stats, setStats] = useState<Stats>({
    restaurants: 0,
    branches: 0,
    menuItems: 0,
    orders: 0,
    revenue: 0,
  });

  // Data States
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Search Query States
  const [searchQuery, setSearchQuery] = useState("");

  // Modals States
  const [isRestaurantModalOpen, setIsRestaurantModalOpen] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Confirm delete states
  const [deletingRestaurantId, setDeletingRestaurantId] = useState<number | null>(null);
  const [deleteConfirmSlug, setDeleteConfirmSlug] = useState("");
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);

  // Form inputs for Restaurant
  const [restName, setRestName] = useState("");
  const [restUsername, setRestUsername] = useState("");
  const [restCuisine, setRestCuisine] = useState("");
  const [restPrice, setRestPrice] = useState("$$");
  const [restTime, setRestTime] = useState("20-30 min");
  const [restLocation, setRestLocation] = useState("");
  const [restPhone, setRestPhone] = useState("");
  const [restHours, setRestHours] = useState("");
  const [restFacilities, setRestFacilities] = useState("");
  const [restImage, setRestImage] = useState("");
  const [restLogoImage, setRestLogoImage] = useState("");

  // Form inputs for User
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRole, setUserRole] = useState("admin");
  const [userRestId, setUserRestId] = useState<string>("null"); // "null" represents global admin
  const [userStatus, setUserStatus] = useState("Active");
  const [userAvatar, setUserAvatar] = useState("");

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Auth check & initial fetch
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (
          data.authenticated &&
          (data.user.restaurantId === null || data.user.role === "system_admin")
        ) {
          setAdminName(data.user.name);
          setAdminEmail(data.user.email);
          setIsCheckingAuth(false);
        } else {
          router.replace("/login");
        }
      })
      .catch(() => {
        router.replace("/login");
      });
  }, [router]);

  // Fetch stats, restaurants, and users
  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/stats");
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const fetchRestaurants = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin/restaurants");
      const data = await res.json();
      if (data.success) {
        setRestaurants(data.restaurants);
      }
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
      console.error("Error fetching restaurants:", err);
    }
  };

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      }
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
      console.error("Error fetching users:", err);
    }
  };

  useEffect(() => {
    if (!isCheckingAuth) {
      fetchStats();
      if (activeTab === "restaurants") {
        fetchRestaurants();
      } else if (activeTab === "users") {
        fetchUsers();
        fetchRestaurants(); // needed for user dropdown association
      }
    }
  }, [isCheckingAuth, activeTab]);

  // Auto-slugify restaurant name
  useEffect(() => {
    if (!editingRestaurant && activeTab === "restaurants") {
      const slug = restName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 50);
      setRestUsername(slug);
    }
  }, [restName, editingRestaurant, activeTab]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      localStorage.clear();
      router.replace("/login");
    } catch {
      showToast("Failed to log out.", "error");
    }
  };

  // Open/Close and prep modals
  const openRestaurantModal = (rest: Restaurant | null = null) => {
    if (rest) {
      setEditingRestaurant(rest);
      setRestName(rest.name);
      setRestUsername(rest.username);
      setRestCuisine(rest.cuisine);
      setRestPrice(rest.price);
      setRestTime(rest.time);
      setRestLocation(rest.location);
      setRestPhone(rest.phone);
      setRestHours(rest.operating_hours);
      setRestFacilities(rest.facilities);
      setRestImage(rest.image);
      setRestLogoImage(rest.logo_image);
    } else {
      setEditingRestaurant(null);
      setRestName("");
      setRestUsername("");
      setRestCuisine("");
      setRestPrice("$$");
      setRestTime("20-30 min");
      setRestLocation("");
      setRestPhone("");
      setRestHours("");
      setRestFacilities("");
      setRestImage("");
      setRestLogoImage("");
    }
    setIsRestaurantModalOpen(true);
  };

  const openUserModal = (u: User | null = null) => {
    if (u) {
      setEditingUser(u);
      setUserName(u.name);
      setUserEmail(u.email);
      setUserPassword(""); // Don't prefill password
      setUserRole(u.role);
      setUserRestId(u.restaurantId ? String(u.restaurantId) : "null");
      setUserStatus(u.status);
      setUserAvatar(u.avatar || "");
    } else {
      setEditingUser(null);
      setUserName("");
      setUserEmail("");
      setUserPassword("");
      setUserRole("admin");
      setUserRestId("null");
      setUserStatus("Active");
      setUserAvatar("");
    }
    setIsUserModalOpen(true);
  };

  // Save Restaurant
  const handleSaveRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restName || !restUsername) {
      showToast("Name and Username slug are required.", "error");
      return;
    }

    const payload = {
      name: restName,
      username: restUsername,
      cuisine: restCuisine,
      price: restPrice,
      time: restTime,
      location: restLocation,
      phone: restPhone,
      operating_hours: restHours,
      facilities: restFacilities,
      image: restImage,
      logo_image: restLogoImage,
    };

    const url = editingRestaurant
      ? `/api/admin/restaurants/${editingRestaurant.id}`
      : "/api/admin/restaurants";
    const method = editingRestaurant ? "PUT" : "POST";

    try {
      setIsLoading(true);
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setIsLoading(false);

      if (res.ok && data.success) {
        showToast(editingRestaurant ? "Restaurant updated!" : "Restaurant created!", "success");
        setIsRestaurantModalOpen(false);
        fetchRestaurants();
        fetchStats();
      } else {
        showToast(data.error || "An error occurred.", "error");
      }
    } catch {
      setIsLoading(false);
      showToast("Network request failed.", "error");
    }
  };

  // Delete Restaurant
  const handleDeleteRestaurant = async (id: number) => {
    const target = restaurants.find((r) => r.id === id);
    if (!target) return;

    if (deleteConfirmSlug.toLowerCase().trim() !== target.username.toLowerCase().trim()) {
      showToast("Slug verification failed. Please check the slug.", "error");
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch(`/api/admin/restaurants/${id}`, { method: "DELETE" });
      const data = await res.json();
      setIsLoading(false);

      if (res.ok && data.success) {
        showToast("Restaurant deleted successfully.", "success");
        setDeletingRestaurantId(null);
        setDeleteConfirmSlug("");
        fetchRestaurants();
        fetchStats();
      } else {
        showToast(data.error || "Failed to delete.", "error");
      }
    } catch {
      setIsLoading(false);
      showToast("Network request failed.", "error");
    }
  };

  // Save User
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName || !userEmail || !userRole) {
      showToast("Name, email and role are required.", "error");
      return;
    }
    if (!editingUser && !userPassword) {
      showToast("Password is required for new users.", "error");
      return;
    }

    const payload = {
      name: userName,
      email: userEmail,
      password: userPassword,
      role: userRole,
      restaurantId: userRestId === "null" ? null : parseInt(userRestId, 10),
      status: userStatus,
      avatar: userAvatar,
    };

    const url = editingUser ? `/api/admin/users/${editingUser.id}` : "/api/admin/users";
    const method = editingUser ? "PUT" : "POST";

    try {
      setIsLoading(true);
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setIsLoading(false);

      if (res.ok && data.success) {
        showToast(editingUser ? "User updated!" : "User created!", "success");
        setIsUserModalOpen(false);
        fetchUsers();
        fetchStats();
      } else {
        showToast(data.error || "An error occurred.", "error");
      }
    } catch {
      setIsLoading(false);
      showToast("Network request failed.", "error");
    }
  };

  // Delete User
  const handleDeleteUser = async (id: number) => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const data = await res.json();
      setIsLoading(false);

      if (res.ok && data.success) {
        showToast("User deleted successfully.", "success");
        setDeletingUserId(null);
        fetchUsers();
        fetchStats();
      } else {
        showToast(data.error || "Failed to delete.", "error");
      }
    } catch {
      setIsLoading(false);
      showToast("Network request failed.", "error");
    }
  };

  // Search and Filter Logic
  const filteredRestaurants = useMemo(() => {
    if (!searchQuery) return restaurants;
    const q = searchQuery.toLowerCase();
    return restaurants.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.username.toLowerCase().includes(q) ||
        r.cuisine.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q),
    );
  }, [restaurants, searchQuery]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        (u.restaurantName && u.restaurantName.toLowerCase().includes(q)),
    );
  }, [users, searchQuery]);

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-deep-emerald-950 flex flex-col items-center justify-center text-white font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium tracking-wide text-neutral-400">
            Verifying administrative access...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans selection:bg-emerald-800 selection:text-white">
      {/* Toast Notification Container */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-top-4 duration-300">
          <Toast text={toast.text} type={toast.type} onClose={() => setToast(null)} />
        </div>
      )}

      {/* Glassmorphic Sidebar */}
      <aside className="w-64 bg-deep-emerald-950 text-white shrink-0 flex flex-col border-r border-deep-emerald-900 shadow-2xl relative z-20">
        <div className="p-6 border-b border-deep-emerald-900 flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-black text-lg shadow-md shadow-emerald-500/20">
              M
            </div>
            <span className="text-[19px] font-bold tracking-[-0.02em] text-white">MenuVerse</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest pl-11">
            System Control
          </span>
        </div>

        {/* Sidebar Nav */}
        <nav className="flex-1 px-4 py-6 flex flex-col gap-2">
          <button
            onClick={() => {
              setActiveTab("overview");
              setSearchQuery("");
            }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-xs font-semibold leading-none cursor-pointer ${
              activeTab === "overview"
                ? "bg-emerald-800 text-white shadow-lg shadow-emerald-900/30"
                : "text-slate-400 hover:text-white hover:bg-deep-emerald-900/40"
            }`}
          >
            <LayoutGrid className="w-4 h-4 shrink-0" />
            Overview Dashboard
          </button>

          <button
            onClick={() => {
              setActiveTab("restaurants");
              setSearchQuery("");
            }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-xs font-semibold leading-none cursor-pointer ${
              activeTab === "restaurants"
                ? "bg-emerald-800 text-white shadow-lg shadow-emerald-900/30"
                : "text-slate-400 hover:text-white hover:bg-deep-emerald-900/40"
            }`}
          >
            <Store className="w-4 h-4 shrink-0" />
            Manage Tenants
          </button>

          <button
            onClick={() => {
              setActiveTab("users");
              setSearchQuery("");
            }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-xs font-semibold leading-none cursor-pointer ${
              activeTab === "users"
                ? "bg-emerald-800 text-white shadow-lg shadow-emerald-900/30"
                : "text-slate-400 hover:text-white hover:bg-deep-emerald-900/40"
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            Manage Accounts
          </button>
        </nav>

        {/* Profile Card & Logout */}
        <div className="p-4 border-t border-deep-emerald-900 flex flex-col gap-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs text-white uppercase shrink-0 border border-slate-600">
              {adminName.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-200 truncate">{adminName}</p>
              <p className="text-[9px] font-medium text-emerald-500 truncate">{adminEmail}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2.5 w-full bg-deep-emerald-900/60 hover:bg-red-950/40 border border-deep-emerald-800 hover:border-red-900/40 text-xs font-bold text-slate-300 hover:text-red-200 py-2.5 rounded-xl transition-all cursor-pointer active:scale-[0.98]"
          >
            <LogOut className="w-3.5 h-3.5" />
            Log Out Panel
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Header bar */}
        <header className="h-[70px] bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 relative z-10">
          <div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight capitalize">
              {activeTab === "overview" ? "Dashboard Stats" : activeTab}
            </h1>
            <p className="text-[11px] font-semibold text-slate-400">Global Platform Control Area</p>
          </div>

          <div className="flex items-center gap-4">
            {activeTab !== "overview" && (
              <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-emerald-500 shadow-inner w-64 h-[38px] transition-colors">
                <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder={`Search ${activeTab}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs font-semibold w-full text-slate-700 placeholder-slate-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}

            <button
              onClick={() => {
                if (activeTab === "restaurants") fetchRestaurants();
                else if (activeTab === "users") fetchUsers();
                fetchStats();
                showToast("Data refreshed!");
              }}
              title="Refresh Data"
              className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 active:scale-95 text-slate-500 transition-all cursor-pointer flex items-center justify-center"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {activeTab === "restaurants" && (
              <Button
                onClick={() => openRestaurantModal()}
                className="h-[38px] flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                New Tenant
              </Button>
            )}

            {activeTab === "users" && (
              <Button onClick={() => openUserModal()} className="h-[38px] flex items-center gap-2">
                <Plus className="w-3.5 h-3.5" />
                Add User
              </Button>
            )}
          </div>
        </header>

        {/* Content Wrapper */}
        <div className="p-8 flex-1 min-w-0">
          {/* TAB: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="flex flex-col gap-8">
              {/* Stats Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatsCard
                  label="Total Restaurants"
                  value={String(stats.restaurants)}
                  icon={StoreIcon}
                  iconColorClass="text-indigo-500"
                  iconBgClass="bg-indigo-50"
                />
                <StatsCard
                  label="Total Branches"
                  value={String(stats.branches)}
                  icon={Layers}
                  iconColorClass="text-teal-500"
                  iconBgClass="bg-teal-50"
                />
                <StatsCard
                  label="Menu Items Listed"
                  value={String(stats.menuItems)}
                  icon={Utensils}
                  iconColorClass="text-amber-500"
                  iconBgClass="bg-amber-50"
                />
                <StatsCard
                  label="Total Orders Received"
                  value={String(stats.orders)}
                  icon={ShoppingBag}
                  iconColorClass="text-rose-500"
                  iconBgClass="bg-rose-50"
                />
                <StatsCard
                  label="Platform Revenue"
                  value={`$${stats.revenue.toFixed(2)}`}
                  icon={DollarSign}
                  iconColorClass="text-emerald-500"
                  iconBgClass="bg-emerald-50"
                />
              </div>

              {/* Overview Details Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-500" />
                    Platform Admin Security Rules
                  </h3>
                  <div className="space-y-4 text-xs font-semibold text-slate-600">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex gap-3">
                      <div className="w-5 h-5 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                        1
                      </div>
                      <p>
                        <strong>Global Multi-Tenant Routing</strong>: Each tenant (restaurant) is
                        isolated using its own slug. A tenant user belongs only to their respective
                        restaurant ID.
                      </p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex gap-3">
                      <div className="w-5 h-5 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                        2
                      </div>
                      <p>
                        <strong>System Administation Privilege</strong>: Global admins are created
                        with a null restaurant association. Only they have credentials to invoke
                        CRUD actions on restaurants and create new restaurant managers.
                      </p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex gap-3">
                      <div className="w-5 h-5 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                        3
                      </div>
                      <p>
                        <strong>Cache Eviction</strong>: Modifying or deleting a restaurant
                        automatically evicts its profile and branch list details from the Redis
                        database cache.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 tracking-tight mb-2">
                      System Status
                    </h3>
                    <p className="text-[11px] font-semibold text-slate-400 mb-6">
                      Connected Services Info
                    </p>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <span className="text-xs font-bold text-slate-500">MySQL Database</span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          ONLINE
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <span className="text-xs font-bold text-slate-500">
                          Redis Cache Storage
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          ONLINE
                        </span>
                      </div>
                      <div className="flex items-center justify-between pb-1">
                        <span className="text-xs font-bold text-slate-500">Next.js Dev Server</span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          ACTIVE
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400">
                    <span>Local Server Port</span>
                    <span className="font-mono text-slate-600">3000</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: RESTAURANTS */}
          {activeTab === "restaurants" && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-4 px-6">ID</th>
                      <th className="py-4 px-6">Restaurant Details</th>
                      <th className="py-4 px-6">Username Slug</th>
                      <th className="py-4 px-6">Cuisine</th>
                      <th className="py-4 px-6">Branches</th>
                      <th className="py-4 px-6">Menu Items</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-600">
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                          Loading restaurants...
                        </td>
                      </tr>
                    ) : filteredRestaurants.length > 0 ? (
                      filteredRestaurants.map((rest) => (
                        <tr key={rest.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-6 font-mono text-slate-400">{rest.id}</td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              {rest.logo_image ? (
                                <Image
                                  src={rest.logo_image}
                                  alt={rest.name}
                                  width={32}
                                  height={32}
                                  className="w-8 h-8 rounded-lg object-cover border border-slate-200"
                                />
                              ) : (
                                <div
                                  className={`w-8 h-8 rounded-lg bg-linear-to-br ${rest.logo_bg || "from-emerald-500 to-teal-600"} flex items-center justify-center font-bold text-white text-xs`}
                                >
                                  {rest.logo}
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-slate-800 text-[13px]">{rest.name}</p>
                                <p className="text-[10px] text-slate-400">
                                  {rest.location || "No location set"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] border border-slate-200/50">
                              /{rest.username}
                            </span>
                          </td>
                          <td className="py-4 px-6 font-medium text-slate-700">{rest.cuisine}</td>
                          <td className="py-4 px-6 font-mono">{rest.branchCount}</td>
                          <td className="py-4 px-6 font-mono">{rest.menuCount}</td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openRestaurantModal(rest)}
                                className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-slate-800 active:scale-95 text-slate-400 transition-all cursor-pointer"
                                title="Edit Restaurant"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setDeletingRestaurantId(rest.id);
                                  setDeleteConfirmSlug("");
                                }}
                                className="p-2 border border-slate-200 rounded-xl hover:bg-red-50 hover:text-red-600 active:scale-95 text-slate-400 transition-all cursor-pointer"
                                title="Delete Restaurant"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          No restaurants found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: USERS */}
          {activeTab === "users" && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-4 px-6">Name</th>
                      <th className="py-4 px-6">Email</th>
                      <th className="py-4 px-6">Role</th>
                      <th className="py-4 px-6">Associated Restaurant</th>
                      <th className="py-4 px-6">Status</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-600">
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                          Loading users...
                        </td>
                      </tr>
                    ) : filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => {
                        const isSelf = user.email === adminEmail;
                        return (
                          <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                {user.avatar ? (
                                  <Image
                                    src={user.avatar}
                                    alt={user.name}
                                    width={32}
                                    height={32}
                                    className="w-8 h-8 rounded-full object-cover border border-slate-200"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-bold flex items-center justify-center text-[10px] uppercase">
                                    {user.name.slice(0, 2)}
                                  </div>
                                )}
                                <div>
                                  <p className="font-bold text-slate-800 text-[13px]">
                                    {user.name}{" "}
                                    {isSelf && (
                                      <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded ml-1">
                                        You
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-6 text-slate-700 font-medium">{user.email}</td>
                            <td className="py-4 px-6">
                              {user.restaurantId === null || user.role === "system_admin" ? (
                                <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-md font-bold text-[10px]">
                                  <Shield className="w-2.5 h-2.5" />
                                  SYSTEM ADMIN
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-md font-bold text-[10px] capitalize">
                                  {user.role}
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-6">
                              {user.restaurantId === null ? (
                                <span className="text-slate-400 italic">Platform (Global)</span>
                              ) : (
                                <span className="font-medium text-slate-700">
                                  {user.restaurantName || `Restaurant ID: ${user.restaurantId}`}
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-6">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                  user.status === "Active"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                    : user.status === "Banned"
                                      ? "bg-red-50 text-red-700 border-red-100"
                                      : "bg-amber-50 text-amber-700 border-amber-100"
                                }`}
                              >
                                {user.status === "Active" ? (
                                  <UserCheck className="w-2.5 h-2.5" />
                                ) : (
                                  <UserX className="w-2.5 h-2.5" />
                                )}
                                {user.status}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => openUserModal(user)}
                                  className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-slate-800 active:scale-95 text-slate-400 transition-all cursor-pointer"
                                  title="Edit User"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeletingUserId(user.id)}
                                  disabled={isSelf}
                                  className={`p-2 border border-slate-200 rounded-xl hover:bg-red-50 hover:text-red-600 active:scale-95 text-slate-400 transition-all ${
                                    isSelf ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
                                  }`}
                                  title={isSelf ? "You cannot delete yourself" : "Delete User"}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL: ADD/EDIT RESTAURANT */}
      {isRestaurantModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h2 className="text-base font-bold text-slate-800 tracking-tight">
                {editingRestaurant ? "Edit Restaurant Profile" : "Create New Restaurant"}
              </h2>
              <button
                onClick={() => setIsRestaurantModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRestaurant} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Restaurant Name
                  </label>
                  <input
                    type="text"
                    required
                    value={restName}
                    onChange={(e) => setRestName(e.target.value)}
                    placeholder="e.g. Burger Craft Lab"
                    className="border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 focus:bg-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Username Slug (URL)
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-4 text-xs font-bold text-slate-400">/</span>
                    <input
                      type="text"
                      required
                      value={restUsername}
                      onChange={(e) => setRestUsername(e.target.value)}
                      placeholder="e.g. burgercraftlab"
                      className="border border-slate-200 rounded-xl pl-7 pr-4 py-2.5 text-xs font-mono text-slate-700 bg-slate-50 focus:bg-white focus:border-emerald-500 outline-none w-full"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Cuisine
                  </label>
                  <input
                    type="text"
                    value={restCuisine}
                    onChange={(e) => setRestCuisine(e.target.value)}
                    placeholder="e.g. Gourmet Burgers"
                    className="border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 focus:bg-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Price Tier
                  </label>
                  <select
                    value={restPrice}
                    onChange={(e) => setRestPrice(e.target.value)}
                    className="border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 focus:bg-white focus:border-emerald-500 outline-none h-[38px]"
                  >
                    <option value="$">$ (Inexpensive)</option>
                    <option value="$$">$$ (Moderate)</option>
                    <option value="$$$">$$$ (Expensive)</option>
                    <option value="$$$$">$$$$ (Very Expensive)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Estimated Prep Time
                  </label>
                  <input
                    type="text"
                    value={restTime}
                    onChange={(e) => setRestTime(e.target.value)}
                    placeholder="e.g. 15-25 min"
                    className="border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 focus:bg-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={restPhone}
                    onChange={(e) => setRestPhone(e.target.value)}
                    placeholder="e.g. +880 1712-345678"
                    className="border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 focus:bg-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Location Address
                  </label>
                  <input
                    type="text"
                    value={restLocation}
                    onChange={(e) => setRestLocation(e.target.value)}
                    placeholder="e.g. Dhanmondi, Dhaka"
                    className="border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 focus:bg-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Operating Hours
                  </label>
                  <input
                    type="text"
                    value={restHours}
                    onChange={(e) => setRestHours(e.target.value)}
                    placeholder="e.g. Open Daily: 11:00 AM - 11:00 PM"
                    className="border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 focus:bg-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Facilities (Comma Separated)
                  </label>
                  <input
                    type="text"
                    value={restFacilities}
                    onChange={(e) => setRestFacilities(e.target.value)}
                    placeholder="e.g. Air Conditioned, Wifi, Parking"
                    className="border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 focus:bg-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Banner Image URL
                  </label>
                  <input
                    type="url"
                    value={restImage}
                    onChange={(e) => setRestImage(e.target.value)}
                    placeholder="https://example.com/banner.jpg"
                    className="border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 focus:bg-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Logo Image URL
                  </label>
                  <input
                    type="url"
                    value={restLogoImage}
                    onChange={(e) => setRestLogoImage(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 focus:bg-white focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsRestaurantModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all cursor-pointer active:scale-95"
                >
                  Cancel
                </button>
                <Button type="submit">{isLoading ? "Saving..." : "Save Restaurant"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD/EDIT USER */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h2 className="text-base font-bold text-slate-800 tracking-tight">
                {editingUser ? "Edit Account Profile" : "Create Administrative User"}
              </h2>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="e.g. manager@example.com"
                  className="border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Password{" "}
                  {editingUser && (
                    <span className="text-[9px] text-slate-400 uppercase font-medium">
                      (Leave blank to keep unchanged)
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  placeholder={editingUser ? "••••••••" : "At least 6 characters"}
                  className="border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Role Designation
                </label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  className="border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 focus:bg-white focus:border-emerald-500 outline-none h-[38px]"
                >
                  <option value="system_admin">System Admin (Global)</option>
                  <option value="admin">Restaurant Admin</option>
                  <option value="manager">Restaurant Manager</option>
                  <option value="staff">Restaurant Staff</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Associated Tenant / Restaurant
                </label>
                <select
                  value={userRestId}
                  onChange={(e) => setUserRestId(e.target.value)}
                  className="border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 focus:bg-white focus:border-emerald-500 outline-none h-[38px]"
                >
                  <option value="null">None (Global System Admin)</option>
                  {restaurants.map((rest) => (
                    <option key={rest.id} value={rest.id}>
                      {rest.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Status
                </label>
                <select
                  value={userStatus}
                  onChange={(e) => setUserStatus(e.target.value)}
                  className="border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 focus:bg-white focus:border-emerald-500 outline-none h-[38px]"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Banned">Banned</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Avatar Image URL
                </label>
                <input
                  type="url"
                  value={userAvatar}
                  onChange={(e) => setUserAvatar(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all cursor-pointer active:scale-95"
                >
                  Cancel
                </button>
                <Button type="submit">{isLoading ? "Saving..." : "Save User"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIALOG: CONFIRM DELETE RESTAURANT */}
      {deletingRestaurantId !== null && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-base font-bold text-slate-800 tracking-tight mb-2">
              Are you absolutely sure?
            </h3>
            <p className="text-xs font-semibold text-slate-500 leading-relaxed mb-4">
              This action is <strong className="text-red-600 uppercase font-bold">permanent</strong>{" "}
              and will delete the restaurant, all its branches, tables, menu items, and related
              order history.
            </p>
            <div className="flex flex-col gap-2 mb-6">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Type the restaurant slug{" "}
                <span className="font-mono font-black text-slate-700 bg-slate-100 border border-slate-200/50 px-1 py-0.5 rounded">
                  {restaurants.find((r) => r.id === deletingRestaurantId)?.username}
                </span>{" "}
                to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmSlug}
                onChange={(e) => setDeleteConfirmSlug(e.target.value)}
                placeholder="Type slug here..."
                className="border border-slate-200 rounded-xl px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-50 focus:bg-white focus:border-red-500 outline-none w-full"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeletingRestaurantId(null);
                  setDeleteConfirmSlug("");
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteRestaurant(deletingRestaurantId)}
                disabled={
                  deleteConfirmSlug.toLowerCase().trim() !==
                  restaurants
                    .find((r) => r.id === deletingRestaurantId)
                    ?.username.toLowerCase()
                    .trim()
                }
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all ${
                  deleteConfirmSlug.toLowerCase().trim() ===
                  restaurants
                    .find((r) => r.id === deletingRestaurantId)
                    ?.username.toLowerCase()
                    .trim()
                    ? "bg-red-600 hover:bg-red-700 cursor-pointer active:scale-95"
                    : "bg-red-400/50 cursor-not-allowed"
                }`}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG: CONFIRM DELETE USER */}
      {deletingUserId !== null && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-base font-bold text-slate-800 tracking-tight mb-2">
              Confirm User Deletion
            </h3>
            <p className="text-xs font-semibold text-slate-500 leading-relaxed mb-6">
              Are you sure you want to delete this administrative user? This account will instantly
              lose system and tenant panel access.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingUserId(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteUser(deletingUserId)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 cursor-pointer active:scale-95 transition-all"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
