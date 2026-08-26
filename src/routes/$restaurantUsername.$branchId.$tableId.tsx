import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { fetchPublicMenu, fetchPublicMenuSync } from "@/lib/public-menu";
import { apiGet } from "@/lib/api-client";
import { validateTableQrServer } from "@/lib/db-queries.server";
import { PublicRestaurantView } from "./$restaurantUsername";
import type { Restaurant } from "@/lib/restaurants-data";

export const Route = createFileRoute("/$restaurantUsername/$branchId/$tableId")({
  component: RestaurantBranchTableRoute,
});

function RestaurantBranchTableRoute() {
  const { restaurantUsername, branchId, tableId } = Route.useParams();

  const [restaurantData, setRestaurantData] = useState<Restaurant | null>(() =>
    fetchPublicMenuSync(restaurantUsername),
  );
  const [resolvedBranchId, setResolvedBranchId] = useState<string>("");
  const [resolvedTableNo, setResolvedTableNo] = useState<string>("");
  const [qrValid, setQrValid] = useState<boolean>(true);
  const [invalidReason, setInvalidReason] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadAsync() {
      try {
        const fresh = await fetchPublicMenu(restaurantUsername);
        if (fresh) setRestaurantData(fresh);

        let valRes: {
          valid?: boolean;
          reason?: string;
          branchId?: string;
          tableNo?: string;
        } | null = null;

        try {
          const apiRes = await apiGet<Record<string, unknown>>(
            `/api/branch-tables?validate=true&restaurantSlug=${encodeURIComponent(restaurantUsername)}&branchId=${encodeURIComponent(branchId)}&tableId=${encodeURIComponent(tableId)}`,
          );
          if (apiRes) {
            const nestedData = (apiRes.data as Record<string, unknown>) || apiRes;
            valRes = {
              valid: apiRes.valid !== false && nestedData.valid !== false,
              reason: String(apiRes.reason || nestedData.reason || ""),
              branchId: String(nestedData.branchId || apiRes.branchId || ""),
              tableNo: String(nestedData.tableNo || apiRes.tableNo || ""),
            };
          }
        } catch {
          valRes = await validateTableQrServer({
            data: {
              restaurantSlug: restaurantUsername,
              branchId,
              tableId,
            },
          });
        }

        if (valRes && valRes.valid === false) {
          setQrValid(false);
          setInvalidReason(valRes.reason || "Invalid Table QR Code");
        } else if (valRes && valRes.valid !== false) {
          if (valRes.branchId) setResolvedBranchId(valRes.branchId);
          if (valRes.tableNo) setResolvedTableNo(valRes.tableNo);
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    loadAsync();
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

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center min-h-[60vh] flex flex-col items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent mb-3" />
        <p className="text-sm font-semibold text-gray-600">Loading dining table menu...</p>
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
      tableNumber={resolvedTableNo || ""}
      branchId={resolvedBranchId || branchId}
    />
  );
}
