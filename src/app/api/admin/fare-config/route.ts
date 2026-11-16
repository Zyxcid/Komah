import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getFareConfig, saveFareConfig } from "@/lib/fare-config";

// Kelola Tarif (admin) — baca & simpan seluruh angka tarif (tingkat jarak,
// surcharge hujan/porsi/tempat/waktu tunggu/jam malam). Perubahan berlaku
// untuk pesanan BARU; pesanan lama memakai rincian tarif yang sudah
// tersimpan di pesanannya masing-masing.
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Hanya admin." }, { status: 403 });
  const config = await getFareConfig();
  return NextResponse.json({ config });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Hanya admin." }, { status: 403 });

  const body = await req.json();
  if (typeof body?.config !== "object" || body.config === null) {
    return NextResponse.json({ error: "Data tarif tidak valid." }, { status: 400 });
  }

  try {
    const config = await saveFareConfig(body.config);
    return NextResponse.json({
      config,
      message: "Tarif tersimpan — berlaku untuk pesanan baru mulai sekarang.",
    });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan tarif. Coba lagi." }, { status: 500 });
  }
}
