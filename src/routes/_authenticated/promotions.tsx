import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { cn, generateId } from "@/lib/utils";
import { ModernDatePicker } from "@/components/menuverse/modern-calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
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
  DollarSign,
  Plus,
  CalendarClock,
  Sparkles,
  Trash2,
  Star,
  Upload,
  ImageIcon,
  Loader2,
  Megaphone,
  Building2,
  MapPin,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { uploadToImgBB } from "@/lib/imgbb";
import { BlobImg } from "@/components/ui/blob-img";

import {
  getPromotionsServer,
  savePromotionsServer,
  getFoodItemsServer,
  getCategoriesServer,
  getCurrentUser,
  getBranchesServer,
} from "@/lib/db-queries.server";

export const Route = createFileRoute("/_authenticated/promotions")({ component: PromotionsPage });

// ================================================================
// Types & storage
// ================================================================

type Category = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  image?: string;
  visible?: boolean;
  itemCount?: number;
};

type FoodItem = {
  id: string;
  name: string;
  slug?: string;
  shortDescription?: string;
  longDescription?: string;
  category: string;
  image?: string;
  gallery?: string[];
  price: number;
  discountPrice?: number | null;
  prepTime?: number;
  calories?: number;
  ingredients?: string[];
  allergens?: string[];
  spicyLevel?: number;
  bestSeller?: boolean;
  popular?: boolean;
  chefChoice?: boolean;
  vegetarian?: boolean;
  halal?: boolean;
  outOfStock?: boolean;
  available?: boolean;
  hidden?: boolean;
  sortOrder?: number;
};

type PromotionKind = "seasonal" | "happy-hour" | "limited-time";

type TargetScope = "all" | "items" | "categories";

type Promotion = {
  id: string;
  kind: PromotionKind;
  name: string;
  discountPercent: number;
  startDate: string;
  endDate: string;
  startTime?: string; // HH:MM (happy hour)
  endTime?: string;
  targetScope?: TargetScope;
  categoryNames?: string[];
  itemIds: string[];
  active: boolean;
  image?: string;
  description?: string;
  showPopup?: boolean;
  branchName?: string;
  branchId?: string;
  createdByRole?: string;
  createdByUserId?: string;
};

const FALLBACK_CATEGORIES: Category[] = [];

const FALLBACK_ITEMS: FoodItem[] = [];

// ================================================================
// Component
// ================================================================

function PromotionsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    role: string | null;
    branch?: string | null;
    full_name?: string | null;
  } | null>(null);
  const [branchesList, setBranchesList] = useState<
    Array<{ id: string; name: string; manager?: string; isDefault?: boolean }>
  >([]);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>("all");
  const [hydrated, setHydrated] = useState(false);

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
              }
            }
          }
        }
      } catch {
        /* ignore */
      }

      try {
        const dbItems = await getFoodItemsServer();
        if (dbItems && Array.isArray(dbItems) && dbItems.length > 0) {
          const mergedItems = (dbItems as unknown as FoodItem[]).map((it) => {
            if (!it.image) {
              const fb = FALLBACK_ITEMS.find((f) => f.id === it.id || f.name === it.name);
              if (fb?.image) return { ...it, image: fb.image };
            }
            return it;
          });
          setItems(mergedItems);
        }
      } catch {
        /* ignore */
      }

      try {
        const dbCats = await getCategoriesServer();
        if (dbCats && Array.isArray(dbCats) && dbCats.length > 0) {
          setCategories(dbCats as unknown as Category[]);
        }
      } catch {
        /* ignore */
      }

      try {
        const dbPromos = await getPromotionsServer();
        if (dbPromos && Array.isArray(dbPromos)) {
          setPromotions(dbPromos as unknown as Promotion[]);
        }
      } catch {
        /* ignore */
      }

      setHydrated(true);
    }
    loadData();
  }, []);

  const userRole = (currentUser?.role || "owner").toLowerCase().trim().replace(/ /g, "_");
  const isManager = userRole === "manager";

  const managerBranchName = useMemo(() => {
    if (!isManager) return null;
    if (currentUser?.branch) {
      const bClean = currentUser.branch.replace(/\s*\((Manager|Owner)\)/gi, "").trim();
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
  }, [isManager, currentUser, branchesList]);

  const visiblePromotions = useMemo(() => {
    let list = promotions;

    if (isManager && managerBranchName) {
      const mbLower = managerBranchName.toLowerCase().trim();
      list = list.filter((p) => {
        const bName = (p.branchName || "").toLowerCase().trim();
        const bId = (p.branchId || "").toLowerCase().trim();
        const isAll = !bName || bName === "all" || bId === "all" || bName === "all branches";
        if (isAll) return true;

        const names = bName.split(",").map((s) => s.trim().replace(/\s*\((manager|owner)\)/gi, ""));
        const ids = bId.split(",").map((s) => s.trim());
        return (
          names.some((n) => n === mbLower || n.includes(mbLower) || mbLower.includes(n)) ||
          ids.some((id) => id === mbLower || id.includes(mbLower) || mbLower.includes(id))
        );
      });
    } else if (selectedBranchFilter && selectedBranchFilter !== "all") {
      const sfLower = selectedBranchFilter.toLowerCase().trim();
      list = list.filter((p) => {
        const bName = (p.branchName || "").toLowerCase().trim();
        const bId = (p.branchId || "").toLowerCase().trim();
        const isAll = !bName || bName === "all" || bId === "all" || bName === "all branches";
        if (isAll) return true;

        const names = bName.split(",").map((s) => s.trim().replace(/\s*\((manager|owner)\)/gi, ""));
        const ids = bId.split(",").map((s) => s.trim());
        return (
          names.some((n) => n === sfLower || n.includes(sfLower) || sfLower.includes(n)) ||
          ids.some((id) => id === sfLower || id.includes(sfLower) || sfLower.includes(id))
        );
      });
    }

    return list;
  }, [promotions, isManager, managerBranchName, selectedBranchFilter]);

  const savePromos = async (updated: Promotion[]) => {
    setPromotions(updated);
    try {
      await savePromotionsServer({
        data: updated as unknown as Parameters<typeof savePromotionsServer>[0]["data"],
      });
    } catch {
      toast.error("Failed to sync promotion to MySQL");
    }
  };

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState<Promotion | null>(null);

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const clearSelection = () => setSelectedIds([]);

  const applyBulk = (
    mode: "fixed" | "increase-pct" | "decrease-pct" | "increase-amt" | "decrease-amt",
    value: number,
  ) => {
    if (Number.isNaN(value)) {
      toast.error("Enter a valid number");
      return;
    }
    setItems((prev) =>
      prev.map((it) => {
        if (!selectedIds.includes(it.id)) return it;
        let next = it.price;
        if (mode === "fixed") next = value;
        else if (mode === "increase-pct") next = it.price * (1 + value / 100);
        else if (mode === "decrease-pct") next = it.price * (1 - value / 100);
        else if (mode === "increase-amt") next = it.price + value;
        else if (mode === "decrease-amt") next = it.price - value;
        next = Math.max(0, Math.round(next * 100) / 100);
        return { ...it, price: next };
      }),
    );
    toast.success(`Updated ${selectedIds.length} item${selectedIds.length === 1 ? "" : "s"}`);
    setBulkOpen(false);
    clearSelection();
  };

  // Helper to check if two promotion target branch scopes overlap
  const doBranchScopesOverlap = (
    p1?: { branchName?: string; branchId?: string },
    p2?: { branchName?: string; branchId?: string },
  ): boolean => {
    if (!p1 || !p2) return true;

    const bName1 = (p1.branchName || "").toLowerCase().trim();
    const bId1 = (p1.branchId || "").toLowerCase().trim();
    const isAll1 = !bName1 || bName1 === "all" || bId1 === "all" || bName1 === "all branches";

    const bName2 = (p2.branchName || "").toLowerCase().trim();
    const bId2 = (p2.branchId || "").toLowerCase().trim();
    const isAll2 = !bName2 || bName2 === "all" || bId2 === "all" || bName2 === "all branches";

    if (isAll1 || isAll2) return true;

    const list1Names = bName1
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const list1Ids = bId1
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const list2Names = bName2
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const list2Ids = bId2
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const nameMatch = list1Names.some((n1) =>
      list2Names.some((n2) => n1 === n2 || n1.includes(n2) || n2.includes(n1)),
    );
    const idMatch = list1Ids.some((i1) =>
      list2Ids.some((i2) => i1 === i2 || i1.includes(i2) || i2.includes(i1)),
    );

    return nameMatch || idMatch;
  };

  // ---------- Promotions Helpers & Handlers ----------
  const getConflictingUnexpiredPromo = (candidate?: Partial<Promotion>): Promotion | null => {
    const today = new Date().toISOString().slice(0, 10);
    const candidateKind = candidate?.kind;
    const isCandidateHappyHour = candidateKind === "happy-hour";

    for (const p of promotions) {
      if (candidate && candidate.id && p.id === candidate.id) continue;
      const isUnexpiredActive = p.active && p.endDate >= today;
      if (!isUnexpiredActive) continue;

      // Only conflict if target branch scopes overlap!
      if (!doBranchScopesOverlap(candidate, p)) continue;

      const isPromoHappyHour = p.kind === "happy-hour";

      // 1. Happy Hour only conflicts with another overlapping Happy Hour (same date range & overlapping daily time window)
      if (candidate && isCandidateHappyHour) {
        if (!isPromoHappyHour) continue; // Can co-exist with Seasonal / Limited Time!

        const candStart = candidate.startDate || today;
        const candEnd = candidate.endDate || today;
        const candStartT = candidate.startTime || "17:00";
        const candEndT = candidate.endTime || "19:00";

        const promoStartT = p.startTime || "17:00";
        const promoEndT = p.endTime || "19:00";

        // Check date overlap
        const dateOverlap = candStart <= p.endDate && candEnd >= p.startDate;
        if (!dateOverlap) continue;

        // Check daily time window overlap
        const timeOverlap = candStartT <= promoEndT && candEndT >= promoStartT;
        if (timeOverlap) return p;
      } else {
        // 2. Date-based (Seasonal / Limited Time) only conflicts with another date-based promo
        if (isPromoHappyHour) continue; // Can co-exist with Happy Hour!

        if (!candidate || !candidate.startDate || !candidate.endDate) {
          return p;
        }
        if (candidate.startDate <= p.endDate && candidate.endDate >= p.startDate) {
          return p;
        }
      }
    }
    return null;
  };

  const handleCreatePromo = (kind: PromotionKind) => {
    const draft = emptyPromotion(kind);
    setPromoOpen(draft);
  };

  const emptyPromotion = (kind: PromotionKind): Promotion => {
    const isManager = currentUser?.role?.toLowerCase() === "manager";
    const managerBranch = (managerBranchName || currentUser?.branch || "Main Branch")
      .replace(/\s*\((Manager|Owner)\)/gi, "")
      .trim();

    // Resolve manager branch UUID from branchesList by name match
    const managerBranchRecord = isManager
      ? branchesList.find(
          (b) =>
            b.name.toLowerCase().trim() === managerBranch.toLowerCase().trim() ||
            b.name.toLowerCase().includes(managerBranch.toLowerCase()) ||
            managerBranch.toLowerCase().includes(b.name.toLowerCase()),
        )
      : null;
    const managerBranchId = managerBranchRecord?.id || managerBranch;
    const managerBranchName2 = managerBranchRecord?.name || managerBranch;

    // selectedBranchFilter now stores UUID; resolve display name
    const selectedBranchRecord =
      selectedBranchFilter !== "all"
        ? branchesList.find((b) => b.id === selectedBranchFilter || b.name === selectedBranchFilter)
        : null;

    return {
      id: generateId(),
      kind,
      name:
        kind === "seasonal"
          ? "Seasonal Menu"
          : kind === "happy-hour"
            ? "Happy Hour"
            : "Limited Time Offer",
      discountPercent: kind === "happy-hour" ? 20 : 15,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
      startTime: kind === "happy-hour" ? "17:00" : undefined,
      endTime: kind === "happy-hour" ? "19:00" : undefined,
      targetScope: "all",
      categoryNames: [],
      itemIds: [],
      active: true,
      // branchName = human-readable label (for display only)
      branchName: isManager
        ? managerBranchName2
        : selectedBranchRecord
          ? selectedBranchRecord.name
          : "all",
      // branchId = authoritative UUID (never changes when admin renames branch)
      branchId: isManager
        ? managerBranchId
        : selectedBranchRecord
          ? selectedBranchRecord.id
          : "all",
      createdByRole: isManager ? "manager" : "owner",
      createdByUserId:
        currentUser?.full_name || currentUser?.role || (isManager ? "manager" : "owner"),
    };
  };

  const savePromotion = (p: Promotion) => {
    if (p.startDate > p.endDate) {
      toast.error("Start date cannot be after end date.");
      return;
    }

    if (p.kind === "happy-hour" && p.startTime && p.endTime && p.startTime >= p.endTime) {
      toast.error("Happy Hour start time must be before end time.");
      return;
    }

    const isManager = currentUser?.role?.toLowerCase() === "manager";
    const managerBranch = (managerBranchName || currentUser?.branch || "Main Branch")
      .replace(/\s*\((Manager|Owner)\)/gi, "")
      .trim();

    // Resolve manager UUID from branchesList (never use name as ID)
    const managerBranchRecord = isManager
      ? (branchesList || []).find(
          (b) =>
            b.name.toLowerCase().trim() === managerBranch.toLowerCase().trim() ||
            b.name.toLowerCase().includes(managerBranch.toLowerCase()) ||
            managerBranch.toLowerCase().includes(b.name.toLowerCase()),
        )
      : null;
    const resolvedManagerBranchId = managerBranchRecord?.id || p.branchId || "assigned";
    const resolvedManagerBranchName = managerBranchRecord?.name || managerBranch || p.branchName || "Assigned Branch";

    const promoToSave: Promotion = {
      ...p,
      branchName: isManager
        ? resolvedManagerBranchName
        : p.branchName || "all",
      // Always store UUID — never branch name — in branchId
      branchId: isManager ? resolvedManagerBranchId : p.branchId || "all",
      createdByRole: isManager ? "manager" : p.createdByRole || "owner",
      createdByUserId: isManager
        ? currentUser?.full_name || currentUser?.role || "manager"
        : p.createdByUserId || "owner",
    };

    if (promoToSave.active) {
      const conflict = getConflictingUnexpiredPromo(promoToSave);
      if (conflict) {
        const conflictBranch =
          conflict.branchName && conflict.branchName !== "all" ? ` on ${conflict.branchName}` : "";
        if (promoToSave.kind === "happy-hour") {
          toast.error(
            `Cannot save duplicate Happy Hour${conflictBranch}. "${conflict.name}" is active from ${conflict.startTime || "17:00"} to ${conflict.endTime || "19:00"} (${conflict.startDate} to ${conflict.endDate}).`,
          );
        } else {
          toast.error(
            `Cannot save active promotion${conflictBranch}. "${conflict.name}" is active until ${conflict.endDate}. Please pause it or choose a different branch.`,
          );
        }
        return;
      }
    }

    const exists = promotions.some((x) => x.id === promoToSave.id);
    const updated = exists
      ? promotions.map((x) => (x.id === promoToSave.id ? promoToSave : x))
      : [...promotions, promoToSave];

    savePromos(updated);
    toast.success(`Saved "${promoToSave.name}"`);
    setPromoOpen(null);
  };

  const deletePromotion = (id: string) => {
    const updated = promotions.filter((p) => p.id !== id);
    savePromos(updated);
    toast.success("Promotion removed");
  };

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const currentTimeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const activeHappyHourInWindow = promotions.find((x) => {
    if (!x.active || x.kind !== "happy-hour" || !x.startTime || !x.endTime) return false;
    if (x.startDate > todayStr || x.endDate < todayStr) return false;
    return currentTimeStr >= x.startTime && currentTimeStr <= x.endTime;
  });

  const getPromoStatus = (
    p: Promotion,
  ): {
    isActiveNow: boolean;
    isClosed: boolean;
    statusLabel: string;
    badgeClass: string;
  } => {
    // 1. Entirely Expired (End Date passed)
    if (p.endDate && p.endDate < todayStr) {
      return {
        isActiveNow: false,
        isClosed: true,
        statusLabel: "Closed",
        badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30",
      };
    }

    // 2. Not started yet (Upcoming)
    if (p.startDate && p.startDate > todayStr) {
      return {
        isActiveNow: false,
        isClosed: false,
        statusLabel: "Upcoming",
        badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30",
      };
    }

    // 3. User manually paused
    if (!p.active) {
      return {
        isActiveNow: false,
        isClosed: false,
        statusLabel: "Paused",
        badgeClass: "bg-muted text-muted-foreground",
      };
    }

    // 4. Happy Hour daily time window check (e.g. 17:00 - 19:00)
    if (p.kind === "happy-hour" && p.startTime && p.endTime) {
      const isWindowActive = currentTimeStr >= p.startTime && currentTimeStr <= p.endTime;
      if (!isWindowActive) {
        return {
          isActiveNow: false,
          isClosed: true,
          statusLabel: "Closed",
          badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30",
        };
      }
    }

    // 5. Check if held by an active Happy Hour in window
    if (activeHappyHourInWindow && p.kind !== "happy-hour") {
      return {
        isActiveNow: false,
        isClosed: false,
        statusLabel: `On Hold (${activeHappyHourInWindow.name})`,
        badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30",
      };
    }

    // 6. Active right now!
    return {
      isActiveNow: true,
      isClosed: false,
      statusLabel: "Active",
      badgeClass:
        "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30",
    };
  };

  return (
    <div
      className="-m-6 md:-m-8 p-6 md:p-8 min-h-screen space-y-6"
      style={{ backgroundColor: "#EEEFF2" }}
    >
      <div className="w-full space-y-4">
        {/* ============== PROMOTIONS ============== */}
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <PromoTypeCard
              kind="seasonal"
              title="Seasonal Menu"
              description="Rotate items for a season."
              icon={<Sparkles className="h-5 w-5" />}
              onCreate={() => handleCreatePromo("seasonal")}
            />
            <PromoTypeCard
              kind="happy-hour"
              title="Happy Hour"
              description="Time-bound daily discounts."
              icon={<CalendarClock className="h-5 w-5" />}
              onCreate={() => handleCreatePromo("happy-hour")}
            />
            <PromoTypeCard
              kind="limited-time"
              title="Limited Time Offer"
              description="Short-window feature items."
              icon={<Star className="h-5 w-5" />}
              onCreate={() => handleCreatePromo("limited-time")}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div>
              <h3 className="font-display text-lg font-bold text-foreground">Active Campaigns</h3>
              <p className="text-xs text-muted-foreground">
                {isManager && managerBranchName
                  ? `Showing promotions for ${managerBranchName}`
                  : "Overview of active and scheduled discount promotions"}
              </p>
            </div>
            {isManager && managerBranchName ? (
              <Badge
                variant="outline"
                className="gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-900 dark:text-amber-200 border-amber-500/30 text-xs font-semibold"
              >
                <Building2 className="h-3.5 w-3.5 text-amber-600" />
                {managerBranchName}
              </Badge>
            ) : branchesList.length > 1 ? (
              <div className="flex items-center gap-2">
                <Select value={selectedBranchFilter} onValueChange={setSelectedBranchFilter}>
                  <SelectTrigger className="h-8 text-xs bg-card w-48 rounded-xl border-border/70">
                    <Building2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branchesList.map((b) => (
                      <SelectItem key={b.id || b.name} value={b.id || b.name}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <div>
            {!hydrated ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <PromotionCardSkeleton key={idx} />
                ))}
              </div>
            ) : visiblePromotions.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
                {isManager && managerBranchName
                  ? `No promotions for ${managerBranchName} yet. Create one above.`
                  : "No promotions yet. Create one above."}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {visiblePromotions.map((p) => {
                  const statusInfo = getPromoStatus(p);

                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "group relative flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-4 shadow-xs transition-all duration-200 hover:border-primary/40 hover:shadow-md space-y-3",
                        statusInfo.isClosed && "opacity-85 bg-muted/15 border-border/50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                            {p.kind === "happy-hour" ? (
                              <CalendarClock className="h-5 w-5" />
                            ) : p.kind === "seasonal" ? (
                              <Sparkles className="h-5 w-5" />
                            ) : (
                              <Star className="h-5 w-5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="truncate font-display text-sm font-bold text-foreground">
                              {p.name}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <Badge
                                className={cn(
                                  "px-2 py-0.5 text-[10px] font-semibold rounded-full",
                                  statusInfo.badgeClass,
                                )}
                              >
                                {statusInfo.statusLabel}
                              </Badge>
                              {p.branchName && p.branchName !== "all" ? (
                                <Badge
                                  variant="outline"
                                  className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-[10px] font-bold"
                                >
                                  <MapPin className="h-3 w-3 text-amber-600" />
                                  {p.branchName.replace(/\s*\((Manager|Owner)\)/gi, "").trim()}
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="gap-1 border-indigo-500/40 bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 text-[10px] font-bold"
                                >
                                  <Globe className="h-3 w-3 text-indigo-600" />
                                  All Branches
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <Switch
                          checked={p.active}
                          onCheckedChange={(v) => {
                            if (v) {
                              if (p.endDate && p.endDate < todayStr) {
                                toast.error(
                                  `Cannot activate "${p.name}". The campaign end date has expired.`,
                                );
                                return;
                              }
                              const conflict = getConflictingUnexpiredPromo(p);
                              if (conflict) {
                                toast.error(
                                  `Cannot activate "${p.name}". "${conflict.name}" is active until ${conflict.endDate}. Please wait until it expires or pause it first.`,
                                );
                                return;
                              }
                              const updated = promotions.map((x) =>
                                x.id === p.id ? { ...x, active: true } : x,
                              );
                              savePromos(updated);
                              toast.success(`"${p.name}" activated.`);
                            } else {
                              const updated = promotions.map((x) =>
                                x.id === p.id ? { ...x, active: false } : x,
                              );
                              savePromos(updated);
                              toast.info(`"${p.name}" paused.`);
                            }
                          }}
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2 text-xs font-mono text-muted-foreground border border-border/50">
                          <span className="font-semibold text-foreground">
                            {p.discountPercent}% OFF
                          </span>
                          <span>
                            {p.targetScope === "all"
                              ? "All items included"
                              : p.targetScope === "categories"
                                ? `${(p.categoryNames || []).length} categor${(p.categoryNames || []).length === 1 ? "y" : "ies"} included`
                                : p.itemIds.length === 0
                                  ? "All items included"
                                  : `${p.itemIds.length} item${p.itemIds.length === 1 ? "" : "s"} included`}
                          </span>
                        </div>
                        <p className="text-[11px] px-1 text-muted-foreground">
                          {p.startDate} → {p.endDate}
                          {p.startTime ? ` (${p.startTime}–${p.endTime})` : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8 text-xs rounded-xl border-border/60 hover:bg-muted"
                          onClick={() => setPromoOpen(p)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
                          onClick={() => deletePromotion(p.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bulk price dialog */}
      <BulkPriceDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        count={selectedIds.length}
        onApply={applyBulk}
      />

      {/* Promotion dialog */}
      <PromotionDialog
        promotion={promoOpen}
        items={items}
        categories={categories}
        currentUser={currentUser}
        branchesList={branchesList}
        managerBranchName={managerBranchName}
        onSave={savePromotion}
        onClose={() => setPromoOpen(null)}
      />
    </div>
  );
}

// ================================================================
// Bulk price dialog
// ================================================================

type BulkMode = "fixed" | "increase-pct" | "decrease-pct" | "increase-amt" | "decrease-amt";

function BulkPriceDialog({
  open,
  onOpenChange,
  count,
  onApply,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  count: number;
  onApply: (mode: BulkMode, value: number) => void;
}) {
  const [mode, setMode] = useState<BulkMode>("increase-pct");
  const [value, setValue] = useState("10");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk price update</DialogTitle>
          <DialogDescription>
            Update prices for {count} selected item{count === 1 ? "" : "s"}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Operation</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as BulkMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="increase-pct">Increase by %</SelectItem>
                <SelectItem value="decrease-pct">Decrease by %</SelectItem>
                <SelectItem value="increase-amt">Increase by amount</SelectItem>
                <SelectItem value="decrease-amt">Decrease by amount</SelectItem>
                <SelectItem value="fixed">Set fixed price</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Value</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="gradient-warm text-primary-foreground"
            onClick={() => onApply(mode, parseFloat(value))}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ================================================================
// Promotion dialog
// ================================================================

function PromotionDialog({
  promotion,
  items,
  categories,
  currentUser,
  branchesList,
  managerBranchName,
  onSave,
  onClose,
}: {
  promotion: Promotion | null;
  items: FoodItem[];
  categories: Category[];
  currentUser?: {
    role: string | null;
    branch?: string | null;
    full_name?: string | null;
  } | null;
  branchesList?: Array<{ id: string; name: string }>;
  managerBranchName?: string | null;
  onSave: (p: Promotion) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Promotion | null>(promotion);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    setDraft(promotion);
  }, [promotion]);

  if (!draft) return null;

  const isManager = currentUser?.role?.toLowerCase() === "manager";
  const managerBranch = (managerBranchName || currentUser?.branch || "Assigned Branch")
    .replace(/\s*\((Manager|Owner)\)/gi, "")
    .trim();

  const toggleItem = (id: string) => {
    setDraft((d) =>
      d
        ? {
            ...d,
            itemIds: d.itemIds.includes(id)
              ? d.itemIds.filter((x) => x !== id)
              : [...d.itemIds, id],
          }
        : d,
    );
  };

  const toggleCategory = (catName: string) => {
    setDraft((d) => {
      if (!d) return d;
      const currentCats = d.categoryNames || [];
      const nextCats = currentCats.includes(catName)
        ? currentCats.filter((c) => c !== catName)
        : [...currentCats, catName];

      const categoryItems = items.filter((it) =>
        nextCats.some((c) => c.toLowerCase() === (it.category || "").toLowerCase()),
      );
      const categoryItemIds = categoryItems.map((it) => it.id);

      return {
        ...d,
        categoryNames: nextCats,
        itemIds: categoryItemIds,
      };
    });
  };

  const currentScope: TargetScope =
    draft.targetScope || (draft.itemIds.length === 0 ? "all" : "items");

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const cdnUrl = await uploadToImgBB(file);
      if (cdnUrl) {
        setDraft((d) => (d ? { ...d, image: cdnUrl } : d));
        toast.success("Promotion banner image uploaded successfully");
      }
    } catch {
      toast.error("Failed to upload promotion banner image");
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <Dialog
      open={!!promotion}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{promotion?.name}</DialogTitle>
          <DialogDescription>
            {draft.kind === "seasonal" && "Seasonal menu: highlight items for a season."}
            {draft.kind === "happy-hour" && "Happy hour: discount within a daily time window."}
            {draft.kind === "limited-time" && "Limited time offer: short-window feature items."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Name & Select Branch side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>{" "}
          </div>

          {/* Multi-Branch Selector */}
          <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground">Target Branches</Label>
              {!isManager && (
                <div className="flex items-center gap-1 bg-muted/80 p-0.5 rounded-lg border border-border/50 text-[11px]">
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        branchName: "all",
                        branchId: "all",
                        createdByRole: "owner",
                      })
                    }
                    className={cn(
                      "px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer",
                      !draft.branchName || draft.branchName === "all" || draft.branchId === "all"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    All Branches
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        (!draft.branchName || draft.branchName === "all") &&
                        (branchesList || []).length > 0
                      ) {
                        const firstB = (branchesList || [])[0];
                        setDraft({
                          ...draft,
                          branchName: firstB.name,
                          branchId: firstB.id || firstB.name,
                          createdByRole: "owner",
                        });
                      }
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer",
                      draft.branchName && draft.branchName !== "all" && draft.branchId !== "all"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Specific Branches
                  </button>
                </div>
              )}
            </div>

            {isManager ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2 h-10">
                <MapPin className="h-4 w-4 shrink-0 text-amber-600" />
                <span className="truncate">
                  <strong>{managerBranch}</strong>
                </span>
              </div>
            ) : !draft.branchName || draft.branchName === "all" || draft.branchId === "all" ? (
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-2.5 text-xs font-semibold text-indigo-800 dark:text-indigo-200 flex items-center gap-2">
                <Globe className="h-4 w-4 shrink-0 text-indigo-600" />
                <span>Applies universally across all current & future branches.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {(() => {
                  const allBList = branchesList || [];
                  const selNames = (draft.branchName || "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const selIds = (draft.branchId || "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);

                  return (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                        {allBList.map((b) => {
                          const bId = b.id || b.name;
                          const isSelected =
                            selIds.includes(bId) ||
                            selNames.includes(b.name) ||
                            selIds.includes(b.name);

                          return (
                            <button
                              key={bId}
                              type="button"
                              onClick={() => {
                                let nextNames: string[];
                                let nextIds: string[];

                                if (isSelected) {
                                  nextNames = selNames.filter((n) => n !== b.name);
                                  nextIds = selIds.filter((id) => id !== bId && id !== b.name);
                                } else {
                                  nextNames = Array.from(new Set([...selNames, b.name]));
                                  nextIds = Array.from(new Set([...selIds, bId]));
                                }

                                if (nextNames.length === 0) {
                                  setDraft({
                                    ...draft,
                                    branchName: "all",
                                    branchId: "all",
                                  });
                                } else {
                                  setDraft({
                                    ...draft,
                                    branchName: nextNames.join(", "),
                                    branchId: nextIds.join(","),
                                  });
                                }
                              }}
                              className={cn(
                                "flex items-center justify-between p-2 rounded-xl border text-xs font-medium transition-all text-left cursor-pointer",
                                isSelected
                                  ? "border-amber-500/60 bg-amber-500/10 text-amber-950 dark:text-amber-200 font-bold shadow-sm"
                                  : "border-border/60 bg-background text-muted-foreground hover:bg-accent/50",
                              )}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <MapPin
                                  className={cn(
                                    "h-3.5 w-3.5 shrink-0",
                                    isSelected ? "text-amber-600" : "text-muted-foreground",
                                  )}
                                />
                                <span className="truncate">{b.name}</span>
                              </div>
                              <div
                                className={cn(
                                  "h-4 w-4 rounded-md border flex items-center justify-center text-[10px]",
                                  isSelected
                                    ? "bg-amber-500 text-white border-amber-600"
                                    : "border-muted-foreground/30",
                                )}
                              >
                                {isSelected && "✓"}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                        <span>
                          <strong>{selNames.length}</strong> of <strong>{allBList.length}</strong>{" "}
                          branches selected
                        </span>
                        {selNames.length < allBList.length && (
                          <button
                            type="button"
                            onClick={() => {
                              const allNames = allBList.map((b) => b.name).join(", ");
                              const allIds = allBList.map((b) => b.id || b.name).join(",");
                              setDraft({
                                ...draft,
                                branchName: allNames,
                                branchId: allIds,
                              });
                            }}
                            className="text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer"
                          >
                            + Select All Branches
                          </button>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Banner / Poster Image Upload */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>Promotion Banner / Poster Image</span>
              {uploadingImage && (
                <span className="text-xs text-primary animate-pulse flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Uploading to CDN...
                </span>
              )}
            </Label>
            <div className="flex items-center gap-3">
              <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-xl border border-border/80 bg-muted/40 shadow-inner flex items-center justify-center">
                {draft.image ? (
                  <>
                    <BlobImg
                      src={draft.image}
                      alt={draft.name}
                      className="h-full w-full object-cover object-center"
                    />
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, image: "" })}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/90 transition-colors"
                      title="Remove Banner"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground p-2 text-center">
                    <ImageIcon className="h-6 w-6 text-muted-foreground/60 mb-0.5" />
                    <span className="text-[10px] font-medium">No Banner</span>
                  </div>
                )}
              </div>
              <div className="space-y-1.5 flex-1">
                <input
                  id="promo-img-file"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingImage}
                  onClick={() => document.getElementById("promo-img-file")?.click()}
                  className="w-full h-8 text-xs font-semibold gap-1.5 rounded-xl border-border/70 hover:bg-muted"
                >
                  <Upload className="h-3.5 w-3.5" />{" "}
                  {uploadingImage
                    ? "Uploading..."
                    : draft.image
                      ? "Change Image"
                      : "Upload Banner Image"}
                </Button>
                <p className="text-[10.5px] text-muted-foreground leading-tight">
                  Upload image to show on the promotional popup on the /username public menu.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <ModernDatePicker
                value={draft.startDate}
                onChange={(val) => setDraft({ ...draft, startDate: val })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>End date</Label>
              <ModernDatePicker
                value={draft.endDate}
                onChange={(val) => setDraft({ ...draft, endDate: val })}
              />
            </div>
          </div>

          {draft.kind === "happy-hour" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start time</Label>
                <Input
                  type="time"
                  value={draft.startTime ?? ""}
                  onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End time</Label>
                <Input
                  type="time"
                  value={draft.endTime ?? ""}
                  onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label>Discount %</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={draft.discountPercent}
              onChange={(e) => setDraft({ ...draft, discountPercent: Number(e.target.value) || 0 })}
            />
          </div>

          {/* Offer Type Target Selection */}
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-bold text-foreground">Offer Type Target</Label>
            <div className="grid grid-cols-3 gap-2">
              <label
                className={cn(
                  "flex cursor-pointer items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition-all select-none",
                  currentScope === "all"
                    ? "bg-primary/10 border-primary text-primary shadow-xs"
                    : "bg-card border-border text-muted-foreground hover:bg-muted/50",
                )}
              >
                <Checkbox
                  checked={currentScope === "all"}
                  onCheckedChange={() =>
                    setDraft((d) => (d ? { ...d, targetScope: "all", itemIds: [] } : d))
                  }
                />
                <span>All Items</span>
              </label>

              <label
                className={cn(
                  "flex cursor-pointer items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition-all select-none",
                  currentScope === "items"
                    ? "bg-primary/10 border-primary text-primary shadow-xs"
                    : "bg-card border-border text-muted-foreground hover:bg-muted/50",
                )}
              >
                <Checkbox
                  checked={currentScope === "items"}
                  onCheckedChange={() => setDraft((d) => (d ? { ...d, targetScope: "items" } : d))}
                />
                <span>Specific Items</span>
              </label>

              <label
                className={cn(
                  "flex cursor-pointer items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition-all select-none",
                  currentScope === "categories"
                    ? "bg-primary/10 border-primary text-primary shadow-xs"
                    : "bg-card border-border text-muted-foreground hover:bg-muted/50",
                )}
              >
                <Checkbox
                  checked={currentScope === "categories"}
                  onCheckedChange={() =>
                    setDraft((d) => (d ? { ...d, targetScope: "categories" } : d))
                  }
                />
                <span>Specific Categories</span>
              </label>
            </div>
          </div>

          {/* Conditional Target Scope Content */}
          {currentScope === "all" ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs font-semibold text-primary flex items-center gap-2.5">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>
                This promotion discount will apply to all active menu items automatically.
              </span>
            </div>
          ) : currentScope === "categories" ? (
            <div className="space-y-1.5">
              <Label>Categories ({(draft.categoryNames || []).length})</Label>
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {categories.length === 0 ? (
                  <p className="p-3 text-center text-xs text-muted-foreground">
                    No categories available.
                  </p>
                ) : (
                  categories.map((cat: Category) => {
                    const isChecked = (draft.categoryNames || []).includes(cat.name);
                    return (
                      <label
                        key={cat.id || cat.name}
                        className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-muted/70 transition-colors border border-transparent hover:border-border/50"
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleCategory(cat.name)}
                        />
                        <span className="text-base">{cat.icon || "🍽️"}</span>
                        <span className="flex-1 truncate text-sm font-bold text-foreground">
                          {cat.name}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Items ({draft.itemIds.length})</Label>
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {items.length === 0 ? (
                  <p className="p-3 text-center text-xs text-muted-foreground">
                    No items available.
                  </p>
                ) : (
                  items.map((it) => (
                    <label
                      key={it.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-1.5 hover:bg-muted/70 transition-colors border border-transparent hover:border-border/50"
                    >
                      <Checkbox
                        checked={draft.itemIds.includes(it.id)}
                        onCheckedChange={() => toggleItem(it.id)}
                      />
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted">
                        {it.image ? (
                          <BlobImg
                            src={it.image}
                            alt={it.name}
                            className="h-full w-full object-cover object-center"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted-foreground">
                            {it.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <span className="flex-1 truncate text-sm font-medium text-foreground">
                        {it.name}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground">
                        ${it.price.toFixed(2)}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button className="gradient-warm text-primary-foreground" onClick={() => onSave(draft)}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ================================================================
// Promotion card skeleton
// ================================================================

function PromotionCardSkeleton() {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-4 shadow-xs space-y-3">
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
          <div className="min-w-0 space-y-1.5">
            <Skeleton className="h-4 w-28 rounded" />
            <div className="flex items-center gap-1.5 mt-1">
              <Skeleton className="h-4 w-14 rounded-full" />
              <Skeleton className="h-4 w-20 rounded-full" />
            </div>
          </div>
        </div>
        <Skeleton className="h-5 w-9 rounded-full shrink-0" />
      </div>

      <div className="space-y-1.5">
        <Skeleton className="h-8 w-full rounded-xl" />
        <Skeleton className="h-3 w-36 rounded" />
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-border/40">
        <Skeleton className="h-8 flex-1 rounded-xl" />
        <Skeleton className="h-8 w-8 rounded-xl shrink-0" />
      </div>
    </div>
  );
}

// ================================================================
// Promo type card
// ================================================================

function PromoTypeCard({
  title,
  description,
  icon,
  onCreate,
}: {
  kind: PromotionKind;
  title: string;
  description: string;
  icon: React.ReactNode;
  onCreate: () => void;
}) {
  return (
    <button
      onClick={onCreate}
      className="group relative flex items-start gap-3.5 rounded-xl border border-border/70 bg-card p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl gradient-warm text-primary-foreground shadow-sm">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-display font-bold text-foreground text-sm sm:text-base">{title}</h4>
          <Plus className="ml-auto h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </button>
  );
}
