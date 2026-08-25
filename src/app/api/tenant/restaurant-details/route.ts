import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { invalidateTenantCache } from "@/lib/redis";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || !user.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const restaurants = await query<Record<string, unknown>[]>(
      "SELECT * FROM restaurants WHERE id = ?",
      [user.restaurantId],
    );

    if (restaurants.length === 0) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    return NextResponse.json(restaurants[0]);
  } catch (err) {
    console.error("Tenant details GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || !user.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    console.log("Incoming PUT Body:", body);

    // Map camelCase or snake_case parameters safely, defaulting undefined to null
    const name = body.name ?? null;
    const cuisine = body.cuisine ?? null;
    const rating = body.rating ?? null;
    const reviews = body.reviews ?? null;
    const price = body.price ?? null;
    const time = body.time ?? null;
    const location = body.location ?? null;
    const logo = body.logo ?? null;
    const logoBg = body.logoBg ?? body.logo_bg ?? null;
    const image = body.image ?? null;
    const logoImage = body.logoImage ?? body.logo_image ?? null;
    const phone = body.phone ?? null;
    const operatingHours = body.operatingHours ?? body.operating_hours ?? null;
    const facilities = body.facilities ?? null;
    const introText = body.introText ?? body.intro_text ?? null;
    const descriptionText = body.descriptionText ?? body.description_text ?? null;
    const primaryColor = body.primaryColor ?? body.primary_color ?? "#ff7a00";
    const fontFamily = body.fontFamily ?? body.font_family ?? "Outfit";
    const layoutType = body.layoutType ?? body.layout_type ?? "grid";
    let offerSlides = body.offerSlides ?? body.offer_slides ?? null;
    if (offerSlides !== null && typeof offerSlides !== "string") {
      offerSlides = JSON.stringify(offerSlides);
    }

    await query(
      `UPDATE restaurants SET 
        name = ?, cuisine = ?, rating = ?, reviews = ?, price = ?, time = ?, 
        location = ?, logo = ?, logo_bg = ?, image = ?, logo_image = ?, 
        phone = ?, operating_hours = ?, facilities = ?, intro_text = ?, 
        description_text = ?, primary_color = ?, font_family = ?, layout_type = ?,
        offer_slides = ?
       WHERE id = ?`,
      [
        name,
        cuisine,
        rating,
        reviews,
        price,
        time,
        location,
        logo,
        logoBg,
        image,
        logoImage,
        phone,
        operatingHours,
        facilities,
        introText,
        descriptionText,
        primaryColor,
        fontFamily,
        layoutType,
        offerSlides,
        user.restaurantId,
      ],
    );

    // Invalidate Redis cache for this tenant
    if (user.restaurantUsername) {
      await invalidateTenantCache(user.restaurantUsername);
    }

    return NextResponse.json({ success: true, message: "Details updated successfully" });
  } catch (err) {
    console.error("Tenant details PUT error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
