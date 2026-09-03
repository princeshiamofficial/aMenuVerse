import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generates a UUID v4-compatible string.
 * Uses crypto.randomUUID() when available (HTTPS / localhost).
 * Falls back to Math.random for non-secure HTTP LAN contexts (e.g. 192.168.x.x).
 */
export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Polyfill: RFC 4122 v4 UUID via Math.random
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Safely parses any date representation (Date instance, ISO string, MySQL date string)
 * into a clean YYYY-MM-DD string.
 */
export function toISODateString(val: unknown): string {
  if (!val) return "";
  if (val instanceof Date) {
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, "0");
    const day = String(val.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const str = String(val).trim();
  const isoMatch = str.match(/\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return isoMatch[0];

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return str.slice(0, 10);
}

/**
 * Validates if the current time falls within a given [startTime, endTime] window (HH:mm).
 * Checks local browser time, UTC, and BD (+06:00) time to ensure server/client compatibility.
 */
export function isTimeInWindow(startTime?: string, endTime?: string): boolean {
  if (!startTime || !endTime) return true;

  const cleanStart = String(startTime).trim().slice(0, 5);
  const cleanEnd = String(endTime).trim().slice(0, 5);
  if (!cleanStart || !cleanEnd) return true;

  const now = new Date();

  const localH = String(now.getHours()).padStart(2, "0");
  const localM = String(now.getMinutes()).padStart(2, "0");
  const localTime = `${localH}:${localM}`;

  const utcH = String(now.getUTCHours()).padStart(2, "0");
  const utcM = String(now.getUTCMinutes()).padStart(2, "0");
  const utcTime = `${utcH}:${utcM}`;

  const bdH = String((now.getUTCHours() + 6) % 24).padStart(2, "0");
  const bdTime = `${bdH}:${utcM}`;

  const matchLocal = localTime >= cleanStart && localTime <= cleanEnd;
  const matchUtc = utcTime >= cleanStart && utcTime <= cleanEnd;
  const matchBd = bdTime >= cleanStart && bdTime <= cleanEnd;

  return matchLocal || matchUtc || matchBd;
}

/**
 * Returns true if the host looks like a nip.io IP-based subdomain host.
 * Pattern: <slug>.<ip-octets>.nip.io  e.g. burgercraft.192.168.10.115.nip.io
 */
function isNipIoHost(host: string): boolean {
  return host.endsWith(".nip.io");
}

/**
 * Extracts the restaurant slug from a nip.io host.
 * burgercraft.192.168.10.115.nip.io  →  "burgercraft"
 */
function getNipIoSubdomain(host: string): string | null {
  // strip port if present
  const bare = host.split(":")[0];
  const parts = bare.split(".");
  // format: <slug>.<a>.<b>.<c>.<d>.nip.io  → parts[0] is slug
  if (parts.length >= 6 && parts[0] !== "www" && parts[0] !== "app") {
    return parts[0];
  }
  return null;
}

/**
 * Extracts subdomain from host.
 * Supports:
 *   - localhost:    burgercraft.localhost:8081
 *   - nip.io LAN:  burgercraft.192.168.10.115.nip.io:8081
 *   - production:  burgercraft.menuverse.com
 */
export function getSubdomain(hostname?: string): string | null {
  let host = hostname;

  if (!host && typeof window !== "undefined") {
    host = window.location.hostname;
  }

  if (!host) return null;

  // Raw IP addresses or plain localhost/127.0.0.1 are platform root, not restaurant subdomains
  const bare = host.split(":")[0];
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(bare) || bare === "localhost" || bare === "127.0.0.1") {
    return null;
  }

  // nip.io LAN subdomain: e.g. burgercraft.192.168.10.115.nip.io
  if (isNipIoHost(host)) {
    return getNipIoSubdomain(host);
  }

  // Localhost test support: e.g. burgercraft.localhost
  if (host.includes("localhost")) {
    const parts = host.split(".");
    if (parts.length > 1 && parts[0] !== "localhost" && parts[0] !== "www") {
      return parts[0];
    }
    return null;
  }

  // Tunnel providers (loca.lt, ngrok, pinggy, trycloudflare, etc.) are platform proxies, not restaurant subdomains
  if (
    host.endsWith(".loca.lt") ||
    host.endsWith(".ngrok.io") ||
    host.endsWith(".ngrok-free.app") ||
    host.endsWith(".pinggy.link") ||
    host.endsWith(".trycloudflare.com") ||
    host.endsWith(".pagekite.me")
  ) {
    return null;
  }

  // Production subdomain: e.g. burgercraft.menuverse.com
  const parts = host.split(".");
  if (parts.length >= 3 && parts[0] !== "www" && parts[0] !== "app") {
    return parts[0];
  }

  return null;
}

/**
 * Updates document title safely without recursive MutationObserver loops.
 */
export function updateDynamicTitle(rawTitle?: string | null): void {
  if (typeof document === "undefined" || !rawTitle) return;
  const title = String(rawTitle).trim();
  if (!title) return;
  if (document.title !== title) {
    document.title = title;
  }
}

/**
 * Updates favicon safely without recursive MutationObserver loops.
 */
export function updateDynamicFavicon(rawUrl?: string | null): void {
  if (typeof document === "undefined" || !rawUrl) return;
  const url = String(rawUrl).trim();
  if (!url) return;

  try {
    let mainIcon = document.getElementById("menuverse-dynamic-favicon") as HTMLLinkElement | null;
    if (!mainIcon) {
      mainIcon = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
    }
    if (!mainIcon) {
      mainIcon = document.createElement("link");
      mainIcon.id = "menuverse-dynamic-favicon";
      mainIcon.rel = "icon";
      document.head.appendChild(mainIcon);
    }
    if (mainIcon.getAttribute("href") !== url) {
      mainIcon.href = url;
    }
  } catch {
    /* ignore */
  }
}

/**
 * Formats restaurant public menu URL.
 * Supports localhost, nip.io LAN, and production.
 */
export function getRestaurantUrl(username: string): string {
  if (typeof window === "undefined") return `/${username}`;
  const host = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port ? `:${window.location.port}` : "";

  if (host.includes("menuverse.com")) {
    return `${protocol}//${username}.menuverse.com${port}`;
  }

  // nip.io: replace existing slug (or bare IP) with the new username slug
  if (isNipIoHost(host)) {
    // host may be bare IP.nip.io or slug.IP.nip.io — extract the IP portion
    const bare = host.split(":")[0];
    const parts = bare.split(".");
    // parts: [slug?, a, b, c, d, nip, io]  or  [a, b, c, d, nip, io]
    const ipStart = parts.length >= 7 ? 1 : 0; // skip slug if present
    const ipAndSuffix = parts.slice(ipStart).join("."); // e.g. 192.168.10.115.nip.io
    return `${protocol}//${username}.${ipAndSuffix}${port}`;
  }

  if (host.includes("localhost")) {
    return `${protocol}//${username}.localhost${port}`;
  }

  return `/${username}`;
}

/**
 * Returns the shareable base URL for the current host using nip.io.
 * Useful for displaying the QR share link in the dashboard.
 * e.g. http://burgercraft.192.168.10.115.nip.io:8081
 */
export function getNipIoShareUrl(username: string, ip: string, port?: string): string {
  const portSuffix = port ? `:${port}` : "";
  return `http://${username}.${ip}.nip.io${portSuffix}`;
}

/**
 * Encodes branch slug and table number into an ultra-short encrypted token under 8 characters.
 * e.g. ("downtown-flagship", "02") → "df02k7" (6 characters)
 */
export function encodeTableToken(branchSlug: string, tableNo: string): string {
  try {
    const parts = branchSlug.split("-").filter(Boolean);
    const code =
      parts.length >= 2
        ? (parts[0][0] + parts[1][0]).toLowerCase()
        : branchSlug.slice(0, 2).toLowerCase();

    const num = String(tableNo).padStart(2, "0");

    let checksum = 7;
    for (let i = 0; i < branchSlug.length; i++) {
      checksum = (checksum * 31 + branchSlug.charCodeAt(i)) & 0xffff;
    }
    const checkStr = checksum.toString(36).slice(0, 2).padStart(2, "x");

    // Returns 6-character ultra-short encrypted token under 8 digits (e.g. "df02k7")
    return `${code}${num}${checkStr}`;
  } catch {
    return `t${tableNo}`;
  }
}

/**
 * Decodes an encrypted table token (supports both 6-char short tokens and legacy base64) back to { branchSlug, tableNo }.
 */
export function decodeTableToken(token: string): { branchSlug: string; tableNo: string } | null {
  if (!token) return null;

  // 1. Try legacy Base64 JSON token
  try {
    let base64 = token.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) base64 += "=";
    const raw =
      typeof window !== "undefined" && window.atob
        ? window.atob(base64)
        : Buffer.from(base64, "base64").toString("utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && parsed.b && parsed.t) {
      return { branchSlug: String(parsed.b), tableNo: String(parsed.t) };
    }
  } catch {
    /* fallback to short token */
  }

  // 2. Decode ultra-short token under 8 chars e.g. "df0419"
  if (token.length <= 8) {
    const match = token.match(/^([a-z]{2})(\d{2})([a-z0-9]{2})$/i);
    if (match) {
      return { branchSlug: match[1].toLowerCase(), tableNo: match[2] };
    }
    const tableMatch = token.match(/\d+/);
    const tableNo = tableMatch ? tableMatch[0].slice(0, 2) : "01";
    const code = token.replace(/\d+/g, "").slice(0, 2);
    return { branchSlug: code, tableNo };
  }

  return null;
}

/**
 * Formats ultra-short branch & table ID QR URL.
 * e.g. http://bellapizza.localhost:5173/bd76cb40/1ce8c163
 */
export function getEncryptedTableUrl(
  username: string,
  branchId: string,
  tableIdOrNo: string,
): string {
  const bClean = (branchId || "main")
    .replace(/^menu-/, "")
    .replace(/^branch-/, "")
    .trim();
  const bShort = bClean.length > 8 ? bClean.slice(0, 8) : bClean;

  const tClean = (tableIdOrNo || "01").trim();
  const tShort = tClean.length > 8 ? tClean.slice(0, 8) : tClean;

  const baseUrl = getRestaurantUrl(username);
  if (baseUrl.startsWith("http")) {
    return `${baseUrl}/${bShort}/${tShort}`;
  }
  return `/${username}/${bShort}/${tShort}`;
}

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  $: "$",
  BDT: "৳",
  "৳": "৳",
  EUR: "€",
  "€": "€",
  GBP: "£",
  "£": "£",
  INR: "₹",
  "₹": "₹",
  AED: "د.إ",
  "د.إ": "د.إ",
  JPY: "¥",
  "¥": "¥",
  CNY: "¥",
  BRL: "R$",
  R$: "R$",
  CAD: "C$",
  C$: "C$",
  SAR: "﷼",
  "﷼": "﷼",
};

export function getCurrencySymbol(code?: string): string {
  if (!code) return "৳";
  const clean = code.trim();
  const upper = clean.toUpperCase();
  return CURRENCY_SYMBOLS[upper] || CURRENCY_SYMBOLS[clean] || clean || "৳";
}

export function formatCurrency(amount: number, currencyCode?: string): string {
  const symbol = getCurrencySymbol(currencyCode);
  const num = Number(amount) || 0;
  return `${symbol}${num.toFixed(2)}`;
}

/**
 * Returns the image URL directly (or an object URL if a File instance is provided).
 */
export function dataUrlToBlobUrl(urlOrFile?: File | Blob | string | null): string {
  if (!urlOrFile) return "";
  if (typeof urlOrFile !== "string") {
    if (typeof window !== "undefined") {
      try {
        return URL.createObjectURL(urlOrFile);
      } catch {
        return "";
      }
    }
    return "";
  }
  return String(urlOrFile).trim();
}

/**
 * Returns the image URL directly without blob conversion.
 */
export async function dataUrlToBlobUrlAsync(
  urlOrFile?: File | Blob | string | null,
): Promise<string> {
  return dataUrlToBlobUrl(urlOrFile);
}
