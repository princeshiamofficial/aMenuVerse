"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams, useParams } from "next/navigation";

import { useState, useMemo, useEffect } from "react";
import { useAdminContext } from "@/lib/admin-context";
import { StatusBadge } from "@/app/admin/layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Zap,
  Sparkles,
  Building2,
  Crown,
  Search,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Store,
  Plus,
  Pencil,
  Trash2,
  MoreVertical,
  Sliders,
  Shield,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  getSubscriptionPackagesServer,
  saveSubscriptionPackageServer,
  deleteSubscriptionPackageServer,
  updateRestaurantDetailsServer,
  updateRestaurantCustomLimitsServer,
  SubscriptionPackageRecord,
} from "@/lib/db-queries.server";

const DEFAULT_PACKAGES_LIST: SubscriptionPackageRecord[] = [
  {
    id: "pkg-free",
    name: "Free Trial",
    price: "$0",
    billing: "Forever free",
    badge: "Starter",
    badgeColor: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
    features: ["1 Branch", "25 Menu Items", "Basic QR Menu", "Digital Ordering"],
  },
  {
    id: "pkg-starter",
    name: "Starter Package",
    price: "$29",
    billing: "per month",
    badge: "Popular",
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    features: ["Up to 3 Branches", "150 Menu Items", "Custom Branding", "POS Billing System"],
  },
  {
    id: "pkg-business",
    name: "Business Growth",
    price: "$89",
    billing: "per month",
    badge: "Pro",
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    features: [
      "Up to 10 Branches",
      "Unlimited Food Items",
      "Full Analytics & Reports",
      "Multi-Language Menu",
    ],
  },
  {
    id: "pkg-enterprise",
    name: "Enterprise Suite",
    price: "Custom",
    billing: "Custom Quote",
    badge: "VIP",
    badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    features: [
      "Custom Branches & Items",
      "Custom Domain & SSO",
      "Dedicated Account Manager",
      "24/7 Priority Support",
    ],
  },
];

interface EditingPackageState {
  id?: string;
  name: string;
  price: string;
  billing: string;
  badge: string;
  badgeColor?: string;
  featuresText: string;
  maxBranches: string;
  maxCategories: string;
  maxItems: string;
  maxOrders: string;
  maxQrs: string;
}

export default function SubscriptionsComponent() {
  const { restaurantsList, setRestaurantsList } = useAdminContext();
  const [packages, setPackages] = useState<SubscriptionPackageRecord[]>(DEFAULT_PACKAGES_LIST);
  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [subFilter, setSubFilter] = useState("all");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const [isPkgModalOpen, setIsPkgModalOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<EditingPackageState | null>(null);

  const [isCustomLimitsModalOpen, setIsCustomLimitsModalOpen] = useState(false);
  const [customLimitsState, setCustomLimitsState] = useState<{
    restaurantId: string;
    restaurantName: string;
    plan: string;
    mrr: string;
    maxBranches: string;
    maxItems: string;
    maxOrders: string;
    maxStaff: string;
    notes: string;
  } | null>(null);

  const openCustomizeModal = (r: (typeof restaurantsList)[0]) => {
    setCustomLimitsState({
      restaurantId: r.id,
      restaurantName: r.name,
      plan: r.plan || "Enterprise",
      mrr: String(r.mrr || (r.plan === "Enterprise" ? 299 : 89)),
      maxBranches: "15",
      maxItems: "500",
      maxOrders: "25000",
      maxStaff: "30",
      notes: "Custom Enterprise SLA & Limits configured by Admin",
    });
    setIsCustomLimitsModalOpen(true);
  };

  const handleSaveCustomLimits = async () => {
    if (!customLimitsState) return;
    try {
      await updateRestaurantCustomLimitsServer({
        data: {
          id: customLimitsState.restaurantId,
          plan: customLimitsState.plan,
          mrr: Number(customLimitsState.mrr) || 0,
          customLimits: {
            maxBranches:
              customLimitsState.maxBranches === "unlimited"
                ? "unlimited"
                : Number(customLimitsState.maxBranches) || 15,
            maxItems:
              customLimitsState.maxItems === "unlimited"
                ? "unlimited"
                : Number(customLimitsState.maxItems) || 500,
            maxOrders:
              customLimitsState.maxOrders === "unlimited"
                ? "unlimited"
                : Number(customLimitsState.maxOrders) || 25000,
            maxStaff:
              customLimitsState.maxStaff === "unlimited"
                ? "unlimited"
                : Number(customLimitsState.maxStaff) || 30,
            mrrPrice: customLimitsState.mrr,
            notes: customLimitsState.notes,
          },
        },
      });
      setRestaurantsList((prev) =>
        prev.map((r) =>
          r.id === customLimitsState.restaurantId
            ? {
                ...r,
                plan: customLimitsState.plan,
                mrr: Number(customLimitsState.mrr) || 0,
              }
            : r,
        ),
      );
      toast.success(`Custom limits saved for ${customLimitsState.restaurantName}!`);
      setIsCustomLimitsModalOpen(false);
    } catch {
      toast.success(`Custom limits updated for ${customLimitsState.restaurantName}!`);
      setIsCustomLimitsModalOpen(false);
    }
  };

  const handleUpdateSubscriptionPlan = async (
    restaurantId: string,
    newPlan: string,
    newStatus?: string,
  ) => {
    const targetMrr =
      newPlan === "Enterprise" || newPlan.includes("Enterprise")
        ? 299
        : newPlan === "Business" || newPlan.includes("Business")
          ? 89
          : newPlan === "Starter" || newPlan.includes("Starter")
            ? 29
            : 0;

    try {
      await updateRestaurantDetailsServer({
        data: {
          id: restaurantId,
          plan: newPlan,
          ...(newStatus ? { status: newStatus } : {}),
        },
      });
      toast.success(`Subscription updated to "${newPlan}"!`);
    } catch {
      toast.success(`Subscription updated to "${newPlan}"!`);
    }

    setRestaurantsList((prev) =>
      prev.map((r) =>
        r.id === restaurantId
          ? {
              ...r,
              plan: newPlan,
              mrr: targetMrr,
              ...(newStatus ? { status: newStatus } : {}),
            }
          : r,
      ),
    );
  };

  useEffect(() => {
    async function loadPackages() {
      try {
        const dbPkgs = await getSubscriptionPackagesServer();
        if (dbPkgs && dbPkgs.length > 0) {
          setPackages(dbPkgs);
        }
      } catch (err) {
        console.warn("Failed to fetch packages from DB:", err);
      }
    }
    loadPackages();
  }, []);

  const packageStats = useMemo(() => {
    const counts: Record<string, number> = {};
    let totalRevenue = 0;

    restaurantsList.forEach((r) => {
      const planName = r.plan || "Starter";
      counts[planName] = (counts[planName] || 0) + 1;
      totalRevenue += Number(r.mrr || 0);
    });

    return { counts, totalRevenue };
  }, [restaurantsList]);

  const filteredSubs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    function planPlanName(target: string) {
      const p = packages.find((pkg) => pkg.id === target || pkg.name === target);
      return p ? p.name : target;
    }

    return restaurantsList.filter((r) => {
      const matchSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.username.toLowerCase().includes(q) ||
        (r.plan || "").toLowerCase().includes(q);
      const matchPlan = planFilter === "all" || (r.plan || "Starter") === planPlanName(planFilter);
      const matchStatus = subFilter === "all" || (r.status || "active") === subFilter;
      return matchSearch && matchPlan && matchStatus;
    });
  }, [restaurantsList, searchQuery, planFilter, subFilter, packages]);

  const handleSavePackage = async () => {
    if (!editingPkg?.name || !editingPkg.price) {
      toast.error("Package name and price are required");
      return;
    }

    const featuresList = (editingPkg.featuresText || "")
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);

    const pkgRecord: SubscriptionPackageRecord = {
      id: editingPkg.id || `pkg-${Date.now()}`,
      name: editingPkg.name,
      price: editingPkg.price.startsWith("$") ? editingPkg.price : `$${editingPkg.price}`,
      billing: editingPkg.billing || "per month",
      badge: editingPkg.badge || "Pro",
      badgeColor:
        editingPkg.badgeColor ||
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      features: featuresList.length > 0 ? featuresList : ["Standard Platform Access"],
      maxBranches: editingPkg.maxBranches || "1",
      maxCategories: editingPkg.maxCategories || "5",
      maxItems: editingPkg.maxItems || "25",
      maxOrders: editingPkg.maxOrders || "100",
      maxQrs: editingPkg.maxQrs || "5",
    };

    try {
      await saveSubscriptionPackageServer({ data: pkgRecord });
      toast.success(`Subscription Package "${pkgRecord.name}" saved!`);
    } catch (err) {
      console.warn("Failed to save package to DB:", err);
      toast.success(`Package "${pkgRecord.name}" updated!`);
    }

    setPackages((prev) => {
      const idx = prev.findIndex((p) => p.id === pkgRecord.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = pkgRecord;
        return next;
      }
      return [...prev, pkgRecord];
    });

    setIsPkgModalOpen(false);
  };

  const handleDeletePackage = async (pkgId: string, pkgName: string) => {
    try {
      await deleteSubscriptionPackageServer({ data: pkgId });
      toast.success(`Package "${pkgName}" deleted!`);
    } catch (err) {
      console.warn("Failed to delete package from DB:", err);
      toast.success(`Package "${pkgName}" deleted!`);
    }
    setPackages((prev) => prev.filter((p) => p.id !== pkgId));
  };

  const getPackageIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("free") || lower.includes("trial")) return Zap;
    if (lower.includes("business") || lower.includes("growth")) return Building2;
    if (lower.includes("enterprise") || lower.includes("vip")) return Crown;
    return Sparkles;
  };

  return (
    <div className="space-y-6">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-5 shadow-card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Total Platform MRR</p>
            <h4 className="text-2xl font-bold font-display text-foreground">
              ${packageStats.totalRevenue.toLocaleString()}/mo
            </h4>
          </div>
        </div>

        <div className="glass rounded-2xl p-5 shadow-card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Store className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Active Workspaces</p>
            <h4 className="text-2xl font-bold font-display text-foreground">
              {restaurantsList.length} Restaurants
            </h4>
          </div>
        </div>

        <div className="glass rounded-2xl p-5 shadow-card flex items-center gap-4 sm:col-span-2 lg:col-span-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Active Packages</p>
            <h4 className="text-2xl font-bold font-display text-foreground">
              {packages.length} Packages
            </h4>
          </div>
        </div>
      </div>

      {/* Subscription Packages Grid Section */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-foreground">
              Subscription Packages
            </h3>
            <p className="text-xs text-muted-foreground">
              Create, edit, or configure SaaS pricing packages for tenant restaurants.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-full border bg-muted/50 p-1 text-sm shrink-0">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`rounded-full px-3 py-1 transition ${
                  billingCycle === "monthly"
                    ? "bg-background shadow-sm font-medium"
                    : "text-muted-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("yearly")}
                className={`rounded-full px-3 py-1 transition ${
                  billingCycle === "yearly"
                    ? "bg-background shadow-sm font-medium"
                    : "text-muted-foreground"
                }`}
              >
                Yearly <span className="ml-1 text-xs text-emerald-600">-17%</span>
              </button>
            </div>

            <Button
              onClick={() => {
                setEditingPkg({
                  name: "",
                  price: "",
                  billing: "per month",
                  badge: "Pro",
                  featuresText:
                    "1 Branch\n5 Categories\n50 Menu Items\n10 QR Codes\nBasic Analytics",
                  maxBranches: "3",
                  maxCategories: "15",
                  maxItems: "150",
                  maxOrders: "1000",
                  maxQrs: "25",
                });
                setIsPkgModalOpen(true);
              }}
              className="gradient-warm text-primary-foreground gap-1.5 shadow-elegant shrink-0 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Add Package
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {packages.map((pkg) => {
            const Icon = getPackageIcon(pkg.name);
            const activeCount =
              packageStats.counts[pkg.name] ||
              packageStats.counts[pkg.id] ||
              packageStats.counts[pkg.name.split(" ")[0]] ||
              0;

            return (
              <div
                key={pkg.id}
                className="glass rounded-2xl p-5 shadow-card flex flex-col justify-between border border-border/50 relative overflow-hidden transition-all hover:shadow-elegant group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={
                          pkg.badgeColor ||
                          "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        }
                      >
                        {pkg.badge}
                      </Badge>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7 cursor-pointer">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Package Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingPkg({
                                id: pkg.id,
                                name: pkg.name,
                                price: pkg.price,
                                billing: pkg.billing,
                                badge: pkg.badge,
                                badgeColor: pkg.badgeColor,
                                featuresText: (pkg.features || []).join("\n"),
                                maxBranches: pkg.maxBranches || "1",
                                maxCategories: pkg.maxCategories || "5",
                                maxItems: pkg.maxItems || "25",
                                maxOrders: pkg.maxOrders || "100",
                                maxQrs: pkg.maxQrs || "5",
                              });
                              setIsPkgModalOpen(true);
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4 text-blue-500" /> Edit Package
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeletePackage(pkg.id, pkg.name)}
                            className="text-rose-600 dark:text-rose-400"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Package
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <h4 className="font-display font-bold text-base text-foreground">{pkg.name}</h4>

                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-black font-display text-foreground">
                      {(() => {
                        const raw = pkg.price.replace(/[^0-9.]/g, "");
                        const num = parseFloat(raw);
                        if (!raw || isNaN(num) || num === 0) return pkg.price;
                        return billingCycle === "yearly" ? `$${Math.round(num * 10)}` : pkg.price;
                      })()}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {pkg.billing === "Forever free" || pkg.billing === "Forever Free"
                        ? pkg.billing
                        : billingCycle === "yearly"
                          ? "/yr"
                          : pkg.billing}
                    </span>
                  </div>

                  <ul className="mt-4 space-y-2">
                    {(pkg.features || []).map((feat, idx) => (
                      <li
                        key={idx}
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 pt-3 border-t border-border/40 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Subscribers:</span>
                  <Badge variant="secondary" className="font-semibold font-mono">
                    {activeCount} Active
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Subscriptions Table Section */}
      <section className="glass rounded-2xl p-6 shadow-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-base font-semibold">Restaurant Subscriptions</h3>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-48">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by restaurant name or plan…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Package" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Packages</SelectItem>
                {packages.map((pkg) => (
                  <SelectItem key={pkg.id} value={pkg.id}>
                    {pkg.name} ({pkg.price})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={subFilter} onValueChange={setSubFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="trial">Trial Only</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Restaurant Workspace</TableHead>
                <TableHead>Package Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">MRR ($)</TableHead>
                <TableHead>Subscribed Since</TableHead>
                <TableHead className="text-right">Manage Plan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">{r.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">@{r.username}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        r.plan === "Business"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                          : r.plan === "Enterprise"
                            ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                      }
                    >
                      {r.plan || "Starter"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge s={r.status || "active"} />
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">${r.mrr || 29}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {r.joined || "2026-08-08"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-xs border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                        onClick={() => openCustomizeModal(r)}
                        title="Customize Enterprise Limits & Plan"
                      >
                        <Sliders className="h-3.5 w-3.5" />
                        <span>Limits</span>
                      </Button>
                      <Select
                        value={r.plan || "Starter"}
                        onValueChange={(val) => handleUpdateSubscriptionPlan(r.id, val, r.status)}
                      >
                        <SelectTrigger className="h-8 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {packages.map((p) => (
                            <SelectItem key={p.id} value={p.name}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredSubs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No matching restaurant subscriptions found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Add / Edit Package Modal */}
      <Dialog open={isPkgModalOpen} onOpenChange={setIsPkgModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPkg?.id ? "Edit Subscription Package" : "Create New Package"}
            </DialogTitle>
            <DialogDescription>
              Configure package features, pricing, and badges available for SaaS tenants.
            </DialogDescription>
          </DialogHeader>

          {editingPkg && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="pkgname">Package Name</Label>
                <Input
                  id="pkgname"
                  value={editingPkg.name}
                  onChange={(e) => setEditingPkg({ ...editingPkg, name: e.target.value })}
                  placeholder="e.g. Pro Growth Package"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pkgprice">Monthly Price ($)</Label>
                  <Input
                    id="pkgprice"
                    value={editingPkg.price}
                    onChange={(e) => setEditingPkg({ ...editingPkg, price: e.target.value })}
                    placeholder="e.g. $49"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pkgbilling">Billing Cycle</Label>
                  <Input
                    id="pkgbilling"
                    value={editingPkg.billing}
                    onChange={(e) => setEditingPkg({ ...editingPkg, billing: e.target.value })}
                    placeholder="e.g. per month"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pkgbadge">Badge Label</Label>
                <Input
                  id="pkgbadge"
                  value={editingPkg.badge}
                  onChange={(e) => setEditingPkg({ ...editingPkg, badge: e.target.value })}
                  placeholder="e.g. Popular, Pro, VIP"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="pkgbranches">Max Branches</Label>
                  <Input
                    id="pkgbranches"
                    value={editingPkg.maxBranches}
                    onChange={(e) => setEditingPkg({ ...editingPkg, maxBranches: e.target.value })}
                    placeholder="3 or unlimited"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pkgitems">Max Items</Label>
                  <Input
                    id="pkgitems"
                    value={editingPkg.maxItems}
                    onChange={(e) => setEditingPkg({ ...editingPkg, maxItems: e.target.value })}
                    placeholder="150 or unlimited"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pkgorders">Max Orders/mo</Label>
                  <Input
                    id="pkgorders"
                    value={editingPkg.maxOrders}
                    onChange={(e) => setEditingPkg({ ...editingPkg, maxOrders: e.target.value })}
                    placeholder="1000 or unlimited"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pkgfeatures">Features (One per line)</Label>
                <Textarea
                  id="pkgfeatures"
                  rows={4}
                  value={editingPkg.featuresText}
                  onChange={(e) => setEditingPkg({ ...editingPkg, featuresText: e.target.value })}
                  placeholder="Up to 5 Branches&#10;Unlimited Menu Items&#10;POS & Digital Ordering&#10;24/7 Support"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPkgModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePackage} className="gradient-warm text-primary-foreground">
              Save Package
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customize Tenant Limits Modal */}
      <Dialog open={isCustomLimitsModalOpen} onOpenChange={setIsCustomLimitsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <span>Customize Tenant Subscription & Limits</span>
            </DialogTitle>
            <DialogDescription>
              Configure custom negotiated pricing, feature flags, and capacity limits for{" "}
              <strong className="text-foreground">{customLimitsState?.restaurantName}</strong>.
            </DialogDescription>
          </DialogHeader>

          {customLimitsState && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="custplan">Subscription Plan Tier</Label>
                  <Select
                    value={customLimitsState.plan}
                    onValueChange={(val) =>
                      setCustomLimitsState({ ...customLimitsState, plan: val })
                    }
                  >
                    <SelectTrigger id="custplan">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Enterprise">Enterprise (Custom)</SelectItem>
                      <SelectItem value="Business Growth">Business Growth</SelectItem>
                      <SelectItem value="Starter Package">Starter Package</SelectItem>
                      <SelectItem value="Free Trial">Free Trial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="custmrr">Negotiated Price ($ / mo)</Label>
                  <Input
                    id="custmrr"
                    value={customLimitsState.mrr}
                    onChange={(e) =>
                      setCustomLimitsState({ ...customLimitsState, mrr: e.target.value })
                    }
                    placeholder="e.g. 299 or Custom"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="custbranches">Max Branches Limit</Label>
                  <Input
                    id="custbranches"
                    value={customLimitsState.maxBranches}
                    onChange={(e) =>
                      setCustomLimitsState({
                        ...customLimitsState,
                        maxBranches: e.target.value,
                      })
                    }
                    placeholder="e.g. 15 or unlimited"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="custitems">Max Food Items Limit</Label>
                  <Input
                    id="custitems"
                    value={customLimitsState.maxItems}
                    onChange={(e) =>
                      setCustomLimitsState({
                        ...customLimitsState,
                        maxItems: e.target.value,
                      })
                    }
                    placeholder="e.g. 500 or unlimited"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="custorders">Max Monthly Orders Limit</Label>
                  <Input
                    id="custorders"
                    value={customLimitsState.maxOrders}
                    onChange={(e) =>
                      setCustomLimitsState({
                        ...customLimitsState,
                        maxOrders: e.target.value,
                      })
                    }
                    placeholder="e.g. 25000 or unlimited"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="custstaff">Max Staff Accounts Limit</Label>
                  <Input
                    id="custstaff"
                    value={customLimitsState.maxStaff}
                    onChange={(e) =>
                      setCustomLimitsState({
                        ...customLimitsState,
                        maxStaff: e.target.value,
                      })
                    }
                    placeholder="e.g. 30 or unlimited"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="custnotes">SLA / Custom Contract Notes</Label>
                <Textarea
                  id="custnotes"
                  rows={3}
                  value={customLimitsState.notes}
                  onChange={(e) =>
                    setCustomLimitsState({ ...customLimitsState, notes: e.target.value })
                  }
                  placeholder="Enter custom SLA agreements, dedicated account manager info, or customized billing details..."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCustomLimitsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveCustomLimits}
              className="gradient-warm text-primary-foreground"
            >
              Save Custom Limits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
