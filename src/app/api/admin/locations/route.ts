import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getBaseFare } from "@/lib/settings";

const CATEGORIES = ["KAMPUS", "KOS", "PUBLIK"];

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

// Validasi badan lokasi (dipakai POST & PATCH).
function parseLocationBody(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category = typeof body.category === "string" ? body.category : "";
  const fare = typeof body.fare === "number" ? Math.round(body.fare) : NaN;
  const isPopular = body.isPopular === true;
  const lat = typeof body.lat === "number" && Number.isFinite(body.lat) && Math.abs(body.lat) <= 90 ? body.lat : null;
  const lng = typeof body.lng === "number" && Number.isFinite(body.lng) && Math.abs(body.lng) <= 180 ? body.lng : null;

  if (!name) return { error: "Nama lokasi wajib diisi." as const };
  if (!CATEGORIES.includes(category)) return { error: "Kategori tidak valid." as const };
  if (!Number.isFinite(fare) || fare < 0 || fare > 1_000_000) return { error: "Tarif tidak valid (Rp0 – Rp1.000.000)." as const };
  if (lat == null || lng == null) return { error: "Tandai titik koordinat di peta dulu." as const };

  return { data: { name, category, fare, isPopular, lat, lng } };
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Hanya admin." }, { status: 403 });
  }
  const [locations, baseFare] = await Promise.all([
    db.location.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    getBaseFare(),
  ]);
  return NextResponse.json({ locations, baseFare });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Hanya admin." }, { status: 403 });
  }
  try {
    const body = await req.json();
    const parsed = parseLocationBody(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const created = await db.location.create({ data: parsed.data });
    return NextResponse.json({ message: `Lokasi "${created.name}" ditambahkan.`, location: created });
  } catch (e) {
    console.error("create location error", e);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
