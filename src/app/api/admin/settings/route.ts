import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { KEY_BASE_FARE, setSetting } from "@/lib/settings";

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Hanya admin." }, { status: 403 });
  }
  try {
    const body = await req.json();
    const baseFare = typeof body.baseFare === "number" ? Math.round(body.baseFare) : NaN;
    if (!Number.isFinite(baseFare) || baseFare < 1000 || baseFare > 1_000_000) {
      return NextResponse.json({ error: "Tarif dasar tidak valid (Rp1.000 – Rp1.000.000)." }, { status: 400 });
    }
    await setSetting(KEY_BASE_FARE, String(baseFare));
    return NextResponse.json({ message: `Tarif dasar dalam kampus diubah menjadi Rp${baseFare.toLocaleString("id-ID")}.` });
  } catch (e) {
    console.error("update setting error", e);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
