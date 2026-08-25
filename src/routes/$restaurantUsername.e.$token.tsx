import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { decodeTableToken } from "@/lib/utils";
import { fetchPublicMenu, fetchPublicMenuSync } from "@/lib/public-menu";
import { validateTableQrServer } from "@/lib/db-queries.server";
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
  const [qrValid, setQrValid] = useState<boolean>(true);
  const [invalidReason, setInvalidReason] = useState<string>("");

  useEffect(() => {
    async function loadAsync() {
      try {
        const fresh = await fetchPublicMenu(restaurantUsername);
        if (fresh) setRestaurantData(fresh);

        const valRes = await validateTableQrServer({
          data: {
            restaurantSlug: restaurantUsername,
            token,
            branchId: branchSlug,
            tableNo,
          },
        });
        if (valRes && valRes.valid === false) {
          setQrValid(false);
          setInvalidReason(valRes.reason || "Invalid Table QR Code");
        }
      } catch {
        /* ignore */
      }
    }
    loadAsync();
  }, [restaurantUsername, branchSlug, tableNo]);

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
