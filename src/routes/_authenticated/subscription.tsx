import { useEffect, useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Check,
  Sparkles,
  Lock,
  Download,
  CreditCard,
  TrendingUp,
  Zap,
  Building2,
  Crown,
  ArrowUpRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  getTenantSubscriptionServer,
  updateTenantSubscriptionServer,
  submitEnterpriseInquiryServer,
  getBranchesServer,
  getFoodItemsServer,
  getOrdersServer,
  getAnalyticsSummaryServer,
  getSubscriptionPackagesServer,
  SubscriptionPackageRecord,
  getCurrentUser,
} from "@/lib/db-queries.server";

type PlanId = string;

type Plan = {
  id: PlanId;
  name: string;
  price: number | "custom";
  tagline: string;
  icon: typeof Zap;
  features: string[];
  limits: {
    branches: number | "unlimited";
    items: number | "unlimited";
    orders: number | "unlimited";
  };
  highlight?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free Trial",
    price: 0,
    tagline: "Kick the tires with a single branch.",
    icon: Zap,
    features: ["1 branch", "Up to 25 menu items", "Basic QR menu", "Digital ordering"],
    limits: { branches: 1, items: 25, orders: 100 },
  },
  {
    id: "starter",
    name: "Starter Package",
    price: 29,
    tagline: "For growing single-location shops.",
    icon: Sparkles,
    features: [
      "Up to 3 branches",
      "Up to 150 menu items",
      "Custom branding",
      "POS Billing System",
      "Email support",
    ],
    limits: { branches: 3, items: 150, orders: 1000 },
  },
  {
    id: "business",
    name: "Business Growth",
    price: 89,
    tagline: "Multi-branch operations & full analytics.",
    icon: Building2,
    features: [
      "Up to 10 branches",
      "Unlimited menu items",
      "Full Analytics & Reports",
      "Multi-Language Menu",
      "Happy hour & seasonal menus",
      "Priority support",
    ],
    limits: { branches: 10, items: "unlimited", orders: 10000 },
    highlight: true,
  },
  {
    id: "enterprise",
    name: "Enterprise Suite",
    price: "custom",
    tagline: "Custom SLA, SSO & integrations — Contact Admin to activate.",
    icon: Crown,
    features: [
      "Custom branches & items",
      "Custom Domain & SSO",
      "Dedicated account manager",
      "Custom integrations",
      "99.9% uptime SLA",
      "24/7 phone support",
    ],
    limits: { branches: "unlimited", items: "unlimited", orders: "unlimited" },
  },
];

// Which features are locked per plan (used elsewhere in the app conceptually)
const FEATURE_MATRIX: { name: string; plans: PlanId[] }[] = [
  { name: "QR Digital Menu", plans: ["free", "starter", "business", "enterprise"] },
  { name: "Custom Branding", plans: ["starter", "business", "enterprise"] },
  { name: "Multi-Branch Management", plans: ["starter", "business", "enterprise"] },
  { name: "Advanced Analytics", plans: ["business", "enterprise"] },
  { name: "Happy Hour & Seasonal Menus", plans: ["business", "enterprise"] },
  { name: "Customer Feedback", plans: ["business", "enterprise"] },
  { name: "SSO & Audit Logs", plans: ["enterprise"] },
  { name: "Dedicated Success Manager", plans: ["enterprise"] },
];

type Invoice = {
  id: string;
  date: string;
  plan: string;
  amount: number;
  status: "paid" | "pending" | "failed";
};

const SAMPLE_INVOICES: Invoice[] = [
  { id: "INV-2026-0007", date: "2026-06-01", plan: "Business", amount: 49, status: "paid" },
  { id: "INV-2026-0006", date: "2026-05-01", plan: "Business", amount: 49, status: "paid" },
  { id: "INV-2026-0005", date: "2026-04-01", plan: "Business", amount: 49, status: "paid" },
  { id: "INV-2026-0004", date: "2026-03-01", plan: "Starter", amount: 19, status: "paid" },
  { id: "INV-2026-0003", date: "2026-02-01", plan: "Starter", amount: 19, status: "paid" },
  { id: "INV-2026-0002", date: "2026-01-01", plan: "Starter", amount: 19, status: "paid" },
];

const LS_KEY = "menuverse:subscription:plan";

// Simulated current usage
const USAGE = { branches: 3, items: 87, orders: 642, scans: 4210 };

function planRank(id: PlanId) {
  const norm = id.toLowerCase().replace("pkg-", "");
  const baseOrder = ["free", "starter", "business", "enterprise"];
  const idx = baseOrder.findIndex((b) => norm.includes(b));
  return idx !== -1 ? idx : 0;
}

function formatLimit(v: number | "unlimited") {
  return v === "unlimited" ? "∞" : String(v);
}

/** Convert admin-managed DB packages into the Plan shape used by the tenant UI */
function mapDbPackagesToPlans(pkgs: SubscriptionPackageRecord[]): Plan[] {
  const ORDER = ["pkg-free", "pkg-starter", "pkg-business", "pkg-enterprise"];
  const sortedPkgs = [...pkgs].sort((a, b) => {
    const idA = a.id.toLowerCase();
    const idB = b.id.toLowerCase();
    const ia = ORDER.findIndex((o) => idA.includes(o) || o.includes(idA));
    const ib = ORDER.findIndex((o) => idB.includes(o) || o.includes(idB));
    return (ia !== -1 ? ia : 99) - (ib !== -1 ? ib : 99);
  });

  const ICONS = [Zap, Sparkles, Building2, Crown];
  const popularIdx = sortedPkgs.findIndex((p) => p.badge?.toLowerCase() === "popular");
  const targetHighlightIdx = popularIdx !== -1 ? popularIdx : 1;

  return sortedPkgs.map((pkg, idx) => {
    const rawPrice = pkg.price.replace(/[^0-9.]/g, "");
    const numPrice = parseFloat(rawPrice);
    const price: number | "custom" =
      pkg.billing?.toLowerCase().includes("custom") ||
      pkg.price?.toLowerCase().includes("custom") ||
      isNaN(numPrice)
        ? "custom"
        : numPrice;

    // Explicit admin limits from DB (e.g. "3", "150", "unlimited")
    function parseLimit(
      val: string | undefined,
      fallback: number | "unlimited",
    ): number | "unlimited" {
      if (!val) return fallback;
      const clean = val.trim().toLowerCase();
      if (clean === "unlimited" || clean === "infinity" || clean === "∞") return "unlimited";
      const num = parseInt(clean, 10);
      return !isNaN(num) && num >= 0 ? num : fallback;
    }

    // Fallback: Infer limits from feature strings if explicit DB values are absent
    const featStr = pkg.features.join(" ");
    const branchMatch = featStr.match(/(\d+)\s*branch/i);
    const itemsUnlimited = featStr.toLowerCase().includes("unlimited");
    const itemsMatch = featStr.match(/(\d+)\s*menu\s*items?/i);
    const lastPkg = idx === sortedPkgs.length - 1;

    const fallbackBranches = lastPkg ? "unlimited" : branchMatch ? Number(branchMatch[1]) : 1;
    const fallbackItems = itemsUnlimited ? "unlimited" : itemsMatch ? Number(itemsMatch[1]) : 25;
    const fallbackOrders = lastPkg ? "unlimited" : idx === 0 ? 100 : idx === 1 ? 1000 : 10000;

    return {
      id: pkg.id,
      name: pkg.name,
      price,
      tagline: pkg.features[0] ?? "",
      icon: ICONS[idx] ?? Crown,
      features: pkg.features,
      highlight: idx === targetHighlightIdx,
      limits: {
        branches: parseLimit(pkg.maxBranches, fallbackBranches),
        items: parseLimit(pkg.maxItems, fallbackItems),
        orders: parseLimit(pkg.maxOrders, fallbackOrders),
      },
    };
  });
}

export const Route = createFileRoute("/_authenticated/subscription")({
  beforeLoad: async () => {
    const user = await getCurrentUser();
    const role = (user?.role || "").toLowerCase().trim().replace(/ /g, "_");
    if (role !== "owner" && role !== "super_admin" && role !== "superadmin") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: SubscriptionPage,
});

function SubscriptionPage() {
  const [currentPlan, setCurrentPlan] = useState<PlanId>("free");
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [pendingPlan, setPendingPlan] = useState<Plan | null>(null);
  const [isExpiredDowngraded, setIsExpiredDowngraded] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"plans" | "usage" | "billing">("plans");
  const [realBranchCount, setRealBranchCount] = useState<number>(USAGE.branches);
  const [realItemCount, setRealItemCount] = useState<number>(USAGE.items);
  const [realOrderCount, setRealOrderCount] = useState<number>(USAGE.orders);
  const [realScanCount, setRealScanCount] = useState<number>(USAGE.scans);
  const [dbPackages, setDbPackages] = useState<SubscriptionPackageRecord[]>([]);

  const plans = useMemo(
    () => (dbPackages.length > 0 ? mapDbPackagesToPlans(dbPackages) : PLANS),
    [dbPackages],
  );

  useEffect(() => {
    async function loadSub() {
      try {
        const data = await getTenantSubscriptionServer();
        if (data) {
          const isExpired =
            data.isExpiredDowngraded ||
            data.status === "expired" ||
            (data.expiresAt && new Date(data.expiresAt).getTime() < Date.now());

          if (isExpired) {
            const freeMatch = plans.find(
              (p) => p.id === "free" || p.id === "pkg-free" || p.name.toLowerCase() === "free",
            );
            setCurrentPlan(freeMatch ? freeMatch.id : "free");
            setIsExpiredDowngraded(true);
            toast.warning(
              "Your subscription has expired and was automatically moved to the Free plan.",
            );
          } else if (data.plan) {
            const pLower = data.plan.toLowerCase();
            const match = plans.find(
              (p) =>
                p.id === pLower ||
                p.id.replace("pkg-", "") === pLower ||
                p.name.toLowerCase().includes(pLower) ||
                pLower.includes(p.name.toLowerCase()),
            );
            if (match) setCurrentPlan(match.id);
            else setCurrentPlan(pLower);
          }

          if (data.expiresAt) {
            setExpiresAt(data.expiresAt);
          }
        }
      } catch (err) {
        console.warn("[Subscription] load error", err);
      }
    }

    async function loadBranchCount() {
      try {
        const rows = await getBranchesServer();
        if (Array.isArray(rows)) setRealBranchCount(rows.length);
      } catch {
        // keep default
      }
    }

    async function loadItemCount() {
      try {
        const rows = await getFoodItemsServer();
        if (Array.isArray(rows)) setRealItemCount(rows.length);
      } catch {
        // keep default
      }
    }

    async function loadOrderCount() {
      try {
        const rows = await getOrdersServer({ data: {} });
        if (Array.isArray(rows)) {
          const now = new Date();
          const thisMonth = rows.filter((o: Record<string, unknown>) => {
            const d = new Date(String(o.createdAt ?? ""));
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
          });
          setRealOrderCount(thisMonth.length);
        }
      } catch {
        // keep default
      }
    }

    async function loadScanCount() {
      try {
        const data = await getAnalyticsSummaryServer();
        if (data && typeof data.totalScans === "number") setRealScanCount(data.totalScans);
      } catch {
        // keep default
      }
    }

    async function loadPackages() {
      try {
        const pkgs = await getSubscriptionPackagesServer();
        if (pkgs && pkgs.length > 0) setDbPackages(pkgs);
      } catch {
        // keep PLANS fallback
      }
    }

    loadSub();
    loadBranchCount();
    loadItemCount();
    loadOrderCount();
    loadScanCount();
    loadPackages();
  }, [plans]);

  const current = useMemo(
    () => plans.find((p) => p.id === currentPlan) ?? plans[0]!,
    [currentPlan, plans],
  );

  const [enterpriseForm, setEnterpriseForm] = useState({
    branchesNeeded: "5+",
    itemsNeeded: "500+",
    contactPhone: "",
    contactEmail: "",
    notes: "",
  });

  const confirmChange = async () => {
    if (!pendingPlan) return;
    if (pendingPlan.price === "custom") {
      try {
        await submitEnterpriseInquiryServer({
          data: {
            contactPhone: enterpriseForm.contactPhone,
            contactEmail: enterpriseForm.contactEmail,
            estimatedBranches: enterpriseForm.branchesNeeded,
            estimatedItems: enterpriseForm.itemsNeeded,
            notes: enterpriseForm.notes,
          },
        });
        toast.success(
          "Enterprise custom plan request sent to Admin! We will configure your tailored subscription limits.",
        );
      } catch {
        toast.success(
          "Enterprise request received! Our sales team will reach out shortly to customize your limits.",
        );
      }
    } else {
      const isUpgrade = planRank(pendingPlan.id) > planRank(currentPlan);
      try {
        await updateTenantSubscriptionServer({
          data: {
            plan: pendingPlan.name,
            mrr: typeof pendingPlan.price === "number" ? pendingPlan.price : 0,
          },
        });
        setCurrentPlan(pendingPlan.id);
        setIsExpiredDowngraded(false);
        toast.success(
          isUpgrade
            ? `Successfully upgraded to ${pendingPlan.name} Plan!`
            : `Switched to ${pendingPlan.name} Plan!`,
        );
      } catch (err) {
        console.warn("Failed to update subscription in DB:", err);
        setCurrentPlan(pendingPlan.id);
        toast.success(`Plan updated to ${pendingPlan.name}`);
      }
    }
    setPendingPlan(null);
  };

  const downloadInvoice = (inv: Invoice) => {
    const content = [
      "MENUVERSE INVOICE",
      "=================",
      `Invoice #: ${inv.id}`,
      `Date:      ${inv.date}`,
      `Plan:      ${inv.plan}`,
      `Amount:    $${inv.amount}`,
      `Status:    ${inv.status.toUpperCase()}`,
      "=================",
      "Thank you for your business!",
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${inv.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${inv.id}`);
  };

  const yearlyMultiplier = 10; // 2 months free
  const displayPrice = (p: Plan) => {
    if (p.price === "custom") return "Custom";
    if (p.price === 0) return "$0";
    return billing === "monthly" ? `$${p.price}` : `$${p.price * yearlyMultiplier}`;
  };
  const displayPeriod = (p: Plan) =>
    p.price === "custom" || p.price === 0 ? "" : billing === "monthly" ? "/mo" : "/yr";

  return (
    <div
      className="-m-6 md:-m-8 p-6 md:p-8 min-h-screen space-y-6"
      style={{ backgroundColor: "#EEEFF2" }}
    >
      {isExpiredDowngraded && (
        <div className="glass rounded-2xl p-5 border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-600 shrink-0">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h5 className="font-bold text-sm">Subscription Expired — Auto-Moved to Free Plan</h5>
              <p className="text-xs opacity-90">
                Your previous subscription period has ended. Your workspace has been automatically
                moved to the Free plan. Choose a package below to upgrade.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Current plan strip */}
      <div className="glass mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl gradient-warm text-primary-foreground">
            <current.icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Current plan</p>
            <p className="font-display text-lg font-semibold">{current.name}</p>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {expiresAt ? (
            <span>
              Expires on <span className="font-medium text-foreground">{expiresAt}</span>
            </span>
          ) : (
            <span>
              Renewal Status: <span className="font-medium text-foreground">Active</span>
            </span>
          )}
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "plans" | "usage" | "billing")}
        className="w-full"
      >
        <div className="flex items-center justify-between gap-4">
          <TabsList className="grid max-w-lg grid-cols-3 flex-1">
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>
          {activeTab === "plans" && (
            <div className="inline-flex rounded-full border bg-muted/50 p-1 text-sm shrink-0">
              <button
                type="button"
                onClick={() => setBilling("monthly")}
                className={`rounded-full px-3 py-1 transition ${
                  billing === "monthly"
                    ? "bg-background shadow-sm font-medium"
                    : "text-muted-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBilling("yearly")}
                className={`rounded-full px-3 py-1 transition ${
                  billing === "yearly"
                    ? "bg-background shadow-sm font-medium"
                    : "text-muted-foreground"
                }`}
              >
                Yearly <span className="ml-1 text-xs text-emerald-600">-17%</span>
              </button>
            </div>
          )}
        </div>

        {/* Plans tab */}
        <TabsContent value="plans" className="mt-6 space-y-8">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((p, index) => {
              const isCurrent = p.id === currentPlan;
              const isUpgrade = planRank(p.id) > planRank(currentPlan);
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.08 }}
                  className="relative"
                >
                  {p.highlight && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -inset-px rounded-2xl opacity-70 blur-xl"
                      style={{
                        background:
                          "conic-gradient(from 180deg at 50% 50%, hsl(var(--primary)) 0deg, transparent 120deg, hsl(var(--primary)) 240deg, transparent 360deg)",
                      }}
                    />
                  )}
                  <div
                    className={`relative flex h-full flex-col rounded-2xl border p-6 backdrop-blur-xl ${
                      p.highlight
                        ? "border-primary/50 bg-linear-to-br from-background/95 to-primary/10 shadow-elegant"
                        : "border-border/60 bg-background/60 shadow-card"
                    }`}
                  >
                    {p.highlight && (
                      <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow-lg">
                        <Sparkles className="h-3 w-3" /> Most popular
                      </span>
                    )}

                    <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                      <p.icon className="h-4 w-4" />
                      <span className="text-xs font-medium uppercase tracking-wider">{p.name}</span>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-5xl font-bold tracking-tight">
                        {displayPrice(p)}
                      </span>
                      {displayPeriod(p) && (
                        <span className="text-sm text-muted-foreground">{displayPeriod(p)}</span>
                      )}
                    </div>

                    <p className="mt-3 text-sm text-muted-foreground">{p.tagline}</p>

                    <div className="my-5 h-px bg-linear-to-r from-transparent via-border to-transparent" />

                    <ul className="mb-6 flex-1 space-y-3 text-sm">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5">
                          <span
                            className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                              p.highlight
                                ? "bg-primary text-primary-foreground"
                                : "bg-primary/10 text-primary"
                            }`}
                          >
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                          <span className="text-foreground/90">{f}</span>
                        </li>
                      ))}
                    </ul>

                    {isCurrent ? (
                      <Button className="w-full" variant="outline" disabled>
                        Current plan
                      </Button>
                    ) : p.price === "custom" ? (
                      <Button
                        className="w-full"
                        variant={p.highlight ? "default" : "outline"}
                        onClick={() => setPendingPlan(p)}
                      >
                        Contact sales
                      </Button>
                    ) : (
                      <Button
                        className={`w-full ${p.highlight ? "gradient-warm text-primary-foreground shadow-elegant" : ""}`}
                        variant={p.highlight ? "default" : "outline"}
                        onClick={() => setPendingPlan(p)}
                      >
                        {isUpgrade ? (
                          <>
                            <ArrowUpRight className="mr-1 h-4 w-4" /> Choose Plan
                          </>
                        ) : (
                          "Choose Plan"
                        )}
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Feature matrix / feature lock */}
          <div className="glass rounded-2xl p-5 shadow-card">
            <h3 className="mb-4 font-display text-lg font-semibold">Feature availability</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feature</TableHead>
                    {plans.map((p) => (
                      <TableHead key={p.id} className="text-center">
                        {p.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {FEATURE_MATRIX.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      {plans.map((p, pIdx) => {
                        const normId = p.id.toLowerCase().replace("pkg-", "");
                        const normName = p.name.toLowerCase();
                        const standardTierList =
                          FEATURE_MATRIX.find((f) => f.name === row.name)?.plans || [];

                        // 1. Direct standard tier match
                        const isStandardMatch = standardTierList.some(
                          (rp) =>
                            normId.includes(rp) || rp.includes(normId) || normName.includes(rp),
                        );

                        // 2. Keyword match in package features text array
                        const featText = (p.features || []).join(" ").toLowerCase();
                        const rLower = row.name.toLowerCase();

                        let included = isStandardMatch;
                        if (!included) {
                          if (
                            rLower.includes("qr") &&
                            (featText.includes("qr") ||
                              featText.includes("digital") ||
                              featText.includes("menu"))
                          )
                            included = true;
                          else if (
                            rLower.includes("branding") &&
                            (featText.includes("brand") ||
                              featText.includes("logo") ||
                              featText.includes("custom"))
                          )
                            included = true;
                          else if (
                            rLower.includes("branch") &&
                            (featText.includes("branch") ||
                              (typeof p.limits.branches === "number" && p.limits.branches > 1) ||
                              p.limits.branches === "unlimited")
                          )
                            included = true;
                          else if (
                            rLower.includes("analytics") &&
                            (featText.includes("analytic") || featText.includes("report"))
                          )
                            included = true;
                          else if (
                            (rLower.includes("seasonal") || rLower.includes("happy")) &&
                            (featText.includes("happy") ||
                              featText.includes("season") ||
                              featText.includes("promo"))
                          )
                            included = true;
                          else if (
                            rLower.includes("feedback") &&
                            (featText.includes("feedback") || featText.includes("review"))
                          )
                            included = true;
                          else if (
                            rLower.includes("sso") &&
                            (featText.includes("sso") ||
                              featText.includes("audit") ||
                              featText.includes("enterprise"))
                          )
                            included = true;
                          else if (
                            rLower.includes("manager") &&
                            (featText.includes("manager") || featText.includes("dedicated"))
                          )
                            included = true;
                          else if (row.name === "QR Digital Menu") included = true;
                          else if (row.name === "Custom Branding")
                            included = pIdx >= 1 || featText.length > 0;
                          else if (row.name === "Multi-Branch Management")
                            included =
                              typeof p.limits.branches === "number"
                                ? p.limits.branches > 1
                                : p.limits.branches === "unlimited";
                          else if (row.name === "Advanced Analytics")
                            included = pIdx >= 2 || featText.includes("analytic");
                        }

                        const lockedOnCurrent = !included && p.id === currentPlan;
                        return (
                          <TableCell key={p.id} className="text-center">
                            {included ? (
                              <Check className="mx-auto h-4 w-4 text-emerald-600" />
                            ) : lockedOnCurrent ? (
                              <Lock className="mx-auto h-4 w-4 text-muted-foreground" />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> Locked features on your current plan can be unlocked by
              upgrading.
            </p>
          </div>
        </TabsContent>

        {/* Usage tab */}
        <TabsContent value="usage" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <UsageCard
              label="Branches"
              used={realBranchCount}
              limit={current.limits.branches}
              icon={Building2}
            />
            <UsageCard
              label="Menu items"
              used={realItemCount}
              limit={current.limits.items}
              icon={Sparkles}
            />
            <UsageCard
              label="Orders (this month)"
              used={realOrderCount}
              limit={current.limits.orders}
              icon={CreditCard}
            />
            <UsageCard label="QR scans" used={realScanCount} limit="unlimited" icon={TrendingUp} />
          </div>
          <div className="glass mt-6 rounded-2xl p-5 shadow-card">
            <h3 className="font-display text-lg font-semibold">Need more headroom?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Upgrading unlocks higher limits, advanced analytics and premium support.
            </p>
            <Button
              className="mt-4 gradient-warm text-primary-foreground shadow-elegant"
              onClick={() => {
                const next = plans.find(
                  (p) => planRank(p.id) > planRank(currentPlan) && p.price !== "custom",
                );
                if (next) setPendingPlan(next);
              }}
              disabled={currentPlan === "enterprise"}
            >
              <ArrowUpRight className="mr-1 h-4 w-4" /> Upgrade plan
            </Button>
          </div>
        </TabsContent>

        {/* Billing tab */}
        <TabsContent value="billing" className="mt-6">
          <div className="glass flex flex-col items-center justify-center rounded-2xl p-16 shadow-card text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl gradient-warm text-primary-foreground mb-5 shadow-elegant">
              <CreditCard className="h-8 w-8" />
            </div>
            <h3 className="font-display text-2xl font-bold mb-2">Billing — Coming Soon</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Payment method management and invoice history will be available once Stripe
              integration is live. Stay tuned!
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
              🚧 Under construction
            </span>
          </div>
          {/* TODO: Restore after Stripe integration
          <div className="glass rounded-2xl p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">Payment method</h3>
              <Button variant="outline" size="sm">
                Update card
              </Button>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background/50 p-4">
              <div className="inline-flex h-10 w-14 items-center justify-center rounded-md bg-muted font-mono text-xs font-semibold">
                VISA
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Visa ending in 4242</p>
                <p className="text-xs text-muted-foreground">Expires 08/28</p>
              </div>
              <Badge variant="secondary">Default</Badge>
            </div>
          </div>

          <div className="glass rounded-2xl p-5 shadow-card">
            <h3 className="mb-4 font-display text-lg font-semibold">Billing history</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SAMPLE_INVOICES.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs">{inv.id}</TableCell>
                      <TableCell>{new Date(inv.date).toLocaleDateString()}</TableCell>
                      <TableCell>{inv.plan}</TableCell>
                      <TableCell className="text-right">${inv.amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            inv.status === "paid"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                              : inv.status === "pending"
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                : "bg-red-500/15 text-red-700 dark:text-red-400"
                          }
                        >
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => downloadInvoice(inv)}>
                          <Download className="mr-1 h-4 w-4" /> Invoice
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          */}
        </TabsContent>
      </Tabs>

      {/* Confirm dialog */}
      <Dialog open={!!pendingPlan} onOpenChange={(o) => !o && setPendingPlan(null)}>
        <DialogContent className={pendingPlan?.price === "custom" ? "max-w-md" : "max-w-sm"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {pendingPlan?.price === "custom" && <Crown className="h-5 w-5 text-purple-600" />}
              <span>
                {pendingPlan?.price === "custom"
                  ? "Request Custom Enterprise Plan"
                  : planRank(pendingPlan?.id ?? "free") > planRank(currentPlan)
                    ? `Upgrade to ${pendingPlan?.name}`
                    : `Switch to ${pendingPlan?.name}`}
              </span>
            </DialogTitle>
            <DialogDescription>
              {pendingPlan?.price === "custom"
                ? "Enter your custom capacity requirements below. Our Admin team will tailor a dedicated proposal and edit your subscription limits."
                : `You'll be billed ${billing === "monthly" ? `$${pendingPlan?.price}/month` : `$${(pendingPlan?.price as number) * yearlyMultiplier}/year`} starting today.`}
            </DialogDescription>
          </DialogHeader>

          {pendingPlan?.price === "custom" ? (
            <div className="space-y-3.5 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="entbranches" className="text-xs">
                    Branches Needed
                  </Label>
                  <Input
                    id="entbranches"
                    value={enterpriseForm.branchesNeeded}
                    onChange={(e) =>
                      setEnterpriseForm({ ...enterpriseForm, branchesNeeded: e.target.value })
                    }
                    placeholder="e.g. 5 or 10+"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="entitems" className="text-xs">
                    Food Items Needed
                  </Label>
                  <Input
                    id="entitems"
                    value={enterpriseForm.itemsNeeded}
                    onChange={(e) =>
                      setEnterpriseForm({ ...enterpriseForm, itemsNeeded: e.target.value })
                    }
                    placeholder="e.g. 500+"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="entphone" className="text-xs">
                    Contact Phone
                  </Label>
                  <Input
                    id="entphone"
                    value={enterpriseForm.contactPhone}
                    onChange={(e) =>
                      setEnterpriseForm({ ...enterpriseForm, contactPhone: e.target.value })
                    }
                    placeholder="+880 1700-000000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="entemail" className="text-xs">
                    Contact Email
                  </Label>
                  <Input
                    id="entemail"
                    value={enterpriseForm.contactEmail}
                    onChange={(e) =>
                      setEnterpriseForm({ ...enterpriseForm, contactEmail: e.target.value })
                    }
                    placeholder="admin@restaurant.com"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="entnotes" className="text-xs">
                  Custom Requirements / Notes
                </Label>
                <Textarea
                  id="entnotes"
                  rows={3}
                  value={enterpriseForm.notes}
                  onChange={(e) => setEnterpriseForm({ ...enterpriseForm, notes: e.target.value })}
                  placeholder="Need custom domain, SSO integration, dedicated account manager, or custom POS setup..."
                />
              </div>
            </div>
          ) : (
            pendingPlan && (
              <ul className="space-y-2 text-sm">
                {pendingPlan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" /> {f}
                  </li>
                ))}
              </ul>
            )
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingPlan(null)}>
              Cancel
            </Button>
            <Button className="gradient-warm text-primary-foreground" onClick={confirmChange}>
              {pendingPlan?.price === "custom" ? "Send Request to Admin" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UsageCard({
  label,
  used,
  limit,
  icon: Icon,
}: {
  label: string;
  used: number;
  limit: number | "unlimited";
  icon: typeof Zap;
}) {
  const pct = limit === "unlimited" ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const nearLimit = limit !== "unlimited" && pct >= 80;
  return (
    <div className="glass rounded-2xl p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="h-4 w-4" /> {label}
        </div>
        {nearLimit && (
          <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
            Near limit
          </Badge>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="font-display text-2xl font-bold">{used.toLocaleString()}</span>
        <span className="text-sm text-muted-foreground">/ {formatLimit(limit)}</span>
      </div>
      {limit !== "unlimited" && <Progress value={pct} className="mt-3 h-2" />}
      {limit === "unlimited" && (
        <p className="mt-3 text-xs text-muted-foreground">Unlimited on your plan</p>
      )}
    </div>
  );
}
