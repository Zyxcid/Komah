import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getBaseFare } from "@/lib/settings";

// Pengaturan aplikasi (admin) — saat ini: tarif dasar dalam kampus.
async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Hanya admin." }, { status: 403 });
  return NextResponse.json({ baseFare: await getBaseFare() });
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Hanya admin." }, { status: 403 });
  try {
    const body = await req.json();
    const fare = Math.round(Number(body.baseFare));
    if (!Number.isFinite(fare) || fare < 1000 || fare > 100000) {
      return NextResponse.json({ error: "Tarif dasar harus antara Rp1.000 - Rp100.000." }, { status: 400 });
    }
    await db.setting.upsert({
      where: { key: "baseFare" },
      update: { value: String(fare) },
      create: { key: "baseFare", value: String(fare) },
    });
    return NextResponse.json({ baseFare: fare, message: "Tarif dasar diperbarui." });
  } catch (e) {
    console.error("admin settings error", e);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
