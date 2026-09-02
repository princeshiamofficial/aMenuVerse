import { getRestaurantData, getRestaurantProfile } from "@/lib/db-queries.server";
import { RESTAURANTS, Restaurant } from "@/lib/restaurants-data";

export function fetchPublicMenuSync(_username: string): Restaurant | null {
  return null;
}

export async function fetchPublicMenu(username: string): Promise<Restaurant | null> {
  const cleanUsername = (username || "").toLowerCase().trim().split(".")[0];

  // 1. Fetch MySQL DB data (profile, active categories, food items)
  let dbData: Restaurant | null = null;
  try {
    dbData = (await getRestaurantData({ data: username })) as Restaurant | null;
  } catch (err) {
    console.warn("[fetchPublicMenu] getRestaurantData warning:", err);
  }

  // 2. Fetch MySQL profile
  let dbProfile: Record<string, unknown> | null = null;
  try {
    dbProfile = (await getRestaurantProfile({ data: username })) as Record<string, unknown> | null;
  } catch {
    /* ignore */
  }

  const profSlug = String(dbProfile?.slug || "")
    .toLowerCase()
    .trim();
  const hasDbMatch = Boolean(dbData) || Boolean(dbProfile && dbProfile.name);

  // If restaurant is NOT in MySQL database, return null -> 404 Not Found
  if (!hasDbMatch) {
    return null;
  }

  const baseData: Restaurant = {
    id: cleanUsername,
    name:
      (dbData?.name as string) ||
      (dbProfile?.name as string) ||
      cleanUsername.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    username: cleanUsername,
    cuisine: (dbData?.cuisine as string) || (dbProfile?.cuisineType as string) || "Gourmet Kitchen",
    rating: (dbData?.rating as string) || (dbProfile?.rating as string) || "4.9",
    reviews: "100",
    price: "$$",
    time: (dbData?.time as string) || (dbProfile?.avgPrepTime as string) || "15-20 min",
    location: (dbData?.location as string) || (dbProfile?.address as string) || "Main Location",
    logo: cleanUsername.charAt(0).toUpperCase(),
    logoBg: "from-amber-500 to-orange-600",
    image:
      (dbProfile?.cover as string) ||
      "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&auto=format&fit=crop&q=80",
    logoImage:
      (dbProfile?.logo as string) ||
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=80&auto=format&fit=crop&q=80",
    menuItems: dbData?.menuItems || [],
    categories: dbData?.categories || [],
  };

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
    if (dbData.isPushEnabled !== undefined) {
      baseData.isPushEnabled = dbData.isPushEnabled;
    }
  }

  if (dbProfile) {
    if (dbProfile.appearance) {
      baseData.appearance = dbProfile.appearance as Restaurant["appearance"];
    }
    if (dbProfile.name && typeof dbProfile.name === "string" && dbProfile.name.trim()) {
      if (
        !profSlug ||
        profSlug === cleanUsername ||
        cleanUsername.startsWith(profSlug) ||
        profSlug.startsWith(cleanUsername)
      ) {
        baseData.name = dbProfile.name;
      }
    }
    if (dbProfile.logo) baseData.logoImage = String(dbProfile.logo);
    if (dbProfile.cover) baseData.image = String(dbProfile.cover);
    if (dbProfile.address && typeof dbProfile.address === "string" && dbProfile.address.trim())
      baseData.location = dbProfile.address;
    if (dbProfile.intro && typeof dbProfile.intro === "string" && dbProfile.intro.trim())
      baseData.introText = dbProfile.intro;
    if (
      dbProfile.description &&
      typeof dbProfile.description === "string" &&
      dbProfile.description.trim()
    )
      baseData.descriptionText = dbProfile.description;
    if (dbProfile.phone && typeof dbProfile.phone === "string" && dbProfile.phone.trim())
      baseData.phone = dbProfile.phone;
    if (
      dbProfile.openingHours &&
      typeof dbProfile.openingHours === "string" &&
      dbProfile.openingHours.trim()
    )
      baseData.operatingHours = dbProfile.openingHours;
    if (
      dbProfile.facilities &&
      typeof dbProfile.facilities === "string" &&
      dbProfile.facilities.trim()
    )
      baseData.facilities = dbProfile.facilities;
    if (
      dbProfile.avgPrepTime &&
      typeof dbProfile.avgPrepTime === "string" &&
      dbProfile.avgPrepTime.trim()
    )
      baseData.time = dbProfile.avgPrepTime;
    if (
      dbProfile.cuisineType &&
      typeof dbProfile.cuisineType === "string" &&
      dbProfile.cuisineType.trim()
    )
      baseData.cuisine = dbProfile.cuisineType;
    if (dbProfile.rating && typeof dbProfile.rating === "string" && dbProfile.rating.trim()) {
      const numMatch = dbProfile.rating.match(/^(\d+\.?\d*)/);
      if (numMatch) {
        baseData.rating = numMatch[1];
        const reviewsMatch = dbProfile.rating.match(/\((\d[\d,]*)\s*reviews?\)/i);
        if (reviewsMatch) baseData.reviews = reviewsMatch[1].replace(/,/g, "");
      } else {
        baseData.rating = dbProfile.rating;
      }
    }
    const resolvedFavicon =
      (dbProfile.favicon as string) ||
      (dbProfile.faviconUrl as string) ||
      (dbProfile.logo as string) ||
      (baseData.logoImage as string) ||
      (baseData.image as string) ||
      "";
    if (resolvedFavicon) {
      (baseData as unknown as { favicon?: string }).favicon = resolvedFavicon;
    }
    if (dbProfile.socialPreview)
      (baseData as unknown as { socialPreview?: string }).socialPreview = String(
        dbProfile.socialPreview,
      );
    if (dbProfile.facebookUrl !== undefined) baseData.facebookUrl = String(dbProfile.facebookUrl);
    if (dbProfile.instagramUrl !== undefined)
      baseData.instagramUrl = String(dbProfile.instagramUrl);
    if (dbProfile.whatsappNumber !== undefined)
      baseData.whatsappNumber = String(dbProfile.whatsappNumber);
    if (dbProfile.isVerified !== undefined) baseData.isVerified = Boolean(dbProfile.isVerified);
    if ((dbProfile as unknown as { currency?: string }).currency) {
      (baseData as unknown as { currency?: string }).currency = (
        dbProfile as unknown as { currency?: string }
      ).currency;
    }
  }

  return baseData;
}
