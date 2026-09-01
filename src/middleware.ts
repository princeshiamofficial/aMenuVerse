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
  const host = req.headers.get("host") || req.nextUrl.host || "";
  const subdomain = extractSubdomain(host);

  console.log("[Middleware]", req.method, req.nextUrl.pathname, "host:", host, "subdomain:", subdomain);

  if (!subdomain) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  // Skip static files, Next.js internal files, API routes, or files with extensions
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
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
    return NextResponse.next();
  }

  // If already prefixed with the subdomain, do nothing
  if (pathname === `/${subdomain}` || pathname.startsWith(`/${subdomain}/`)) {
    return NextResponse.next();
  }

  // Rewrite to `/${subdomain}${pathname}`
  const url = req.nextUrl.clone();
  url.pathname = `/${subdomain}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
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
