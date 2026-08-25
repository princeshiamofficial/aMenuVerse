import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BlobImg } from "@/components/ui/blob-img";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Minus,
  Search,
  Trash2,
  Utensils,
  Store,
  Bike,
  Receipt,
  Pencil,
  Building2,
} from "lucide-react";
import { toast } from "sonner";

import { cn, generateId, getCurrencySymbol } from "@/lib/utils";
import { AppleEmoji } from "@/components/menuverse/apple-emoji";
import {
  getCurrentUser,
  getBranchesServer,
  getBranchTablesServer,
  getCategoriesServer,
  getFoodItemsServer,
  saveOrderServer,
  getOrdersServer,
  getSettingsServer,
  getRestaurantProfile,
} from "@/lib/db-queries.server";
import { Skeleton } from "@/components/ui/skeleton";
import { useRealtime, playChime } from "@/lib/use-realtime";

export const Route = createFileRoute("/_authenticated/pos")({
  validateSearch: (search: Record<string, unknown>) => ({
    edit: search.edit ? String(search.edit) : undefined,
  }),
  component: POSPage,
});

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
  discountType?: "amount" | "percent";
  discountValue?: number;
  discountAmount?: number;
  tax: number;
  total: number;
};

const FALLBACK_CATEGORIES: Category[] = [];
const FALLBACK_ITEMS: FoodItem[] = [];

const TYPE_META: Record<OrderType, { label: string; icon: typeof Utensils }> = {
  "dine-in": { label: "Dine In", icon: Utensils },
  takeaway: { label: "Takeaway", icon: Store },
  delivery: { label: "Delivery", icon: Bike },
};

function sanitizeCategory(raw: Record<string, unknown>, index: number): Category {
  return {
    id: String(raw?.id || raw?.name || `cat-${index}`),
    name: String(raw?.name || "Category"),
    icon: String(raw?.icon || "🍽️"),
    visible: raw?.visible !== false,
  };
}

function sanitizePOSFoodItem(item: Record<string, unknown>, idx: number): FoodItem {
  return {
    id: String(item?.id || `item-${idx}`),
    name: String(item?.name || "Food Item"),
    price: Number(item?.price) || 0,
    discountPrice: item?.discountPrice != null ? Number(item.discountPrice) : null,
    category: String(item?.category || "Burgers"),
    image: String(item?.image || ""),
    available: item?.available !== false,
    outOfStock: Boolean(item?.outOfStock),
    hidden: Boolean(item?.hidden),
  };
}

function POSItemCardSkeleton() {
  return (
    <div className="flex flex-col justify-between overflow-hidden rounded-xl border border-border/60 bg-card p-0 shadow-2xs">
      <div className="aspect-4/3 w-full bg-muted/60">
        <Skeleton className="h-full w-full rounded-none" />
      </div>
      <div className="p-2.5 space-y-1.5">
        <Skeleton className="h-3.5 w-3/4 rounded" />
        <Skeleton className="h-3.5 w-1/3 rounded" />
      </div>
    </div>
  );
}

function POSPage() {
  const searchParams = Route.useSearch();
  const editOrderId = searchParams.edit;
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const [items, setItems] = useState<FoodItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [counter, setCounter] = useState(1);
  const [hydrated, setHydrated] = useState(false);

  const [activeCat, setActiveCat] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<OrderLine[]>([]);
  const [type, setType] = useState<OrderType>("dine-in");
  const [branchesList, setBranchesList] = useState<{ id: string; name: string }[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<{
    role?: string | null;
    branch?: string | null;
    full_name?: string | null;
  } | null>(null);
  const [tableNumber, setTableNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");

  useEffect(() => {
    if (!editOrderId) return;
    async function loadOrderToEdit() {
      try {
        const dbOrders = await getOrdersServer({ data: {} });
        if (dbOrders && Array.isArray(dbOrders)) {
          const found = (dbOrders as unknown as Order[]).find(
            (o) => o.id === editOrderId || String(o.number) === editOrderId,
          );
          if (found) {
            setEditingOrder(found);
            setCart(found.lines || []);
            setType(found.type || "dine-in");
            if (found.tableNumber) setTableNumber(found.tableNumber);
            if (found.customerName) setCustomerName(found.customerName);
            if (found.phone) setPhone(found.phone);
            if (found.discountValue != null) setDiscountValue(found.discountValue);
            if (found.discountType) setDiscountType(found.discountType);
            toast.info(`Loaded Order #${found.number} for editing`);
          }
        }
      } catch {
        /* ignore */
      }
    }
    loadOrderToEdit();
  }, [editOrderId]);

  useEffect(() => {
    async function loadBranches() {
      try {
        const u = await getCurrentUser();
        const dbBranches = await getBranchesServer();
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
            }
          }
          setSelectedBranchId(targetBranch.id);
        }
      } catch {
        /* ignore */
      }
    }
    loadBranches();
  }, []);

  const [branchTables, setBranchTables] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    async function loadTables() {
      try {
        const dbTables = await getBranchTablesServer({ data: selectedBranchId || "all" });
        if (dbTables && Array.isArray(dbTables) && dbTables.length > 0) {
          const seen = new Set<string>();
          const uniqueTables: { value: string; label: string }[] = [];
          for (const t of dbTables) {
            const val = String(t.tableNo || "").trim();
            const numKey = parseInt(val, 10);
            const key = !isNaN(numKey) ? `num-${numKey}` : val.toLowerCase();
            if (val && !seen.has(key)) {
              seen.add(key);
              uniqueTables.push({
                value: val,
                label: `Table ${val}${t.zone ? ` — ${t.zone}` : ""}`,
              });
            }
          }
          setBranchTables(uniqueTables);
          return;
        }
      } catch {
        /* ignore */
      }
      setBranchTables([]);
    }
    loadTables();
  }, [selectedBranchId]);

  const [currency, setCurrency] = useState<string>("BDT");
  const cs = getCurrencySymbol(currency);

  const [taxRate, setTaxRate] = useState<number>(8.5);
  const [taxInclusive, setTaxInclusive] = useState<boolean>(false);
  const [serviceCharge, setServiceCharge] = useState<number>(10);
  const [serviceEnabled, setServiceEnabled] = useState<boolean>(true);
  const [deliveryFee, setDeliveryFee] = useState<number>(3.99);
  const [freeDeliveryOver, setFreeDeliveryOver] = useState<number>(40);

  useEffect(() => {
    async function loadData() {
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
            setCurrency(String(target.currency));
          } else {
            const prof = await getRestaurantProfile().catch(() => null);
            if (prof && typeof prof === "object" && (prof as Record<string, unknown>).currency) {
              setCurrency(String((prof as Record<string, unknown>).currency));
            }
          }
          if (target.taxRate != null) setTaxRate(Number(target.taxRate));
          if (target.taxInclusive != null) setTaxInclusive(Boolean(target.taxInclusive));
          if (target.serviceCharge != null) setServiceCharge(Number(target.serviceCharge));
          if (target.serviceEnabled != null) setServiceEnabled(Boolean(target.serviceEnabled));
          if (target.deliveryFee != null) setDeliveryFee(Number(target.deliveryFee));
          if (target.freeDeliveryOver != null) setFreeDeliveryOver(Number(target.freeDeliveryOver));
        }
      } catch {
        /* ignore */
      }

      try {
        const dbItems = await getFoodItemsServer();
        if (dbItems && Array.isArray(dbItems) && dbItems.length > 0) {
          setItems(
            dbItems.map((it, idx) => sanitizePOSFoodItem(it as Record<string, unknown>, idx)),
          );
        }
      } catch {
        /* ignore */
      }

      try {
        const dbCats = await getCategoriesServer();
        if (dbCats && Array.isArray(dbCats) && dbCats.length > 0) {
          setCategories(
            dbCats.map((c, idx) => sanitizeCategory(c as Record<string, unknown>, idx)),
          );
        }
      } catch {
        /* ignore */
      }

      try {
        const existingOrders = await getOrdersServer({ data: {} });
        if (existingOrders && Array.isArray(existingOrders) && existingOrders.length > 0) {
          const maxNum = Math.max(...existingOrders.map((o) => o.number || 0));
          setCounter(maxNum + 1);
        }
      } catch {
        /* ignore */
      }

      setHydrated(true);
    }

    loadData();

    const handleUpdate = () => loadData();
    if (typeof window !== "undefined") {
      window.addEventListener("menuverse:settings-updated", handleUpdate);
      window.addEventListener("storage", handleUpdate);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("menuverse:settings-updated", handleUpdate);
        window.removeEventListener("storage", handleUpdate);
      }
    };
  }, []);

  useRealtime({
    branchId: selectedBranchId !== "all" ? selectedBranchId : undefined,
    eventTypes: ["order:created", "order:updated"],
    onEvent: (event) => {
      if (event.type === "order:created") {
        const payload = event.payload as { number?: number; customerName?: string; total?: number };
        playChime("order");
        toast.info(`POS: Live Order #${payload?.number || ""} placed!`, {
          description: `${payload?.customerName || "Customer"}`,
        });
      }
    },
  });

  const orderableItems = useMemo(
    () => items.filter((i) => !i.hidden && !i.outOfStock && i.available !== false),
    [items],
  );
  const visibleCategories = useMemo(
    () => categories.filter((c) => Boolean(c) && Boolean(c.name) && c.visible !== false),
    [categories],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orderableItems.filter((it) => {
      if (activeCat !== "all") {
        const cat = (it.category || "").trim().toLowerCase();
        const sel = activeCat.trim().toLowerCase();
        const normCat = cat.replace(/s$/, "");
        const normSel = sel.replace(/s$/, "");
        const matches =
          cat === sel ||
          normCat === normSel ||
          cat.includes(sel) ||
          sel.includes(cat) ||
          normCat.includes(normSel) ||
          normSel.includes(normCat);
        if (!matches) return false;
      }
      if (q && !(it.name || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [orderableItems, activeCat, search]);

  const addToCart = (it: FoodItem) => {
    const price = it.discountPrice ?? it.price;
    setCart((prev) => {
      const existing = prev.find((l) => l.itemId === it.id);
      if (existing) return prev.map((l) => (l.itemId === it.id ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { itemId: it.id, name: it.name, price, qty: 1 }];
    });
  };
  const changeQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.itemId === id ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    );
  };
  const removeLine = (id: string) => setCart((prev) => prev.filter((l) => l.itemId !== id));

  const subtotal = cart.reduce((s, l) => s + l.qty * l.price, 0);
  const rawDiscount = Math.max(0, discountValue || 0);
  const discountAmount =
    discountType === "percent"
      ? (subtotal * Math.min(100, rawDiscount)) / 100
      : Math.min(subtotal, rawDiscount);
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const tax = taxInclusive ? 0 : (discountedSubtotal * taxRate) / 100;
  const serviceFee =
    type === "dine-in" && serviceEnabled ? (discountedSubtotal * serviceCharge) / 100 : 0;
  const deliveryFeeAmt =
    type === "delivery" ? (discountedSubtotal >= freeDeliveryOver ? 0 : deliveryFee) : 0;
  const total = discountedSubtotal + tax + serviceFee + deliveryFeeAmt;

  const clear = () => {
    setEditingOrder(null);
    setCart([]);
    setTableNumber("");
    setCustomerName("");
    setPhone("");
    setDiscountValue(0);
    setDiscountType("amount");
  };

  const checkout = async () => {
    if (!hydrated) return;
    if (cart.length === 0) return toast.error("Cart is empty");
    if (!customerName.trim()) return toast.error("Customer name required");
    if (!phone.trim()) return toast.error("Phone required");
    if (type === "dine-in" && !tableNumber.trim())
      return toast.error("Table number required for dine-in");

    const now = new Date().toISOString();
    const order: Order = {
      id: editingOrder ? editingOrder.id : generateId(),
      number: editingOrder ? editingOrder.number : counter,
      branchId:
        editingOrder?.branchId ||
        selectedBranchId ||
        branchesList.find((b) => b.id === selectedBranchId)?.name ||
        branchesList[0]?.id ||
        "Main Branch",
      createdAt: editingOrder ? editingOrder.createdAt : now,
      updatedAt: now,
      type,
      status: editingOrder ? editingOrder.status : "pending",
      tableNumber: type === "dine-in" ? tableNumber.trim() : undefined,
      customerName: customerName.trim(),
      phone: phone.trim(),
      lines: cart,
      subtotal,
      discountType,
      discountValue: rawDiscount,
      discountAmount,
      tax,
      total,
    };

    try {
      await saveOrderServer({ data: order });
      if (editingOrder) {
        toast.success(`Order #${order.number} updated successfully!`);
      } else {
        setCounter((c) => c + 1);
        toast.success(`Order #${order.number} sent to kitchen`);
      }
      clear();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save order";
      toast.error(msg);
    }
  };

  return (
    <div
      className="-m-6 md:-m-8 p-4 md:p-6 h-[calc(100vh-4rem)] overflow-hidden flex flex-col"
      style={{ backgroundColor: "#EEEFF2" }}
    >
      <div className="grid flex-1 min-h-0 gap-4 lg:grid-cols-[1fr_380px] overflow-hidden">
        {/* Menu */}
        <div className="glass rounded-2xl border border-border/60 p-4 shadow-card flex flex-col h-full overflow-hidden">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-50">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {isOwner && branchesList.length > 1 ? (
              <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                <SelectTrigger className="h-9 w-48 text-xs font-semibold bg-background border-border shadow-xs">
                  <SelectValue placeholder="Select Branch" />
                </SelectTrigger>
                <SelectContent align="end">
                  {branchesList.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : !isOwner ? (
              <div className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground shadow-2xs">
                <Building2 className="h-3.5 w-3.5 text-amber-600" />
                <span>
                  {branchesList.find((b) => b.id === selectedBranchId)?.name ||
                    currentUser?.branch ||
                    "Main Branch"}
                </span>
              </div>
            ) : null}
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {!hydrated ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className="h-7 w-20 rounded-full" />
              ))
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setActiveCat("all")}
                  className={cn(
                    "inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer active:scale-95",
                    activeCat === "all"
                      ? "gradient-warm text-primary-foreground border-transparent shadow-sm"
                      : "bg-background text-muted-foreground border-border/70 hover:bg-muted hover:text-foreground",
                  )}
                >
                  All
                </button>
                {visibleCategories.map((c) => {
                  const isActive =
                    activeCat === c.id ||
                    activeCat === c.name ||
                    activeCat.toLowerCase() === c.name.toLowerCase() ||
                    activeCat.toLowerCase() === c.id.toLowerCase();
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setActiveCat(c.name || c.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer active:scale-95",
                        isActive
                          ? "gradient-warm text-primary-foreground border-transparent shadow-sm"
                          : "bg-background text-muted-foreground border-border/70 hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <AppleEmoji emoji={c.icon} size={18} />
                      <span>{c.name}</span>
                    </button>
                  );
                })}
              </>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {!hydrated ? (
              <div className="grid grid-cols-2 min-[480px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
                {Array.from({ length: 12 }).map((_, idx) => (
                  <POSItemCardSkeleton key={idx} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
                <Utensils className="mx-auto h-8 w-8 text-muted-foreground/60" />
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                  No menu items found.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 min-[480px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
                {filtered.map((it) => {
                  const price = it.discountPrice ?? it.price;
                  const qty = cart.find((l) => l.itemId === it.id)?.qty ?? 0;

                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => addToCart(it)}
                      className={cn(
                        "group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card p-0 text-left shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-xs active:scale-[0.98] cursor-pointer",
                        qty > 0
                          ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
                          : "border-border/60",
                      )}
                    >
                      <div>
                        {/* Flush Image Container */}
                        <div className="relative aspect-4/3 w-full overflow-hidden bg-muted/60">
                          <BlobImg
                            src={
                              it.image ||
                              "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80"
                            }
                            alt={it.name}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          {qty > 0 && (
                            <Badge className="absolute top-1.5 right-1.5 z-10 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-xs">
                              {qty}
                            </Badge>
                          )}
                        </div>

                        <div className="p-2.5">
                          <h4 className="line-clamp-1 font-display text-xs font-semibold text-foreground group-hover:text-primary transition-colors leading-tight">
                            {it.name}
                          </h4>
                          <div className="mt-1 flex items-baseline gap-1">
                            <span className="font-display text-xs font-bold text-primary">
                              {cs}
                              {price.toFixed(2)}
                            </span>
                            {it.discountPrice && (
                              <span className="text-[10px] text-muted-foreground line-through">
                                {cs}
                                {it.price.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Cart */}
        <aside className="glass flex flex-col rounded-2xl border border-border/60 p-4 shadow-card h-full overflow-hidden">
          {editingOrder && (
            <div className="mb-3 flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-900 dark:text-amber-200">
              <span className="font-semibold flex items-center gap-1.5">
                <Pencil className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                Editing Order #{editingOrder.number}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px] hover:bg-amber-500/20"
                onClick={clear}
              >
                Cancel Edit
              </Button>
            </div>
          )}
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-black shrink-0">
              {editingOrder ? `Edit Order #${editingOrder.number}` : "Current order"}
            </h2>
            <div className="flex items-center gap-2">
              {type === "dine-in" && (
                <Select value={tableNumber} onValueChange={setTableNumber}>
                  <SelectTrigger className="h-7 min-w-22.5 px-1.5 text-xs font-semibold bg-background border-primary/50 shadow-xs hover:border-primary transition-colors">
                    <SelectValue placeholder="Select Table" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {branchTables.length === 0 ? (
                      <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                        No tables found. Add tables from Branches → Branch QR.
                      </div>
                    ) : (
                      branchTables.map((t, idx) => (
                        <SelectItem key={`tbl-${t.value}-${idx}`} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl border border-border/60 bg-muted/40 p-1">
            {(Object.keys(TYPE_META) as OrderType[]).map((t) => {
              const Icon = TYPE_META[t].icon;
              return (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    "flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition",
                    type === t
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {TYPE_META[t].label}
                </button>
              );
            })}
          </div>

          <div className="mb-3 flex-1 min-h-0 w-full overflow-y-auto rounded-xl border border-border/60 bg-card/30 p-1 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {cart.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                Cart is empty
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {cart.map((l) => (
                  <div
                    key={l.itemId}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-card/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {cs}
                        {l.price.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 cursor-pointer"
                        onClick={() => changeQty(l.itemId, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-semibold">{l.qty}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 cursor-pointer"
                        onClick={() => changeQty(l.itemId, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 cursor-pointer"
                        onClick={() => removeLine(l.itemId)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-border/60 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Customer</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Name"
                />
              </div>
              <div>
                <Label className="text-xs">Phone</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone"
                />
              </div>
            </div>

            {/* Discount Control */}
            <div className="flex items-center justify-between gap-2 py-0.5">
              <Label className="text-xs font-semibold text-muted-foreground shrink-0">
                Discount
              </Label>
              <div className="flex items-center gap-1.5 ml-auto">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={discountValue === 0 ? "" : discountValue}
                  onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0"
                  className="h-8 w-20 text-right text-xs font-semibold"
                />
                <div className="flex h-8 items-center rounded-lg border border-border/70 bg-muted/60 p-0.5 text-xs font-bold shrink-0">
                  <button
                    type="button"
                    onClick={() => setDiscountType("amount")}
                    className={cn(
                      "h-7 px-2.5 rounded-md transition-colors cursor-pointer",
                      discountType === "amount"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {cs}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType("percent")}
                    className={cn(
                      "h-7 px-2.5 rounded-md transition-colors cursor-pointer",
                      discountType === "percent"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    %
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-1 rounded-xl border border-border/60 bg-muted/40 p-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>
                  {cs}
                  {subtotal.toFixed(2)}
                </span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                  <span>Discount ({discountType === "percent" ? `${rawDiscount}%` : "Fixed"})</span>
                  <span>
                    -{cs}
                    {discountAmount.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>
                  Tax ({taxRate}%{taxInclusive ? " — Included" : ""})
                </span>
                <span>
                  {cs}
                  {tax.toFixed(2)}
                </span>
              </div>
              {type === "dine-in" && serviceEnabled && serviceFee > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Service charge ({serviceCharge}%)</span>
                  <span>
                    {cs}
                    {serviceFee.toFixed(2)}
                  </span>
                </div>
              )}
              {type === "delivery" && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery fee</span>
                  <span>{deliveryFeeAmt > 0 ? `${cs}${deliveryFeeAmt.toFixed(2)}` : "FREE"}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border/60 pt-1 font-display text-lg font-black">
                <span>Total</span>
                <span className="text-primary">
                  {cs}
                  {total.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={clear}>
                Clear
              </Button>
              <Button
                className="flex-2 gradient-warm text-primary-foreground shadow-elegant"
                onClick={checkout}
              >
                <Receipt className="mr-1 h-4 w-4" /> Charge
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
