import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { sendWA, waOrderAccepted, waOrderCancelled, waOrderCompleted, waOrderStarted } from "@/lib/wa";

const orderInclude = {
  pickupLocation: true,
  destLocation: true,
  driver: { select: { id: true, name: true, phone: true, rating: true, ratingCount: true, vehiclePlate: true, vehicleType: true, avatarUrl: true, isOnline: true } },
  user: { select: { id: true, name: true, phone: true, nim: true, avatarUrl: true } },
};

async function findOrder(idOrCode: string) {
  return db.order.findFirst({
    where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
    include: orderInclude,
  });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });

  const { id } = await ctx.params;
  const order = await findOrder(id);
  if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });

  const allowed = order.userId === user.id || order.driverId === user.id || user.role === "ADMIN";
  if (!allowed) return NextResponse.json({ error: "Tidak berhak mengakses." }, { status: 403 });

  return NextResponse.json({ order });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });

  const { id } = await ctx.params;
  const order = await findOrder(id);
  if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });

  const body = await req.json();
  const action = body.action as string;

  // ===== Aksi pengguna =====
  if (action === "cancel") {
    if (order.userId !== user.id) return NextResponse.json({ error: "Tidak berhak." }, { status: 403 });
    if (!["MENCARI", "DIKONFIRMASI"].includes(order.status)) {
      return NextResponse.json({ error: "Pesanan yang sedang berjalan tidak dapat dibatalkan." }, { status: 400 });
    }
    const updated = await db.order.update({
      where: { id: order.id },
      data: { status: "DIBATALKAN", cancelledAt: new Date() },
      include: orderInclude,
    });
    // Beri tahu driver yang sudah menerima (jika ada).
    if (order.driverId) {
      const drv = await db.user.findUnique({ where: { id: order.driverId }, select: { phone: true } });
      if (drv) sendWA(drv.phone, waOrderCancelled({ code: order.code }));
    }
    return NextResponse.json({ order: updated, message: "Pesanan dibatalkan." });
  }

  if (action === "rate") {
    if (order.userId !== user.id) return NextResponse.json({ error: "Tidak berhak." }, { status: 403 });
    if (order.status !== "SELESAI") return NextResponse.json({ error: "Pesanan belum selesai." }, { status: 400 });
    if (order.rating) return NextResponse.json({ error: "Pesanan sudah dinilai." }, { status: 400 });
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating 1-5." }, { status: 400 });
    }
    const updated = await db.order.update({
      where: { id: order.id },
      data: { rating, review: body.review?.trim() || null },
      include: orderInclude,
    });
    if (order.driverId) {
      const driver = await db.user.findUnique({ where: { id: order.driverId } });
      if (driver) {
        const newCount = driver.ratingCount + 1;
        const newRating = (driver.rating * driver.ratingCount + rating) / newCount;
        await db.user.update({
          where: { id: driver.id },
          data: { rating: Math.round(newRating * 10) / 10, ratingCount: newCount },
        });
      }
    }
    return NextResponse.json({ order: updated, message: "Terima kasih atas penilaian Anda!" });
  }

  // ===== Aksi driver =====
  if (action === "position") {
    // Update posisi driver untuk pelacakan live (dipanggil dashboard driver tiap beberapa detik).
    if (order.driverId !== user.id) return NextResponse.json({ error: "Tidak berhak." }, { status: 403 });
    if (!["DIKONFIRMASI", "BERJALAN"].includes(order.status)) {
      return NextResponse.json({ error: "Pesanan tidak sedang aktif." }, { status: 400 });
    }
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return NextResponse.json({ error: "Koordinat tidak valid." }, { status: 400 });
    }
    await db.order.update({
      where: { id: order.id },
      data: { driverLat: lat, driverLng: lng, driverPosAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "accept") {
    if (user.role !== "DRIVER") return NextResponse.json({ error: "Hanya driver." }, { status: 403 });
    if (user.verifyStatus !== "VERIFIED") return NextResponse.json({ error: "Akun driver belum terverifikasi." }, { status: 403 });
    if (!user.isOnline) return NextResponse.json({ error: "Aktifkan mode online dulu." }, { status: 400 });

    const [fresh, driverActive] = await Promise.all([
      db.order.findUnique({ where: { id: order.id } }),
      db.order.findFirst({ where: { driverId: user.id, status: { in: ["DIKONFIRMASI", "BERJALAN"] } } }),
    ]);
    if (!fresh || fresh.status !== "MENCARI") {
      return NextResponse.json({ error: "Pesanan sudah diambil driver lain." }, { status: 409 });
    }
    if (driverActive) {
      return NextResponse.json({ error: "Selesaikan pesanan aktif Anda dulu." }, { status: 409 });
    }
    const updated = await db.order.update({
      where: { id: order.id },
      data: { driverId: user.id, status: "DIKONFIRMASI", acceptedAt: new Date() },
      include: orderInclude,
    });
    // Kabari penumpang bahwa driver ditemukan.
    if (order.user?.phone) {
      sendWA(
        order.user.phone,
        waOrderAccepted({
          code: order.code,
          driverName: user.name,
          vehicle: user.vehicleType,
          pickupName: order.pickupLocation.name,
          fare: order.fare,
        })
      );
    }
    return NextResponse.json({ order: updated, message: "Pesanan diterima. Menuju titik jemput!" });
  }

  if (action === "start" || action === "complete") {
    if (order.driverId !== user.id) return NextResponse.json({ error: "Tidak berhak." }, { status: 403 });
    if (action === "start") {
      if (order.status !== "DIKONFIRMASI") return NextResponse.json({ error: "Status tidak sesuai." }, { status: 400 });
      const updated = await db.order.update({
        where: { id: order.id },
        data: { status: "BERJALAN", startedAt: new Date() },
        include: orderInclude,
      });
      if (order.user?.phone) {
        sendWA(order.user.phone, waOrderStarted({ code: order.code, destName: order.destLocation.name, fare: order.fare }));
      }
      return NextResponse.json({ order: updated, message: "Perjalanan dimulai." });
    }
    if (order.status !== "BERJALAN") return NextResponse.json({ error: "Status tidak sesuai." }, { status: 400 });
    const updated = await db.order.update({
      where: { id: order.id },
      data: { status: "SELESAI", completedAt: new Date() },
      include: orderInclude,
    });
    await db.user.update({
      where: { id: user.id },
      data: { totalTrips: { increment: 1 }, totalEarnings: { increment: order.fare - 1000 } },
    });
    if (order.user?.phone) {
      sendWA(order.user.phone, waOrderCompleted({ code: order.code, fare: order.fare }));
    }
    return NextResponse.json({ order: updated, message: "Pesanan selesai. Kerja bagus!" });
  }

  return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
}
