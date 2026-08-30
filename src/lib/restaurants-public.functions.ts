"use server";

import { createServerFn } from "./server-fn";
import { query } from "./mysql";

export type PublicRestaurant = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  cuisine: string | null;
  website: string | null;
};

export const listPublicRestaurants = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicRestaurant[]> => {
    try {
      let rows: PublicRestaurant[] | null = null;
      try {
        rows = await query<PublicRestaurant[]>(
          "SELECT id, name, slug, description, logo_url, cover_url, cuisine, website FROM restaurants WHERE status = 'active' ORDER BY created_at DESC LIMIT 60",
        );
      } catch {
        rows = await query<PublicRestaurant[]>(
          "SELECT id, name, slug, description, logo_url, cover_url, cuisine, NULL as website FROM restaurants ORDER BY id DESC LIMIT 60",
        );
      }
      return rows ?? [];
    } catch (err) {
      console.error("listPublicRestaurants error:", err);
      return [];
    }
  },
);
