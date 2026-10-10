import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// Simpan (atau perbarui) langganan push perangkat pengguna ini.
// Driver → notifikasi pesanan baru; penumpang → status pesanan;
// admin → kabar driver baru mendaftar. Semua role boleh berlangganan.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }
  try {
    const { endpoint, p256dh, auth } = await req.json();
    if (typeof endpoint !== "string" || !endpoint || typeof p256dh !== "string" || typeof auth !== "string") {
      return NextResponse.json({ error: "Data langganan tidak lengkap." }, { status: 400 });
    }
    await db.pushSubscription.upsert({
      where: { endpoint },
      update: { p256dh, auth, userId: user.id },
      create: { endpoint, p256dh, auth, userId: user.id },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
