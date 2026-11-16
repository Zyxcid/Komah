import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// Direktori driver (admin) — seluruh driver beserta status online,
// verifikasi, rating, statistik, dan status blokir. Dipakai panel
// "Kelola Driver" untuk mengawasi dan menindak pelanggaran.
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Hanya admin." }, { status: 403 });

  const drivers = await db.user.findMany({
    where: { role: "DRIVER" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      nim: true,
      avatarUrl: true,
      vehiclePlate: true,
      vehicleType: true,
      verifyStatus: true,
      isOnline: true,
      rating: true,
      ratingCount: true,
      totalTrips: true,
      totalEarnings: true,
      banned: true,
      banReason: true,
      bannedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Pesanan yang sedang diantar per driver (untuk peringatan saat blokir).
  const active = await db.order.findMany({
    where: { status: { in: ["DIKONFIRMASI", "BERJALAN"] }, driverId: { not: null } },
    select: { driverId: true },
  });
  const activeCount: Record<string, number> = {};
  for (const o of active) {
    if (o.driverId) activeCount[o.driverId] = (activeCount[o.driverId] || 0) + 1;
  }

  return NextResponse.json({
    drivers: drivers.map((d) => ({ ...d, activeOrders: activeCount[d.id] || 0 })),
  });
}
