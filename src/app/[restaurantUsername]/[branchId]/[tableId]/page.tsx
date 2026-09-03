"use client";

import { useState, useEffect } from "react";
import { useParams, usePathname } from "next/navigation";
import { fetchPublicMenu, fetchPublicMenuSync } from "@/lib/public-menu";
import { validateTableQrServer } from "@/lib/db-queries.server";
import { updateDynamicFavicon } from "@/lib/utils";
import { PublicRestaurantView, PublicRestaurantSkeleton } from "@/app/[restaurantUsername]/page";
import type { Restaurant } from "@/lib/restaurants-data";

export default function RestaurantBranchTableRoute() {
  const params = useParams();
  const pathname = usePathname();
  const segments = (pathname || "").split("/").filter(Boolean);

  const rawUsername = (params?.restaurantUsername as string) || segments[0] || "";
  const rawBranchId = (params?.branchId as string) || segments[1] || "";
  const rawTableId = (params?.tableId as string) || segments[2] || "";

  const restaurantUsername = rawUsername.toLowerCase().trim();
  const branchId = rawBranchId.trim();
  const tableId = rawTableId.trim();

  // Create immediate deterministic base restaurant object so UI renders without indefinite skeleton
  const [restaurantData, setRestaurantData] = useState<Restaurant | null>(() => {
    if (!restaurantUsername) return null;
    return (
      fetchPublicMenuSync(restaurantUsername) || {
        id: restaurantUsername,
        name: restaurantUsername.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        username: restaurantUsername,
        cuisine: "Gourmet Kitchen",
        rating: "4.9",
        reviews: "100",
        price: "$$",
        time: "15-20 min",
        location: "Main Location",
        logo: restaurantUsername.charAt(0).toUpperCase(),
        logoBg: "from-amber-500 to-orange-600",
        image: "",
        logoImage: "",
        menuItems: [],
        categories: [],
      }
    );
  });
  const [resolvedBranchId, setResolvedBranchId] = useState<string>("");
  const [resolvedTableNo, setResolvedTableNo] = useState<string>("");
  const [qrValid, setQrValid] = useState<boolean>(true);
  const [invalidReason, setInvalidReason] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 2000);

    async function loadAsync() {
      if (!restaurantUsername) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const [fresh, valRes] = await Promise.allSettled([
          fetchPublicMenu(restaurantUsername),
          validateTableQrServer({
            data: {
              restaurantSlug: restaurantUsername,
              branchId,
              tableId,
            },
          }),
        ]);

        if (!isMounted) return;

        if (fresh.status === "fulfilled" && fresh.value) {
          setRestaurantData(fresh.value);
          const fav = (fresh.value as { favicon?: string }).favicon || fresh.value.logoImage;
          if (fav) updateDynamicFavicon(fav);
        }

        if (valRes.status === "fulfilled" && valRes.value) {
          const res = valRes.value;
          if (res.valid === false) {
            // Only flag invalid if restaurant itself verified but table was explicitly rejected
            if (res.reason && !res.reason.includes("Restaurant not found")) {
              setQrValid(false);
              setInvalidReason(res.reason);
            }
          } else {
            if (res.branchId) setResolvedBranchId(res.branchId);
            if (res.tableNo) setResolvedTableNo(res.tableNo);
          }
        }
      } catch (err) {
        console.warn("[TableQr loadAsync Error]", err);
      } finally {
        if (isMounted) {
          clearTimeout(safetyTimer);
          setLoading(false);
        }
      }
    }

    loadAsync();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, [restaurantUsername, branchId, tableId]);

  if (!qrValid) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center min-h-[60vh] flex flex-col items-center justify-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 mb-3">
          ⚠️
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Invalid Table QR Code</h1>
        <p className="mt-2 text-muted-foreground text-sm max-w-md">
          {invalidReason ||
            "This dining table QR code is invalid or has been removed from the database."}
        </p>
      </div>
    );
  }

  if (loading && !restaurantData) {
    return <PublicRestaurantSkeleton />;
  }

  if (!restaurantData) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center min-h-[60vh] flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold">Restaurant not found</h1>
        <p className="mt-2 text-muted-foreground">
          No active restaurant matches this username or table QR code.
        </p>
      </div>
    );
  }

  return (
    <PublicRestaurantView
      initialRestaurant={restaurantData}
      restaurantUsername={restaurantUsername}
      tableNumber={resolvedTableNo || ""}
      branchId={resolvedBranchId || branchId}
    />
  );
}
