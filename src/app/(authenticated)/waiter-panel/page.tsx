"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams, useParams } from "next/navigation";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BlobImg } from "@/components/ui/blob-img";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  getWaiterRequestsServer,
  getWaiterRequestHistoryServer,
  updateWaiterRequestServer,
  getWaiterActiveOrdersServer,
  saveOrderServer,
  updateOrderStatusServer,
  getFoodItemsServer,
  getCategoriesServer,
  getCurrentUser,
  getBranchesServer,
  getSettingsServer,
  getRestaurantProfile,
} from "@/lib/db-queries.server";
import type {
  WaiterRequest,
  WaiterRequestType,
  WaiterRequestStatus,
  FullOrderRecord,
  OrderLineRecord,
} from "@/lib/db-queries.server";
import { toast } from "sonner";
import { cn, formatCurrency, getCurrencySymbol } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useRealtime, playChime } from "@/lib/use-realtime";
import {
  Bell,
  Droplet,
  FileText,
  CheckCircle2,
  Clock,
  Search,
  Plus,
  Minus,
  X,
  Utensils,
  ChefHat,
  RefreshCw,
  Sparkles,
  ConciergeBell,
  Check,
  CheckCheck,
  SquareTerminal,
  Activity,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type FoodItem = {
  id: string;
  name: string;
  price: number;
  discountPrice?: number | null;
  category: string;
  image?: string;
  available?: boolean;
};

type Category = { id: string; name: string; icon?: string };

// ─── Constants ───────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 45000;

const REQUEST_CONFIG: Record<
  WaiterRequestType,
  {
    icon: typeof Bell;
    label: string;
    badgeClass: string;
    borderClass: string;
  }
> = {
  call: {
    icon: Bell,
    label: "Call Waiter",
    badgeClass: "bg-violet-500/10 text-violet-500 border-violet-500/20",
    borderClass: "border-l-4 border-l-violet-500",
  },
  water: {
    icon: Droplet,
    label: "Water Please",
    badgeClass: "bg-sky-500/10 text-sky-500 border-sky-500/20",
    borderClass: "border-l-4 border-l-sky-500",
  },
  bill: {
    icon: FileText,
    label: "Request Bill",
    badgeClass: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    borderClass: "border-l-4 border-l-emerald-500",
  },
  custom: {
    icon: Sparkles,
    label: "Custom Request",
    badgeClass: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    borderClass: "border-l-4 border-l-amber-500",
  },
};

const STATUS_CONFIG: Record<WaiterRequestStatus, { label: string; badgeClass: string }> = {
  pending: {
    label: "Needs Attention",
    badgeClass:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 animate-pulse",
  },
  acknowledged: {
    label: "In Progress",
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  },
  done: {
    label: "Completed",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
};

const ORDER_STATUS_CONFIG: Record<
  string,
  { label: string; badgeClass: string; icon: typeof Clock }
> = {
  pending: {
    label: "New Order",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    icon: Clock,
  },
  preparing: {
    label: "In Kitchen",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    icon: ChefHat,
  },
  ready: {
    label: "Ready to Serve",
    badgeClass:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold",
    icon: CheckCircle2,
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function elapsedLabel(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

function newOrderId() {
  return `ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Localized Card Skeleton ──────────────────────────────────────────────────

function WaiterCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3 animate-pulse shadow-2xs">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
          <div className="space-y-1.5 min-w-0">
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="h-3 w-28 rounded" />
          </div>
        </div>
        <Skeleton className="h-5 w-16 rounded-full shrink-0" />
      </div>
      <div className="space-y-2 py-2 border-t border-border/40">
        <Skeleton className="h-3.5 w-full rounded" />
        <Skeleton className="h-3.5 w-4/5 rounded" />
      </div>
      <div className="flex items-center justify-between border-t border-border/40 pt-2">
        <Skeleton className="h-3.5 w-16 rounded" />
        <Skeleton className="h-4 w-12 rounded" />
      </div>
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-8 flex-1 rounded-xl" />
        <Skeleton className="h-8 flex-1 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function RequestCard({
  req,
  onAck,
  onDone,
  updating,
}: {
  req: WaiterRequest;
  onAck: (id: string) => void;
  onDone: (id: string) => void;
  updating: string | null;
}) {
  const cfg = REQUEST_CONFIG[req.type] || REQUEST_CONFIG.call;
  const sCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
  const IconComp = cfg.icon;
  const busy = updating === req.id;

  return (
    <div className="group relative rounded-2xl border border-border/60 bg-card p-4 transition-all duration-200 hover:border-border hover:shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
            <IconComp className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-foreground">Table {req.tableNo}</h3>
              <Badge
                variant="secondary"
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                  sCfg.badgeClass,
                )}
              >
                {sCfg.label}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground font-normal">
              <span className="font-medium text-foreground">{cfg.label}</span> ·{" "}
              <span className="font-mono">{elapsedLabel(req.createdAt)}</span>
            </p>
          </div>
        </div>
      </div>

      {req.note && (
        <div className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-xs italic text-muted-foreground">
          &ldquo;{req.note}&rdquo;
        </div>
      )}

      <div className="mt-3.5 flex gap-2">
        {req.status === "pending" && (
          <Button
            id={`ack-btn-${req.id}`}
            disabled={busy}
            onClick={() => onAck(req.id)}
            size="sm"
            variant="secondary"
            className="flex-1 rounded-xl text-xs h-8 font-medium gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            {busy ? "…" : "Acknowledge"}
          </Button>
        )}
        {req.status !== "done" && (
          <Button
            id={`done-btn-${req.id}`}
            disabled={busy}
            onClick={() => onDone(req.id)}
            size="sm"
            className="flex-1 rounded-xl text-xs h-8 font-medium gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {busy ? "…" : "Mark Done"}
          </Button>
        )}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  currency,
  onStatusChange,
  onEdit,
  updating,
}: {
  order: FullOrderRecord;
  currency?: string;
  onStatusChange: (id: string, status: FullOrderRecord["status"]) => void;
  onEdit: (order: FullOrderRecord) => void;
  updating: string | null;
}) {
  const sCfg = ORDER_STATUS_CONFIG[order.status] || ORDER_STATUS_CONFIG.pending;
  const StatusIcon = sCfg.icon;
  const busy = updating === order.id;
  const totalQty = order.lines.reduce((acc, curr) => acc + curr.qty, 0);

  return (
    <div className="group relative rounded-2xl border border-border/60 bg-card p-4 transition-all duration-200 hover:border-border hover:shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground font-semibold text-xs">
            {order.tableNumber ? `T${order.tableNumber}` : "—"}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-semibold text-sm text-foreground whitespace-nowrap">
                Table {order.tableNumber || "—"}
              </h3>
              <span className="font-mono text-[10px] text-muted-foreground/70">
                #{order.number}
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-normal whitespace-normal wrap-break-word">
              {order.customerName} ·{" "}
              <span className="font-mono">{elapsedLabel(order.createdAt)}</span>
            </p>
          </div>
        </div>

        <Badge
          variant="secondary"
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
            sCfg.badgeClass,
          )}
        >
          <StatusIcon className="mr-1 h-3 w-3" />
          {sCfg.label}
        </Badge>
      </div>

      {/* Item List */}
      <div className="py-2.5 divide-y divide-border/30">
        {order.lines.map((l, i) => (
          <div key={i} className="flex items-start justify-between gap-2 py-1.5 text-xs">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <span className="font-mono text-[11px] font-semibold text-muted-foreground/80 w-4 shrink-0 mt-0.5">
                {l.qty}×
              </span>
              <span className="wrap-break-word font-normal text-foreground">{l.name}</span>
            </div>
            <span className="font-mono text-xs text-muted-foreground shrink-0">
              {formatCurrency(l.price * l.qty, currency)}
            </span>
          </div>
        ))}
        {order.lines.length === 0 && (
          <p className="py-2 text-xs italic text-muted-foreground/60">No items added</p>
        )}
      </div>

      {/* Footer Total */}
      <div className="flex items-center justify-between border-t border-border/40 pt-2.5 text-xs">
        <span className="text-muted-foreground font-normal">
          Total ({totalQty} {totalQty === 1 ? "item" : "items"})
        </span>
        <span className="font-mono text-sm font-bold text-foreground">
          {formatCurrency(order.total, currency)}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="mt-3 flex gap-2">
        <Button
          id={`edit-order-btn-${order.id}`}
          onClick={() => onEdit(order)}
          variant="secondary"
          size="sm"
          className="flex-1 rounded-xl text-xs h-8 font-medium"
        >
          Edit Order
        </Button>

        {order.status === "pending" && (
          <Button
            id={`status-preparing-${order.id}`}
            disabled={busy}
            onClick={() => onStatusChange(order.id, "preparing")}
            size="sm"
            className="flex-1 rounded-xl text-xs h-8 font-medium gap-1.5"
          >
            <ChefHat className="h-3.5 w-3.5" />
            {busy ? "…" : "To Kitchen"}
          </Button>
        )}

        {order.status === "preparing" && (
          <Button
            id={`status-ready-${order.id}`}
            disabled={busy}
            onClick={() => onStatusChange(order.id, "ready")}
            size="sm"
            className="flex-1 rounded-xl text-xs h-8 font-medium gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {busy ? "…" : "Mark Ready"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Add/Edit Order Modal ─────────────────────────────────────────────────────

function OrderModal({
  order,
  items,
  categories,
  currency,
  onClose,
  onSave,
}: {
  order: FullOrderRecord | null;
  items: FoodItem[];
  categories: Category[];
  currency?: string;
  onClose: () => void;
  onSave: (order: FullOrderRecord) => Promise<void>;
}) {
  const isNew = !order?.id || order.id.startsWith("__new");
  const [tableNo, setTableNo] = useState(order?.tableNumber || "");
  const [customerName, setCustomerName] = useState(
    isNew ? "Guest" : order?.customerName || "Guest",
  );
  const [lines, setLines] = useState<OrderLineRecord[]>(order?.lines || []);
  const [catFilter, setCatFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const TAX_RATE = 0.08;
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const total = subtotal + tax;

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchCat = catFilter === "all" || item.category === catFilter;
      const matchSearch =
        !searchQuery.trim() || item.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      return matchCat && matchSearch;
    });
  }, [items, catFilter, searchQuery]);

  function addItem(item: FoodItem) {
    const price = item.discountPrice ?? item.price;
    setLines((prev) => {
      const ex = prev.find((l) => l.itemId === item.id);
      if (ex) {
        return prev.map((l) => (l.itemId === item.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { itemId: item.id, name: item.name, price, qty: 1 }];
    });
  }

  function changeQty(itemId: string, delta: number) {
    setLines((prev) =>
      prev
        .map((l) => (l.itemId === itemId ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    );
  }

  async function handleSave() {
    if (!tableNo.trim()) {
      toast.error("Please enter a table number.");
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const rec: FullOrderRecord = {
        id: isNew ? newOrderId() : (order?.id ?? newOrderId()),
        number: isNew ? Math.floor(Date.now() / 1000) % 100000 : (order?.number ?? 1),
        branchId: order?.branchId || undefined,
        createdAt: isNew ? now : (order?.createdAt ?? now),
        updatedAt: now,
        type: "dine-in",
        status: isNew ? "pending" : (order?.status ?? "pending"),
        tableNumber: tableNo.trim(),
        customerName: customerName.trim() || "Guest",
        phone: order?.phone || "",
        lines,
        subtotal,
        tax,
        total,
      };
      await onSave(rec);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <SquareTerminal className="h-5 w-5 text-primary" />
            {isNew ? "Create Dine-In Order" : `Edit Order #${order?.number}`}
          </DialogTitle>
          <DialogDescription>
            Specify table number and select food items for the guest.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Table & Guest Input */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                Table Number <span className="text-destructive">*</span>
              </label>
              <Input
                id="modal-table-input"
                value={tableNo}
                onChange={(e) => setTableNo(e.target.value)}
                placeholder="e.g. 04"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                Customer Name
              </label>
              <Input
                id="modal-customer-input"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Guest"
              />
            </div>
          </div>

          {/* Cart Summary */}
          {lines.length > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Order Cart ({lines.reduce((a, c) => a + c.qty, 0)} items)
                </span>
                <span className="font-mono text-xs font-bold text-foreground">
                  Subtotal: {formatCurrency(subtotal, currency)}
                </span>
              </div>
              <div className="space-y-1.5">
                {lines.map((l) => (
                  <div
                    key={l.itemId}
                    className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-1.5 text-xs"
                  >
                    <span className="font-medium text-foreground">{l.name}</span>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 rounded bg-muted p-0.5">
                        <button
                          id={`qty-minus-${l.itemId}`}
                          onClick={() => changeQty(l.itemId, -1)}
                          className="flex h-5 w-5 items-center justify-center rounded hover:bg-background text-foreground"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center font-mono font-bold text-foreground">
                          {l.qty}
                        </span>
                        <button
                          id={`qty-plus-${l.itemId}`}
                          onClick={() => changeQty(l.itemId, 1)}
                          className="flex h-5 w-5 items-center justify-center rounded hover:bg-background text-foreground"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="w-14 text-right font-mono font-bold text-primary">
                        {formatCurrency(l.price * l.qty, currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search & Categories */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search food items by name..."
                className="pl-9"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              <Button
                id="cat-all"
                onClick={() => setCatFilter("all")}
                variant={catFilter === "all" ? "default" : "outline"}
                size="sm"
                className="shrink-0 rounded-full"
              >
                All Items
              </Button>
              {categories.map((c) => (
                <Button
                  key={c.id}
                  id={`cat-${c.id}`}
                  onClick={() => setCatFilter(c.id)}
                  variant={catFilter === c.id ? "default" : "outline"}
                  size="sm"
                  className="shrink-0 rounded-full"
                >
                  {c.icon} {c.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Food Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {filteredItems.map((item) => {
              const inCart = lines.find((l) => l.itemId === item.id);
              const price = item.discountPrice ?? item.price;
              return (
                <button
                  key={item.id}
                  id={`add-item-${item.id}`}
                  onClick={() => addItem(item)}
                  className={cn(
                    "relative flex flex-col justify-between rounded-xl border p-3 text-left transition-all duration-150 hover:shadow-sm",
                    inCart
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-muted-foreground/30",
                  )}
                >
                  {inCart && (
                    <Badge className="absolute right-2 top-2 h-5 min-w-5 px-1 justify-center rounded-full">
                      {inCart.qty}
                    </Badge>
                  )}

                  {item.image ? (
                    <BlobImg
                      src={item.image}
                      alt={item.name}
                      className="mb-2 h-16 w-full rounded-lg object-cover"
                    />
                  ) : (
                    <div className="mb-2 flex h-16 w-full items-center justify-center rounded-lg bg-muted text-xl">
                      🍲
                    </div>
                  )}

                  <div>
                    <p className="line-clamp-2 text-xs font-semibold text-foreground">
                      {item.name}
                    </p>
                    <p className="mt-1 font-mono text-xs font-bold text-primary">
                      {formatCurrency(price, currency)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="border-t border-border p-4 bg-muted/30">
          <Button
            id="save-order-btn"
            disabled={saving || lines.length === 0}
            onClick={handleSave}
            className="w-full font-bold gap-2"
          >
            <SquareTerminal className="h-4 w-4" />
            {saving
              ? "Saving Order…"
              : `${isNew ? "Place Dine-In Order" : "Update Order"} · ${formatCurrency(total, currency)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WaiterPanelPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => {});
  }, []);

  const [tab, setTab] = useState<"requests" | "orders">("requests");

  // Branch context
  const [branchesList, setBranchesList] = useState<{ id: string; name: string }[]>([]);
  const [waiterBranch, setWaiterBranch] = useState<{ id: string; name: string } | null>(null);

  // Filters
  const [tableFilter, setTableFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Requests state
  const [requests, setRequests] = useState<WaiterRequest[]>([]);
  const [history, setHistory] = useState<WaiterRequest[]>([]);
  const [reqFilter, setReqFilter] = useState<"active" | "history">("active");
  const [updatingReq, setUpdatingReq] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>("BDT");

  // Orders state
  const [orders, setOrders] = useState<FullOrderRecord[]>([]);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<FullOrderRecord | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);

  // Menu data
  const [items, setItems] = useState<FoodItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isGlobalOwner =
    user?.role?.toLowerCase() === "super_admin" ||
    user?.role?.toLowerCase() === "superadmin" ||
    user?.role?.toLowerCase() === "owner";

  // ── Data Loading ────────────────────────────────────────────────────────────

  const loadRequests = useCallback(async () => {
    try {
      const [active, done] = await Promise.all([
        getWaiterRequestsServer({
          data: {
            branchId: waiterBranch?.id || undefined,
            tableNo: tableFilter || undefined,
            type: typeFilter !== "all" ? typeFilter : undefined,
          },
        }),
        getWaiterRequestHistoryServer({
          data: {
            branchId: waiterBranch?.id || undefined,
            tableNo: tableFilter || undefined,
            type: typeFilter !== "all" ? typeFilter : undefined,
          },
        }),
      ]);
      setRequests(active);
      setHistory(done);
    } catch (err) {
      console.warn("Waiter panel poll error:", err);
    }
  }, [waiterBranch, tableFilter, typeFilter]);

  const loadOrders = useCallback(async () => {
    try {
      const rows = await getWaiterActiveOrdersServer({
        data: {
          branchId: waiterBranch?.id || undefined,
        },
      });
      setOrders(rows);
    } catch (err) {
      console.warn("Waiter orders poll error:", err);
    }
  }, [waiterBranch]);

  const loadMenu = useCallback(async () => {
    try {
      const [rawItems, rawCats, rawBranches, dbSettings, prof] = await Promise.all([
        getFoodItemsServer({ data: {} }),
        getCategoriesServer({ data: {} }),
        getBranchesServer({ data: {} }),
        getSettingsServer().catch(() => null),
        getRestaurantProfile().catch(() => null),
      ]);

      if (prof?.currency) {
        setCurrency(String(prof.currency));
      } else if (dbSettings && typeof dbSettings === "object") {
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
        if (target.currency) setCurrency(String(target.currency));
      }

      setItems(
        (rawItems || []).filter(
          (i: FoodItem) =>
            i.available !== false && !("hidden" in i && (i as { hidden?: boolean }).hidden),
        ),
      );
      setCategories(rawCats || []);

      if (rawBranches && Array.isArray(rawBranches) && rawBranches.length > 0) {
        setBranchesList(rawBranches.map((b) => ({ id: b.id, name: b.name })));
        if (!isGlobalOwner) {
          let targetBranch = rawBranches[0];
          if (user) {
            const uName = (user.full_name || "").toLowerCase().trim();
            const managedBranch = rawBranches.find((b) => {
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
              targetBranch = managedBranch;
            } else if (user.branch) {
              const bClean = user.branch
                .replace(/\s*\([^)]*\)/g, "")
                .toLowerCase()
                .trim();
              const bMatched = rawBranches.find(
                (b) =>
                  b.name.toLowerCase().trim() === bClean ||
                  b.name.toLowerCase().includes(bClean) ||
                  bClean.includes(b.name.toLowerCase()),
              );
              if (bMatched) targetBranch = bMatched;
            }
          }
          setWaiterBranch({ id: targetBranch.id, name: targetBranch.name });
        }
      }
    } catch {
      /* ignore */
    }
  }, [user, isGlobalOwner]);

  useEffect(() => {
    let mounted = true;
    async function init() {
      setLoading(true);
      await loadMenu();
      await Promise.all([loadRequests(), loadOrders()]);
      if (mounted) setLoading(false);
    }
    void init();

    pollRef.current = setInterval(() => {
      void loadRequests();
      void loadOrders();
    }, POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadRequests, loadOrders, loadMenu]);

  useRealtime({
    branchId: waiterBranch?.id || undefined,
    eventTypes: [
      "waiter:called",
      "waiter:resolved",
      "order:created",
      "order:updated",
      "order:deleted",
    ],
    onEvent: (event) => {
      if (event.type === "waiter:called") {
        const req = event.payload as WaiterRequest;
        if (req?.id) {
          setRequests((prev) => {
            if (prev.some((r) => r.id === req.id)) return prev;
            return [req, ...prev];
          });
          playChime("waiter");
          const label =
            req.type === "bill"
              ? "Request Bill 🧾"
              : req.type === "water"
                ? "Water Please 💧"
                : "Call Waiter 🔔";
          toast.warning(`Table ${req.tableNo}: ${label}`, {
            description: req.note ? `Note: "${req.note}"` : "Guest is waiting at the table",
          });
        }
      } else if (event.type === "waiter:resolved") {
        void loadRequests();
      } else if (event.type === "order:created") {
        playChime("order");
        void loadOrders();
      } else if (event.type === "order:updated" || event.type === "order:deleted") {
        void loadOrders();
      }
    },
  });

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function handleAck(id: string) {
    setUpdatingReq(id);
    try {
      await updateWaiterRequestServer({ data: { id, status: "acknowledged" } });
      await loadRequests();
      toast.success("Request acknowledged 👋");
    } catch {
      toast.error("Failed to update status");
    } finally {
      setUpdatingReq(null);
    }
  }

  async function handleDone(id: string) {
    setUpdatingReq(id);
    try {
      await updateWaiterRequestServer({ data: { id, status: "done" } });
      await loadRequests();
      toast.success("Request completed ✓");
    } catch {
      toast.error("Failed to update status");
    } finally {
      setUpdatingReq(null);
    }
  }

  async function handleOrderStatus(id: string, status: FullOrderRecord["status"]) {
    setUpdatingOrder(id);
    try {
      await updateOrderStatusServer({ data: { id, status } });
      await loadOrders();
      toast.success(`Order status updated to ${status}`);
    } catch {
      toast.error("Failed to update order");
    } finally {
      setUpdatingOrder(null);
    }
  }

  async function handleSaveOrder(order: FullOrderRecord) {
    try {
      await saveOrderServer({
        data: order as unknown as Parameters<typeof saveOrderServer>[0]["data"],
      });
      await loadOrders();
      toast.success(order.id.startsWith("ord-") ? "Order placed! 🎉" : "Order updated ✓");
    } catch {
      toast.error("Failed to save order");
      throw new Error("save failed");
    }
  }

  function openNewOrder() {
    const blankOrder: FullOrderRecord = {
      id: `__new-${Date.now()}`,
      number: 0,
      branchId: waiterBranch?.id || branchesList[0]?.id || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      type: "dine-in",
      status: "pending",
      tableNumber: "",
      customerName: "Guest",
      phone: "",
      lines: [],
      subtotal: 0,
      tax: 0,
      total: 0,
    };
    setEditingOrder(blankOrder);
    setShowOrderModal(true);
  }

  // Filtering
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const filteredRequests = useMemo(() => {
    const list = reqFilter === "active" ? requests : history;
    return list.filter((r) => {
      const matchTable =
        !tableFilter.trim() || r.tableNo.toLowerCase().includes(tableFilter.toLowerCase().trim());
      const matchType = typeFilter === "all" || r.type === typeFilter;
      return matchTable && matchType;
    });
  }, [requests, history, reqFilter, tableFilter, typeFilter]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (!tableFilter.trim()) return true;
      const t = (o.tableNumber || "").toLowerCase();
      const c = (o.customerName || "").toLowerCase();
      const q = tableFilter.toLowerCase().trim();
      return t.includes(q) || c.includes(q);
    });
  }, [orders, tableFilter]);

  const preparingCount = orders.filter((o) => o.status === "preparing").length;
  const readyCount = orders.filter((o) => o.status === "ready").length;
  const activeTableCount = new Set([
    ...requests.map((r) => r.tableNo),
    ...orders.map((o) => o.tableNumber).filter(Boolean),
  ]).size;

  return (
    <div className="space-y-6">
      {showOrderModal && editingOrder && (
        <OrderModal
          order={editingOrder}
          items={items}
          categories={categories}
          currency={currency}
          onClose={() => {
            setShowOrderModal(false);
            setEditingOrder(null);
          }}
          onSave={handleSaveOrder}
        />
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Pending Calls</p>
              {loading ? (
                <Skeleton className="h-8 w-12 rounded mt-1" />
              ) : (
                <h3 className="text-2xl font-bold font-mono mt-1 text-foreground">
                  {pendingCount}
                </h3>
              )}
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <Bell className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">In Kitchen</p>
              {loading ? (
                <Skeleton className="h-8 w-12 rounded mt-1" />
              ) : (
                <h3 className="text-2xl font-bold font-mono mt-1 text-foreground">
                  {preparingCount}
                </h3>
              )}
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <ChefHat className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Ready to Serve</p>
              {loading ? (
                <Skeleton className="h-8 w-12 rounded mt-1" />
              ) : (
                <h3 className="text-2xl font-bold font-mono mt-1 text-foreground">{readyCount}</h3>
              )}
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-violet-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Active Tables</p>
              {loading ? (
                <Skeleton className="h-8 w-12 rounded mt-1" />
              ) : (
                <h3 className="text-2xl font-bold font-mono mt-1 text-foreground">
                  {activeTableCount}
                </h3>
              )}
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
              <Utensils className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Controls & Content */}
      <div className="space-y-4">
        {/* Controls Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* View Tabs */}
          <div className="inline-flex items-center w-fit max-w-full shrink-0 rounded-xl border border-border/60 bg-muted/60 p-1">
            <button
              id="tab-requests"
              onClick={() => setTab("requests")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition",
                tab === "requests"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Bell className="h-3.5 w-3.5" />
              <span>Table Requests</span>
              {pendingCount > 0 && (
                <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">
                  {pendingCount}
                </Badge>
              )}
            </button>
            <button
              id="tab-orders"
              onClick={() => setTab("orders")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition",
                tab === "orders"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Utensils className="h-3.5 w-3.5" />
              <span>Dine-In Orders</span>
              {orders.length > 0 && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                  {orders.length}
                </Badge>
              )}
            </button>
          </div>

          {/* Filter controls & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Branch Selector */}
            {isGlobalOwner || branchesList.length > 1 ? (
              <Select
                value={waiterBranch?.id || "all"}
                onValueChange={(val) => {
                  if (val === "all") {
                    setWaiterBranch(null);
                  } else {
                    const found = branchesList.find((b) => b.id === val);
                    if (found) setWaiterBranch(found);
                  }
                }}
              >
                <SelectTrigger className="h-9 w-36 text-xs bg-background">
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  {isGlobalOwner && <SelectItem value="all">🏢 All Branches</SelectItem>}
                  {branchesList.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      📍 {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : waiterBranch ? (
              <Badge
                variant="outline"
                className="h-9 px-3 gap-1.5 text-xs bg-background font-medium"
              >
                📍 {waiterBranch.name}
              </Badge>
            ) : null}

            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                placeholder="Filter by table (e.g. 04)..."
                className="pl-9 h-9 text-xs bg-background"
              />
              {tableFilter && (
                <button
                  onClick={() => setTableFilter("")}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {tab === "requests" && (
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 w-36 text-xs bg-background">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="call">🔔 Call Waiter</SelectItem>
                  <SelectItem value="water">💧 Water Please</SelectItem>
                  <SelectItem value="bill">🧾 Request Bill</SelectItem>
                  <SelectItem value="custom">✏️ Custom</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Button
              id="new-order-btn"
              onClick={openNewOrder}
              size="sm"
              className="gradient-warm gap-1.5 h-9 font-semibold text-white shadow-xs shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>New Order</span>
            </Button>
          </div>
        </div>

        {/* Content area */}
        {loading ? (
          <div>
            <div className="mb-4 flex gap-2">
              <Skeleton className="h-8 w-28 rounded-full" />
              <Skeleton className="h-8 w-28 rounded-full" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <WaiterCardSkeleton key={i} />
              ))}
            </div>
          </div>
        ) : tab === "requests" ? (
          <div>
            <div className="mb-4 flex gap-2">
              <Button
                id="filter-active"
                onClick={() => setReqFilter("active")}
                variant={reqFilter === "active" ? "default" : "outline"}
                size="sm"
                className="rounded-full"
              >
                Active Alerts ({requests.length})
              </Button>
              <Button
                id="filter-history"
                onClick={() => setReqFilter("history")}
                variant={reqFilter === "history" ? "default" : "outline"}
                size="sm"
                className="rounded-full"
              >
                Completed ({history.length})
              </Button>
            </div>

            {filteredRequests.length === 0 ? (
              <div className="py-16 text-center border rounded-xl border-dashed border-border bg-card/40">
                <Bell className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm font-semibold text-muted-foreground">
                  {reqFilter === "active" ? "No active table requests" : "No request history yet"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Customer requests will appear here in real time.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4">
                {filteredRequests.map((req) => (
                  <RequestCard
                    key={req.id}
                    req={req}
                    onAck={handleAck}
                    onDone={handleDone}
                    updating={updatingReq}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            {filteredOrders.length === 0 ? (
              <div className="py-16 text-center border rounded-xl border-dashed border-border bg-card/40">
                <Utensils className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm font-semibold text-muted-foreground">
                  No active dine-in orders
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Click &quot;New Order&quot; above to create a table order.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4">
                {filteredOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    currency={currency}
                    onStatusChange={handleOrderStatus}
                    onEdit={(o) => {
                      setEditingOrder(o);
                      setShowOrderModal(true);
                    }}
                    updating={updatingOrder}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
