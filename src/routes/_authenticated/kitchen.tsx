import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  ChefHat,
  Package,
  CheckCircle2,
  Utensils,
  Store,
  Bike,
  Flame,
  GripVertical,
  ArrowRight,
  AlertCircle,
  Timer,
  Activity,
  Volume2,
  VolumeX,
  XCircle,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatCurrency } from "@/lib/utils";

import {
  getOrdersServer,
  updateOrderStatusServer,
  getCurrentUser,
  getBranchesServer,
} from "@/lib/db-queries.server";
import { Skeleton } from "@/components/ui/skeleton";
import { useRealtime, playChime } from "@/lib/use-realtime";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/kitchen")({
  ssr: false,
  component: KitchenDisplayPage,
});

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
  prepTimeMinutes?: number;
  prepStartedAt?: string;
  estimatedPrepMinutes?: number;
};

const KITCHEN_STATUS_META: Record<
  OrderStatus,
  { label: string; icon: typeof Clock; className: string }
> = {
  pending: {
    label: "New Order",
    icon: Clock,
    className: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  },
  preparing: {
    label: "In Kitchen",
    icon: ChefHat,
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  },
  ready: {
    label: "Ready to Serve",
    icon: Package,
    className: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  },
  completed: {
    label: "Served & Done",
    icon: CheckCircle2,
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
};

const TYPE_ICON: Record<OrderType, typeof Utensils> = {
  "dine-in": Utensils,
  takeaway: Store,
  delivery: Bike,
};

const TYPE_LABEL: Record<OrderType, string> = {
  "dine-in": "Dine In",
  takeaway: "Takeaway",
  delivery: "Delivery",
};

const COLUMNS: {
  status: OrderStatus;
  label: string;
  icon: typeof Clock;
  bannerBg: string;
  nextStatus?: OrderStatus;
  nextLabel?: string;
}[] = [
  {
    status: "pending",
    label: "New Orders",
    icon: Clock,
    bannerBg: "bg-[#0284C7]",
    nextStatus: "preparing",
    nextLabel: "Start Prep",
  },
  {
    status: "preparing",
    label: "In Kitchen",
    icon: ChefHat,
    bannerBg: "bg-[#2563EB]",
    nextStatus: "ready",
    nextLabel: "Mark Ready",
  },
  {
    status: "ready",
    label: "Ready to Serve",
    icon: Package,
    bannerBg: "bg-[#7C3AED]",
    nextStatus: "completed",
    nextLabel: "Complete",
  },
  {
    status: "completed",
    label: "Served & Done",
    icon: CheckCircle2,
    bannerBg: "bg-[#059669]",
  },
];

function elapsedMin(iso: string, target?: number | string) {
  const targetMs =
    typeof target === "number" ? target : target ? new Date(target).getTime() : Date.now();
  return Math.max(0, Math.floor((targetMs - new Date(iso).getTime()) / 60000));
}

function playKitchenAlertSound() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const nowTime = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, nowTime);
    gain1.gain.setValueAtTime(0.18, nowTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, nowTime + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(nowTime);
    osc1.stop(nowTime + 0.25);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, nowTime + 0.12);
    gain2.gain.setValueAtTime(0.22, nowTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, nowTime + 0.42);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(nowTime + 0.12);
    osc2.stop(nowTime + 0.42);
  } catch {
    /* ignore browser audio policy restrictions */
  }
}

function KitchenTicketCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm space-y-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-2.5">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-16 rounded" />
          <Skeleton className="h-3.5 w-24 rounded" />
        </div>
        <Skeleton className="h-4 w-12 rounded" />
      </div>
      <div className="space-y-2 py-1">
        <div className="flex justify-between items-center">
          <Skeleton className="h-3.5 w-28 rounded" />
          <Skeleton className="h-3.5 w-8 rounded" />
        </div>
        <div className="flex justify-between items-center">
          <Skeleton className="h-3.5 w-20 rounded" />
          <Skeleton className="h-3.5 w-8 rounded" />
        </div>
      </div>
      <div className="pt-2 border-t border-border/40">
        <Skeleton className="h-8 w-full rounded-lg" />
      </div>
    </div>
  );
}

function KitchenDisplayPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [now, setNow] = useState<number>(() => Date.now());
  const [dragOver, setDragOver] = useState<OrderStatus | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("menuverse:kds-sound") !== "muted";
  });

  const [currentUser, setCurrentUser] = useState<{
    role?: string | null;
    branch?: string | null;
    full_name?: string | null;
  } | null>(null);
  const [branchesList, setBranchesList] = useState<{ id: string; name: string }[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [isOwner, setIsOwner] = useState<boolean>(false);

  const [prepDialogOpen, setPrepDialogOpen] = useState<boolean>(false);
  const [prepModalOrder, setPrepModalOrder] = useState<Order | null>(null);
  const [prepTimeInput, setPrepTimeInput] = useState<string>("15");

  const prevOrdersCountRef = useRef<number | null>(null);

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("menuverse:kds-sound", next ? "enabled" : "muted");
      }
      if (next) {
        playKitchenAlertSound();
        toast.success("Kitchen alert sound unmuted");
      } else {
        toast.info("Kitchen alert sound muted");
      }
      return next;
    });
  };

  useEffect(() => {
    async function loadSessionAndBranches() {
      try {
        const u = await getCurrentUser();
        const dbBranches = await getBranchesServer({ data: {} });
        if (dbBranches && Array.isArray(dbBranches) && dbBranches.length > 0) {
          setBranchesList(dbBranches.map((b) => ({ id: b.id, name: b.name })));

          let targetBranch = dbBranches[0];
          if (u) {
            setCurrentUser(u);
            const rClean = (u.role || "").toLowerCase().trim();
            const isOwnerRole =
              !rClean ||
              rClean.includes("owner") ||
              rClean.includes("super_admin") ||
              rClean.includes("superadmin") ||
              rClean.includes("admin");
            setIsOwner(isOwnerRole);

            if (!isOwnerRole) {
              const uName = (u.full_name || "").toLowerCase().trim();
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
                targetBranch = managedBranch;
              } else if (u.branch) {
                const bClean = u.branch
                  .replace(/\s*\([^)]*\)/g, "")
                  .toLowerCase()
                  .trim();
                const bByBranchName = dbBranches.find(
                  (b) =>
                    b.name.toLowerCase().trim() === bClean ||
                    b.name.toLowerCase().includes(bClean) ||
                    bClean.includes(b.name.toLowerCase()),
                );
                if (bByBranchName) targetBranch = bByBranchName;
              }
              setSelectedBranchId(targetBranch.id);
            } else {
              setSelectedBranchId("all");
            }
          }
        }
      } catch {
        /* ignore */
      }
    }
    loadSessionAndBranches();
  }, []);

  useEffect(() => {
    async function fetchOrders() {
      try {
        const dbOrders = await getOrdersServer({
          data: {
            branchId: selectedBranchId !== "all" ? selectedBranchId : undefined,
          },
        });
        if (dbOrders && Array.isArray(dbOrders)) {
          const fetched = dbOrders as unknown as Order[];
          if (
            prevOrdersCountRef.current !== null &&
            fetched.length > prevOrdersCountRef.current &&
            soundEnabled
          ) {
            playKitchenAlertSound();
            toast.info("🔔 New kitchen order received!");
          }
          prevOrdersCountRef.current = fetched.length;
          setOrders(fetched);
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();

    const poll = window.setInterval(fetchOrders, 45000);
    const tick = window.setInterval(() => setNow(Date.now()), 30000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [soundEnabled, selectedBranchId]);

  useRealtime({
    branchId: selectedBranchId !== "all" ? selectedBranchId : undefined,
    eventTypes: ["order:created", "order:updated", "order:deleted"],
    onEvent: (event) => {
      if (event.type === "order:created") {
        const payload = event.payload as Order;
        if (payload?.id) {
          setOrders((prev) => {
            if (prev.some((o) => o.id === payload.id)) return prev;
            return [payload, ...prev];
          });
          if (soundEnabled) {
            playChime("order");
          }
          toast.info(`🔔 New Kitchen Order #${payload.number || ""} received!`, {
            description: `Table: ${payload.tableNumber || "Dine-in"} • ${payload.customerName || "Guest"}`,
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

  const filteredOrders = useMemo(() => {
    if (isOwner && selectedBranchId === "all") return orders;

    const targetBranch = isOwner
      ? branchesList.find((b) => b.id === selectedBranchId)
      : branchesList.find((b) => b.id === selectedBranchId) || branchesList[0];

    if (!targetBranch) return orders;

    const targetIds = [
      targetBranch.name.toLowerCase().trim(),
      targetBranch.id.toLowerCase().trim(),
    ].filter(Boolean);

    const isDefaultBranch = targetBranch.name === branchesList[0]?.name;

    return orders.filter((o) => {
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
  }, [orders, isOwner, selectedBranchId, branchesList]);

  const grouped = useMemo(() => {
    const g: Record<OrderStatus, Order[]> = {
      pending: [],
      preparing: [],
      ready: [],
      completed: [],
      cancelled: [],
    };
    for (const o of filteredOrders) g[o.status].push(o);
    for (const k of Object.keys(g) as OrderStatus[]) {
      g[k].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    return g;
  }, [filteredOrders]);

  const stats = useMemo(() => {
    const activeCount = grouped.pending.length + grouped.preparing.length + grouped.ready.length;
    const urgentCount = [...grouped.pending, ...grouped.preparing].filter(
      (o) => elapsedMin(o.createdAt, now) >= 15,
    ).length;
    const totalToday = filteredOrders.length;
    return { activeCount, urgentCount, totalToday };
  }, [grouped, filteredOrders, now]);

  const updateStatus = async (id: string, status: OrderStatus, estimatedPrepMinutes?: number) => {
    const nowIso = new Date().toISOString();
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              status,
              updatedAt: nowIso,
              ...(status === "preparing" && !o.prepStartedAt ? { prepStartedAt: nowIso } : {}),
              ...(estimatedPrepMinutes ? { estimatedPrepMinutes } : {}),
            }
          : o,
      ),
    );
    try {
      await updateOrderStatusServer({ data: { id, status, estimatedPrepMinutes } });
      toast.success(`Order moved to ${KITCHEN_STATUS_META[status].label}`);
    } catch {
      toast.error("Failed to update order status");
    }
  };

  const handleStatusChangeRequest = (order: Order, targetStatus: OrderStatus) => {
    if (targetStatus === "preparing") {
      setPrepModalOrder(order);
      setPrepTimeInput(String(order.estimatedPrepMinutes || 15));
      setPrepDialogOpen(true);
    } else {
      updateStatus(order.id, targetStatus);
    }
  };

  const confirmPrepTime = async () => {
    if (!prepModalOrder) return;
    const mins = Math.max(1, Math.min(180, parseInt(prepTimeInput, 10) || 15));
    setPrepDialogOpen(false);
    await updateStatus(prepModalOrder.id, "preparing", mins);
    setPrepModalOrder(null);
  };

  const handleDragStart = (e: React.DragEvent, orderId: string, from: OrderStatus) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ orderId, from }));
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e: React.DragEvent, status: OrderStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOver !== status) setDragOver(status);
  };
  const handleDrop = (e: React.DragEvent, target: OrderStatus) => {
    e.preventDefault();
    setDragOver(null);
    try {
      const { orderId, from } = JSON.parse(e.dataTransfer.getData("text/plain")) as {
        orderId: string;
        from: OrderStatus;
      };
      if (from === target) return;
      const targetOrder = orders.find((o) => o.id === orderId);
      if (targetOrder) {
        handleStatusChangeRequest(targetOrder, target);
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className="-m-6 md:-m-8 p-6 md:p-8 h-[calc(100vh-4rem)] flex flex-col space-y-4 overflow-hidden"
      style={{ backgroundColor: "#EEEFF2" }}
    >
      {/* Top Toolbar: Branch Filter & Sound Toggle */}
      <div className="flex items-center justify-between gap-3">
        <div>
          {isOwner && branchesList.length > 1 ? (
            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger className="h-8 w-48 text-xs font-semibold bg-background border-border shadow-xs">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="all">All Branches</SelectItem>
                {branchesList.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground shadow-2xs">
              <Building2 className="h-3.5 w-3.5 text-amber-600" />
              <span>
                {branchesList.find((b) => b.id === selectedBranchId)?.name ||
                  currentUser?.branch ||
                  "Main Branch"}
              </span>
            </div>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={toggleSound}
          className={cn(
            "h-8 rounded-full border px-3 text-xs font-semibold gap-1.5 transition-all shadow-sm",
            soundEnabled
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
              : "border-muted-foreground/30 bg-muted/60 text-muted-foreground hover:bg-muted",
          )}
        >
          {soundEnabled ? (
            <>
              <Volume2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Alert Sound: On</span>
            </>
          ) : (
            <>
              <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Alert Sound: Off</span>
            </>
          )}
        </Button>
      </div>

      {/* KDS Overview Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
        <div className="flex items-center gap-3.5 rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm backdrop-blur-md">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Active Board Orders</p>
            {loading ? (
              <Skeleton className="h-7 w-12 rounded mt-1" />
            ) : (
              <h3 className="font-display text-xl font-bold text-foreground">
                {stats.activeCount}
              </h3>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm backdrop-blur-md">
          <div
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
              stats.urgentCount > 0
                ? "bg-red-500/10 text-red-500 animate-pulse"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Urgent Tickets (15m+)</p>
            {loading ? (
              <Skeleton className="h-7 w-12 rounded mt-1" />
            ) : (
              <h3
                className={cn(
                  "font-display text-xl font-bold",
                  stats.urgentCount > 0 ? "text-red-500" : "text-foreground",
                )}
              >
                {stats.urgentCount}
              </h3>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm backdrop-blur-md">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Total Today</p>
            {loading ? (
              <Skeleton className="h-7 w-12 rounded mt-1" />
            ) : (
              <h3 className="font-display text-xl font-bold text-foreground">{stats.totalToday}</h3>
            )}
          </div>
        </div>
      </div>

      {/* Kanban Board Columns Container — Fixed Width Columns + Horizontal Scroll */}
      <div className="flex-1 min-h-0 overflow-x-auto pb-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 h-full min-w-275">
          {COLUMNS.map(({ status, label, icon: Icon, bannerBg, nextStatus, nextLabel }) => {
            const isOver = dragOver === status;
            return (
              <div
                key={status}
                onDragOver={(e) => handleDragOver(e, status)}
                onDragLeave={() => setDragOver((s) => (s === status ? null : s))}
                onDrop={(e) => handleDrop(e, status)}
                className={cn(
                  "flex flex-col rounded-2xl border border-border/70 bg-[#EAEFF4] dark:bg-slate-900/60 transition-all duration-200 h-full min-h-0 overflow-hidden",
                  isOver && "border-primary ring-2 ring-primary/40 scale-[1.01]",
                )}
              >
                {/* Header Banner matching user's screenshot */}
                <header
                  className={cn(
                    "px-4 py-3.5 flex items-center justify-between text-white shrink-0",
                    bannerBg,
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-7 w-7 place-items-center rounded-lg bg-white/20">
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <h3 className="font-display text-sm font-bold tracking-wide text-white">
                      {label}
                    </h3>
                  </div>
                  <span className="grid h-6 min-w-6 place-items-center rounded-full bg-black/25 px-2 text-xs font-black text-white">
                    {loading ? (
                      <Skeleton className="h-3.5 w-3.5 rounded-full bg-white/40" />
                    ) : (
                      grouped[status].length
                    )}
                  </span>
                </header>

                {/* Column Body Canvas */}
                <ScrollArea className="flex-1 h-full min-h-0">
                  <div className="p-3 space-y-3">
                    {loading ? (
                      <div className="space-y-3">
                        <KitchenTicketCardSkeleton />
                        <KitchenTicketCardSkeleton />
                      </div>
                    ) : grouped[status].length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                        <p className="text-xs italic text-slate-400 font-medium">
                          No orders in this stage.
                        </p>
                      </div>
                    ) : (
                      grouped[status].map((o) => {
                        const TypeIcon = TYPE_ICON[o.type];
                        const prepStartTime = o.prepStartedAt || o.createdAt;
                        const activeEndTime = status === "completed" ? o.updatedAt : now;
                        const mins = elapsedMin(prepStartTime, activeEndTime);
                        const estMins = o.estimatedPrepMinutes || 15;
                        const isOverdue = status === "preparing" && mins > estMins;
                        const urgent =
                          (mins >= 15 || isOverdue) && status !== "ready" && status !== "completed";
                        return (
                          <Card
                            key={o.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, o.id, status)}
                            className="group relative cursor-move border-0 bg-white dark:bg-slate-900 rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md overflow-hidden"
                          >
                            <CardContent className="space-y-3 p-3.5 bg-white dark:bg-slate-900 rounded-xl min-w-0">
                              {/* Ticket Header */}
                              <div className="flex items-start justify-between gap-1.5 border-b border-border/40 pb-2.5 min-w-0">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h4 className="font-display text-base font-black tracking-tight text-foreground shrink-0">
                                      #{o.number}
                                    </h4>
                                    {isOverdue ? (
                                      <Badge className="bg-red-500 text-white px-1.5 py-0 text-[10px] font-bold animate-pulse gap-1 shrink-0">
                                        <Flame className="h-3 w-3" /> Overdue (+{mins - estMins}m)
                                      </Badge>
                                    ) : urgent ? (
                                      <Badge className="bg-amber-500 text-white px-1.5 py-0 text-[10px] font-bold gap-1 shrink-0">
                                        <Flame className="h-3 w-3" /> Long Wait ({mins}m)
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground flex-wrap min-w-0">
                                    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground shrink-0">
                                      <TypeIcon className="h-3 w-3 text-primary" />
                                      {TYPE_LABEL[o.type]}
                                    </span>
                                    {o.type === "dine-in" && o.tableNumber && (
                                      <span className="font-bold text-primary shrink-0">
                                        · Table {o.tableNumber}
                                      </span>
                                    )}
                                    {o.customerName && (
                                      <span
                                        className="truncate max-w-24 font-medium"
                                        title={o.customerName}
                                      >
                                        · {o.customerName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <Select
                                    value={o.status}
                                    onValueChange={(val: OrderStatus) =>
                                      handleStatusChangeRequest(o, val)
                                    }
                                  >
                                    <SelectTrigger
                                      className={cn(
                                        "h-6 text-[10.5px] px-2 font-semibold inline-flex items-center gap-1 border rounded-full transition-all cursor-pointer shadow-2xs focus:ring-1 focus:ring-primary/40 shrink-0 max-w-28 truncate",
                                        KITCHEN_STATUS_META[o.status].className,
                                      )}
                                    >
                                      <div className="flex items-center gap-1 min-w-0 truncate">
                                        {(() => {
                                          const StatusIconComp = KITCHEN_STATUS_META[o.status].icon;
                                          return <StatusIconComp className="h-3 w-3 shrink-0" />;
                                        })()}
                                        <SelectValue className="truncate">
                                          {KITCHEN_STATUS_META[o.status].label}
                                        </SelectValue>
                                      </div>
                                    </SelectTrigger>
                                    <SelectContent
                                      align="end"
                                      className="rounded-xl border border-border/80 p-1 shadow-lg"
                                    >
                                      {(Object.keys(KITCHEN_STATUS_META) as OrderStatus[]).map(
                                        (st) => {
                                          const itemMeta = KITCHEN_STATUS_META[st];
                                          const ItemIcon = itemMeta.icon;
                                          return (
                                            <SelectItem
                                              key={st}
                                              value={st}
                                              className="rounded-lg text-xs font-semibold cursor-pointer py-1.5 px-2.5 my-0.5"
                                            >
                                              <div className="flex items-center gap-1.5">
                                                <ItemIcon className="h-3.5 w-3.5 shrink-0" />
                                                <span>{itemMeta.label}</span>
                                              </div>
                                            </SelectItem>
                                          );
                                        },
                                      )}
                                    </SelectContent>
                                  </Select>
                                  <div className="text-muted-foreground/50 group-hover:text-muted-foreground transition-colors p-0.5 shrink-0">
                                    <GripVertical className="h-3.5 w-3.5" />
                                  </div>
                                </div>
                              </div>

                              {/* Order Items */}
                              <ul className="space-y-1.5 text-sm py-1">
                                {o.lines.map((l) => (
                                  <li key={l.itemId} className="flex items-center gap-2">
                                    <span className="grid h-5 w-5 place-items-center rounded bg-primary/10 text-xs font-bold text-primary font-mono shrink-0">
                                      {l.qty}
                                    </span>
                                    <span className="truncate font-medium text-foreground text-sm">
                                      {l.name}
                                    </span>
                                  </li>
                                ))}
                              </ul>

                              {/* Special Notes */}
                              {o.notes && (
                                <div className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-900 dark:text-amber-200">
                                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                                  <p className="leading-tight font-medium">Note: {o.notes}</p>
                                </div>
                              )}

                              {/* Ticket Footer */}
                              <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1 font-mono font-medium">
                                  {status === "completed" ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                      Served in {o.prepTimeMinutes ?? mins}m
                                    </span>
                                  ) : status === "pending" && !o.prepStartedAt ? (
                                    <>
                                      <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                                      Placed {elapsedMin(o.createdAt, now)}m ago
                                    </>
                                  ) : (
                                    <span
                                      className={cn(
                                        "inline-flex items-center gap-1 font-semibold",
                                        isOverdue
                                          ? "text-red-500 font-bold animate-pulse"
                                          : "text-muted-foreground",
                                      )}
                                    >
                                      <Timer
                                        className={cn(
                                          "h-3.5 w-3.5",
                                          isOverdue ? "text-red-500" : "text-muted-foreground",
                                        )}
                                      />
                                      {mins}m / {estMins}m prep
                                    </span>
                                  )}
                                </span>
                                <span className="font-bold text-foreground font-mono">
                                  {formatCurrency(o.total)}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preparation Time Input Dialog Modal */}
      <Dialog open={prepDialogOpen} onOpenChange={setPrepDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-background border border-border shadow-xl">
          <DialogHeader className="space-y-1.5">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <ChefHat className="h-5 w-5" />
              <DialogTitle className="font-display text-lg font-bold">
                Start Kitchen Preparation
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Set estimated preparation time for Order #{prepModalOrder?.number || ""}{" "}
              {prepModalOrder?.tableNumber ? `(Table ${prepModalOrder.tableNumber})` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div>
              <label className="text-xs font-semibold text-foreground mb-2 block">
                Quick Time Presets
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[10, 15, 20, 30, 45].map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant={prepTimeInput === String(preset) ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPrepTimeInput(String(preset))}
                    className="h-9 text-xs font-bold rounded-xl"
                  >
                    {preset}m
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">
                Custom Estimated Minutes
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min="1"
                  max="180"
                  value={prepTimeInput}
                  onChange={(e) => setPrepTimeInput(e.target.value)}
                  className="h-10 text-sm font-semibold rounded-xl pr-16"
                  placeholder="e.g. 15"
                  autoFocus
                />
                <span className="absolute right-3 top-2.5 text-xs font-medium text-muted-foreground pointer-events-none">
                  Minutes
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPrepDialogOpen(false)}
              className="rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={confirmPrepTime}
              className="rounded-xl text-xs font-bold gradient-warm text-primary-foreground gap-1.5 shadow-sm"
            >
              <span>Start Cooking ({prepTimeInput || "15"} mins)</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
