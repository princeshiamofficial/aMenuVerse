import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { decodeTableToken } from "@/lib/utils";
import { fetchPublicMenu, fetchPublicMenuSync } from "@/lib/public-menu";
import { PublicRestaurantView } from "./$restaurantUsername";
import type { Restaurant } from "@/lib/restaurants-data";

export const Route = createFileRoute("/$restaurantUsername/e/$token")({
  component: RestaurantEncryptedTableRoute,
});

function RestaurantEncryptedTableRoute() {
  const { restaurantUsername, token } = Route.useParams();
  const decoded = decodeTableToken(token);

  const branchSlug = decoded?.branchSlug || "";
  const tableNo = decoded?.tableNo || "01";

  const [restaurantData, setRestaurantData] = useState<Restaurant | null>(() =>
    fetchPublicMenuSync(restaurantUsername),
  );

  useEffect(() => {
    async function loadAsync() {
      try {
        const fresh = await fetchPublicMenu(restaurantUsername);
        if (fresh) setRestaurantData(fresh);
      } catch {
        /* ignore */
      }
    }
    loadAsync();
  }, [restaurantUsername]);

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
      tableNumber={tableNo}
      branchId={branchSlug}
    />
  );
}
