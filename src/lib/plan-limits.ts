export interface SubscriptionPackageRecord {
  id: string;
  name: string;
  price: string;
  billing: string;
  badge: string;
  badgeColor?: string;
  features: string[];
  maxBranches?: string;
  maxCategories?: string;
  maxItems?: string;
  maxOrders?: string;
  maxQrs?: string;
}

export function resolvePlanLimits(
  planName: string,
  packagesList: SubscriptionPackageRecord[] = [],
): {
  maxBranches: number | "unlimited";
  maxCategories: number | "unlimited";
  maxItems: number | "unlimited";
  maxOrders: number | "unlimited";
  maxQrs: number | "unlimited";
} {
  const norm = (planName || "Free").toLowerCase().trim();
  const matched = (packagesList || []).find(
    (p) =>
      p.name.toLowerCase().trim() === norm ||
      p.id.toLowerCase().includes(norm) ||
      norm.includes(p.name.toLowerCase().trim()),
  );

  if (matched) {
    return {
      maxBranches:
        matched.maxBranches === "unlimited"
          ? "unlimited"
          : Math.max(1, parseInt(matched.maxBranches || "1", 10)),
      maxCategories:
        matched.maxCategories === "unlimited"
          ? "unlimited"
          : Math.max(1, parseInt(matched.maxCategories || "5", 10)),
      maxItems:
        matched.maxItems === "unlimited"
          ? "unlimited"
          : Math.max(1, parseInt(matched.maxItems || "25", 10)),
      maxOrders:
        matched.maxOrders === "unlimited"
          ? "unlimited"
          : Math.max(1, parseInt(matched.maxOrders || "100", 10)),
      maxQrs:
        matched.maxQrs === "unlimited"
          ? "unlimited"
          : Math.max(1, parseInt(matched.maxQrs || "5", 10)),
    };
  }

  if (norm.includes("enterprise") || norm.includes("vip") || norm.includes("custom")) {
    return {
      maxBranches: "unlimited",
      maxCategories: "unlimited",
      maxItems: "unlimited",
      maxOrders: "unlimited",
      maxQrs: "unlimited",
    };
  }
  if (norm.includes("business") || norm.includes("pro") || norm.includes("growth")) {
    return {
      maxBranches: 10,
      maxCategories: "unlimited",
      maxItems: "unlimited",
      maxOrders: 10000,
      maxQrs: 100,
    };
  }
  if (norm.includes("starter") || norm.includes("popular")) {
    return {
      maxBranches: 3,
      maxCategories: 15,
      maxItems: 150,
      maxOrders: 1000,
      maxQrs: 25,
    };
  }

  // Free default
  return { maxBranches: 1, maxCategories: 5, maxItems: 25, maxOrders: 100, maxQrs: 5 };
}
