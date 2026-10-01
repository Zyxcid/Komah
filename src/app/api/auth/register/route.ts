import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { sendWA, waDriverRegistered } from "@/lib/wa";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, phone, nim, role, vehiclePlate, vehicleType, ktmUrl } = body;

    if (!name?.trim() || !email?.trim() || !password || !phone?.trim() || !nim?.trim()) {
      return NextResponse.json({ error: "Nama, email, kata sandi, no. HP, dan NIM/NIP wajib diisi." }, { status: 400 });
    }
    if (String(password).length < 6) {
      return NextResponse.json({ error: "Kata sandi minimal 6 karakter." }, { status: 400 });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Format email tidak valid." }, { status: 400 });
    }

    const isDriver = role === "DRIVER";
    if (isDriver && (!vehiclePlate?.trim() || !vehicleType?.trim() || !ktmUrl)) {
      return NextResponse.json({ error: "Data kendaraan dan foto KTM wajib diisi untuk driver." }, { status: 400 });
    }

    const existing = await db.user.findFirst({
      where: { OR: [{ email: email.toLowerCase() }, { nim: nim.trim() }] },
    });
    if (existing) {
      const field = existing.email === email.toLowerCase() ? "Email" : "NIM/NIP";
      return NextResponse.json({ error: `${field} sudah terdaftar. Silakan masuk.` }, { status: 409 });
    }

    const user = await db.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase(),
        passwordHash: hashPassword(String(password)),
        phone: phone.trim(),
        nim: nim.trim(),
        role: isDriver ? "DRIVER" : "USER",
        // Daftar langsung sebagai driver → buka aplikasi di dashboard driver.
        appMode: isDriver ? "DRIVER" : "PENUMPANG",
        vehiclePlate: isDriver ? vehiclePlate.trim() : null,
        vehicleType: isDriver ? vehicleType.trim() : null,
        ktmUrl: isDriver ? ktmUrl : null,
        verifyStatus: isDriver ? "PENDING" : null,
      },
    });

    // Kabari semua admin via WA: ada driver baru yang menunggu verifikasi.
    if (isDriver) {
      const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { phone: true } });
      const msg = waDriverRegistered({ name: user.name, vehicle: user.vehicleType });
      for (const a of admins) sendWA(a.phone, msg);
    }

    return NextResponse.json({
      ok: true,
      message: isDriver
        ? "Pendaftaran berhasil! Akun driver Anda menunggu verifikasi KTM oleh admin (maks. 1x24 jam)."
        : "Pendaftaran berhasil! Silakan masuk.",
    });
  } catch (e) {
    console.error("register error", e);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
