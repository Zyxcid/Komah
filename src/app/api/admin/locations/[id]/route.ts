import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

const CATEGORIES = ["KAMPUS", "KOS", "PUBLIK"];

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Hanya admin." }, { status: 403 });
  }
  try {
    const { id } = await params;
    const existing = await db.location.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Lokasi tidak ditemukan." }, { status: 404 });
    }

    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) return NextResponse.json({ error: "Nama lokasi wajib diisi." }, { status: 400 });
      data.name = name;
    }
    if (typeof body.category === "string") {
      if (!CATEGORIES.includes(body.category)) {
        return NextResponse.json({ error: "Kategori tidak valid." }, { status: 400 });
      }
      data.category = body.category;
    }
    if (typeof body.fare === "number") {
      const fare = Math.round(body.fare);
      if (!Number.isFinite(fare) || fare < 0 || fare > 1_000_000) {
        return NextResponse.json({ error: "Tarif tidak valid (Rp0 – Rp1.000.000)." }, { status: 400 });
      }
      data.fare = fare;
    }
    if (typeof body.isPopular === "boolean") data.isPopular = body.isPopular;
    if (typeof body.lat === "number" && Number.isFinite(body.lat) && Math.abs(body.lat) <= 90) data.lat = body.lat;
    if (typeof body.lng === "number" && Number.isFinite(body.lng) && Math.abs(body.lng) <= 180) data.lng = body.lng;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Tidak ada perubahan." }, { status: 400 });
    }

    const updated = await db.location.update({ where: { id }, data });
    return NextResponse.json({ message: `Lokasi "${updated.name}" diperbarui.`, location: updated });
  } catch (e) {
    console.error("update location error", e);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Hanya admin." }, { status: 403 });
  }
  try {
    const { id } = await params;
    const existing = await db.location.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Lokasi tidak ditemukan." }, { status: 404 });
    }

    // Cek referensi dulu agar pesan errornya ramah (bukan error FK mentah).
    const [orderCount, addressCount] = await Promise.all([
      db.order.count({ where: { OR: [{ pickupLocationId: id }, { destLocationId: id }] } }),
      db.savedAddress.count({ where: { locationId: id } }),
    ]);
    if (orderCount > 0 || addressCount > 0) {
      return NextResponse.json(
        {
          error: `Lokasi ini tercatat di ${orderCount} pesanan & ${addressCount} alamat tersimpan, jadi tidak dapat dihapus. Sunting saja bila ingin menyesuaikan.`,
        },
        { status: 409 }
      );
    }

    await db.location.delete({ where: { id } });
    return NextResponse.json({ message: `Lokasi "${existing.name}" dihapus.` });
  } catch (e) {
    console.error("delete location error", e);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
