import { SignJWT, jwtVerify } from "jose";
import { NextRequest } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_key_123456789_super_secret_key";
const key = new TextEncoder().encode(JWT_SECRET);

export interface JWTPayload {
  id: number;
  email: string;
  name: string;
  role: string;
  restaurantId: number | null;
  restaurantUsername: string | null;
  assignedBranchId: string | null;
}

export async function signToken(payload: JWTPayload, expiresIn = "24h"): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
    });
    return payload as unknown as JWTPayload;
  } catch (err) {
    return null;
  }
}

export async function getCurrentUser(req: NextRequest): Promise<JWTPayload | null> {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return null;
  return await verifyToken(token);
}
