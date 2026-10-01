import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// Ubah / hapus lokasi (admin).
async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Hanya admin." }, { status: 403 });
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const data: { name?: string; category?: string; fare?: number; isPopular?: boolean; lat?: number | null; lng?: number | null } = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: "Nama tidak boleh kosong." }, { status: 400 });
      data.name = name;
    }
    if (body.category !== undefined) {
      if (!["KAMPUS", "KOS", "PUBLIK"].includes(body.category)) {
        return NextResponse.json({ error: "Kategori tidak valid." }, { status: 400 });
      }
      data.category = body.category;
    }
    if (body.fare !== undefined) {
      const fare = Math.round(Number(body.fare));
      if (!Number.isFinite(fare) || fare < 0) return NextResponse.json({ error: "Tarif tidak valid." }, { status: 400 });
      data.fare = fare;
    }
    if (body.isPopular !== undefined) data.isPopular = !!body.isPopular;
    if (body.lat !== undefined) data.lat = body.lat === null || body.lat === "" ? null : Number(body.lat);
    if (body.lng !== undefined) data.lng = body.lng === null || body.lng === "" ? null : Number(body.lng);

    const updated = await db.location.update({ where: { id }, data });
    return NextResponse.json({ location: updated, message: "Lokasi diperbarui." });
  } catch (e) {
    console.error("admin locations PATCH error", e);
    return NextResponse.json({ error: "Lokasi tidak ditemukan atau terjadi kesalahan." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Hanya admin." }, { status: 403 });
  try {
    const { id } = await ctx.params;
    // Cegah penghapusan bila lokasi masih dipakai pesanan/alamat tersimpan.
    const used = await db.order.findFirst({
      where: { OR: [{ pickupLocationId: id }, { destLocationId: id }] },
      select: { id: true },
    });
    if (used) {
      return NextResponse.json({ error: "Lokasi masih dipakai riwayat pesanan — tidak bisa dihapus." }, { status: 409 });
    }
    const usedAddr = await db.savedAddress.findFirst({ where: { locationId: id }, select: { id: true } });
    if (usedAddr) {
      return NextResponse.json({ error: "Lokasi masih dipakai alamat tersimpan pengguna — hapus alamatnya dulu." }, { status: 409 });
    }
    await db.location.delete({ where: { id } });
    return NextResponse.json({ message: "Lokasi dihapus." });
  } catch (e) {
    console.error("admin locations DELETE error", e);
    return NextResponse.json({ error: "Lokasi tidak ditemukan atau terjadi kesalahan." }, { status: 500 });
  }
}
