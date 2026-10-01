import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });
  const addresses = await db.savedAddress.findMany({
    where: { userId: user.id },
    include: { location: true },
  });
  return NextResponse.json({ addresses });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });

  const { label, locationId, detail } = await req.json();
  if (!label?.trim() || !locationId) {
    return NextResponse.json({ error: "Label dan lokasi wajib diisi." }, { status: 400 });
  }
  const location = await db.location.findUnique({ where: { id: locationId } });
  if (!location) return NextResponse.json({ error: "Lokasi tidak ditemukan." }, { status: 400 });

  const count = await db.savedAddress.count({ where: { userId: user.id } });
  if (count >= 5) return NextResponse.json({ error: "Maksimal 5 alamat tersimpan." }, { status: 400 });

  const address = await db.savedAddress.create({
    data: { userId: user.id, label: label.trim(), locationId, detail: detail?.trim() || null },
    include: { location: true },
  });
  return NextResponse.json({ address, message: "Alamat ditambahkan." });
}
