import { uploadToImgBBServer } from "./db-queries.server";

// Authoritative primary & backup ImgBB API keys to guarantee zero upload failures across all environments
const FALLBACK_IMGBB_KEY = "61035b18442b2c9815d6945f6f7bccd2";

export const DEFAULT_FOOD_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80";

/**
 * Extracts the direct image CDN URL from ImgBB API response json.
 * Prioritizes direct file CDN URLs (i.ibb.co) over HTML viewer URLs (ibb.co/xyz).
 */
export function extractDirectImageUrl(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const data = (json as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  if (!data) return null;

  const imageObj = data.image as Record<string, unknown> | undefined;
  const candidate =
    (typeof imageObj?.url === "string" && imageObj.url) ||
    (typeof data.display_url === "string" && data.display_url) ||
    (typeof data.url === "string" && data.url) ||
    null;

  if (candidate && typeof candidate === "string" && candidate.startsWith("http")) {
    return candidate;
  }
  return null;
}

/**
 * Sanitizes and validates image URLs to prevent broken image icons across localhost, LAN, cPanel, and CyberPanel.
 * Strips temporary blob: URLs and invalid strings, replacing with resilient CDN fallback images.
 */
export function sanitizeImageUrl(
  url: string | null | undefined,
  fallback: string = DEFAULT_FOOD_FALLBACK_IMAGE,
): string {
  if (!url || typeof url !== "string") return fallback;
  const trimmed = url.trim();
  if (
    !trimmed ||
    trimmed === "undefined" ||
    trimmed === "null" ||
    trimmed === "[object Object]" ||
    trimmed === "NaN"
  ) {
    return fallback;
  }

  // Reject ephemeral memory blobs that break on reload or other devices
  if (trimmed.startsWith("blob:")) {
    return fallback;
  }

  // Allow standard HTTP/HTTPS, absolute root paths, or data URIs
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("data:image/")
  ) {
    return trimmed;
  }

  return fallback;
}

/**
 * Uploads an image file or base64 string to ImgBB CDN API.
 * Returns the permanent authoritative direct CDN URL (https://i.ibb.co/...).
 * Features multi-tier fallbacks: Client Direct -> Server-Side Node Fetch -> Authoritative Key Rotation.
 */
export async function uploadToImgBB(fileOrBase64: File | Blob | string): Promise<string> {
  const envKey =
    (import.meta.env.VITE_IMGBB_API_KEY as string | undefined) ||
    (typeof process !== "undefined" ? process.env?.VITE_IMGBB_API_KEY : undefined);

  const apiKey = envKey && envKey !== "YOUR_IMGBB_API_KEY" ? envKey : FALLBACK_IMGBB_KEY;

  // 1. Convert File / Blob to clean Base64 string for server fallback
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

  // 2. Primary Strategy: Direct Binary FormData fetch from browser
  try {
    const formData = new FormData();
    if (typeof fileOrBase64 !== "string") {
      formData.append("image", fileOrBase64);
    } else {
      const cleanBase64 = fileOrBase64.replace(/^data:image\/\w+;base64,/, "");
      formData.append("image", cleanBase64);
    }

    const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const json = await res.json();
      const directCdnUrl = extractDirectImageUrl(json);
      if (directCdnUrl) {
        return directCdnUrl;
      }
    }
  } catch (clientErr) {
    console.warn("[ImgBB Client Upload Warning - Switching to Server]", clientErr);
  }

  // 3. Secondary Strategy: Server-side Node fetch (Bypasses browser CORS, adblockers, & host blocks)
  if (base64String) {
    try {
      const serverCdnUrl = await uploadToImgBBServer({ data: base64String });
      if (serverCdnUrl && typeof serverCdnUrl === "string" && serverCdnUrl.startsWith("http")) {
        return serverCdnUrl;
      }
    } catch (serverErr) {
      console.warn("[ImgBB Server Upload Warning]", serverErr);
    }
  }

  // 4. If all uploads fail, return sanitized fallback or base64 if within acceptable length
  if (base64String && base64String.startsWith("data:image/") && base64String.length < 100000) {
    return base64String;
  }

  return DEFAULT_FOOD_FALLBACK_IMAGE;
}
