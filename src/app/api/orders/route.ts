import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { calcOfficialFare, resolveDistanceMeters } from "@/lib/fare";
import { pushNewOrderToDrivers } from "@/lib/push";
import { expireStaleMencariOrders } from "@/lib/order-expiry";
import { getFareConfig } from "@/lib/fare-config";
import crypto from "crypto";

const ACTIVE = ["MENCARI", "DIKONFIRMASI", "BERJALAN"] as const;

async function generateCode() {
  for (let i = 0; i < 20; i++) {
    const code = `KMH-${crypto.randomInt(1000, 9999)}`;
    const exists = await db.order.findUnique({ where: { code } });
    if (!exists) return code;
  }
  return `KMH-${Date.now().toString().slice(-6)}`;
}

const orderInclude = {
  pickupLocation: true,
  destLocation: true,
  driver: { select: { id: true, name: true, phone: true, rating: true, ratingCount: true, vehiclePlate: true, vehicleType: true, avatarUrl: true, isOnline: true } },
  user: { select: { id: true, name: true, phone: true, nim: true, avatarUrl: true } },
};

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");

  // Bersihkan pesanan usang (MENCARI > 30 menit) sebelum mengambil daftar.
  await expireStaleMencariOrders().catch(() => {});

  if (scope === "driver") {
    if (user.role !== "DRIVER") return NextResponse.json({ error: "Hanya driver." }, { status: 403 });
    const [incoming, active] = await Promise.all([
      user.isOnline && user.verifyStatus === "VERIFIED"
        ? db.order.findMany({ where: { status: "MENCARI" }, include: orderInclude, orderBy: { createdAt: "desc" }, take: 10 })
        : Promise.resolve([]),
      db.order.findMany({ where: { driverId: user.id, status: { in: ["DIKONFIRMASI", "BERJALAN"] } }, include: orderInclude, orderBy: { createdAt: "desc" } }),
    ]);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const completedToday = await db.order.findMany({
      where: { driverId: user.id, status: "SELESAI", completedAt: { gte: startOfDay } },
      select: { fare: true },
    });

    return NextResponse.json({
      incoming,
      active,
      stats: {
        todayEarnings: completedToday.reduce((s, o) => s + (o.fare - 1000), 0),
        todayTrips: completedToday.length,
        totalTrips: user.totalTrips,
        totalEarnings: user.totalEarnings,
        rating: user.rating,
        ratingCount: user.ratingCount,
        isOnline: user.isOnline,
        verifyStatus: user.verifyStatus,
      },
    });
  }

  const orders = await db.order.findMany({
    where: { userId: user.id },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });

  try {
    const body = await req.json();
    const { type, pickupLocationId, destLocationId, pickupDetail, destDetail, itemNote, passengerNote } = body;

    // Koordinat pin opsional (hasil geser pin di peta) — divalidasi kasar.
    const coord = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 180 ? v : undefined);
    const pickupLat = coord(body.pickupLat);
    const pickupLng = coord(body.pickupLng);
    const destLat = coord(body.destLat);
    const destLng = coord(body.destLng);

    // Input tarif resmi (jarak rute diukur klien via OSRM; sisanya pilihan pelanggan).
    const rain = body.rain === true;
    const int0 = (v: unknown) => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n >= 0 ? n : undefined;
    };
    const portions = type === "MAKANAN" ? Math.min(int0(body.portions) ?? 1, 50) : null;
    const places = type === "MAKANAN" ? Math.min(int0(body.places) ?? 1, 20) : null;
    const distanceMetersClient = int0(body.distanceMeters);

    if (!["OJEK", "BARANG", "MAKANAN"].includes(type)) {
      return NextResponse.json({ error: "Jenis layanan tidak valid." }, { status: 400 });
    }
    if ((type === "BARANG" || type === "MAKANAN") && !itemNote?.trim()) {
      return NextResponse.json({ error: "Deskripsi barang/makanan wajib diisi." }, { status: 400 });
    }
    if (!pickupLocationId || !destLocationId || pickupLocationId === destLocationId) {
      return NextResponse.json({ error: "Lokasi jemput dan tujuan wajib berbeda." }, { status: 400 });
    }

    const [pickup, dest] = await Promise.all([
      db.location.findUnique({ where: { id: pickupLocationId } }),
      db.location.findUnique({ where: { id: destLocationId } }),
    ]);
    if (!pickup || !dest) {
      return NextResponse.json({ error: "Lokasi tidak ditemukan." }, { status: 400 });
    }

    // Guard anti-konflik: satu pesanan penumpang aktif pada satu waktu,
    // dan driver yang sedang mengantar tidak boleh memesan perjalanan.
    const [existingActive, driving] = await Promise.all([
      db.order.findFirst({
        where: { userId: user.id, status: { in: ACTIVE as unknown as string[] } },
      }),
      db.order.findFirst({
        where: { driverId: user.id, status: { in: ["DIKONFIRMASI", "BERJALAN"] } },
        select: { id: true },
      }),
    ]);
    if (driving) {
      return NextResponse.json({ error: "Anda sedang mengantar pesanan. Selesaikan dulu." }, { status: 409 });
    }
    if (existingActive) {
      return NextResponse.json({ error: "Anda masih memiliki pesanan aktif. Selesaikan atau batalkan dulu." }, { status: 409 });
    }

    // Tarif resmi: jarak tempuh + surcharge (hujan/porsi/tempat/malam).
    // Jarak dipilih server: ukuran rute klien bila wajar, jika tidak
    // perkiraan garis lurus × faktor jalan (lihat src/lib/fare.ts).
    const orderTime = new Date();
    const distanceMeters = resolveDistanceMeters(
      distanceMetersClient,
      { lat: pickupLat ?? pickup.lat ?? null, lng: pickupLng ?? pickup.lng ?? null },
      { lat: destLat ?? dest.lat ?? null, lng: destLng ?? dest.lng ?? null }
    );
    const breakdown = calcOfficialFare(
      {
        distanceKm: (distanceMeters ?? 100) / 1000,
        type,
        rain,
        portions: portions ?? undefined,
        places: places ?? undefined,
        orderTime,
      },
      await getFareConfig()
    );
    const fare = breakdown.total;
    const order = await db.order.create({
      data: {
        code: await generateCode(),
        userId: user.id,
        type,
        pickupLocationId: pickup.id,
        destLocationId: dest.id,
        // Prioritaskan pin yang digeser user; fallback ke koordinat lokasi.
        pickupLat: pickupLat ?? pickup.lat,
        pickupLng: pickupLng ?? pickup.lng,
        destLat: destLat ?? dest.lat,
        destLng: destLng ?? dest.lng,
        pickupDetail: pickupDetail?.trim() || null,
        destDetail: destDetail?.trim() || null,
        itemNote: itemNote?.trim() || null,
        passengerNote: passengerNote?.trim() || null,
        distanceMeters,
        rain,
        portions,
        places,
        fareBreakdown: breakdown as unknown as object,
        fare,
        status: "MENCARI",
      },
      include: orderInclude,
    });

    // Web Push ke semua driver online terverifikasi — notifikasi sampai walau
    // aplikasi/tab KOMAH ditutup. Gagal kirim tidak boleh mengganggu pesanan.
    await pushNewOrderToDrivers({
      code: order.code,
      type: order.type,
      pickupName: pickup.name,
      destName: dest.name,
      fare: order.fare,
    }).catch(() => {});

    return NextResponse.json({ order });
  } catch (e) {
    console.error("create order error", e);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
