import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "./lib/auth";

const PROTECTED_ROUTES = [
  "/admin",
  "/dashboard",
  "/pos",
  "/orders",
  "/kitchen",
  "/kitchen2",
  "/inventory",
  "/menu",
  "/categories",
  "/branches",
  "/profile",
  "/appearance",
  "/staff",
  "/settings",
  "/qr-codes",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("auth_token")?.value;

  // Check if it is a protected route
  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isProtected) {
    if (!token) {
      const loginUrl = new URL("/login", req.url);
      return NextResponse.redirect(loginUrl);
    }

    const payload = await verifyToken(token);
    if (!payload) {
      // Invalid token, remove cookie and redirect to login
      const response = NextResponse.redirect(new URL("/login", req.url));
      response.cookies.delete("auth_token");
      return response;
    }

    const isSystemAdmin = payload.restaurantId === null || payload.role === "system_admin";

    // Route checks for system admin panel /admin
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      if (!isSystemAdmin) {
        // Non-system-admins go back to dashboard
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
      return NextResponse.next();
    }

    // System admins should only be allowed on the system admin pages.
    // If they access other protected routes, redirect to /admin.
    if (isSystemAdmin) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }

    // Role-based authorization check (Managers can't access Admin-only pages)
    const adminOnlyRoutes = ["/branches", "/profile", "/appearance", "/staff", "/settings"];
    const isAdminOnly = adminOnlyRoutes.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    );

    if (isAdminOnly && payload.role !== "admin") {
      // Redirect unauthorized roles to dashboard
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  }

  // Redirect logged-in users away from the login page
  if (pathname === "/login" && token) {
    const payload = await verifyToken(token);
    if (payload) {
      const destination =
        payload.restaurantId === null || payload.role === "system_admin" ? "/admin" : "/dashboard";
      return NextResponse.redirect(new URL(destination, req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - logo.png (logo file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|logo.png).*)",
  ],
};
