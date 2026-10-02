import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBaseFare } from "@/lib/settings";

// Selalu render dinamis — tanpa ini Next.js mencoba prerender statis saat
// `next build` (di Vercel) dan query DB dijalankan saat build, bukan runtime.
export const dynamic = "force-dynamic";

export async function GET() {
  const [locations, baseFare] = await Promise.all([
    db.location.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
    getBaseFare(),
  ]);
  return NextResponse.json({ locations, baseFare });
}
