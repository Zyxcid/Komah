import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// Monitor pesanan (admin) — pesanan terbaru lintas pengguna untuk
// pengawasan & intervensi (batalkan pesanan bermasalah lewat detailnya).
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Hanya admin." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("status"); // aktif | selesai | dibatalkan

  const where =
    filter === "aktif"
      ? { status: { in: ["MENCARI", "DIKONFIRMASI", "BERJALAN"] } }
      : filter === "selesai"
        ? { status: "SELESAI" }
        : filter === "dibatalkan"
          ? { status: "DIBATALKAN" }
          : {};

  const orders = await db.order.findMany({
    where,
    select: {
      id: true,
      code: true,
      type: true,
      status: true,
      fare: true,
      rating: true,
      createdAt: true,
      completedAt: true,
      cancelledAt: true,
      pickupLocation: { select: { name: true } },
      destLocation: { select: { name: true } },
      driver: { select: { name: true } },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ orders });
}
