import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// Hapus langganan push perangkat ini (toggle dimatikan / keluar akun).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });
  try {
    const { endpoint } = await req.json();
    if (typeof endpoint !== "string" || !endpoint) return NextResponse.json({ ok: true });
    const sub = await db.pushSubscription.findUnique({ where: { endpoint } });
    if (sub && sub.userId === user.id) {
      await db.pushSubscription.delete({ where: { endpoint } }).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("push unsubscribe error", e);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
