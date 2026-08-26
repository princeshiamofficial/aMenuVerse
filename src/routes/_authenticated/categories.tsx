import { createFileRoute, redirect } from "@tanstack/react-router";
import { memo, useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  getCategoriesServer,
  saveCategoriesServer,
  deleteCategoryServer,
  getTenantSubscriptionServer,
  getCurrentUser,
} from "@/lib/db-queries.server";
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import { SkeletonCategoriesPage } from "@/components/menuverse/skeletons";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AppleEmoji } from "@/components/menuverse/apple-emoji";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
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
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Search,
  Upload,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

import { cn, generateId } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/categories")({
  beforeLoad: async () => {
    const user = await getCurrentUser();
    const role = (user?.role || "").toLowerCase().trim().replace(/ /g, "_");
    if (role !== "owner" && role !== "super_admin" && role !== "superadmin") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: CategoriesPage,
});

type Category = {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
  image: string; // data URL
  visible: boolean;
  itemCount: number;
};

const STORAGE_KEY = "menuverse:categories";

const DEFAULTS: Category[] = [];

const ICON_CHOICES = [
  // Meals & Main Dishes
  "🥗",
  "🍲",
  "🍝",
  "🍕",
  "🍔",
  "🌮",
  "🌯",
  "🥙",
  "🧆",
  "🥪",
  "🌭",
  "🍟",
  "🍖",
  "🍗",
  "🥩",
  "🥓",
  "🍳",
  "🥞",
  "🧇",
  "🥟",
  "🥠",
  "🥡",
  "🍱",
  "🍘",
  "🍙",
  "🍚",
  "🍛",
  "🍜",
  "🦪",
  "🍣",
  "🍤",
  "🫕",
  "🥘",
  "🥣",
  "🥖",
  "🥨",
  "🥯",
  "🍞",
  "🧀",
  // Sweets & Desserts
  "🍰",
  "🧁",
  "🥧",
  "🍮",
  "🍨",
  "🍦",
  "🍧",
  "🍩",
  "🍪",
  "🎂",
  "🍫",
  "🍬",
  "🍭",
  "🍯",
  // Fruits & Fresh Produce
  "🍎",
  "🍊",
  "🍋",
  "🍌",
  "🍉",
  "🍇",
  "🍓",
  "🫐",
  "🍈",
  "🍒",
  "🍑",
  "🥭",
  "🍍",
  "🥥",
  "🥝",
  "🥑",
  "🍅",
  "🍆",
  "🥔",
  "🥕",
  "🌽",
  "🌶️",
  "🫑",
  "🥒",
  "🥬",
  "🥦",
  "🧄",
  "🧅",
  "🍄",
  // Beverages & Drinks
  "☕",
  "🍵",
  "🧃",
  "🥤",
  "🧋",
  "🥛",
  "🍶",
  "🍾",
  "🍷",
  "🍸",
  "🍹",
  "🍺",
  "🍻",
  "🥂",
  "🥃",
  "🧊",
  // Cutlery & Dining
  "🍽️",
  "🍴",
  "🥄",
  "🥢",
  "🔪",
];

const empty = (): Category => ({
  id: generateId(),
  name: "",
  description: "",
  icon: "🍽️",
  image: "",
  visible: true,
  itemCount: 0,
});

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

const POPULAR_EMOJIS = [
  "🥗",
  "🍲",
  "🍝",
  "🍕",
  "🍔",
  "🌮",
  "🌯",
  "🥙",
  "🥩",
  "🍗",
  "🍟",
  "☕",
  "🥤",
  "🍰",
  "🍨",
  "🍺",
];

const EmojiPickerGrid = memo(function EmojiPickerGrid({
  selectedIcon,
  onSelect,
}: {
  selectedIcon: string;
  onSelect: (emoji: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const list = showAll ? ICON_CHOICES : POPULAR_EMOJIS;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 rounded-xl border border-gray-200 bg-gray-50/50 shadow-inner select-none">
        {list.map((emoji) => {
          const isSelected = selectedIcon === emoji;
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onSelect(emoji)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg text-lg transition hover:bg-white hover:shadow-xs cursor-pointer select-none",
                isSelected && "bg-white shadow-xs ring-2 ring-amber-500 font-bold scale-105",
              )}
            >
              {emoji}
            </button>
          );
        })}
      </div>
      {!showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-xs font-semibold text-amber-600 hover:text-amber-700 hover:underline cursor-pointer pl-1"
        >
          + Show all {ICON_CHOICES.length} icons
        </button>
      )}
    </div>
  );
});

function CategoryEditDialog({
  open,
  onOpenChange,
  category,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
  subInfo?: { plan: string; limit: number | "unlimited" };
  onSave: (updated: Category) => Promise<void>;
}) {
  if (!open || !category) return null;

  return (
    <CategoryEditFormContent category={category} onOpenChange={onOpenChange} onSave={onSave} />
  );
}

function CategoryEditFormContent({
  category,
  onOpenChange,
  onSave,
}: {
  category: Category;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: Category) => Promise<void>;
}) {
  const [form, setForm] = useState<Category>(() => ({ ...category }));
  const isEdit = Boolean(category?.name && category.name.trim().length > 0);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Category name is required");
      return;
    }
    await onSave(form);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit category" : "Add category"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="c-name">Category Name</Label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-lg border border-amber-100/60 pointer-events-none select-none">
                <span>{form.icon || "🥗"}</span>
              </div>
              <Input
                id="c-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Appetizers"
                className="pl-12 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-amber-500 h-11 text-base font-medium"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Icon / Emoji</Label>
            <EmojiPickerGrid
              selectedIcon={form.icon || "🥗"}
              onSelect={(icon) => setForm({ ...form, icon })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-desc">Description</Label>
            <Input
              id="c-desc"
              value={form.description || ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Short summary of items"
              className="bg-white border-gray-200"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-gray-200 p-3 bg-gray-50/50">
            <Label htmlFor="c-vis" className="cursor-pointer font-medium text-gray-700">
              Visible on Public Menu
            </Label>
            <Switch
              id="c-vis"
              checked={form.visible}
              onCheckedChange={(v) => setForm({ ...form, visible: v })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="gradient-warm text-primary-foreground">
            Save category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [subInfo, setSubInfo] = useState<{ plan: string; limit: number | "unlimited" }>({
    plan: "Free Trial",
    limit: 5,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    async function loadFromDb() {
      try {
        const [apiCategories, subData] = await Promise.all([
          apiGet<Category[]>("/api/categories").catch(async () => {
            const res = await getCategoriesServer({ data: {} });
            return (res || []) as unknown as Category[];
          }),
          getTenantSubscriptionServer(),
        ]);
        if (apiCategories && Array.isArray(apiCategories)) {
          setItems(apiCategories);
        }
        if (subData) {
          setSubInfo({
            plan: subData.plan,
            limit: subData.limits?.maxCategories ?? 5,
          });
        }
      } catch (err) {
        console.error("[Categories] loadFromDb error:", err);
      } finally {
        setHydrated(true);
      }
    }
    loadFromDb();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(async () => {
      try {
        const q = query.trim();
        const url = q ? `/api/categories?search=${encodeURIComponent(q)}` : "/api/categories";
        const dbCategories = await apiGet<Category[]>(url).catch(async () => {
          const res = await getCategoriesServer({
            data: {
              search: q || undefined,
            },
          });
          return (res || []) as unknown as Category[];
        });
        if (dbCategories && Array.isArray(dbCategories)) {
          setItems(dbCategories);
        }
      } catch (err) {
        console.warn("[Categories] Server fetch error:", err);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [hydrated, query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
    );
  }, [items, query]);

  const visibleCount = items.filter((c) => c.visible).length;
  const isFiltered = query.trim().length > 0;

  const openCreate = () => {
    if (subInfo.limit !== "unlimited" && items.length >= subInfo.limit) {
      toast.error(
        `Package Limit Reached: Your current "${subInfo.plan}" package allows up to ${subInfo.limit} category(ies). Please upgrade your subscription package to add more categories.`,
      );
      return;
    }
    setEditing(empty());
    setDialogOpen(true);
  };
  const openEdit = (c: Category) => {
    setEditing({ ...c });
    setDialogOpen(true);
  };

  const save = async (editingCat: Category) => {
    if (!editingCat.name.trim()) {
      toast.error("Category name is required");
      return;
    }
    const isEdit = items.some((c) => c.id === editingCat.id);
    if (!isEdit && subInfo.limit !== "unlimited" && items.length >= subInfo.limit) {
      toast.error(
        `Package Limit Reached: Your current "${subInfo.plan}" package allows up to ${subInfo.limit} category(ies). Please upgrade your subscription package to add more categories.`,
      );
      return;
    }
    const updatedList = isEdit
      ? items.map((c) => (c.id === editingCat.id ? editingCat : c))
      : [...items, editingCat];

    setItems(updatedList);

    try {
      await apiPost("/api/categories", {
        id: editingCat.id,
        name: editingCat.name,
        icon: editingCat.icon,
        isActive: editingCat.visible !== false,
      });
      toast.success(isEdit ? "Category updated successfully" : "Category created successfully");
    } catch (err: unknown) {
      console.error("Database sync error:", err);
      const msg = err instanceof Error ? err.message : "Failed to save category";
      toast.error(msg);
    }
    setDialogOpen(false);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const targetId = deleteId;
    setItems((prev) => prev.filter((c) => c.id !== targetId));
    setDeleteId(null);

    try {
      await apiDelete(`/api/categories?id=${encodeURIComponent(targetId)}`);
      toast.success("Category deleted successfully");
    } catch (err: unknown) {
      console.error("Delete category sync error:", err);
      const msg = err instanceof Error ? err.message : "Failed to delete category";
      toast.error(msg);
    }
  };

  const toggleVisible = async (id: string) => {
    const updatedList = items.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c));
    setItems(updatedList);
    try {
      await saveCategoriesServer({ data: updatedList });
    } catch {
      /* ignore */
    }
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((c) => c.id === active.id);
    const newIndex = items.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const updatedList = arrayMove(items, oldIndex, newIndex);
    setItems(updatedList);
    toast.success("Category order updated successfully");
    try {
      await saveCategoriesServer({ data: updatedList });
    } catch {
      /* ignore */
    }
  };

  const onImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }
    const url = await readImage(file);
    setEditing({ ...editing, image: url });
  };

  if (!hydrated) {
    return <SkeletonCategoriesPage />;
  }

  return (
    <div
      className="-m-6 md:-m-8 p-6 md:p-8 min-h-screen space-y-6"
      style={{ backgroundColor: "#EEEFF2" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search categories…"
            className="pl-10 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 shadow-xs focus-visible:ring-amber-500 h-10"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <Button
            onClick={openCreate}
            className="gradient-warm text-primary-foreground shadow-elegant shrink-0"
          >
            <Plus className="mr-1 h-4 w-4" /> Add category
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="glass rounded-2xl border border-dashed p-12 text-center shadow-card">
          <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-3 font-display text-lg font-semibold">No categories yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Group your menu items by adding your first category.
          </p>
          <Button
            onClick={openCreate}
            className="mt-4 gradient-warm text-primary-foreground shadow-elegant"
          >
            <Plus className="mr-1 h-4 w-4" /> Add category
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={filtered.map((c) => c.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((c) => {
                  const originalIndex = items.findIndex((item) => item.id === c.id);
                  const isDisabledByLimit =
                    subInfo.limit !== "unlimited" && originalIndex >= subInfo.limit;

                  return (
                    <SortableRow
                      key={c.id}
                      category={c}
                      dragDisabled={isFiltered || isDisabledByLimit}
                      isDisabledByLimit={isDisabledByLimit}
                      onEdit={() => {
                        if (isDisabledByLimit) {
                          toast.error(
                            `This category is disabled because your current "${subInfo.plan}" package limit is ${subInfo.limit}. Please upgrade your subscription package to re-enable it.`,
                          );
                          return;
                        }
                        openEdit(c);
                      }}
                      onDelete={() => setDeleteId(c.id)}
                      onToggle={() => {
                        if (isDisabledByLimit) {
                          toast.error(
                            `This category is disabled because your current "${subInfo.plan}" package limit is ${subInfo.limit}. Please upgrade your subscription package to re-enable it.`,
                          );
                          return;
                        }
                        toggleVisible(c.id);
                      }}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
          {isFiltered && (
            <p className="px-1 text-xs text-muted-foreground">
              Drag reordering is disabled while searching.
            </p>
          )}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <CategoryEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editing}
        subInfo={subInfo}
        onSave={save}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this category?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the category. Food items associated with it will remain, but won't be
              grouped under this category anymore.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete category
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortableRow({
  category,
  dragDisabled,
  isDisabledByLimit,
  onEdit,
  onDelete,
  onToggle,
}: {
  category: Category;
  dragDisabled?: boolean;
  isDisabledByLimit?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
    disabled: dragDisabled,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border flex flex-col justify-between rounded-2xl p-4 shadow-xs transition hover:shadow-md relative overflow-hidden",
        isDragging && "shadow-xl border-primary/40 ring-2 ring-primary/20 bg-white z-50",
        isDisabledByLimit
          ? "bg-amber-500/5 border-amber-300/80 opacity-80"
          : !category.visible
            ? "bg-white border-gray-100 opacity-60"
            : "bg-white border-gray-100",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
            className={cn(
              "cursor-grab touch-none rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 active:cursor-grabbing shrink-0",
              (dragDisabled || isDisabledByLimit) && "cursor-not-allowed opacity-40",
            )}
            disabled={dragDisabled || isDisabledByLimit}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-50/80 text-2xl shadow-2xs border border-amber-100/60">
            <AppleEmoji emoji={category.icon} size={24} />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-base font-bold text-gray-900 truncate">
              {category.name}
            </h3>
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {category.itemCount} item{category.itemCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        {isDisabledByLimit ? (
          <Badge
            variant="outline"
            className="border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400 font-medium text-[10px]"
          >
            Plan Limit Exceeded (Disabled)
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className={cn(
              "border text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0",
              category.visible
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-gray-200 bg-gray-100 text-gray-500",
            )}
          >
            {category.visible ? "Visible" : "Hidden"}
          </Badge>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="text-xs font-semibold text-gray-400">
          {category.itemCount} item{category.itemCount === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggle}
            className="h-8 w-8 p-0 text-gray-400 hover:text-gray-700 cursor-pointer"
            aria-label={category.visible ? "Hide category" : "Show category"}
          >
            {category.visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onEdit}
            className="h-8 w-8 p-0 text-gray-400 hover:text-gray-700 cursor-pointer"
            aria-label="Edit category"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 cursor-pointer"
            aria-label="Delete category"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
