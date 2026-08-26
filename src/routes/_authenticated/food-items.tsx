import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  getFoodItemsServer,
  saveFoodItemsServer,
  deleteFoodItemServer,
  getCategoriesServer,
  getTenantSubscriptionServer,
  getCurrentUser,
  getRestaurantProfile,
  getSettingsServer,
} from "@/lib/db-queries.server";
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import { SkeletonFoodItemsPage } from "@/components/menuverse/skeletons";
import { BlobImg } from "@/components/ui/blob-img";
import { uploadToImgBB } from "@/lib/imgbb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  Plus,
  Search,
  Flame,
  Upload,
  Trash2,
  Pencil,
  ImageIcon,
  X,
  RotateCw,
  Leaf,
  Award,
  Star,
  ChefHat,
  Clock,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { cn, generateId, getCurrencySymbol, formatCurrency } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/food-items")({
  beforeLoad: async () => {
    const user = await getCurrentUser();
    const role = (user?.role || "").toLowerCase().trim().replace(/ /g, "_");
    if (role !== "owner" && role !== "super_admin" && role !== "superadmin") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: FoodItemsPage,
});

type FoodItem = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  category: string;
  image: string;
  gallery: string[];
  view360: string;
  price: number;
  discountPrice: number | null;
  prepTime: number;
  calories: number;
  ingredients: string[];
  allergens: string[];
  spicyLevel: number; // 0-5
  bestSeller: boolean;
  popular: boolean;
  chefChoice: boolean;
  vegetarian: boolean;
  halal: boolean;
  outOfStock: boolean;
  available: boolean;
  sortOrder: number;
};

type CategoryRef = { id: string; name: string; icon?: string };

const STORAGE_KEY = "menuverse:food-items";
const CATEGORIES_KEY = "menuverse:categories";

const FALLBACK_CATEGORIES: CategoryRef[] = [];

const COMMON_ALLERGENS = [
  "Gluten",
  "Dairy",
  "Nuts",
  "Peanuts",
  "Eggs",
  "Soy",
  "Shellfish",
  "Fish",
  "Sesame",
];

function slugify(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

const empty = (order: number): FoodItem => ({
  id: generateId(),
  name: "",
  slug: "",
  shortDescription: "",
  longDescription: "",
  category: "Burgers",
  image: "",
  gallery: [],
  view360: "",
  price: 0,
  discountPrice: null,
  prepTime: 15,
  calories: 0,
  ingredients: [],
  allergens: [],
  spicyLevel: 0,
  bestSeller: false,
  popular: false,
  chefChoice: false,
  vegetarian: false,
  halal: false,
  outOfStock: false,
  available: true,
  sortOrder: order,
});

const DEFAULTS: FoodItem[] = [];

function sanitizeFoodItem(raw: Record<string, unknown>, index: number): FoodItem {
  return {
    id: String(raw?.id || generateId()),
    name: String(raw?.name || "Untitled Item"),
    slug: String(raw?.slug || slugify(String(raw?.name || "item"))),
    shortDescription: String(raw?.shortDescription || raw?.description || ""),
    longDescription: String(raw?.longDescription || raw?.description || ""),
    category: String(raw?.category || "Burgers"),
    image: String(raw?.image || raw?.imageUrl || raw?.image_url || raw?.img || ""),
    gallery: Array.isArray(raw?.gallery) ? (raw.gallery as string[]) : [],
    view360: String(raw?.view360 || ""),
    price: Number(raw?.price) || 0,
    discountPrice: raw?.discountPrice != null ? Number(raw.discountPrice) : null,
    prepTime: Number(raw?.prepTime) || 15,
    calories: Number(raw?.calories) || 0,
    ingredients: Array.isArray(raw?.ingredients) ? (raw.ingredients as string[]) : [],
    allergens: Array.isArray(raw?.allergens) ? (raw.allergens as string[]) : [],
    spicyLevel: Number(raw?.spicyLevel) || 0,
    bestSeller: Boolean(raw?.bestSeller),
    popular: Boolean(raw?.popular),
    chefChoice: Boolean(raw?.chefChoice),
    vegetarian: Boolean(raw?.vegetarian),
    halal: Boolean(raw?.halal),
    outOfStock: Boolean(raw?.outOfStock),
    available: raw?.available !== false,
    sortOrder: Number(raw?.sortOrder) || index + 1,
  };
}

function FoodItemsPage() {
  const [items, setItems] = useState<FoodItem[]>([]);
  const [categories, setCategories] = useState<CategoryRef[]>(FALLBACK_CATEGORIES);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editing, setEditing] = useState<FoodItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeCurrency, setActiveCurrency] = useState("BDT");
  const cs = useMemo(() => getCurrencySymbol(activeCurrency), [activeCurrency]);
  const [subInfo, setSubInfo] = useState<{ plan: string; limit: number | "unlimited" }>({
    plan: "Free Trial",
    limit: 25,
  });

  useEffect(() => {
    async function loadFromDb() {
      try {
        const [dbItems, dbCategories, subData, prof, dbSettings] = await Promise.all([
          getFoodItemsServer({ data: {} }),
          getCategoriesServer({ data: {} }),
          getTenantSubscriptionServer(),
          getRestaurantProfile().catch(() => null),
          getSettingsServer().catch(() => null),
        ]);

        let resolvedCurr: string | null = null;
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
            resolvedCurr = String(target.currency);
          }
        }
        if (
          !resolvedCurr &&
          prof &&
          typeof prof === "object" &&
          (prof as Record<string, unknown>).currency
        ) {
          resolvedCurr = String((prof as Record<string, unknown>).currency);
        }

        if (resolvedCurr) {
          setActiveCurrency(resolvedCurr);
        }

        setItems(dbItems ? dbItems.map(sanitizeFoodItem) : []);

        if (dbCategories && dbCategories.length > 0) {
          const catRefs: CategoryRef[] = dbCategories.map((c) => ({
            id: c.id,
            name: c.name,
            icon: c.icon,
          }));
          setCategories(catRefs);
        } else {
          setCategories([]);
        }

        if (subData) {
          setSubInfo({
            plan: subData.plan,
            limit: subData.limits?.maxItems ?? 25,
          });
        }
      } catch {
        setItems([]);
        setCategories([]);
      }
      setHydrated(true);
    }
    loadFromDb();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(async () => {
      try {
        const q = query.trim();
        const cat = categoryFilter !== "all" ? categoryFilter : "";
        const params = new URLSearchParams();
        if (q) params.set("search", q);
        if (cat) params.set("categoryId", cat);
        const url = `/api/food-items${params.toString() ? `?${params.toString()}` : ""}`;

        const dbItems = await apiGet<FoodItem[]>(url).catch(async () => {
          const res = await getFoodItemsServer({
            data: {
              category: cat || undefined,
              search: q || undefined,
            },
          });
          return (res || []).map(sanitizeFoodItem);
        });

        if (dbItems && Array.isArray(dbItems)) {
          setItems(dbItems.map(sanitizeFoodItem));
        }
      } catch (err) {
        console.warn("[FoodItems] Server fetch error:", err);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [hydrated, categoryFilter, query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...items]
      .filter((i) => {
        if (categoryFilter === "all") return true;
        const cat = (i.category || "").toLowerCase();
        const targetCat = categoryFilter.toLowerCase();
        return cat === targetCat || cat.includes(targetCat) || targetCat.includes(cat);
      })
      .filter((i) =>
        q
          ? [i.name || "", i.category || "", i.shortDescription || ""].some((v) =>
              v.toLowerCase().includes(q),
            )
          : true,
      )
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [items, query, categoryFilter]);

  const openCreate = () => {
    if (subInfo.limit !== "unlimited" && items.length >= subInfo.limit) {
      toast.error(
        `Package Limit Reached: Your current "${subInfo.plan}" package allows up to ${subInfo.limit} menu item(s). Please upgrade your subscription package to add more items.`,
      );
      return;
    }
    setEditing(empty(items.length + 1));
    setSheetOpen(true);
  };
  const openEdit = (i: FoodItem) => {
    setEditing({ ...i });
    setSheetOpen(true);
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast.error("Food name is required");
      return;
    }
    if (editing.price < 0) {
      toast.error("Price must be zero or more");
      return;
    }
    if (editing.discountPrice !== null && editing.discountPrice > editing.price) {
      toast.error("Discount price must be less than price");
      return;
    }
    const toSave: FoodItem = { ...editing, slug: editing.slug || slugify(editing.name) };
    const isNew = !items.some((i) => i.id === toSave.id);
    if (isNew && subInfo.limit !== "unlimited" && items.length >= subInfo.limit) {
      toast.error(
        `Package Limit Reached: Your current "${subInfo.plan}" package allows up to ${subInfo.limit} menu item(s). Please upgrade your subscription package to add more items.`,
      );
      return;
    }
    const updatedList = isNew
      ? [...items, toSave]
      : items.map((i) => (i.id === toSave.id ? toSave : i));

    setItems(updatedList);
    setSheetOpen(false);

    try {
      await apiPost("/api/food-items", {
        id: toSave.id,
        name: toSave.name,
        categoryId: toSave.category,
        price: toSave.price,
        description: toSave.shortDescription || toSave.longDescription || "",
        badge: toSave.bestSeller ? "Best Seller" : toSave.chefChoice ? "Chef Choice" : toSave.popular ? "Popular" : undefined,
        isVeg: toSave.vegetarian,
        isVegan: false,
        isGlutenFree: false,
        isHalal: toSave.halal,
        spicyLevel: toSave.spicyLevel,
        calories: toSave.calories,
        prepTime: toSave.prepTime,
        status: toSave.available ? "available" : "sold_out",
        variations: [],
        addOns: [],
        branchIds: [],
      });
      toast.success(isNew ? "Food item created successfully" : "Food item updated successfully");
    } catch (err: unknown) {
      console.error("DB save error:", err);
      const msg = err instanceof Error ? err.message : "Failed to save food item";
      toast.error(msg);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const targetId = deleteId;
    setItems((prev) => prev.filter((i) => i.id !== targetId));
    setDeleteId(null);

    try {
      await apiDelete(`/api/food-items?id=${encodeURIComponent(targetId)}`);
      toast.success("Food item deleted successfully");
    } catch (err: unknown) {
      console.error("Delete food item error:", err);
      const msg = err instanceof Error ? err.message : "Failed to delete food item";
      toast.error(msg);
    }
  };

  const toggleAvailable = async (id: string, val: boolean) => {
    const updatedList = items.map((i) => (i.id === id ? { ...i, available: val } : i));
    setItems(updatedList);
    try {
      await saveFoodItemsServer({ data: updatedList });
    } catch {
      /* ignore */
    }
  };

  const togglePopular = async (id: string) => {
    const updatedList = items.map((i) => (i.id === id ? { ...i, popular: !i.popular } : i));
    setItems(updatedList);
    try {
      await saveFoodItemsServer({ data: updatedList });
    } catch {
      /* ignore */
    }
  };

  if (!hydrated) {
    return <SkeletonFoodItemsPage />;
  }

  return (
    <div
      className="-m-6 md:-m-8 p-6 md:p-8 min-h-screen space-y-6"
      style={{ backgroundColor: "#F7F8FA" }}
    >
      {/* Reference Image Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left: Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
          <button
            onClick={() => setCategoryFilter("all")}
            className={cn(
              "px-4 py-2 rounded-full font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-2xs shrink-0",
              categoryFilter === "all"
                ? "bg-[#FF6B00] text-white"
                : "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200/80",
            )}
          >
            <span>🍽️</span>
            <span>All</span>
          </button>
          {categories.map((cat) => {
            const isActive =
              categoryFilter.toLowerCase() === cat.id.toLowerCase() ||
              categoryFilter.toLowerCase() === cat.name.toLowerCase();
            return (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.name)}
                className={cn(
                  "px-4 py-2 rounded-full font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shrink-0",
                  isActive
                    ? "bg-[#FF6B00] text-white shadow-2xs"
                    : "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200/80 shadow-2xs",
                )}
              >
                {cat.icon && <span>{cat.icon}</span>}
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        {/* Right: + Add Menu Item & Search Bar */}
        <div className="flex items-center gap-3 ml-auto">
          <Button
            onClick={openCreate}
            size="sm"
            className="bg-linear-to-r from-[#D77649] via-[#CB6C3F] to-[#B85C31] hover:from-[#C9693D] hover:to-[#A74E26] text-white shadow-md shadow-amber-900/10 h-9 rounded-md px-5 text-xs font-medium tracking-wide flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 text-white" /> Add Menu Item
          </Button>

          <div className="relative w-44 sm:w-60">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search dishes.."
              className="pl-9 pr-3 bg-white border-neutral-200/80 text-gray-900 placeholder:text-gray-400 rounded-md text-xs h-9 shadow-2xs focus-visible:ring-2 focus-visible:ring-neutral-400/20"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Grid of Food Cards identical to reference image */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center shadow-2xs">
          <ImageIcon className="mx-auto h-8 w-8 text-gray-400" />
          <h3 className="mt-3 text-base font-bold text-gray-900">No food items found</h3>
          <p className="mt-1 text-xs text-gray-500">
            Add a new dish or clear search filters to display menu items.
          </p>
          <Button
            onClick={openCreate}
            className="mt-4 bg-[#00B074] hover:bg-[#009E68] text-white px-4 py-2 rounded-xl text-xs font-bold"
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add Menu Item
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((it) => {
            const originalIdx = items.findIndex((i) => i.id === it.id);
            const isDisabledByLimit = subInfo.limit !== "unlimited" && originalIdx >= subInfo.limit;

            return (
              <FoodCardItem
                key={it.id}
                item={it}
                isDisabledByLimit={isDisabledByLimit}
                currencyCode={activeCurrency}
                onEdit={() => {
                  if (isDisabledByLimit) {
                    toast.error(
                      `This food item is disabled because your current "${subInfo.plan}" package limit is ${subInfo.limit}. Please upgrade your subscription package to re-enable it.`,
                    );
                    return;
                  }
                  openEdit(it);
                }}
                onDelete={() => setDeleteId(it.id)}
                onToggleAvailable={(val) => {
                  if (isDisabledByLimit) {
                    toast.error(
                      `This food item is disabled because your current "${subInfo.plan}" package limit is ${subInfo.limit}. Please upgrade your subscription package to re-enable it.`,
                    );
                    return;
                  }
                  toggleAvailable(it.id, val);
                }}
                onTogglePopular={() => {
                  if (isDisabledByLimit) {
                    toast.error(
                      `This food item is disabled because your current "${subInfo.plan}" package limit is ${subInfo.limit}. Please upgrade your subscription package to re-enable it.`,
                    );
                    return;
                  }
                  togglePopular(it.id);
                }}
              />
            );
          })}
        </div>
      )}

      <EditDialog
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editing={editing}
        setEditing={setEditing}
        categories={categories}
        currencySymbol={cs}
        isNew={editing ? !items.some((i) => i.id === editing.id) : true}
        onSave={save}
        onDelete={() => {
          if (editing) {
            setDeleteId(editing.id);
            setSheetOpen(false);
          }
        }}
      />

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FoodCardItem({
  item,
  isDisabledByLimit,
  currencyCode,
  onEdit,
  onDelete,
  onToggleAvailable,
  onTogglePopular,
}: {
  item: FoodItem;
  isDisabledByLimit?: boolean;
  currencyCode?: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggleAvailable: (val: boolean) => void;
  onTogglePopular: () => void;
}) {
  return (
    <div
      className={cn(
        "border rounded-2xl p-3.5 sm:p-4 transition-all flex flex-col justify-between relative overflow-hidden",
        isDisabledByLimit
          ? "bg-amber-500/5 border-amber-300/80 opacity-80"
          : !item.available
            ? "bg-white border-gray-200/80 opacity-75"
            : "bg-white border-gray-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]",
      )}
    >
      {isDisabledByLimit && (
        <Badge
          variant="outline"
          className="border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400 font-medium text-[10px] self-start mb-2"
        >
          Plan Limit Exceeded (Disabled)
        </Badge>
      )}
      <div className="flex items-start gap-3">
        {/* Left Image Thumbnail */}
        <div className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-xl overflow-hidden shrink-0 bg-gray-100 border border-gray-100">
          {item.image ? (
            <BlobImg src={item.image} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">
              No image
            </div>
          )}
        </div>

        {/* Right Content Column */}
        <div className="flex-1 min-w-0 flex flex-col justify-between min-h-20 sm:min-h-22">
          {/* Header Row: Title & Price & Action Icons */}
          <div>
            <div className="flex items-start justify-between gap-1">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 truncate leading-snug">
                {item.name}
              </h3>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs sm:text-sm font-bold text-[#FF6B00] mr-1">
                  {formatCurrency(item.price, currencyCode)}
                </span>
                <button
                  onClick={onEdit}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded transition cursor-pointer"
                  title="Edit item"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onDelete}
                  className="p-1 text-gray-400 hover:text-red-500 rounded transition cursor-pointer"
                  title="Delete item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Description */}
            <p className="text-[10.5px] sm:text-xs text-gray-400 leading-normal line-clamp-2 mt-1">
              {item.shortDescription}
            </p>
          </div>

          {/* Bottom Switch & Popular Badge Row */}
          <div className="flex items-center justify-between mt-2 pt-1">
            <div className="flex items-center gap-1.5">
              <Switch
                checked={item.available}
                onCheckedChange={onToggleAvailable}
                className="data-[state=checked]:bg-[#00B074] scale-90"
              />
              <span className="text-[11px] sm:text-xs font-semibold text-gray-600">Available</span>
            </div>

            <button
              onClick={onTogglePopular}
              className={cn(
                "px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10.5px] sm:text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer border",
                item.popular
                  ? "bg-[#FFF8E6] text-[#E69500] border-[#FFE8A3]"
                  : "bg-white text-gray-400 border-gray-200 hover:border-gray-300",
              )}
            >
              <Star
                className={cn(
                  "w-3 h-3",
                  item.popular ? "fill-[#E69500] text-[#E69500]" : "text-gray-400",
                )}
              />
              <span>Popular</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditDialog({
  open,
  onOpenChange,
  editing,
  setEditing,
  categories,
  currencySymbol = "$",
  isNew,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: FoodItem | null;
  setEditing: React.Dispatch<React.SetStateAction<FoodItem | null>>;
  categories: CategoryRef[];
  currencySymbol?: string;
  isNew: boolean;
  onSave: () => void;
  onDelete: () => void;
}) {
  if (!editing) return null;

  const [isUploading, setIsUploading] = useState(false);

  const handleMainFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    toast.info("Uploading food image...");
    try {
      const cdnUrl = await uploadToImgBB(file);
      setEditing((prev) => (prev ? { ...prev, image: cdnUrl } : null));
      toast.success("Food image uploaded successfully!");
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-y-auto p-6 sm:p-7 rounded-3xl bg-[#FAF7F2] border border-stone-200/80 shadow-2xl">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b-0">
          <DialogTitle className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
            {isNew ? "Create Food Item" : "Edit Food Item"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Item Name */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-stone-800">Item Name *</Label>
            <Input
              value={editing.name}
              onChange={(e) =>
                setEditing((prev) =>
                  prev
                    ? {
                        ...prev,
                        name: e.target.value,
                        slug: prev.slug ? prev.slug : slugify(e.target.value),
                      }
                    : null,
                )
              }
              placeholder="e.g. Margherita Pizza"
              className="h-11 bg-[#FFFBF5] border border-stone-200/90 rounded-2xl text-sm px-4 focus-visible:ring-amber-500"
            />
          </div>

          {/* Category & Price */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-stone-800">Category *</Label>
              <Select
                value={editing.category || categories[0]?.name || "Burgers"}
                onValueChange={(val) =>
                  setEditing((prev) => (prev ? { ...prev, category: val } : null))
                }
              >
                <SelectTrigger className="h-11 bg-[#FFFBF5] border border-stone-200/90 rounded-2xl text-sm px-4 focus:ring-amber-500">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="rounded-xl bg-white shadow-lg">
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.icon ? `${c.icon} ${c.name}` : c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-stone-800">
                Price ({currencySymbol}) *
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={editing.price}
                onChange={(e) =>
                  setEditing((prev) =>
                    prev ? { ...prev, price: Number(e.target.value) || 0 } : null,
                  )
                }
                placeholder="0.00"
                className="h-11 bg-[#FFFBF5] border border-stone-200/90 rounded-2xl text-sm px-4 focus-visible:ring-amber-500"
              />
            </div>
          </div>

          {/* Short Description */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-stone-800">Short Description</Label>
            <Input
              value={editing.shortDescription}
              onChange={(e) =>
                setEditing((prev) => (prev ? { ...prev, shortDescription: e.target.value } : null))
              }
              placeholder="San Marzano, buffalo mozzarella, basil."
              className="h-11 bg-[#FFFBF5] border border-stone-200/90 rounded-2xl text-sm px-4 focus-visible:ring-amber-500"
            />
          </div>

          {/* Main Cover Image */}
          <div className="space-y-1.5 pt-1">
            <Label className="text-sm font-semibold text-stone-800">Main Cover Image</Label>
            <div className="flex items-start gap-4 pt-1">
              <div className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-2xl overflow-hidden bg-stone-100 border border-stone-200/80 shrink-0 shadow-2xs">
                {editing.image ? (
                  <BlobImg src={editing.image} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-400">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}
              </div>

              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Label
                    htmlFor="dialog-main-file"
                    className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-1.5 bg-white border border-stone-200 hover:bg-stone-50 rounded-full font-semibold text-xs text-stone-700 shadow-2xs transition-all"
                  >
                    <Upload className="w-3.5 h-3.5 text-stone-500" />
                    {isUploading ? "Uploading..." : "Upload File"}
                  </Label>
                  <input
                    id="dialog-main-file"
                    type="file"
                    accept="image/*"
                    disabled={isUploading}
                    onChange={handleMainFile}
                    className="hidden"
                  />
                  {editing.image && (
                    <button
                      type="button"
                      onClick={() => setEditing((prev) => (prev ? { ...prev, image: "" } : null))}
                      className="px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-full transition-all"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <Input
                  value={editing.image || ""}
                  onChange={(e) =>
                    setEditing((prev) => (prev ? { ...prev, image: e.target.value } : null))
                  }
                  placeholder="Or paste direct image URL (https://...)"
                  className="h-9 bg-[#FFFBF5] border border-stone-200/90 rounded-xl text-xs px-3 focus-visible:ring-amber-500"
                />
                <p className="text-[11px] text-stone-400">Upload JPG, PNG, WebP or paste an online image link.</p>
              </div>
            </div>
          </div>

          {/* Switches Row */}
          <div className="flex items-center justify-between p-4 bg-white/80 rounded-2xl border border-stone-200/70 shadow-2xs mt-2">
            <div className="flex items-center gap-3">
              <span className="text-xs sm:text-sm font-medium text-stone-800">
                Available in Menu
              </span>
              <Switch
                checked={editing.available}
                onCheckedChange={(val) => setEditing({ ...editing, available: val })}
                className="data-[state=checked]:bg-[#C86235]"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs sm:text-sm font-medium text-stone-800">Mark as Popular</span>
              <Switch
                checked={editing.popular}
                onCheckedChange={(val) => setEditing({ ...editing, popular: val })}
                className="data-[state=checked]:bg-[#C86235]"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t-0 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onSave}
            className="px-7 py-2.5 rounded-2xl bg-[#00B074] hover:bg-[#009E68] text-white font-bold text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
          >
            Save Item
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
