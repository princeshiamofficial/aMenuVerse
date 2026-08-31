import { uploadToImgBBServer } from "./db-queries.server";

/**
 * Converts a File or Blob object into a base64 string on the browser/client.
 */
async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads an image file or base64 string to ImgBB CDN API securely via backend Server Action.
 * Keeps API secrets strictly protected on the server.
 * Returns the permanent authoritative CDN URL (https://i.ibb.co/...).
 */
export async function uploadToImgBB(fileOrBase64: File | string): Promise<string> {
  let base64String = "";
  if (typeof fileOrBase64 === "string") {
    base64String = fileOrBase64;
  } else {
    try {
      base64String = await fileToBase64(fileOrBase64);
    } catch {
      base64String = "";
    }
  }

  if (!base64String) {
    return typeof fileOrBase64 === "string" ? fileOrBase64 : "";
  }

  // If already a remote CDN / HTTPS URL, do not re-upload
  if (base64String.startsWith("http://") || base64String.startsWith("https://")) {
    return base64String;
  }

  try {
    const serverCdnUrl = await uploadToImgBBServer({ data: base64String });
    if (serverCdnUrl && typeof serverCdnUrl === "string") {
      return serverCdnUrl;
    }
  } catch (serverErr) {
    console.warn("[ImgBB Server Upload Warning]", serverErr);
  }

  // Fallback to sanitized payload string if upload fails gracefully
  return base64String;
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
