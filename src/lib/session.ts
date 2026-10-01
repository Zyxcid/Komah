import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verifySession(token);
  if (!payload) return null;
  const user = await db.user.findUnique({ where: { id: payload.uid } });
  return user;
}

export function toSafeUser(u: {
  id: string;
  name: string;
  email: string;
  phone: string;
  nim: string | null;
  role: string;
  avatarUrl: string | null;
  vehiclePlate: string | null;
  vehicleType: string | null;
  verifyStatus: string | null;
  appMode?: string;
  ktmUrl?: string | null;
  isOnline: boolean;
  rating: number;
  ratingCount: number;
  totalTrips: number;
  totalEarnings: number;
  passwordHash?: string;
  [key: string]: unknown;
}) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    nim: u.nim,
    role: u.role,
    avatarUrl: u.avatarUrl,
    vehiclePlate: u.vehiclePlate,
    vehicleType: u.vehicleType,
    ktmUrl: u.ktmUrl ?? null,
    verifyStatus: u.verifyStatus,
    appMode: u.appMode === "DRIVER" ? "DRIVER" : "PENUMPANG",
    isOnline: u.isOnline,
    rating: u.rating,
    ratingCount: u.ratingCount,
    totalTrips: u.totalTrips,
    totalEarnings: u.totalEarnings,
  };
}

export type SafeUser = ReturnType<typeof toSafeUser>;
