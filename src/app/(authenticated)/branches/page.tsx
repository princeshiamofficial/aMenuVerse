"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams, useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Building2,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  QrCode,
  Phone,
  UserRound,
  Download,
  Star,
  BookOpen,
  Search,
  Printer,
  Copy,
  Minus,
  UtensilsCrossed,
  ExternalLink,
  MoreVertical,
  X,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import { cn, generateId, getEncryptedTableUrl } from "@/lib/utils";
import { SkeletonBranchesPage } from "@/components/menuverse/skeletons";
import {
  getBranchesServer,
  updateBranchesServer,
  getBranchTablesServer,
  saveBranchTablesServer,
  getCurrentTenantSlugServer,
  getTenantSubscriptionServer,
  getSubscriptionPackagesServer,
  getStaffServer,
  getCurrentUser,
  SubscriptionPackageRecord,
} from "@/lib/db-queries.server";

type BranchStatus = "open" | "closed" | "temporarily-closed";

type Branch = {
  id: string;
  name: string;
  address: string;
  phone: string;
  manager: string;
  status: BranchStatus;
  isDefault: boolean;
  menuId: string;
};

const STORAGE_KEY = "menuverse:branches";

const DEFAULT_BRANCHES: Branch[] = [
  {
    id: "branch-downtown",
    name: "Main Branch",
    address: "",
    phone: "",
    manager: "",
    status: "open",
    isDefault: true,
    menuId: "menu-main",
  },
];
const PLAN_BRANCH_LIMITS: Record<string, number | "unlimited"> = {
  free: 1,
  starter: 2,
  business: 10,
  enterprise: "unlimited",
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-primary/15 text-primary border-primary/20" },
  active: { label: "Open", className: "bg-primary/15 text-primary border-primary/20" },
  closed: { label: "Closed", className: "bg-muted text-muted-foreground border-border" },
  disabled: { label: "Closed", className: "bg-muted text-muted-foreground border-border" },
  "temporarily-closed": {
    label: "Temporarily closed",
    className: "bg-amber-500/15 text-amber-700 border-amber-500/20 dark:text-amber-400",
  },
};

const EMPTY_BRANCH = (): Branch => ({
  id: generateId(),
  name: "",
  address: "",
  phone: "",
  manager: "",
  status: "open",
  isDefault: false,
  menuId: `menu-${generateId().slice(0, 8)}`,
});

function menuUrl(b: Branch) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/m/${b.menuId}`;
}

const AVAILABLE_MANAGERS: string[] = [];

function cleanManagerName(name: string): string {
  if (!name) return "";
  return name.replace(/\s*\([^)]*\)/g, "").trim();
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    role?: string | null;
    full_name?: string | null;
    email?: string | null;
    branch?: string | null;
  } | null>(null);
  const [dbStaff, setDbStaff] = useState<{ name: string; role: string }[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Branch | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrBranch, setQrBranch] = useState<Branch | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [disabledBranchModal, setDisabledBranchModal] = useState<{
    branch: Branch;
    reason: string;
  } | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<string>("free");
  const [dbPackages, setDbPackages] = useState<SubscriptionPackageRecord[]>([]);
  const [subInfo, setSubInfo] = useState<{ plan: string; limit: number | "unlimited" }>({
    plan: "Free Trial",
    limit: 1,
  });

  const userRole = (currentUser?.role || "").toLowerCase().trim().replace(/ /g, "_");
  const isManager = userRole === "manager";

  const managerList = useMemo(() => {
    const set = new Set<string>();

    const actualManagers = dbStaff
      .filter((s) => (s.role || "").toLowerCase().trim() === "manager")
      .map((s) => cleanManagerName(s.name))
      .filter(Boolean);

    actualManagers.forEach((m) => set.add(m));

    if (editing?.manager && editing.manager.trim() && editing.manager !== "Unassigned") {
      set.add(cleanManagerName(editing.manager));
    }

    return Array.from(set);
  }, [dbStaff, editing?.manager]);

  useEffect(() => {
    async function loadBranches() {
      try {
        const u = await getCurrentUser();
        if (u) {
          setCurrentUser(u);
        }
      } catch {
        /* ignore */
      }

      try {
        const staffList = await getStaffServer({ data: {} });
        if (staffList && Array.isArray(staffList)) {
          setDbStaff(staffList.map((s) => ({ name: s.name, role: s.role })));
        }
      } catch {
        /* ignore */
      }

      try {
        const dbBranches = await getBranchesServer({ data: {} });
        if (dbBranches && Array.isArray(dbBranches) && dbBranches.length > 0) {
          let list = dbBranches as Branch[];
          if (!list.some((b) => b.isDefault)) {
            list = list.map((b, idx) => ({ ...b, isDefault: idx === 0 }));
          }
          setBranches(list);
        } else {
          setBranches(DEFAULT_BRANCHES);
        }
      } catch {
        setBranches(DEFAULT_BRANCHES);
      }
      setHydrated(true);
    }

    async function loadSubscription() {
      try {
        const [subData, pkgs] = await Promise.all([
          getTenantSubscriptionServer(),
          getSubscriptionPackagesServer(),
        ]);
        if (subData?.plan) {
          setSubscriptionPlan(subData.plan.toLowerCase());
          setSubInfo({
            plan: subData.plan,
            limit: subData.limits?.maxBranches ?? 1,
          });
        }
        if (pkgs && Array.isArray(pkgs)) setDbPackages(pkgs);
      } catch {
        // keep default "free"
      }
    }

    loadBranches();
    loadSubscription();
  }, []);



  const visibleBranches = useMemo(() => {
    if (!isManager || !currentUser) return branches;
    const userCleanName = cleanManagerName(currentUser.full_name || "").toLowerCase();
    const userBranch = (currentUser.branch || "").toLowerCase().trim();

    return branches.filter((b) => {
      const bManager = cleanManagerName(b.manager || "").toLowerCase();
      const bName = b.name.toLowerCase().trim();
      const bId = b.id.toLowerCase().trim();

      if (
        userCleanName &&
        bManager &&
        (bManager === userCleanName ||
          bManager.includes(userCleanName) ||
          userCleanName.includes(bManager))
      ) {
        return true;
      }
      if (
        userBranch &&
        (userBranch === bName || userBranch === bId || bName.includes(userBranch))
      ) {
        return true;
      }
      return false;
    });
  }, [branches, isManager, currentUser]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visibleBranches;
    return visibleBranches.filter((b) =>
      [b.name, b.address, b.manager, b.phone].some((v) => (v || "").toLowerCase().includes(q)),
    );
  }, [visibleBranches, query]);

  const openCreate = () => {
    if (subInfo.limit !== "unlimited" && branches.length >= subInfo.limit) {
      toast.error(
        `Package Limit Reached: Your current "${subInfo.plan}" package allows up to ${subInfo.limit} branch(es). Please upgrade your subscription to add more branches.`,
      );
      return;
    }
    setEditing(EMPTY_BRANCH());
    setDialogOpen(true);
  };

  const openEdit = (b: Branch) => {
    setEditing({ ...b });
    setDialogOpen(true);
  };

  const saveBranch = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast.error("Branch name is required");
      return;
    }
    const isNew = !branches.some((b) => b.id === editing.id);
    if (isNew && subInfo.limit !== "unlimited" && branches.length >= subInfo.limit) {
      toast.error(
        `Package Limit Reached: Your current "${subInfo.plan}" package allows up to ${subInfo.limit} branch(es). Please upgrade your subscription to add more branches.`,
      );
      return;
    }
    const exists = branches.some((b) => b.id === editing.id);
    let next = exists
      ? branches.map((b) => (b.id === editing.id ? editing : b))
      : [...branches, editing];
    if (editing.isDefault) {
      next = next.map((b) => ({ ...b, isDefault: b.id === editing.id }));
    }
    if (!next.some((b) => b.isDefault) && next.length > 0) {
      next[0] = { ...next[0], isDefault: true };
    }
    setBranches(next);
    setDialogOpen(false);
    try {
      const res = await updateBranchesServer({ data: next });
      if (res && typeof res === "object" && "success" in res && !(res as any).success) {
        toast.error((res as any).error || "Failed to save branch");
        return;
      }
      toast.success(exists ? "Branch updated" : "Branch created");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save branch";
      toast.error(msg);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const target = branches.find((b) => b.id === deleteId);
    let next = branches.filter((b) => b.id !== deleteId);
    if ((target?.isDefault || !next.some((b) => b.isDefault)) && next.length > 0) {
      next[0] = { ...next[0], isDefault: true };
    }
    setBranches(next);
    setDeleteId(null);
    try {
      await updateBranchesServer({ data: next });
    } catch {
      /* ignore */
    }
    toast.success("Branch deleted");
  };

  const setDefault = async (id: string) => {
    const next = branches.map((b) => ({ ...b, isDefault: b.id === id }));
    setBranches(next);
    try {
      await updateBranchesServer({ data: next });
    } catch {
      /* ignore */
    }
    toast.success("Default branch updated");
  };

  const branchLimit = useMemo(() => {
    if (!subscriptionPlan) return 1;
    const pLower = subscriptionPlan.toLowerCase();

    // 1. Check DB package records first
    const match = dbPackages.find(
      (p) =>
        p.id.toLowerCase() === pLower ||
        p.id.toLowerCase().replace("pkg-", "") === pLower ||
        p.name.toLowerCase().includes(pLower) ||
        pLower.includes(p.name.toLowerCase()),
    );

    if (match) {
      if (match.maxBranches) {
        const val = match.maxBranches.trim().toLowerCase();
        if (val === "unlimited" || val === "infinity" || val === "∞") return "unlimited";
        const num = parseInt(val, 10);
        if (!isNaN(num) && num >= 0) return num;
      }
      const featStr = (match.features || []).join(" ");
      const branchMatch = featStr.match(/(\d+)\s*branch/i);
      if (branchMatch) return Number(branchMatch[1]);
    }

    // 2. Static fallback map by name keywords
    if (pLower.includes("enterprise") || pLower.includes("vip")) return "unlimited";
    if (pLower.includes("business") || pLower.includes("pro")) return 10;
    if (pLower.includes("starter") || pLower.includes("popular")) return 2;
    if (PLAN_BRANCH_LIMITS[pLower] !== undefined) return PLAN_BRANCH_LIMITS[pLower];

    return 1;
  }, [subscriptionPlan, dbPackages]);

  if (!hydrated) {
    return <SkeletonBranchesPage />;
  }

  return (
    <div
      className="-m-6 md:-m-8 p-6 md:p-8 min-h-screen space-y-6"
      style={{ backgroundColor: "#EEEFF2" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, address, manager…"
            className="pl-9 bg-white"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 ml-auto">
          {!isManager && (
            <Button
              onClick={openCreate}
              size="sm"
              className="bg-linear-to-r from-[#D77649] via-[#CB6C3F] to-[#B85C31] hover:from-[#C9693D] hover:to-[#A74E26] text-white shadow-md shadow-amber-900/10 h-9 rounded-md px-5 text-xs font-medium tracking-wide flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 text-white" /> Create branch
            </Button>
          )}
          <div className="text-sm font-medium text-gray-500 whitespace-nowrap">
            {filtered.length} branch{filtered.length === 1 ? "" : "es"}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center shadow-xs">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-3 font-display text-lg font-semibold">
            {isManager ? "No assigned branches found" : "No branches yet"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {isManager
              ? "You do not have any branches assigned to your account yet. Please contact the restaurant owner."
              : "Add your first location to get going."}
          </p>
          {!isManager && (
            <Button
              onClick={openCreate}
              className="mt-4 gradient-warm text-primary-foreground shadow-elegant"
            >
              <Plus className="mr-1 h-4 w-4" /> Create branch
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((b) => {
            const status =
              STATUS_META[(b.status || "").toLowerCase()] ||
              STATUS_META[b.status] ||
              STATUS_META.open;
            const originalIdx = branches.findIndex((item) => item.id === b.id);
            const isDisabledByLimit = subInfo.limit !== "unlimited" && originalIdx >= subInfo.limit;

            const isClosedOrDisabled = b.status === "closed" || b.status === "temporarily-closed";
            const isBranchInactive = isDisabledByLimit || isClosedOrDisabled;

            return (
              <div
                key={b.id}
                className={cn(
                  "border flex flex-col rounded-2xl p-6 shadow-xs transition hover:shadow-md relative overflow-hidden",
                  isBranchInactive
                    ? "bg-amber-500/5 border-amber-300/80 opacity-85"
                    : "bg-white border-gray-100",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-primary-foreground",
                      isBranchInactive ? "bg-gray-400" : "gradient-warm",
                    )}
                  >
                    <Building2 className="h-5 w-5" />
                  </span>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {isDisabledByLimit ? (
                      <Badge
                        variant="outline"
                        className="border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400 font-medium text-[10px]"
                      >
                        Plan Limit Exceeded (Disabled)
                      </Badge>
                    ) : (
                      <>
                        {b.isDefault && (
                          <Badge className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">
                            <Star className="mr-1 h-3 w-3 fill-primary" /> Default
                          </Badge>
                        )}
                        <Badge variant="outline" className={cn("border", status.className)}>
                          {status.label}
                        </Badge>
                      </>
                    )}
                  </div>
                </div>

                <h3 className="mt-4 font-display text-lg font-semibold">{b.name}</h3>
                <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{" "}
                    <span className="min-w-0 wrap-break-word">{b.address || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" /> {b.phone || "—"}
                  </div>
                  <div className="flex items-center gap-2">
                    <UserRound className="h-3.5 w-3.5" /> {b.manager || "—"}
                  </div>
                  {!isManager && (
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5" />{" "}
                      <span className="truncate font-mono text-xs">{b.menuId}</span>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn(isManager && "w-full justify-center")}
                    onClick={() => {
                      if (isDisabledByLimit) {
                        setDisabledBranchModal({
                          branch: b,
                          reason: `This branch is disabled because your current "${subInfo.plan}" package allows up to ${subInfo.limit} active branch(es). Upgrade your subscription package to re-enable it.`,
                        });
                        return;
                      }
                      if (isClosedOrDisabled) {
                        setDisabledBranchModal({
                          branch: b,
                          reason: `This branch is currently marked as "${status.label}". Please reactivate or open this branch in branch settings to generate table QR codes.`,
                        });
                        return;
                      }
                      setQrBranch(b);
                    }}
                  >
                    <QrCode className="mr-1 h-3.5 w-3.5" /> Branch QR
                  </Button>
                  {!isManager && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          aria-label="More options"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          onClick={() => {
                            if (isDisabledByLimit) {
                              setDisabledBranchModal({
                                branch: b,
                                reason: `This branch is disabled because your current "${subInfo.plan}" package allows up to ${subInfo.limit} active branch(es). Upgrade your subscription package to re-enable it.`,
                              });
                              return;
                            }
                            openEdit(b);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        {!b.isDefault && (
                          <DropdownMenuItem
                            onClick={() => {
                              if (isDisabledByLimit) {
                                setDisabledBranchModal({
                                  branch: b,
                                  reason: `This branch is disabled because your current "${subInfo.plan}" package allows up to ${subInfo.limit} active branch(es). Upgrade your subscription package to re-enable it.`,
                                });
                                return;
                              }
                              setDefault(b.id);
                            }}
                          >
                            <Star className="mr-2 h-4 w-4" /> Set default
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteId(b.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Disabled Branch Alert Popup */}
      <Dialog
        open={disabledBranchModal !== null}
        onOpenChange={(o) => !o && setDisabledBranchModal(null)}
      >
        <DialogContent className="max-w-md rounded-3xl p-6 text-center shadow-2xl border border-amber-200 bg-white">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 mb-2 border border-amber-200">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-display text-center text-gray-900">
              Subscription Expired / Branch Disabled
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm text-gray-600 text-center">
            <div className="font-bold text-gray-900 text-base">
              {disabledBranchModal?.branch.name}
            </div>
            <p className="leading-relaxed font-medium text-amber-900 bg-amber-50 p-2.5 rounded-xl border border-amber-200/60 text-xs">
              ⚠️ The subscription has expired. All branch operations, orders, and table QR access
              are locked until the subscription is renewed.
            </p>
            <p className="leading-relaxed">{disabledBranchModal?.reason}</p>
            <p className="text-xs text-muted-foreground">
              {isManager
                ? "Please contact your restaurant owner to renew the subscription package or reactivate this branch."
                : "Upgrade or renew your subscription package to unlock active branch access."}
            </p>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-3">
            {!isManager && (
              <Button
                className="w-full gradient-warm text-white font-bold h-10 rounded-xl cursor-pointer"
                onClick={() => {
                  setDisabledBranchModal(null);
                  window.location.href = "/subscription";
                }}
              >
                Renew Subscription
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full h-10 rounded-xl border-gray-200 cursor-pointer"
              onClick={() => setDisabledBranchModal(null)}
            >
              {isManager ? "Understood" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing && branches.some((b) => b.id === editing.id)
                ? "Edit branch"
                : "Create branch"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="b-name">Branch name</Label>
                <Input
                  id="b-name"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Downtown Flagship"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="b-address">Address</Label>
                <Textarea
                  id="b-address"
                  rows={2}
                  value={editing.address}
                  onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                  placeholder="Street, city, state"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="b-phone">Phone</Label>
                  <Input
                    id="b-phone"
                    value={editing.phone}
                    onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="b-manager">Manager</Label>
                  <Select
                    value={
                      editing.manager && editing.manager.trim() && editing.manager !== "Unassigned"
                        ? cleanManagerName(editing.manager)
                        : "Unassigned"
                    }
                    onValueChange={(v) =>
                      setEditing({ ...editing, manager: v === "Unassigned" ? "" : v })
                    }
                  >
                    <SelectTrigger id="b-manager" className="w-full">
                      <SelectValue placeholder="Select manager" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Unassigned">Unassigned (No Manager)</SelectItem>
                      {managerList.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editing.status}
                    onValueChange={(v: BranchStatus) => setEditing({ ...editing, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="temporarily-closed">Temporarily closed</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="b-menu">Menu ID</Label>
                  <Input
                    id="b-menu"
                    value={editing.menuId}
                    onChange={(e) => setEditing({ ...editing, menuId: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border bg-background/60 p-4">
                <div>
                  <div className="text-sm font-medium">Default branch</div>
                  <div className="text-xs text-muted-foreground">
                    Used as the main storefront across the app.
                  </div>
                </div>
                <Switch
                  checked={editing.isDefault}
                  disabled={editing.isDefault && branches.length <= 1}
                  onCheckedChange={(v) => {
                    if (!v && branches.length <= 1) {
                      toast.error("At least one default branch is required.");
                      return;
                    }
                    setEditing({ ...editing, isDefault: v });
                  }}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="gradient-warm text-primary-foreground shadow-elegant"
              onClick={saveBranch}
            >
              Save branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this branch?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the branch and its dedicated menu link. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete branch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Branch QR */}
      <BranchQrDialog branch={qrBranch} onClose={() => setQrBranch(null)} />
    </div>
  );
}

type TableItem = {
  id: string;
  tableNo: string;
  zone: string;
};

function BranchQrDialog({ branch, onClose }: { branch: Branch | null; onClose: () => void }) {
  const [tables, setTables] = useState<TableItem[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newTableNo, setNewTableNo] = useState("");
  const [newTableZone, setNewTableZone] = useState("MAIN ROOM");
  const [restaurantSlug, setRestaurantSlug] = useState<string>("");

  useEffect(() => {
    if (!branch) return;
    const currentBranchId = branch.id;
    async function loadTables() {
      try {
        const [dbTables, tenantRes] = await Promise.all([
          getBranchTablesServer({ data: currentBranchId }).catch(() => []),
          getCurrentTenantSlugServer().catch(() => null),
        ]);

        setTables(Array.isArray(dbTables) ? dbTables : []);

        if (tenantRes && tenantRes.slug) {
          setRestaurantSlug(tenantRes.slug);
        }
      } catch {
        const dbTables = await getBranchTablesServer({ data: currentBranchId }).catch(() => []);
        setTables(Array.isArray(dbTables) ? dbTables : []);
      }
    }
    loadTables();
  }, [branch]);

  const addTable = async () => {
    const nextNo = newTableNo.trim() || String(tables.length + 1).padStart(2, "0");
    const newTable: TableItem = {
      id: generateId(),
      tableNo: nextNo,
      zone: newTableZone || "MAIN ROOM",
    };
    const nextTables = [...tables, newTable];
    if (branch) {
      try {
        const res = await saveBranchTablesServer({
          data: {
            branchId: branch.id,
            tables: nextTables,
          },
        });
        if (res && typeof res === "object" && "success" in res && !(res as any).success) {
          toast.error((res as any).error || "Failed to save table QR code");
          return;
        }
        setTables(nextTables);
        setNewTableNo("");
        setAddDialogOpen(false);
        toast.success(`Table ${nextNo} added`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to add table QR code";
        toast.error(msg);
      }
    }
  };

  const deleteTable = async (id: string, num: string) => {
    const nextTables = tables.filter((t) => t.id !== id);
    setTables(nextTables);
    if (branch) {
      try {
        await saveBranchTablesServer({
          data: {
            branchId: branch.id,
            tables: nextTables,
          },
        });
      } catch {
        /* ignore */
      }
    }
    toast.success(`Table ${num} deleted`);
  };

  const getTableUrl = (tNo: string, tableId?: string) => {
    if (!branch) return "";
    const username = restaurantSlug || "burgercraft";
    const bId = branch.menuId || branch.id || branch.name;
    const tId = tableId || tNo;
    return getEncryptedTableUrl(username, bId, tId);
  };

  const downloadTableQr = (tableNo: string, canvasId: string) => {
    const el = document.getElementById(canvasId);
    const canvas = el?.querySelector("canvas");
    if (!canvas || !branch) return;
    const link = document.createElement("a");
    link.download = `${branch.name.replace(/\s+/g, "-").toLowerCase()}-table-${tableNo}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast.success(`Downloaded Table ${tableNo} QR`);
  };

  const copyUrl = async (url: string, tableNo: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`Table ${tableNo} link copied`);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  if (!branch) return null;

  return (
    <Dialog open={branch !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl rounded-3xl bg-background p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-200/60">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-100/80 text-amber-600 border border-amber-200/60 shadow-2xs">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-gray-900 leading-tight">
                Dining Tables — {branch.name}
              </h2>
              <p className="text-xs font-medium text-gray-500 mt-0.5">
                {branch.address || "Location details"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => setAddDialogOpen(true)}
              className="gradient-warm text-white font-bold px-4 py-2 rounded-full shadow-sm text-xs hover:opacity-90 transition cursor-pointer"
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add Table
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full border border-gray-200 bg-white text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition cursor-pointer shadow-xs"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Table Cards Grid wrapped in ScrollArea */}
        <ScrollArea className="max-h-[60vh] pr-3 my-2">
          {tables.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-2xl p-8 bg-gray-50/50">
              <QrCode className="mx-auto h-10 w-10 text-gray-400/80 mb-3" />
              <h4 className="text-sm font-bold text-gray-900">No Dining Tables Created</h4>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto mb-4">
                No default QR codes exist for this branch. Click "Add Table" to create dedicated QR
                codes for your dining tables.
              </p>
              <Button
                onClick={() => setAddDialogOpen(true)}
                className="gradient-warm text-white font-bold px-4 py-2 rounded-full shadow-sm text-xs cursor-pointer"
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add Table
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 p-1">
              {tables.map((t) => {
                const url = getTableUrl(t.tableNo, t.id);
                const canvasId = `qr-card-canvas-${t.id}`;

                return (
                  <div
                    key={t.id}
                    className="group relative bg-white border border-blue-100/70 rounded-xl p-2 shadow-2xs flex flex-col items-center justify-between gap-1.5 hover:border-amber-400 hover:shadow-md transition"
                  >
                    {/* Top right edit/delete controls */}
                    <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition z-10">
                      <button
                        type="button"
                        onClick={() => copyUrl(url, t.tableNo)}
                        title="Copy Link"
                        className="p-1 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
                      >
                        <Copy className="h-2.5 w-2.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadTableQr(t.tableNo, canvasId)}
                        title="Download PNG"
                        className="p-1 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
                      >
                        <Download className="h-2.5 w-2.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTable(t.id, t.tableNo)}
                        title="Delete Table"
                        className="p-1 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>

                    {/* QR Box */}
                    <div className="bg-gray-50/60 border border-gray-100/80 rounded-lg p-1.5 w-full flex items-center justify-center relative">
                      <div
                        id={canvasId}
                        className="bg-white p-1 rounded-md border border-gray-100 shadow-2xs relative"
                      >
                        <QRCodeCanvas value={url} size={85} level="H" includeMargin={false} />
                      </div>
                    </div>

                    {/* Table Label & Zone Subtitle */}
                    <div className="text-center w-full">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 font-display text-[11px] font-bold text-gray-900 hover:text-amber-600 transition"
                      >
                        Table {t.tableNo} <ExternalLink className="h-2 w-2 text-gray-400" />
                      </a>
                      <div className="text-[9px] font-extrabold tracking-wider text-orange-500 uppercase mt-0.5 truncate">
                        {t.zone}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="pt-4 border-t border-gray-200/60 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => {
              window.print();
            }}
            className="border-gray-200 text-gray-700 text-xs font-semibold rounded-full"
          >
            <Printer className="mr-1.5 h-3.5 w-3.5 text-gray-500" /> Print Sheet
          </Button>

          <Button
            onClick={onClose}
            className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold px-6 py-2 rounded-full shadow-2xs text-xs cursor-pointer"
          >
            Close Manager
          </Button>
        </div>

        {/* Add Table Sub-Dialog */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent className="max-w-sm rounded-2xl p-5">
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-bold">
                Add New Dining Table
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label className="text-xs font-bold">Table Number</Label>
                <Input
                  value={newTableNo}
                  onChange={(e) => setNewTableNo(e.target.value)}
                  placeholder={`e.g. ${String(tables.length + 1).padStart(2, "0")}`}
                  className="mt-1 bg-white border-gray-200 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-bold">Location / Zone</Label>
                <Select value={newTableZone} onValueChange={setNewTableZone}>
                  <SelectTrigger className="mt-1 bg-white border-gray-200 text-sm">
                    <SelectValue placeholder="Select Zone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MAIN ROOM">MAIN ROOM</SelectItem>
                    <SelectItem value="WINDOW SIDE">WINDOW SIDE</SelectItem>
                    <SelectItem value="TERRACE">TERRACE</SelectItem>
                    <SelectItem value="PATIO">PATIO</SelectItem>
                    <SelectItem value="VIP ROOM">VIP ROOM</SelectItem>
                    <SelectItem value="OUTDOOR">OUTDOOR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAddDialogOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button onClick={addTable} className="gradient-warm text-white text-xs font-bold">
                Create Table
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
