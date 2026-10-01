import { NextResponse } from "next/server";
import { getCurrentUser, toSafeUser } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 200 });

  const [addresses, activeOrder, activeDriveOrder] = await Promise.all([
    db.savedAddress.findMany({
      where: { userId: user.id },
      include: { location: true },
      orderBy: { createdAt: "asc" },
    }),
    db.order.findFirst({
      where: { userId: user.id, status: { in: ["MENCARI", "DIKONFIRMASI", "BERJALAN"] } },
      include: {
        pickupLocation: true,
        destLocation: true,
        driver: { select: { id: true, name: true, phone: true, rating: true, vehiclePlate: true, vehicleType: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Pesanan yang sedang driver ini antar — dikunci sampai selesai (guard mode).
    db.order.findFirst({
      where: { driverId: user.id, status: { in: ["DIKONFIRMASI", "BERJALAN"] } },
      select: { id: true },
    }),
  ]);

  const safe = toSafeUser(user) as ReturnType<typeof toSafeUser> & { activeDrive?: boolean };
  safe.activeDrive = !!activeDriveOrder;

  return NextResponse.json({ user: safe, addresses, activeOrder });
}
