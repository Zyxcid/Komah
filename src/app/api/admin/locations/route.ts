import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// Kelola lokasi (admin) — daftar & tambah titik baru dengan nama + koordinat.
// Tarif tidak lagi diatur per lokasi: harga dihitung otomatis dari jarak
// tempuh rute sesuai daftar harga resmi (src/lib/fare.ts).
const CATEGORIES = ["KAMPUS", "KOS", "PUBLIK"] as const;

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Hanya admin." }, { status: 403 });
  const locations = await db.location.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
  return NextResponse.json({ locations });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Hanya admin." }, { status: 403 });
  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const category = CATEGORIES.includes(body.category) ? body.category : "PUBLIK";
    const lat = body.lat === "" || body.lat == null ? null : Number(body.lat);
    const lng = body.lng === "" || body.lng == null ? null : Number(body.lng);
    const isPopular = !!body.isPopular;

    if (!name) return NextResponse.json({ error: "Nama lokasi wajib diisi." }, { status: 400 });
    const badCoords = (lat != null && (!Number.isFinite(lat) || Math.abs(lat) > 90)) || (lng != null && (!Number.isFinite(lng) || Math.abs(lng) > 180));
    if (badCoords) return NextResponse.json({ error: "Koordinat tidak valid." }, { status: 400 });

    const exists = await db.location.findFirst({ where: { name } });
    if (exists) return NextResponse.json({ error: "Lokasi dengan nama itu sudah ada." }, { status: 409 });

    const created = await db.location.create({ data: { name, category, isPopular, lat, lng } });
    return NextResponse.json({ location: created, message: "Lokasi ditambahkan." });
  } catch (e) {
    console.error("admin locations POST error", e);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
