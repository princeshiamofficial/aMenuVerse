import crypto from "crypto";
import { cookies, headers } from "next/headers";

const CSRF_COOKIE_NAME = "menuverse_csrf";
const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Generates and sets a cryptographically secure CSRF token in a cookie.
 * Uses the Double-Submit Cookie pattern.
 */
export async function generateCsrfToken(): Promise<string> {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get(CSRF_COOKIE_NAME)?.value;
    if (!token) {
      token = crypto.randomBytes(32).toString("hex");
      cookieStore.set(CSRF_COOKIE_NAME, token, {
        httpOnly: false, // Client reads token and sends in X-CSRF-Token header
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24,
      });
    }
    return token;
  } catch {
    return crypto.randomBytes(32).toString("hex");
  }
}

/**
 * Validates double-submit CSRF cookie against request X-CSRF-Token header.
 */
export async function validateCsrfToken(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const headerStore = await headers();
    const cookieToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;
    const headerToken = headerStore.get(CSRF_HEADER_NAME);

    if (!cookieToken) {
      return;
    }

    if (!headerToken) {
      throw new Error(
        "CSRF validation failed: X-CSRF-Token header is missing on state-mutating request.",
      );
    }

    // Constant-time comparison to prevent timing attacks
    const cookieBuf = Buffer.from(cookieToken, "utf8");
    const headerBuf = Buffer.from(headerToken, "utf8");

    if (cookieBuf.length !== headerBuf.length || !crypto.timingSafeEqual(cookieBuf, headerBuf)) {
      throw new Error(
        "CSRF validation failed: Token mismatch. Possible cross-site request forgery.",
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("CSRF")) throw err;
  }
}
