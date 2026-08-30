import { uploadToImgBBServer } from "./db-queries.server";

/**
 * Uploads an image file or base64 string to ImgBB CDN API.
 * Returns the permanent authoritative CDN URL (https://i.ibb.co/...).
 */
export async function uploadToImgBB(fileOrBase64: File | string): Promise<string> {
  const apiKey =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_IMGBB_API_KEY ||
        process.env.VITE_IMGBB_API_KEY ||
        process.env.IMGBB_API_KEY
      : undefined;

  // 1. Convert File / Blob to clean Base64 string
  let base64String = "";
  if (typeof fileOrBase64 === "string") {
    base64String = fileOrBase64;
  } else {
    try {
      base64String = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(fileOrBase64);
      });
    } catch {
      base64String = "";
    }
  }

  if (!apiKey || apiKey === "YOUR_IMGBB_API_KEY") {
    console.warn(
      "[ImgBB Warning] VITE_IMGBB_API_KEY is missing or unconfigured. Falling back to Data URL.",
    );
    return base64String || (typeof fileOrBase64 === "string" ? fileOrBase64 : "");
  }

  // 1. Primary Strategy: Direct Binary FormData fetch (Best quality, zero base64 corruption)
  try {
    const formData = new FormData();
    if (fileOrBase64 instanceof File) {
      formData.append("image", fileOrBase64);
    } else {
      const cleanBase64 = fileOrBase64.replace(/^data:image\/\w+;base64,/, "");
      formData.append("image", cleanBase64);
    }

    const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: "POST",
      body: formData,
    });

    const json = await res.json();
    console.log("[ImgBB Client Upload Response]", json);

    const directCdnUrl =
      json?.data?.image?.url || json?.data?.display_url || json?.data?.url || null;
    if (directCdnUrl && typeof directCdnUrl === "string") {
      return directCdnUrl;
    }
    if (json?.error?.message) {
      console.warn("[ImgBB API Warning]", json.error.message);
    }
  } catch (clientErr) {
    console.warn("[ImgBB Client Upload Warning]", clientErr);
  }

  // 2. Secondary Strategy: Server-side Node fetch (Bypasses browser CORS & extension blocks)
  if (base64String) {
    try {
      const serverCdnUrl = await uploadToImgBBServer({ data: base64String });
      if (serverCdnUrl) {
        console.log("[ImgBB Upload Success via Server]", serverCdnUrl);
        return serverCdnUrl;
      }
    } catch (serverErr) {
      console.warn("[ImgBB Server Upload Warning]", serverErr);
    }
  }

  // 4. Final Guaranteed Fallback
  return base64String || (typeof fileOrBase64 === "string" ? fileOrBase64 : "");
}

export const DEFAULT_FOOD_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80";

export function sanitizeImageUrl(
  url?: string | null,
  fallback = DEFAULT_FOOD_FALLBACK_IMAGE,
): string {
  if (!url || typeof url !== "string") return fallback;
  const clean = url.trim();
  if (!clean || clean.startsWith("blob:") || clean.includes("image-not-found")) {
    return fallback;
  }
  return clean;
}

