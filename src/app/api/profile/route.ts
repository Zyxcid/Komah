import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, toSafeUser } from "@/lib/session";
import { sendWA, waDriverRegistered } from "@/lib/wa";

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });

  const body = await req.json();

  // ===== Ganti mode aplikasi (PENUMPANG <-> DRIVER) =====
  // Guard dua arah: tidak boleh pindah saat sedang mengantar (driver)
  // atau saat jadi penumpang aktif (pesanan berjalan).
  if (body.appMode === "PENUMPANG" || body.appMode === "DRIVER") {
    const target = body.appMode as "PENUMPANG" | "DRIVER";
    if (user.role !== "DRIVER") {
      return NextResponse.json({ error: "Hanya akun driver yang bisa mengganti mode." }, { status: 403 });
    }
    const [driving, riding] = await Promise.all([
      db.order.findFirst({
        where: { driverId: user.id, status: { in: ["DIKONFIRMASI", "BERJALAN"] } },
        select: { id: true },
      }),
      db.order.findFirst({
        where: { userId: user.id, status: { in: ["MENCARI", "DIKONFIRMASI", "BERJALAN"] } },
        select: { id: true },
      }),
    ]);
    if (target === "PENUMPANG" && driving) {
      return NextResponse.json({ error: "Selesaikan pesanan yang sedang Anda antar dulu." }, { status: 409 });
    }
    if (target === "DRIVER" && riding) {
      return NextResponse.json({ error: "Selesaikan perjalanan Anda sebagai penumpang dulu." }, { status: 409 });
    }
    const updated = await db.user.update({ where: { id: user.id }, data: { appMode: target } });
    return NextResponse.json({ user: toSafeUser(updated), message: "Mode aplikasi diganti." });
  }

  // ===== Naik kelas: penumpang (atau driver ditolak) mendaftar jadi driver =====
  if (body.driverRegister) {
    const { vehiclePlate, vehicleType, ktmUrl } = body.driverRegister as {
      vehiclePlate?: string;
      vehicleType?: string;
      ktmUrl?: string;
    };
    if (user.role !== "USER" && !(user.role === "DRIVER" && user.verifyStatus === "REJECTED")) {
      return NextResponse.json({ error: "Akun Anda sudah terdaftar sebagai driver." }, { status: 409 });
    }
    if (!vehiclePlate?.trim() || !vehicleType?.trim() || !ktmUrl) {
      return NextResponse.json({ error: "Nomor polisi, jenis motor, dan foto KTM wajib diisi." }, { status: 400 });
    }
    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        role: "DRIVER",
        vehiclePlate: vehiclePlate.trim(),
        vehicleType: vehicleType.trim(),
        ktmUrl,
        verifyStatus: "PENDING",
        // Mode tidak diubah — penumpang tetap di beranda, tak ada kejutan.
      },
    });
    const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { phone: true } });
    const msg = waDriverRegistered({ name: user.name, vehicle: vehicleType.trim() });
    for (const a of admins) sendWA(a.phone, msg);
    return NextResponse.json({
      user: toSafeUser(updated),
      message: "Pendaftaran driver terkirim! Menunggu verifikasi KTM oleh admin (maks. 1x24 jam).",
    });
  }

  // ===== Perbarui profil biasa =====
  const data: { name?: string; phone?: string; avatarUrl?: string } = {};
  if (body.name?.trim()) data.name = body.name.trim();
  if (body.phone?.trim()) data.phone = body.phone.trim();
  if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Tidak ada perubahan." }, { status: 400 });
  }

  const updated = await db.user.update({ where: { id: user.id }, data });
  return NextResponse.json({ user: toSafeUser(updated), message: "Profil diperbarui." });
}
