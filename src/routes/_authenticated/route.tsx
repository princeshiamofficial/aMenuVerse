import {
  createFileRoute,
  Outlet,
  redirect,
  useRouteContext,
  useLocation,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getCurrentUser, getRestaurantProfile } from "@/lib/db-queries.server";
import { DashboardShell } from "@/components/menuverse/dashboard-shell";
import { useRealtime, playChime } from "@/lib/use-realtime";

import { SkeletonDashboard } from "@/components/menuverse/skeletons";

const PAGE_TITLE_MAP: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/restaurant-profile": "Restaurant Profile",
  "/food-items": "Food Items",
  "/categories": "Categories",
  "/orders": "Orders",
  "/pos": "POS Billing",
  "/reservations": "Reservations",
  "/branches": "Branches",
  "/staff": "Staff Management",
  "/kitchen": "Kitchen Display",
  "/waiter-panel": "Waiter Panel",
  "/promotions": "Promotions",
  "/subscription": "Subscription",
  "/analytics": "Analytics",
  "/settings": "Settings",
  "/menu-ai": "Menu AI",
  "/feedback": "Customer Feedback",
};

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    let token: string | undefined;
    if (typeof window !== "undefined") {
      token = localStorage.getItem("menuverse_session") || undefined;
    }
    const user = await getCurrentUser({ data: { token } });

    if (!user) {
      if (typeof window !== "undefined") {
        throw redirect({ to: "/auth" });
      }
      return { user: null };
    }

    // Role-Based Access Control (RBAC) path restrictions for tenant roles
    const role = (user.role || "").toLowerCase().trim().replace(/ /g, "_");
    const pathname = location.pathname;

    // Admin-only pages strictly restricted to Restaurant Owner / Super Admin only
    const isOwnerOrSuperAdmin = role === "owner" || role === "super_admin" || role === "superadmin";
    const isAdminOnlyRoute =
      pathname.startsWith("/restaurant-profile") ||
      pathname.startsWith("/branches") ||
      pathname.startsWith("/categories") ||
      pathname.startsWith("/food-items") ||
      pathname.startsWith("/subscription");

    if (isAdminOnlyRoute && !isOwnerOrSuperAdmin) {
      if (role === "waiter") throw redirect({ to: "/waiter-panel" });
      if (role === "chef") throw redirect({ to: "/kitchen" });
      if (role === "cashier") throw redirect({ to: "/dashboard" });
      if (role === "host") throw redirect({ to: "/reservations" });
      throw redirect({ to: "/dashboard" });
    }

    if (role === "waiter" && !pathname.startsWith("/waiter-panel")) {
      throw redirect({ to: "/waiter-panel" });
    }
    if (role === "chef" && !pathname.startsWith("/kitchen") && !pathname.startsWith("/orders")) {
      throw redirect({ to: "/kitchen" });
    }
    if (
      role === "cashier" &&
      !pathname.startsWith("/dashboard") &&
      !pathname.startsWith("/pos") &&
      !pathname.startsWith("/orders") &&
      !pathname.startsWith("/reservations") &&
      !pathname.startsWith("/waiter-panel")
    ) {
      throw redirect({ to: "/pos", search: { edit: undefined } });
    }
    if (role === "host" && !pathname.startsWith("/reservations")) {
      throw redirect({ to: "/reservations" });
    }

    return { user };
  },
  component: AuthenticatedLayout,
});

function GlobalRealtimeNotifier({
  restaurantId,
  branch,
  role,
}: {
  restaurantId?: string | number | null;
  branch?: string | null;
  role?: string | null;
}) {
  const userRole = (role || "").toLowerCase().trim();
  const isGuestOrCustomer = userRole === "customer" || userRole === "guest";

  useRealtime({
    restaurantId: restaurantId ? String(restaurantId) : undefined,
    branchId: branch && branch !== "all" ? String(branch) : undefined,
    enabled: !isGuestOrCustomer,
    onEvent: (event) => {
      if (event.type === "order:created") {
        playChime("order");
        const payload = event.payload as Record<string, unknown>;
        const orderNum = payload?.number ? `#${payload.number}` : "New Order";
        const customerName = (payload?.customerName as string) || "Guest";

        toast.success(`🔔 New Order Received! ${orderNum}`, {
          description: `Customer: ${customerName}`,
          duration: 7000,
        });
      } else if (event.type === "waiter:called") {
        playChime("waiter");
        const payload = event.payload as Record<string, unknown>;
        const tableNum = payload?.tableNumber ? `Table ${payload.tableNumber}` : "A table";

        toast.warning(`🚨 Waiter Call! ${tableNum}`, {
          description: "Guest needs assistance",
          duration: 7000,
        });
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("menuverse:realtime-event", { detail: event }));
      }
    },
  });

  return null;
}

function AuthenticatedLayout() {
  const { user: initialUser } = useRouteContext({ from: "/_authenticated" });
  const [currentUser, setCurrentUser] = useState(initialUser);
  const [loading, setLoading] = useState(!initialUser);
  const location = useLocation();
  const [restaurantName, setRestaurantName] = useState<string>("MenuVerse");

  useEffect(() => {
    if (!currentUser && typeof window !== "undefined") {
      const token = localStorage.getItem("menuverse_session");
      getCurrentUser({ data: { token: token || undefined } }).then((u) => {
        if (!u) {
          window.location.href = "/auth";
        } else {
          setCurrentUser(u);
          setLoading(false);
        }
      });
    }
  }, [currentUser]);

  useEffect(() => {
    async function loadRestaurantName() {
      try {
        const profile = await getRestaurantProfile();
        if (profile?.name?.trim()) {
          setRestaurantName(profile.name.trim());
        }
      } catch {
        /* ignore */
      }
    }
    loadRestaurantName();

    const handleProfileUpdate = (e: Event) => {
      const customEv = e as CustomEvent<{ name?: string }>;
      if (customEv.detail?.name?.trim()) {
        setRestaurantName(customEv.detail.name.trim());
      }
    };
    window.addEventListener("menuverse:profile-updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("menuverse:profile-updated", handleProfileUpdate);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const pathname = location.pathname;
    const pageTitle =
      PAGE_TITLE_MAP[pathname] ||
      pathname
        .replace(/^\//, "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()) ||
      "Dashboard";

    document.title = `${pageTitle} | ${restaurantName}`;
  }, [location.pathname, restaurantName]);

  if (loading || !currentUser) {
    return <SkeletonDashboard />;
  }

  return (
    <DashboardShell
      userId={currentUser?.id ?? ""}
      userName={currentUser?.full_name ?? ""}
      userEmail={currentUser?.email ?? ""}
      userAvatarUrl={currentUser?.avatar_url ?? null}
      userRole={currentUser?.role ?? "Owner"}
      userBranch={currentUser?.branch ?? null}
    >
      <GlobalRealtimeNotifier
        restaurantId={
          (currentUser as unknown as Record<string, unknown>)?.restaurant_id as string | number | undefined
        }
        branch={(currentUser as unknown as Record<string, unknown>)?.branch as string | undefined}
        role={currentUser?.role}
      />
      <Outlet />
    </DashboardShell>
  );
}
