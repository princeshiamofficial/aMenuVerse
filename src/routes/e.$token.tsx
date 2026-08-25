import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { decodeTableToken, getSubdomain } from "@/lib/utils";
import { fetchPublicMenu, fetchPublicMenuSync } from "@/lib/public-menu";
import { validateTableQrServer, resolveTableRestaurantServer } from "@/lib/db-queries.server";
import { PublicRestaurantView } from "./$restaurantUsername";
import type { Restaurant } from "@/lib/restaurants-data";

export const Route = createFileRoute("/e/$token")({
  component: EncryptedTableRoute,
});

function EncryptedTableRoute() {
  const { token } = Route.useParams();
  const decoded = decodeTableToken(token);
  const detectedSubdomain = getSubdomain();

  const branchSlug = decoded?.branchSlug || "";
  const tableNo = decoded?.tableNo || "01";

  const [activeSlug, setActiveSlug] = useState<string>(detectedSubdomain || "");
  const [restaurantData, setRestaurantData] = useState<Restaurant | null>(() =>
    detectedSubdomain ? fetchPublicMenuSync(detectedSubdomain) : null,
  );
  const [resolvedBranchId, setResolvedBranchId] = useState<string>("");
  const [resolvedTableNo, setResolvedTableNo] = useState<string>("");
  const [qrValid, setQrValid] = useState<boolean>(true);
  const [invalidReason, setInvalidReason] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadAsync() {
      try {
        const resolved = await resolveTableRestaurantServer({
          data: { token, subdomain: detectedSubdomain },
        });

        const targetSlug = resolved?.slug || detectedSubdomain || "";
        if (!targetSlug) {
          setQrValid(false);
          setInvalidReason("No active restaurant corresponds to this table QR code.");
          setLoading(false);
          return;
        }

        setActiveSlug(targetSlug);

        const fresh = await fetchPublicMenu(targetSlug);
        if (fresh) {
          setRestaurantData(fresh);
        } else {
          setQrValid(false);
          setInvalidReason(`Restaurant "${targetSlug}" not found in database.`);
          setLoading(false);
          return;
        }

        const valRes = await validateTableQrServer({
          data: {
            restaurantSlug: targetSlug,
            token,
            branchId: branchSlug,
            tableNo,
          },
        });

        if (valRes && valRes.valid === false) {
          setQrValid(false);
          setInvalidReason(valRes.reason || "Invalid Table QR Code");
        } else if (valRes && valRes.valid) {
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
  }, [token, detectedSubdomain, branchSlug, tableNo]);

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
    return (
      <div className="mx-auto max-w-2xl p-8 text-center min-h-[60vh] flex flex-col items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent mb-3" />
        <p className="text-sm font-semibold text-gray-600">Loading digital menu...</p>
      </div>
    );
  }

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
      restaurantUsername={activeSlug}
      tableNumber={resolvedTableNo || tableNo}
      branchId={resolvedBranchId || branchSlug}
    />
  );
}
