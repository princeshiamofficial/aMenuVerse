import {
  getRestaurantData,
  getRestaurantProfile,
  LIVE_PROFILE_STORES,
} from "@/lib/db-queries.server";
import { RESTAURANTS, Restaurant } from "@/lib/restaurants-data";

export function fetchPublicMenuSync(username: string): Restaurant {
  const cleanUsername = (username || "").toLowerCase().trim().split(".")[0];
  const localMatch = RESTAURANTS.find(
    (r) =>
      r.username.toLowerCase() === cleanUsername ||
      cleanUsername.startsWith(r.username.toLowerCase()) ||
      r.username.toLowerCase().startsWith(cleanUsername),
  );
  const baseData: Restaurant = localMatch
    ? JSON.parse(JSON.stringify(localMatch))
    : JSON.parse(JSON.stringify(RESTAURANTS[0]));

  const live = LIVE_PROFILE_STORES[cleanUsername] || LIVE_PROFILE_STORES[username] || {};
  if (live.facebookUrl) baseData.facebookUrl = String(live.facebookUrl);
  if (live.instagramUrl) baseData.instagramUrl = String(live.instagramUrl);
  if (live.whatsappNumber) baseData.whatsappNumber = String(live.whatsappNumber);

  return baseData;
}

export async function fetchPublicMenu(username: string): Promise<Restaurant | null> {
  const cleanUsername = (username || "").toLowerCase().trim().split(".")[0];

  // 1. Check base mock restaurants first (known local tenants)
  const localMatch = RESTAURANTS.find(
    (r) =>
      r.username.toLowerCase() === cleanUsername ||
      cleanUsername.startsWith(r.username.toLowerCase()) ||
      r.username.toLowerCase().startsWith(cleanUsername),
  );

  const baseData: Restaurant = localMatch
    ? JSON.parse(JSON.stringify(localMatch))
    : {
        id: cleanUsername,
        name: cleanUsername.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        username: cleanUsername,
        cuisine: "Gourmet Kitchen",
        rating: "4.9",
        reviews: "100",
        price: "$$",
        time: "15-20 min",
        location: "Main Location",
        logo: cleanUsername.charAt(0).toUpperCase(),
        logoBg: "from-amber-500 to-orange-600",
        image: "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&auto=format&fit=crop&q=80",
        logoImage: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=80&auto=format&fit=crop&q=80",
        menuItems: [],
        categories: [],
      };

  // 2. Fetch MySQL DB data (profile, active categories, food items with promotional discount prices)
  try {
    const dbData = (await getRestaurantData({ data: username })) as Restaurant | null;
    if (dbData) {
      if (dbData.categories !== undefined) {
        baseData.categories = dbData.categories;
      }
      if (dbData.menuItems !== undefined) {
        baseData.menuItems = dbData.menuItems;
      }
      if ((dbData as unknown as { promotions?: unknown }).promotions !== undefined) {
        (baseData as unknown as { promotions?: unknown }).promotions = (
          dbData as unknown as { promotions?: unknown }
        ).promotions;
      }
      if (dbData.name) baseData.name = dbData.name;
      if (dbData.location) baseData.location = dbData.location;
      if (dbData.phone) baseData.phone = dbData.phone;
      if (dbData.operatingHours) baseData.operatingHours = dbData.operatingHours;
      if (dbData.time) baseData.time = dbData.time;
      if (dbData.cuisine) baseData.cuisine = dbData.cuisine;
      if (dbData.appearance) baseData.appearance = dbData.appearance;
      if ((dbData as unknown as { currency?: string }).currency) {
        (baseData as unknown as { currency?: string }).currency = (
          dbData as unknown as { currency?: string }
        ).currency;
      }
      if ((dbData as unknown as { facebookUrl?: string }).facebookUrl !== undefined) {
        baseData.facebookUrl = (dbData as unknown as { facebookUrl?: string }).facebookUrl;
      }
      if ((dbData as unknown as { instagramUrl?: string }).instagramUrl !== undefined) {
        baseData.instagramUrl = (dbData as unknown as { instagramUrl?: string }).instagramUrl;
      }
      if ((dbData as unknown as { whatsappNumber?: string }).whatsappNumber !== undefined) {
        baseData.whatsappNumber = (dbData as unknown as { whatsappNumber?: string }).whatsappNumber;
      }
    }
  } catch (err) {
    console.warn("[fetchPublicMenu] getRestaurantData warning:", err);
  }

  // 3. Fetch MySQL profile overrides
  try {
    const dbProfile = await getRestaurantProfile({ data: username });
    if (dbProfile) {
      if (dbProfile.appearance) {
        baseData.appearance = dbProfile.appearance;
      }
      if (dbProfile.name?.trim()) baseData.name = dbProfile.name;
      if (dbProfile.logo) baseData.logoImage = dbProfile.logo;
      if (dbProfile.cover) baseData.image = dbProfile.cover;
      if (dbProfile.address?.trim()) baseData.location = dbProfile.address;
      if (dbProfile.intro?.trim()) baseData.introText = dbProfile.intro;
      if (dbProfile.description?.trim()) baseData.descriptionText = dbProfile.description;
      if (dbProfile.phone?.trim()) baseData.phone = dbProfile.phone;
      if (dbProfile.openingHours?.trim()) baseData.operatingHours = dbProfile.openingHours;
      if (dbProfile.facilities?.trim()) baseData.facilities = dbProfile.facilities;
      if (dbProfile.avgPrepTime?.trim()) baseData.time = dbProfile.avgPrepTime;
      if (dbProfile.cuisineType?.trim()) baseData.cuisine = dbProfile.cuisineType;
      if (dbProfile.rating?.trim()) {
        const numMatch = dbProfile.rating.match(/^(\d+\.?\d*)/);
        if (numMatch) {
          baseData.rating = numMatch[1];
          const reviewsMatch = dbProfile.rating.match(/\((\d[\d,]*)\s*reviews?\)/i);
          if (reviewsMatch) baseData.reviews = reviewsMatch[1].replace(/,/g, "");
        } else {
          baseData.rating = dbProfile.rating;
        }
      }
      if (dbProfile.favicon || dbProfile.logo)
        (baseData as unknown as { favicon?: string }).favicon = dbProfile.favicon || dbProfile.logo;
      if (dbProfile.socialPreview)
        (baseData as unknown as { socialPreview?: string }).socialPreview = dbProfile.socialPreview;
      if (dbProfile.facebookUrl !== undefined) baseData.facebookUrl = dbProfile.facebookUrl;
      if (dbProfile.instagramUrl !== undefined) baseData.instagramUrl = dbProfile.instagramUrl;
      if (dbProfile.whatsappNumber !== undefined)
        baseData.whatsappNumber = dbProfile.whatsappNumber;
      if (dbProfile.isVerified !== undefined) baseData.isVerified = dbProfile.isVerified;
      if ((dbProfile as unknown as { currency?: string }).currency) {
        (baseData as unknown as { currency?: string }).currency = (
          dbProfile as unknown as { currency?: string }
        ).currency;
      }
    }
  } catch {
    /* ignore */
  }

  return baseData;
}
