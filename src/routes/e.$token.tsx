import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { decodeTableToken, getSubdomain } from "@/lib/utils";
import { fetchPublicMenu, fetchPublicMenuSync } from "@/lib/public-menu";
import { PublicRestaurantView } from "./$restaurantUsername";
import type { Restaurant } from "@/lib/restaurants-data";

export const Route = createFileRoute("/e/$token")({
  component: EncryptedTableRoute,
});

function EncryptedTableRoute() {
  const { token } = Route.useParams();
  const decoded = decodeTableToken(token);
  const subdomain = getSubdomain() || "burgercraft";

  const branchSlug = decoded?.branchSlug || "";
  const tableNo = decoded?.tableNo || "01";

  const [restaurantData, setRestaurantData] = useState<Restaurant | null>(() =>
    fetchPublicMenuSync(subdomain),
  );

  useEffect(() => {
    async function loadAsync() {
      try {
        const fresh = await fetchPublicMenu(subdomain);
        if (fresh) setRestaurantData(fresh);
      } catch {
        /* ignore */
      }
    }
    loadAsync();
  }, [subdomain]);

  if (!restaurantData) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center min-h-[60vh] flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold">Restaurant not found</h1>
        <p className="mt-2 text-muted-foreground">
          No active restaurant matches this table QR code.
        </p>
      </div>
    );
  }

  return (
    <PublicRestaurantView
      initialRestaurant={restaurantData}
      restaurantUsername={subdomain}
      tableNumber={tableNo}
      branchId={branchSlug}
    />
  );
}
