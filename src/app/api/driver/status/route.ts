import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DRIVER") {
    return NextResponse.json({ error: "Hanya driver." }, { status: 403 });
  }
  if (user.verifyStatus !== "VERIFIED") {
    return NextResponse.json({ error: "Akun belum terverifikasi." }, { status: 403 });
  }

  const { isOnline } = await req.json();
  if (typeof isOnline !== "boolean") {
    return NextResponse.json({ error: "Parameter tidak valid." }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: { isOnline },
  });

  return NextResponse.json({ isOnline: updated.isOnline });
}
