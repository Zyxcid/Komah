import { NextResponse } from "next/server";
import { getCurrentUser, toSafeUser } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 200 });

  const addresses = await db.savedAddress.findMany({
    where: { userId: user.id },
    include: { location: true },
    orderBy: { createdAt: "asc" },
  });

  const activeOrder = await db.order.findFirst({
    where: { userId: user.id, status: { in: ["MENCARI", "DIKONFIRMASI", "BERJALAN"] } },
    include: {
      pickupLocation: true,
      destLocation: true,
      driver: { select: { id: true, name: true, phone: true, rating: true, vehiclePlate: true, vehicleType: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ user: toSafeUser(user), addresses, activeOrder });
}
