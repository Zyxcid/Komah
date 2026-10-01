import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.toLowerCase().trim();
  const onlineOnly = searchParams.get("online") === "1";

  const drivers = await db.user.findMany({
    where: {
      role: "DRIVER",
      verifyStatus: "VERIFIED",
      ...(onlineOnly ? { isOnline: true } : {}),
    },
    select: {
      id: true,
      name: true,
      nim: true,
      avatarUrl: true,
      vehiclePlate: true,
      vehicleType: true,
      isOnline: true,
      rating: true,
      ratingCount: true,
      totalTrips: true,
    },
  });

  const filtered = search
    ? drivers.filter(
        (d) =>
          d.name.toLowerCase().includes(search) ||
          (d.vehicleType || "").toLowerCase().includes(search) ||
          (d.vehiclePlate || "").toLowerCase().includes(search)
      )
    : drivers;

  filtered.sort((a, b) => {
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    return b.rating - a.rating;
  });

  return NextResponse.json({ drivers: filtered });
}
