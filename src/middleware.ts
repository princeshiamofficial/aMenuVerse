import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function extractSubdomain(host: string): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0].toLowerCase().trim();

  // Plain localhost or direct IP
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
  ) {
    return null;
  }

  // Handle .localhost (e.g. bellapizza.localhost)
  if (hostname.endsWith(".localhost")) {
    const sub = hostname.replace(/\.localhost$/, "");
    if (
      sub &&
      !["www", "app", "admin", "api", "mail", "cpanel", "webmail", "preview"].includes(sub)
    ) {
      return sub;
    }
    return null;
  }

  // Handle production or nip.io / sslip.io / custom subdomains
  const parts = hostname.split(".");
  if (parts.length >= 3) {
    const sub = parts[0];
    if (
      sub &&
      !["www", "app", "admin", "api", "mail", "cpanel", "webmail", "preview"].includes(sub)
    ) {
      return sub;
    }
  }

  return null;
}

export function middleware(req: NextRequest) {
  // Sanitize comma-separated proxy headers (e.g. from LiteSpeed / Cloudflare reverse proxy chains)
  const requestHeaders = new Headers(req.headers);
  let headersModified = false;

  const origin = req.headers.get("origin");
  if (origin && origin.includes(",")) {
    const singleOrigin = origin.split(",")[0].trim();
    requestHeaders.set("origin", singleOrigin);
    headersModified = true;
  }

  const rawHost = req.headers.get("host") || req.nextUrl.host || "";
  const host = rawHost.includes(",") ? rawHost.split(",")[0].trim() : rawHost;
  if (rawHost.includes(",")) {
    requestHeaders.set("host", host);
    headersModified = true;
  }

  const xForwardedHost = req.headers.get("x-forwarded-host");
  if (xForwardedHost && xForwardedHost.includes(",")) {
    requestHeaders.set("x-forwarded-host", xForwardedHost.split(",")[0].trim());
    headersModified = true;
  }

  const subdomain = extractSubdomain(host);

  const { pathname } = req.nextUrl;

  // Skip static files, Next.js internal files, API routes, or files with extensions
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname.includes(".")
  ) {
    return headersModified
      ? NextResponse.next({ request: { headers: requestHeaders } })
      : NextResponse.next();
  }

  if (!subdomain) {
    return headersModified
      ? NextResponse.next({ request: { headers: requestHeaders } })
      : NextResponse.next();
  }

  // Preserve global auth, admin, and panel routes
  const preservedPrefixes = [
    "/admin",
    "/auth",
    "/dashboard",
    "/orders",
    "/pos",
    "/kitchen",
    "/waiter-panel",
    "/reservations",
    "/food-items",
    "/categories",
    "/branches",
    "/staff",
    "/promotions",
    "/restaurant-profile",
    "/subscription",
    "/analytics",
    "/feedback",
    "/settings",
    "/m",
  ];

  if (
    preservedPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return headersModified
      ? NextResponse.next({ request: { headers: requestHeaders } })
      : NextResponse.next();
  }

  // If already prefixed with the subdomain, do nothing
  if (pathname === `/${subdomain}` || pathname.startsWith(`/${subdomain}/`)) {
    return headersModified
      ? NextResponse.next({ request: { headers: requestHeaders } })
      : NextResponse.next();
  }

  // Rewrite to `/${subdomain}${pathname}`
  const url = req.nextUrl.clone();
  url.pathname = `/${subdomain}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url, {
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
