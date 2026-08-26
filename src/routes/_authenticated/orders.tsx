import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { z } from "zod";
import { ModernDatePicker } from "@/components/menuverse/modern-calendar";
import { Button } from "@/components/ui/button";
import { ReactBarcode, Renderer } from "react-jsbarcode";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Minus,
  Search,
  Trash2,
  ShoppingBag,
  Utensils,
  Bike,
  Store,
  Clock,
  ChefHat,
  CheckCircle2,
  XCircle,
  Package,
  Receipt,
  Printer,
  CreditCard,
  Wallet,
  Pencil,
  Building2,
  MoreVertical,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

import { cn, generateId, formatCurrency, getCurrencySymbol } from "@/lib/utils";

import {
  getCurrentUser,
  getBranchesServer,
  getOrdersServer,
  getOrderStatusCountsServer,
  saveOrderServer,
  updateOrderStatusServer,
  deleteOrderServer,
  getFoodItemsServer,
  getCategoriesServer,
  getSettingsServer,
  getRestaurantProfile,
} from "@/lib/db-queries.server";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
import { useRealtime, playChime } from "@/lib/use-realtime";

export const Route = createFileRoute("/_authenticated/orders")({ component: OrdersPage });

// ================================================================
// Types & storage
// ================================================================

type FoodItem = {
  id: string;
  name: string;
  price: number;
  discountPrice?: number | null;
  category: string;
  image?: string;
  outOfStock?: boolean;
  available?: boolean;
  hidden?: boolean;
};

type Category = { id: string; name: string; icon?: string; visible?: boolean };

type OrderType = "dine-in" | "takeaway" | "delivery";
type OrderStatus = "pending" | "preparing" | "ready" | "completed" | "cancelled";

type OrderLine = { itemId: string; name: string; price: number; qty: number };

type Order = {
  id: string;
  number: number;
  branchId?: string;
  createdAt: string;
  updatedAt: string;
  type: OrderType;
  status: OrderStatus;
  tableNumber?: string;
  customerName: string;
  phone: string;
  notes?: string;
  lines: OrderLine[];
  subtotal: number;
  tax: number;
  total: number;
};

const TAX_RATE = 0.08;

const FALLBACK_CATEGORIES: Category[] = [];

import { Skeleton } from "@/components/ui/skeleton";

const FALLBACK_ITEMS: FoodItem[] = [];

// ================================================================
// Validation
// ================================================================

const orderSchema = z.object({
  type: z.enum(["dine-in", "takeaway", "delivery"]),
  customerName: z.string().trim().min(1, "Customer name is required").max(80, "Name too long"),
  phone: z
    .string()
    .trim()
    .min(6, "Phone number is required")
    .max(20, "Phone too long")
    .regex(/^[+\d\s\-()]+$/, "Only digits, spaces and + - ( ) allowed"),
  tableNumber: z.string().trim().max(10).optional(),
  notes: z.string().trim().max(500, "Notes must be under 500 chars").optional(),
});

// ================================================================
// Meta
// ================================================================

const STATUS_META: Record<
  OrderStatus,
  {
    label: string;
    icon: typeof Clock;
    badge: string;
    ring: string;
    cardBg: string;
    cardBgActive: string;
    labelColor: string;
    countColor: string;
  }
> = {
  pending: {
    label: "Pending",
    icon: Clock,
    badge:
      "bg-amber-100/90 text-amber-800 border-amber-300/80 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800",
    ring: "ring-amber-400/80 shadow-md shadow-amber-500/10",
    cardBg: "bg-amber-500/10 hover:bg-amber-500/15 border-amber-300/60 dark:border-amber-500/30",
    cardBgActive:
      "bg-amber-500/25 border-amber-400 dark:border-amber-400 shadow-md shadow-amber-500/15",
    labelColor: "text-amber-800/90 dark:text-amber-300/90",
    countColor: "text-amber-950 dark:text-amber-100",
  },
  preparing: {
    label: "Preparing",
    icon: ChefHat,
    badge:
      "bg-blue-100/90 text-blue-800 border-blue-300/80 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800",
    ring: "ring-blue-400/80 shadow-md shadow-blue-500/10",
    cardBg: "bg-blue-500/10 hover:bg-blue-500/15 border-blue-300/60 dark:border-blue-500/30",
    cardBgActive:
      "bg-blue-500/25 border-blue-400 dark:border-blue-400 shadow-md shadow-blue-500/15",
    labelColor: "text-blue-800/90 dark:text-blue-300/90",
    countColor: "text-blue-950 dark:text-blue-100",
  },
  ready: {
    label: "Ready",
    icon: Package,
    badge:
      "bg-purple-100/90 text-purple-800 border-purple-300/80 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800",
    ring: "ring-purple-400/80 shadow-md shadow-purple-500/10",
    cardBg:
      "bg-purple-500/10 hover:bg-purple-500/15 border-purple-300/60 dark:border-purple-500/30",
    cardBgActive:
      "bg-purple-500/25 border-purple-400 dark:border-purple-400 shadow-md shadow-purple-500/15",
    labelColor: "text-purple-800/90 dark:text-purple-300/90",
    countColor: "text-purple-950 dark:text-purple-100",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    badge:
      "bg-emerald-100/90 text-emerald-800 border-emerald-300/80 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800",
    ring: "ring-emerald-400/80 shadow-md shadow-emerald-500/10",
    cardBg:
      "bg-emerald-500/10 hover:bg-emerald-500/15 border-emerald-300/60 dark:border-emerald-500/30",
    cardBgActive:
      "bg-emerald-500/25 border-emerald-400 dark:border-emerald-400 shadow-md shadow-emerald-500/15",
    labelColor: "text-emerald-800/90 dark:text-emerald-300/90",
    countColor: "text-emerald-950 dark:text-emerald-100",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    badge:
      "bg-rose-100/90 text-rose-800 border-rose-300/80 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800",
    ring: "ring-rose-400/80 shadow-md shadow-rose-500/10",
    cardBg: "bg-rose-500/10 hover:bg-rose-500/15 border-rose-300/60 dark:border-rose-500/30",
    cardBgActive:
      "bg-rose-500/25 border-rose-400 dark:border-rose-400 shadow-md shadow-rose-500/15",
    labelColor: "text-rose-800/90 dark:text-rose-300/90",
    countColor: "text-rose-950 dark:text-rose-100",
  },
};

const TYPE_META: Record<
  OrderType,
  { label: string; icon: typeof Utensils; description: string; placeholder?: boolean }
> = {
  "dine-in": {
    label: "Dine In",
    icon: Utensils,
    description: "Order for a table in the restaurant.",
  },
  takeaway: { label: "Takeaway", icon: Store, description: "Customer picks up at the counter." },
  delivery: {
    label: "Delivery",
    icon: Bike,
    description: "Send to customer address.",
  },
};

const STATUS_FLOW: OrderStatus[] = ["pending", "preparing", "ready", "completed", "cancelled"];

// ================================================================
// Page
// ================================================================

function OrdersPage() {
  const [items, setItems] = useState<FoodItem[]>(FALLBACK_ITEMS);
  const [categories, setCategories] = useState<Category[]>(FALLBACK_CATEGORIES);
  const [orders, setOrders] = useState<Order[]>([]);
  const [counter, setCounter] = useState(1);
  const [currency, setCurrency] = useState<string>("BDT");
  const [currentUser, setCurrentUser] = useState<{
    role: string | null;
    branch?: string | null;
    full_name?: string | null;
  } | null>(null);
  const [branchesList, setBranchesList] = useState<
    Array<{
      id: string;
      name: string;
      address?: string;
      phone?: string;
      manager?: string;
      isDefault?: boolean;
    }>
  >([]);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>("all");
  const [hydrated, setHydrated] = useState(false);

  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [openOrder, setOpenOrder] = useState<Order | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<Order | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Order | null>(null);
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [printReceiptOrder, setPrintReceiptOrder] = useState<Order | null>(null);
  const [addItemsOrder, setAddItemsOrder] = useState<Order | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [restaurantProfile, setRestaurantProfile] = useState<{
    name?: string;
    address?: string;
    phone?: string;
    logo?: string;
  } | null>(null);

  const [statusCounts, setStatusCounts] = useState<Record<OrderStatus, number>>({
    pending: 0,
    preparing: 0,
    ready: 0,
    completed: 0,
    cancelled: 0,
  });
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    async function loadData() {
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
        const brs = await getBranchesServer({ data: {} });
        if (brs && Array.isArray(brs)) {
          setBranchesList(
            brs as Array<{
              id: string;
              name: string;
              address?: string;
              phone?: string;
              manager?: string;
              isDefault?: boolean;
            }>,
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
              }
            }
          }
        }
      } catch {
        /* ignore */
      }

      try {
        const dbSettings = await getSettingsServer();
        if (dbSettings && typeof dbSettings === "object") {
          let apps = dbSettings.app_settings;
          if (typeof apps === "string") {
            try {
              apps = JSON.parse(apps);
            } catch {
              /* ignore */
            }
          }
          const target = (apps && typeof apps === "object" ? apps : dbSettings) as Record<
            string,
            unknown
          >;
          if (target.currency) {
            const currStr = String(target.currency);
            setCurrency(currStr);
          }
        }
      } catch {
        /* ignore */
      }

      try {
        const dbItems = await getFoodItemsServer({ data: {} });
        if (dbItems && Array.isArray(dbItems) && dbItems.length > 0) {
          setItems(dbItems as unknown as FoodItem[]);
        }
      } catch {
        /* ignore */
      }

      try {
        const dbCats = await getCategoriesServer({ data: {} });
        if (dbCats && Array.isArray(dbCats) && dbCats.length > 0) {
          setCategories(dbCats as unknown as Category[]);
        }
      } catch {
        /* ignore */
      }

      try {
        const [dbOrders, dbCounts] = await Promise.all([
          getOrdersServer({ data: {} }),
          getOrderStatusCountsServer({ data: {} }),
        ]);
        if (dbOrders && Array.isArray(dbOrders)) {
          setOrders(dbOrders as unknown as Order[]);
          if (dbOrders.length > 0) {
            const maxNum = Math.max(...dbOrders.map((o) => o.number || 0));
            setCounter(maxNum + 1);
          }
        }
        if (dbCounts && typeof dbCounts === "object") {
          setStatusCounts(dbCounts);
        }
      } catch {
        /* ignore */
      }

      try {
        const prof = await getRestaurantProfile().catch(() => null);
        if (prof) {
          if (prof.currency) {
            setCurrency(String(prof.currency));
          }
          setRestaurantProfile({
            name: prof.name || "Burger Craft Lab",
            address: prof.address || "221 Baker Street, Downtown, Gulshan-2, Dhaka",
            phone: prof.phone || "+880 1700-000000",
            logo: prof.logo || "/default-logo.png",
          });
        }
      } catch {
        /* ignore */
      }

      setHydrated(true);
    }
    loadData();
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

  useEffect(() => {
    if (!hydrated) return;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const activeBranch =
          isStaffScoped && staffBranchName
            ? staffBranchName
            : selectedBranchFilter !== "all"
              ? selectedBranchFilter
              : undefined;
        const [dbOrders, dbCounts] = await Promise.all([
          getOrdersServer({
            data: {
              branchId: activeBranch,
              status: statusFilter !== "all" ? statusFilter : undefined,
              type: typeFilter !== "all" ? typeFilter : undefined,
              startDate: dateFilter || undefined,
              endDate: dateFilter || undefined,
              search: search.trim() || undefined,
            },
          }),
          getOrderStatusCountsServer({
            data: {
              branchId: activeBranch,
              type: typeFilter !== "all" ? typeFilter : undefined,
              startDate: dateFilter || undefined,
              endDate: dateFilter || undefined,
              search: search.trim() || undefined,
            },
          }),
        ]);
        if (dbOrders && Array.isArray(dbOrders)) {
          setOrders(dbOrders as unknown as Order[]);
        }
        if (dbCounts && typeof dbCounts === "object") {
          setStatusCounts(dbCounts);
        }
      } catch (err) {
        console.warn("[Orders] Server fetch error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [
    hydrated,
    statusFilter,
    typeFilter,
    dateFilter,
    search,
    selectedBranchFilter,
    isStaffScoped,
    staffBranchName,
  ]);

  useRealtime({
    branchId: selectedBranchFilter !== "all" ? selectedBranchFilter : undefined,
    eventTypes: ["order:created", "order:updated", "order:deleted"],
    onEvent: (event) => {
      if (event.type === "order:created") {
        const payload = event.payload as Order;
        if (payload?.id) {
          setOrders((prev) => {
            if (prev.some((o) => o.id === payload.id)) return prev;
            return [payload, ...prev];
          });
          setStatusCounts((prev) => ({
            ...prev,
            pending: (prev.pending || 0) + 1,
          }));
          playChime("order");
          toast.info(`🔔 New Order #${payload.number || ""} created!`, {
            description: `${payload.customerName || "Guest"} • ${formatCurrency(payload.total || 0, currency)}`,
          });
        }
      } else if (event.type === "order:updated") {
        const payload = event.payload as { id: string; status: OrderStatus };
        if (payload?.id && payload?.status) {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === payload.id
                ? { ...o, status: payload.status, updatedAt: new Date().toISOString() }
                : o,
            ),
          );
        }
      } else if (event.type === "order:deleted") {
        const payload = event.payload as { id: string };
        if (payload?.id) {
          setOrders((prev) => prev.filter((o) => o.id !== payload.id));
        }
      }
    },
  });

  const orderableItems = useMemo(
    () => items.filter((i) => !i.hidden && !i.outOfStock && i.available !== false),
    [items],
  );

  const visibleCategories = useMemo(
    () => categories.filter((c) => c.visible !== false),
    [categories],
  );

  const visibleOrders = orders;

  const placeOrder = async (
    draft: Omit<Order, "id" | "number" | "createdAt" | "updatedAt" | "status">,
  ) => {
    const now = new Date().toISOString();
    const targetBranchId =
      isStaffScoped && staffBranchName
        ? branchesList.find((b) => b.name === staffBranchName)?.id || staffBranchName
        : draft.branchId ||
          (selectedBranchFilter !== "all"
            ? selectedBranchFilter
            : branchesList[0]?.id || "Main Branch");

    const order: Order = {
      ...draft,
      branchId: targetBranchId,
      id: generateId(),
      number: counter,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    try {
      await saveOrderServer({
        data: order as unknown as Parameters<typeof saveOrderServer>[0]["data"],
      });
      setOrders((prev) => [order, ...prev]);
      setStatusCounts((c) => ({ ...c, pending: c.pending + 1 }));
      setCounter((c) => c + 1);
      setNewOrderOpen(false);
      toast.success(`Order #${order.number} placed`);
    } catch {
      toast.error("Failed to place order");
    }
  };

  const updateStatus = async (id: string, status: OrderStatus) => {
    try {
      await apiPut("/api/orders", { id, status }).catch(async () => {
        await updateOrderStatusServer({ data: { id, status } });
      });
      const prevOrder = orders.find((o) => o.id === id);
      const prevStatus = prevOrder?.status;
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status, updatedAt: new Date().toISOString() } : o)),
      );
      if (prevStatus && prevStatus !== status) {
        setStatusCounts((c) => ({
          ...c,
          [prevStatus]: Math.max(0, c[prevStatus] - 1),
          [status]: c[status] + 1,
        }));
      }
      toast.success(`Order updated to ${STATUS_META[status].label}`);
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      await apiDelete(`/api/orders?id=${encodeURIComponent(orderId)}`).catch(async () => {
        await deleteOrderServer({ data: orderId });
      });
      const prevOrder = orders.find((o) => o.id === orderId);
      const prevStatus = prevOrder?.status;
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      if (prevStatus) {
        setStatusCounts((c) => ({
          ...c,
          [prevStatus]: Math.max(0, c[prevStatus] - 1),
        }));
      }
      if (openOrder?.id === orderId) setOpenOrder(null);
      setConfirmDelete(null);
      toast.success("Order deleted successfully from database");
    } catch {
      toast.error("Failed to delete order from database");
    }
  };

  const handleUpdateOrderLines = (orderId: string, extraLines: OrderLine[]) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const updatedLines = [...o.lines];
        for (const item of extraLines) {
          const idx = updatedLines.findIndex((l) => l.itemId === item.itemId);
          if (idx >= 0) {
            updatedLines[idx] = {
              ...updatedLines[idx],
              qty: updatedLines[idx].qty + item.qty,
            };
          } else {
            updatedLines.push(item);
          }
        }
        const subtotal = updatedLines.reduce((s, l) => s + l.qty * l.price, 0);
        const tax = subtotal * TAX_RATE;
        const total = subtotal + tax;
        const updated = {
          ...o,
          lines: updatedLines,
          subtotal,
          tax,
          total,
          updatedAt: new Date().toISOString(),
        };
        if (openOrder?.id === orderId) setOpenOrder(updated);
        return updated;
      }),
    );
    toast.success("Items added to order successfully");
  };

  const handleCompletePayment = (orderId: string, method: string) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const updated: Order = {
          ...o,
          status: "completed",
          updatedAt: new Date().toISOString(),
        };
        if (openOrder?.id === orderId) setOpenOrder(updated);
        return updated;
      }),
    );
    toast.success(`Payment completed via ${method}`);
    setPaymentOrder(null);
  };

  return (
    <div
      className="-m-6 md:-m-8 p-6 md:p-8 min-h-screen space-y-6"
      style={{ backgroundColor: "#EEEFF2" }}
    >
      {/* Stat strip */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
        {STATUS_FLOW.map((s) => {
          const meta = STATUS_META[s];
          const Icon = meta.icon;
          const isSelected = statusFilter === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(isSelected ? "all" : s)}
              className={cn(
                "rounded-2xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5 shadow-2xs cursor-pointer",
                isSelected ? cn(meta.cardBgActive, "ring-2", meta.ring) : meta.cardBg,
              )}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-xl border shadow-2xs",
                    meta.badge,
                  )}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wider",
                      meta.labelColor,
                    )}
                  >
                    {meta.label}
                  </p>
                  {!hydrated ? (
                    <Skeleton className="h-6 w-8 rounded my-0.5" />
                  ) : (
                    <p className={cn("text-xl font-black leading-tight", meta.countColor)}>
                      {statusCounts[s]}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Integrated Orders Toolbar: Search, Date Filter, Order Type Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-70">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <Input
              placeholder="Search order #, customer, table..."
              className="pl-9 bg-white border-neutral-200/80 hover:border-neutral-300 focus-visible:ring-2 focus-visible:ring-neutral-400/20 shadow-2xs rounded-md text-neutral-800 placeholder:text-neutral-400 text-xs font-normal"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <ModernDatePicker
            value={dateFilter}
            onChange={setDateFilter}
            placeholder="Filter Date"
            className="w-40 rounded-md border-neutral-200/80 shadow-2xs"
          />

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36 bg-white border-neutral-200/80 hover:border-neutral-300 focus:ring-2 focus:ring-neutral-400/20 shadow-2xs rounded-md font-normal text-xs text-neutral-800 cursor-pointer">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent className="rounded-md">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="dine-in">Dine-in</SelectItem>
              <SelectItem value="takeaway">Takeaway</SelectItem>
              <SelectItem value="delivery">Delivery</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as OrderStatus | "all")}
          >
            <SelectTrigger className="w-38 bg-white border-neutral-200/80 hover:border-neutral-300 focus:ring-2 focus:ring-neutral-400/20 shadow-2xs rounded-md font-normal text-xs text-neutral-800 cursor-pointer">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="rounded-md">
              <SelectItem value="all">
                All Statuses (
                {!hydrated ? "..." : Object.values(statusCounts).reduce((a, b) => a + b, 0)})
              </SelectItem>
              {STATUS_FLOW.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_META[s].label} ({!hydrated ? "..." : statusCounts[s]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isStaffScoped && staffBranchName ? (
            <Badge
              variant="outline"
              className="gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-900 dark:text-amber-200 border-amber-500/30 text-xs font-semibold"
            >
              <Building2 className="h-3.5 w-3.5 text-amber-600" />
              {staffBranchName}
            </Badge>
          ) : branchesList.length > 1 ? (
            <Select value={selectedBranchFilter} onValueChange={setSelectedBranchFilter}>
              <SelectTrigger className="w-44 bg-white border-neutral-200/80 hover:border-neutral-300 focus:ring-2 focus:ring-neutral-400/20 shadow-2xs rounded-md font-normal text-xs text-neutral-800 cursor-pointer">
                <Building2 className="h-3.5 w-3.5 mr-1.5 text-neutral-500" />
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent className="rounded-md">
                <SelectItem value="all">All Branches</SelectItem>
                {branchesList.map((b) => (
                  <SelectItem key={b.id || b.name} value={b.id || b.name}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link to="/pos" search={{ edit: undefined }}>
            <Button
              size="sm"
              className="bg-linear-to-r from-[#D77649] via-[#CB6C3F] to-[#B85C31] hover:from-[#C9693D] hover:to-[#A74E26] h-9 px-5 rounded-md text-white font-medium text-xs shadow-md cursor-pointer transition-all flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5 text-white" /> Open POS
            </Button>
          </Link>
        </div>
      </div>

      {/* Orders list */}
      {!hydrated || isSearching ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <OrderCardSkeleton key={idx} />
          ))}
        </div>
      ) : visibleOrders.length === 0 ? (
        <div className="glass rounded-2xl border border-dashed border-border/60 p-12 text-center">
          <Receipt className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-display text-lg font-bold">No orders yet</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Place your first order to get started.
          </p>
          <Link to="/pos" search={{ edit: undefined }}>
            <Button className="gradient-warm text-primary-foreground cursor-pointer">
              <Plus className="mr-1 h-4 w-4" /> New order
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleOrders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              currency={currency}
              onOpen={() => setOpenOrder(o)}
              onAdvance={(next) => updateStatus(o.id, next)}
              onCancel={() => setConfirmCancel(o)}
              onPrintReceipt={(ord) => setPrintReceiptOrder(ord)}
              onBillPayment={(ord) => setPaymentOrder(ord)}
              onDelete={() => setConfirmDelete(o)}
            />
          ))}
        </div>
      )}

      {/* Order details */}
      <OrderDetailsDialog
        order={openOrder}
        currency={currency}
        onClose={() => setOpenOrder(null)}
        onStatus={(status) => {
          if (openOrder) updateStatus(openOrder.id, status);
        }}
        onPrintReceipt={(ord) => setPrintReceiptOrder(ord)}
        onAddItems={(ord) => setAddItemsOrder(ord)}
        onBillPayment={(ord) => setPaymentOrder(ord)}
        onDelete={(ord) => setConfirmDelete(ord)}
      />

      {/* Action Dialogs */}
      <PrintReceiptDialog
        order={printReceiptOrder}
        restaurant={restaurantProfile}
        branches={branchesList}
        currencySymbol={getCurrencySymbol(currency)}
        onClose={() => setPrintReceiptOrder(null)}
      />
      <AddItemsToOrderDialog
        order={addItemsOrder}
        items={orderableItems}
        currency={currency}
        onClose={() => setAddItemsOrder(null)}
        onSave={handleUpdateOrderLines}
      />
      <BillPaymentDialog
        order={paymentOrder}
        currencySymbol={getCurrencySymbol(currency)}
        onClose={() => setPaymentOrder(null)}
        onComplete={handleCompletePayment}
      />

      {/* Cancel confirm */}
      <AlertDialog
        open={!!confirmCancel}
        onOpenChange={(o) => {
          if (!o) setConfirmCancel(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel order #{confirmCancel?.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the order as cancelled. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmCancel) updateStatus(confirmCancel.id, "cancelled");
                setConfirmCancel(null);
              }}
            >
              Cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => {
          if (!o) setConfirmDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive font-bold flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Delete order #{confirmDelete?.number}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete order #{confirmDelete?.number}? This will permanently
              remove the order from the database and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
              onClick={() => {
                if (confirmDelete) handleDeleteOrder(confirmDelete.id);
              }}
            >
              Delete Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ================================================================
// Order card skeleton
// ================================================================

function OrderCardSkeleton() {
  return (
    <article className="glass flex flex-col rounded-2xl border border-border/60 p-4 shadow-card">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-16 rounded" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-28 rounded" />
        </div>
        <Skeleton className="h-3.5 w-12 rounded" />
      </header>

      <div className="mt-3 min-w-0 space-y-1.5">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-3 w-24 rounded" />
      </div>

      <ul className="mt-4 space-y-2 text-sm">
        <li className="flex justify-between gap-2">
          <Skeleton className="h-3.5 w-28 rounded" />
          <Skeleton className="h-3.5 w-12 rounded" />
        </li>
        <li className="flex justify-between gap-2">
          <Skeleton className="h-3.5 w-36 rounded" />
          <Skeleton className="h-3.5 w-14 rounded" />
        </li>
        <li className="flex justify-between gap-2">
          <Skeleton className="h-3.5 w-24 rounded" />
          <Skeleton className="h-3.5 w-10 rounded" />
        </li>
      </ul>

      <footer className="mt-4 border-t border-border/60 pt-3">
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-4 w-10 rounded" />
          <Skeleton className="h-6 w-20 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 flex-1 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </footer>
    </article>
  );
}

// ================================================================
// Order card
// ================================================================

function OrderCard({
  order,
  currency,
  onOpen,
  onAdvance,
  onCancel,
  onPrintReceipt,
  onBillPayment,
  onDelete,
}: {
  order: Order;
  currency?: string;
  onOpen: () => void;
  onAdvance: (s: OrderStatus) => void;
  onCancel: () => void;
  onPrintReceipt: (o: Order) => void;
  onBillPayment: (o: Order) => void;
  onDelete: () => void;
}) {
  const meta = STATUS_META[order.status];
  const StatusIcon = meta.icon;
  const TypeIcon = TYPE_META[order.type].icon;

  const navigate = useNavigate();
  const nextStatus: OrderStatus | null =
    order.status === "pending"
      ? "preparing"
      : order.status === "preparing"
        ? "ready"
        : order.status === "ready"
          ? "completed"
          : null;

  return (
    <article className="glass flex flex-col rounded-2xl border border-border/60 p-4 shadow-card">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg font-black">#{order.number}</h3>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                meta.badge,
              )}
            >
              <StatusIcon className="h-3 w-3" />
              {meta.label}
            </span>
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <TypeIcon className="h-3 w-3" />
            {TYPE_META[order.type].label}
            {order.type === "dine-in" && order.tableNumber ? ` · Table ${order.tableNumber}` : ""}
          </p>
        </div>
        <p className="shrink-0 text-right text-xs text-muted-foreground">
          {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </header>

      <div className="mt-3 min-w-0">
        <p className="truncate text-sm font-medium">{order.customerName}</p>
        <p className="truncate text-xs text-muted-foreground">{order.phone}</p>
      </div>

      <ul className="mt-3 space-y-1 text-sm">
        {order.lines.slice(0, 3).map((l) => (
          <li key={l.itemId} className="flex justify-between gap-2">
            <span className="truncate">
              <span className="mr-1 font-semibold">{l.qty}×</span>
              {l.name}
            </span>
            <span className="shrink-0 text-muted-foreground">
              {formatCurrency(l.qty * l.price, currency)}
            </span>
          </li>
        ))}
        {order.lines.length > 3 ? (
          <li className="text-xs text-muted-foreground">+ {order.lines.length - 3} more</li>
        ) : null}
      </ul>

      <footer className="mt-4 border-t border-border/60 pt-3">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="font-display text-lg font-black text-primary">
            {formatCurrency(order.total, currency)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1 cursor-pointer border-amber-300 text-amber-900 hover:bg-amber-50 dark:text-amber-200"
            onClick={() => onBillPayment(order)}
          >
            <CreditCard className="h-3.5 w-3.5 text-primary" /> Bill & Payment
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-emerald-300 text-emerald-900 hover:bg-emerald-50 dark:text-emerald-200 cursor-pointer"
            onClick={() => onPrintReceipt(order)}
            title="Print Receipt"
          >
            <Printer className="h-3.5 w-3.5 text-emerald-600" /> Print
          </Button>
          {nextStatus ? (
            <Button
              size="sm"
              className="flex-1 gradient-warm text-primary-foreground cursor-pointer"
              onClick={() => onAdvance(nextStatus)}
            >
              Mark {STATUS_META[nextStatus].label}
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-9 w-9 p-0 rounded-lg shrink-0 cursor-pointer border-border/80 hover:bg-accent"
                aria-label="Order actions"
              >
                <MoreVertical className="h-4 w-4 text-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onOpen} className="gap-2 cursor-pointer">
                <Eye className="h-4 w-4 text-muted-foreground" /> Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate({ to: "/pos", search: { edit: order.id } })}
                className="gap-2 cursor-pointer"
              >
                <Pencil className="h-4 w-4 text-primary" /> Edit Order
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => onPrintReceipt(order)}
                className="gap-2 cursor-pointer"
              >
                <Printer className="h-4 w-4 text-emerald-600" /> Print Receipt
              </DropdownMenuItem>
              {nextStatus ? (
                <DropdownMenuItem
                  onClick={() => onAdvance(nextStatus)}
                  className="gap-2 cursor-pointer font-semibold text-primary"
                >
                  <CheckCircle2 className="h-4 w-4 text-primary" /> Mark{" "}
                  {STATUS_META[nextStatus].label}
                </DropdownMenuItem>
              ) : null}
              {order.status !== "completed" && order.status !== "cancelled" ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onCancel}
                    className="gap-2 cursor-pointer text-amber-600 focus:text-amber-700"
                  >
                    <XCircle className="h-4 w-4" /> Cancel Order
                  </DropdownMenuItem>
                </>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="gap-2 cursor-pointer text-destructive focus:text-destructive font-medium"
              >
                <Trash2 className="h-4 w-4" /> Delete Order
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </footer>
    </article>
  );
}

// ================================================================
// Order details dialog
// ================================================================

function OrderDetailsDialog({
  order,
  currency,
  onClose,
  onStatus,
  onPrintReceipt,
  onAddItems,
  onBillPayment,
  onDelete,
}: {
  order: Order | null;
  currency?: string;
  onClose: () => void;
  onStatus: (s: OrderStatus) => void;
  onPrintReceipt: (order: Order) => void;
  onAddItems: (order: Order) => void;
  onBillPayment: (order: Order) => void;
  onDelete?: (order: Order) => void;
}) {
  const navigate = useNavigate();
  return (
    <Dialog
      open={!!order}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        {order ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl font-black">
                Order #{order.number}
              </DialogTitle>
              <DialogDescription>
                {TYPE_META[order.type].label}
                {order.type === "dine-in" && order.tableNumber
                  ? ` · Table ${order.tableNumber}`
                  : ""}
                {" · "}
                {new Date(order.createdAt).toLocaleString()}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Customer</p>
                <p className="font-medium">{order.customerName}</p>
                <p className="text-sm text-muted-foreground">{order.phone}</p>
              </div>

              {order.notes ? (
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
                  <p className="text-sm">{order.notes}</p>
                </div>
              ) : null}

              <div className="rounded-xl border border-border">
                <ul className="divide-y divide-border">
                  {order.lines.map((l) => (
                    <li
                      key={l.itemId}
                      className="flex items-center justify-between gap-3 p-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{l.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(l.price, currency)} × {l.qty}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold">
                        {formatCurrency(l.qty * l.price, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="space-y-1 border-t border-border p-3 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatCurrency(order.subtotal, currency)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax ({Math.round(TAX_RATE * 100)}%)</span>
                    <span>{formatCurrency(order.tax, currency)}</span>
                  </div>
                  <div className="flex justify-between pt-1 font-display text-base font-black text-primary">
                    <span>Total</span>
                    <span>{formatCurrency(order.total, currency)}</span>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between border-t border-border/60 pt-4">
              {onDelete ? (
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5 cursor-pointer"
                  onClick={() => {
                    onClose();
                    onDelete(order);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete Order
                </Button>
              ) : (
                <div />
              )}
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ================================================================
// New order dialog
// ================================================================

function NewOrderDialog({
  open,
  onClose,
  items,
  categories,
  currency,
  onSubmit,
  nextNumber,
}: {
  open: boolean;
  onClose: () => void;
  items: FoodItem[];
  categories: Category[];
  currency?: string;
  onSubmit: (draft: Omit<Order, "id" | "number" | "createdAt" | "updatedAt" | "status">) => void;
  nextNumber: number;
}) {
  const [type, setType] = useState<OrderType>("dine-in");
  const [tableNumber, setTableNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setType("dine-in");
      setTableNumber("");
      setCustomerName("");
      setPhone("");
      setNotes("");
      setCart({});
      setQuery("");
      setActiveCategory("all");
      setErrors({});
    }
  }, [open]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (activeCategory !== "all" && it.category !== activeCategory) return false;
      if (q && !it.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, query, activeCategory]);

  const lines: OrderLine[] = useMemo(() => {
    const list: OrderLine[] = [];
    for (const [id, qty] of Object.entries(cart)) {
      if (qty <= 0) continue;
      const it = items.find((x) => x.id === id);
      if (!it) continue;
      const price = it.discountPrice ?? it.price;
      list.push({ itemId: id, name: it.name, price, qty });
    }
    return list;
  }, [cart, items]);

  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);

  const increment = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const decrement = (id: string) =>
    setCart((c) => {
      const next = { ...c };
      const q = (next[id] ?? 0) - 1;
      if (q <= 0) delete next[id];
      else next[id] = q;
      return next;
    });
  const removeLine = (id: string) =>
    setCart((c) => {
      const n = { ...c };
      delete n[id];
      return n;
    });

  const submit = () => {
    const parsed = orderSchema.safeParse({
      type,
      customerName,
      phone,
      tableNumber: type === "dine-in" ? tableNumber : undefined,
      notes: notes || undefined,
    });

    const newErrors: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        newErrors[issue.path.join(".")] = issue.message;
      }
    }
    if (type === "dine-in" && !tableNumber.trim()) {
      newErrors.tableNumber = "Table number is required for dine-in";
    }
    if (lines.length === 0) {
      newErrors.lines = "Add at least one item to the order";
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    if (!parsed.success) return;

    onSubmit({
      type,
      tableNumber: type === "dine-in" ? parsed.data.tableNumber : undefined,
      customerName: parsed.data.customerName,
      phone: parsed.data.phone,
      notes: parsed.data.notes,
      lines,
      subtotal: Math.round(subtotal * 100) / 100,
      tax,
      total,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-4xl overflow-hidden p-0">
        <div className="grid max-h-[85vh] gap-0 md:grid-cols-[minmax(0,1fr)_360px]">
          {/* Left — items */}
          <div className="flex min-h-0 flex-col overflow-hidden">
            <DialogHeader className="border-b border-border p-4">
              <DialogTitle className="font-display text-xl font-black">
                New order · #{nextNumber}
              </DialogTitle>
              <DialogDescription>Pick items, then add customer details.</DialogDescription>
            </DialogHeader>

            {/* Order type */}
            <div className="border-b border-border p-4">
              <Label className="mb-2 block text-xs uppercase tracking-wide">Order type</Label>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Order type">
                {(Object.keys(TYPE_META) as OrderType[]).map((t) => {
                  const meta = TYPE_META[t];
                  const Icon = meta.icon;
                  const active = type === t;
                  return (
                    <button
                      key={t}
                      role="radio"
                      aria-checked={active}
                      onClick={() => setType(t)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition",
                        active
                          ? "border-primary bg-primary/5 text-primary shadow-elegant"
                          : "border-border bg-background hover:bg-muted",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs font-semibold">{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search + categories */}
            <div className="border-b border-border p-4">
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search menu…"
                  aria-label="Search menu"
                  className="pl-9"
                />
              </div>
              <div className="flex snap-x gap-2 overflow-x-auto pb-1">
                <CategoryChip
                  active={activeCategory === "all"}
                  onClick={() => setActiveCategory("all")}
                >
                  All
                </CategoryChip>
                {categories.map((c) => (
                  <CategoryChip
                    key={c.id}
                    active={activeCategory === c.id}
                    onClick={() => setActiveCategory(c.id)}
                  >
                    <span className="mr-1">{c.icon ?? "🍽️"}</span>
                    {c.name}
                  </CategoryChip>
                ))}
              </div>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredItems.length === 0 ? (
                <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No items match your search.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {filteredItems.map((it) => {
                    const inCart = cart[it.id] ?? 0;
                    const price = it.discountPrice ?? it.price;
                    return (
                      <div
                        key={it.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{it.name}</p>
                          <p className="text-xs text-primary">{formatCurrency(price, currency)}</p>
                        </div>
                        {inCart > 0 ? (
                          <div className="flex items-center gap-1 rounded-lg border border-border">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              aria-label={`Remove one ${it.name}`}
                              onClick={() => decrement(it.id)}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="w-6 text-center text-sm font-bold">{inCart}</span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              aria-label={`Add one ${it.name}`}
                              onClick={() => increment(it.id)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => increment(it.id)}>
                            <Plus className="mr-1 h-3.5 w-3.5" /> Add
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right — cart + customer */}
          <aside className="flex min-h-0 flex-col border-t border-border bg-muted/30 md:border-l md:border-t-0">
            <div className="border-b border-border p-4">
              <div className="mb-1 flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-primary" />
                <h3 className="font-display font-bold">Cart</h3>
                <Badge variant="secondary" className="ml-auto">
                  {itemCount} item{itemCount === 1 ? "" : "s"}
                </Badge>
              </div>
              {errors.lines ? <p className="text-xs text-destructive">{errors.lines}</p> : null}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {lines.length === 0 ? (
                <p className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                  No items yet. Tap a menu item to add.
                </p>
              ) : (
                <ul className="space-y-2">
                  {lines.map((l) => (
                    <li
                      key={l.itemId}
                      className="flex items-center gap-2 rounded-lg border border-border bg-background p-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{l.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(l.price, currency)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 rounded-md border border-border">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          aria-label={`Remove one ${l.name}`}
                          onClick={() => decrement(l.itemId)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-5 text-center text-xs font-bold">{l.qty}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          aria-label={`Add one ${l.name}`}
                          onClick={() => increment(l.itemId)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={`Remove ${l.name}`}
                        onClick={() => removeLine(l.itemId)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Customer */}
              <div className="mt-4 space-y-3">
                {type === "dine-in" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="table-number">Table number *</Label>
                    <Input
                      id="table-number"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value.slice(0, 10))}
                      placeholder="e.g. 12"
                      aria-invalid={!!errors.tableNumber}
                      aria-describedby={errors.tableNumber ? "table-number-error" : undefined}
                    />
                    {errors.tableNumber ? (
                      <p id="table-number-error" className="text-xs text-destructive">
                        {errors.tableNumber}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <Label htmlFor="customer-name">Customer name *</Label>
                  <Input
                    id="customer-name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value.slice(0, 80))}
                    placeholder="Full name"
                    autoComplete="name"
                    aria-invalid={!!errors.customerName}
                    aria-describedby={errors.customerName ? "customer-name-error" : undefined}
                  />
                  {errors.customerName ? (
                    <p id="customer-name-error" className="text-xs text-destructive">
                      {errors.customerName}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="customer-phone">Phone *</Label>
                  <Input
                    id="customer-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.slice(0, 20))}
                    placeholder="+1 555 010 2233"
                    autoComplete="tel"
                    aria-invalid={!!errors.phone}
                    aria-describedby={errors.phone ? "customer-phone-error" : undefined}
                  />
                  {errors.phone ? (
                    <p id="customer-phone-error" className="text-xs text-destructive">
                      {errors.phone}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="order-notes">Order notes</Label>
                  <Textarea
                    id="order-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                    placeholder="Allergies, spice level, special requests…"
                    rows={3}
                    aria-invalid={!!errors.notes}
                    aria-describedby={errors.notes ? "order-notes-error" : undefined}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    {errors.notes ? (
                      <span id="order-notes-error" className="text-destructive">
                        {errors.notes}
                      </span>
                    ) : (
                      <span />
                    )}
                    <span>{notes.length}/500</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Totals + place */}
            <div className="space-y-2 border-t border-border bg-background p-4">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Tax ({Math.round(TAX_RATE * 100)}%)</span>
                <span>{formatCurrency(tax, currency)}</span>
              </div>
              <div className="flex justify-between font-display text-lg font-black text-primary">
                <span>Total</span>
                <span>{formatCurrency(total, currency)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  className="gradient-warm text-primary-foreground shadow-elegant"
                  onClick={submit}
                  disabled={lines.length === 0}
                >
                  Place order
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ================================================================
// Utilities
// ================================================================

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 snap-start rounded-full border px-3 py-1 text-xs font-semibold transition",
        active
          ? "border-transparent bg-primary text-primary-foreground shadow-elegant"
          : "border-border bg-background text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

// ================================================================
// Order Action Dialogs (Print Receipt, Add Items, Bill & Payment)
// ================================================================

function RealBarcode({ value }: { value: string }) {
  const cleanVal = value || "ORD-0000";
  return (
    <div className="barcode-wrapper flex flex-col items-center justify-center my-2 shrink-0 w-full">
      <ReactBarcode
        value={cleanVal}
        options={{
          format: "CODE128",
          width: 1.8,
          height: 38,
          displayValue: true,
          fontSize: 10,
          font: "monospace",
          margin: 4,
          background: "#FFFFFF",
          lineColor: "#000000",
        }}
        renderer={Renderer.SVG}
      />
    </div>
  );
}

function PrintReceiptDialog({
  order,
  restaurant,
  branches,
  currencySymbol,
  onClose,
}: {
  order: Order | null;
  restaurant?: {
    name?: string;
    address?: string;
    phone?: string;
    logo?: string;
  } | null;
  branches?: Array<{
    id: string;
    name: string;
    address?: string;
    phone?: string;
    isDefault?: boolean;
  }>;
  currencySymbol?: string;
  onClose: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const cs = getCurrencySymbol(currencySymbol);

  const matchedBranch = useMemo(() => {
    if (!branches || branches.length === 0) return null;
    if (order?.branchId) {
      const found = branches.find(
        (b) => b.id === order.branchId || b.name.toLowerCase() === order.branchId?.toLowerCase(),
      );
      if (found) return found;
    }
    return branches.find((b) => b.isDefault) || branches[0];
  }, [order, branches]);

  const restaurantName = restaurant?.name || "Burger Craft Lab";
  const branchAddress =
    matchedBranch?.address || restaurant?.address || "221 Baker Street, Downtown, Gulshan-2, Dhaka";
  const branchPhone = matchedBranch?.phone || restaurant?.phone || "+880 1700-000000";
  const restaurantLogo = restaurant?.logo || "/default-logo.png";
  const printPageStyle = `
    @media print {
      body * {
        visibility: hidden !important;
      }
      #printable-thermal-receipt, #printable-thermal-receipt * {
        visibility: visible !important;
        color: #000000 !important;
        background: transparent !important;
        text-shadow: none !important;
      }
      #printable-thermal-receipt {
        position: fixed !important;
        left: 50% !important;
        top: 0 !important;
        transform: translateX(-50%) !important;
        width: 100% !important;
        max-width: 80mm !important;
        margin: 0 auto !important;
        padding: 8px 12px !important;
        border: none !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        font-family: monospace, 'Courier New', Courier, sans-serif !important;
        font-size: 11px !important;
        line-height: 1.35 !important;
      }
      #printable-thermal-receipt img.receipt-logo {
        max-height: 120px !important;
        max-width: 280px !important;
        object-fit: contain !important;
        filter: grayscale(100%) contrast(140%) !important;
        display: block !important;
        margin: 0 auto 10px auto !important;
      }
      .receipt-notch {
        display: none !important;
      }
      @page {
        size: 80mm auto;
        margin: 0mm;
      }
    }
  `;

  const handleReactToPrint = useReactToPrint({
    contentRef,
    documentTitle: order ? `Receipt-#${order.number}` : "Receipt",
    pageStyle: printPageStyle,
  });

  const handlePrint = () => {
    if (contentRef.current) {
      handleReactToPrint();
      return;
    }
    window.print();
  };

  if (!order) return null;

  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-4 sm:p-6 overflow-y-auto max-h-[90vh]">
        <style>{printPageStyle}</style>

        <div
          ref={contentRef}
          id="printable-thermal-receipt"
          className="relative rounded-2xl border-2 border-dashed border-border bg-white dark:bg-card pt-3 px-6 pb-6 text-foreground font-mono text-xs shadow-md space-y-3 overflow-hidden"
        >
          {/* Decorative side notch cuts */}
          <div className="receipt-notch absolute -left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-background border border-border" />
          <div className="receipt-notch absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-background border border-border" />

          {/* Restaurant Header */}
          <div className="text-center space-y-1 flex flex-col items-center justify-center pt-0">
            {restaurantLogo ? (
              <div className="flex items-center justify-center w-full mb-0.5">
                <img
                  src={restaurantLogo}
                  alt={restaurantName}
                  crossOrigin="anonymous"
                  className="receipt-logo max-h-36 sm:max-h-40 max-w-[320px] w-auto object-contain mx-auto grayscale contrast-125 dark:brightness-110 mt-0 mb-1"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = "none";
                  }}
                />
              </div>
            ) : (
              <h2 className="font-display text-2xl font-black tracking-wider uppercase text-foreground">
                {restaurantName}
              </h2>
            )}
            <p className="text-xs text-muted-foreground font-mono font-semibold leading-normal w-full text-center">
              {branchAddress}
            </p>
            <p className="text-xs text-muted-foreground font-mono font-semibold">
              Tel: {branchPhone}
            </p>
            <p className="text-xs text-muted-foreground font-mono font-medium pt-1">
              {new Date(order.createdAt).toLocaleString([], {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
            </p>
          </div>

          {/* Order Meta Strip */}
          <div className="border-t border-b border-dashed border-border/80 py-2.5 space-y-1">
            <div className="flex justify-between items-center font-bold">
              <span className="text-sm">ORDER #{order.number}</span>
              <span className="inline-block px-2 py-0.5 rounded bg-muted text-[10px] uppercase font-bold tracking-wide">
                {TYPE_META[order.type].label}
              </span>
            </div>
            {order.tableNumber && (
              <div className="text-[11px] font-semibold">Table: #{order.tableNumber}</div>
            )}
            <div className="flex justify-between text-[11px]">
              <span>Customer: {order.customerName}</span>
              <span>{order.phone}</span>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="space-y-1.5">
            <div className="flex justify-between font-bold text-[11px] uppercase border-b border-border pb-1 tracking-wider">
              <span>Item Description</span>
              <span>Total</span>
            </div>
            {order.lines.map((l) => (
              <div key={l.itemId} className="flex justify-between gap-2 text-[11px] py-0.5">
                <span className="truncate">
                  {l.name} <span className="font-bold">× {l.qty}</span>
                </span>
                <span className="shrink-0 font-bold">
                  {cs}
                  {(l.qty * l.price).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {/* Summary Breakdown */}
          <div className="border-t border-dashed border-border/80 pt-2 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>
                {cs}
                {order.subtotal.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Tax ({Math.round(TAX_RATE * 100)}%):</span>
              <span>
                {cs}
                {order.tax.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between font-black text-sm pt-2 border-t-2 border-foreground mt-1">
              <span>TOTAL PAID:</span>
              <span className="text-primary">
                {cs}
                {order.total.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Footer Thank You */}
          <div className="text-center pt-3 space-y-1 border-t border-dashed border-border/60">
            <p className="text-[10px] font-sans font-semibold text-muted-foreground">
              *** Thank you for dining with us! ***
            </p>
            <p className="text-[9px] text-muted-foreground">Powered by MenuVerse OS</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 mt-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Close
          </Button>
          <Button
            className="gradient-warm text-primary-foreground shadow-elegant rounded-xl gap-1.5"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4" /> Print Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddItemsToOrderDialog({
  order,
  items,
  currency,
  onClose,
  onSave,
}: {
  order: Order | null;
  items: FoodItem[];
  currency?: string;
  onClose: () => void;
  onSave: (orderId: string, extraLines: OrderLine[]) => void;
}) {
  const [extraCart, setExtraCart] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    setExtraCart({});
    setSearch("");
  }, [order]);

  if (!order) return null;

  const filteredItems = items.filter((it) =>
    it.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const addQty = (id: string, delta: number) => {
    setExtraCart((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: next };
    });
  };

  const handleConfirm = () => {
    const extraLines: OrderLine[] = [];
    for (const [id, qty] of Object.entries(extraCart)) {
      if (qty > 0) {
        const item = items.find((i) => i.id === id);
        if (item) {
          const price = item.discountPrice ?? item.price;
          extraLines.push({ itemId: item.id, name: item.name, price, qty });
        }
      }
    }
    if (extraLines.length === 0) {
      toast.error("Select at least one item to add");
      return;
    }
    onSave(order.id, extraLines);
    onClose();
  };

  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" /> Add Items to Order #{order.number}
          </DialogTitle>
          <DialogDescription>
            Select additional dishes or drinks to append to this order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search food items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 border border-border rounded-xl p-2">
            {filteredItems.map((it) => {
              const qty = extraCart[it.id] || 0;
              const price = it.discountPrice ?? it.price;
              return (
                <div
                  key={it.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/60 border border-border/40"
                >
                  <div>
                    <p className="font-semibold text-sm">{it.name}</p>
                    <p className="text-xs text-primary font-bold">
                      {formatCurrency(price, currency)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => addQty(it.id, -1)}
                      disabled={qty === 0}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-5 text-center text-xs font-bold">{qty}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => addQty(it.id, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button className="gradient-warm text-primary-foreground" onClick={handleConfirm}>
            Add Selected Items
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BillPaymentDialog({
  order,
  currencySymbol = "$",
  onClose,
  onComplete,
}: {
  order: Order | null;
  currencySymbol?: string;
  onClose: () => void;
  onComplete: (orderId: string, method: string, tendered?: number) => void;
}) {
  const [method, setMethod] = useState<"cash" | "card" | "mobile">("cash");
  const [tendered, setTendered] = useState<string>("");

  useEffect(() => {
    setMethod("cash");
    setTendered("");
  }, [order]);

  if (!order) return null;

  const tenderedAmount = parseFloat(tendered) || 0;
  const change = Math.max(0, tenderedAmount - order.total);

  const handlePay = () => {
    if (method === "cash" && tenderedAmount < order.total) {
      toast.error(
        `Tendered amount must be at least ${formatCurrency(order.total, currencySymbol)}`,
      );
      return;
    }
    const methodLabel =
      method === "cash"
        ? "Cash"
        : method === "card"
          ? "Credit/Debit Card"
          : "Mobile Banking (bKash)";
    onComplete(order.id, methodLabel, method === "cash" ? tenderedAmount : undefined);
    onClose();
  };

  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-3xl p-6 border border-border/40 shadow-2xl bg-white dark:bg-card overflow-hidden">
        <DialogHeader className="pb-1">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="font-display text-xl font-black tracking-tight text-foreground">
                Bill & Payment
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Process checkout payment for Order #{order.number}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-linear-to-br from-amber-500/5 via-amber-500/10 to-amber-500/5 p-4 text-center shadow-xs">
            <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">
              Total Amount Due
            </p>
            <p className="font-display text-3xl font-black tracking-tight text-amber-600 dark:text-amber-400 mt-1">
              {formatCurrency(order.total, currencySymbol)}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Payment Method
            </Label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: "cash", label: "Cash", icon: Wallet },
                { id: "card", label: "Card", icon: CreditCard },
                { id: "mobile", label: "Mobile Pay", icon: Receipt },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMethod(id as "cash" | "card" | "mobile")}
                  className={cn(
                    "flex items-center justify-center py-2 px-2.5 rounded-md border text-xs font-bold gap-1.5 transition-all duration-200 cursor-pointer",
                    method === id
                      ? "border-amber-500/80 bg-amber-500/10 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/20 shadow-xs"
                      : "border-border/60 bg-muted/20 hover:bg-muted/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      method === id
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground",
                    )}
                  />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {method === "cash" && (
            <div className="space-y-2.5 rounded-2xl border border-border/60 p-4 bg-muted/20">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Cash Tendered ({currencySymbol})
                </Label>
                <Input
                  type="number"
                  min={order.total}
                  step="any"
                  value={tendered}
                  onChange={(e) => setTendered(e.target.value)}
                  placeholder={`e.g. ${Math.ceil(order.total)}`}
                  className="h-11 rounded-xl bg-white dark:bg-card font-display text-lg font-bold border-amber-200/90 focus-visible:ring-amber-500/20 shadow-xs"
                />
              </div>
              {tenderedAmount >= order.total && (
                <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs text-emerald-900 dark:text-emerald-200">
                  <span className="font-semibold">Change to return:</span>
                  <span className="font-display text-base font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(change, currencySymbol)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2 border-t border-border/40">
          <Button
            variant="outline"
            className="h-10 rounded-full font-semibold cursor-pointer"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className="h-10 px-6 rounded-full gradient-warm text-primary-foreground font-semibold shadow-xs hover:shadow-md transition-all cursor-pointer gap-1.5"
            onClick={handlePay}
          >
            <CheckCircle2 className="h-4 w-4" /> Confirm & Pay {formatCurrency(order.total)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
