import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Selalu render dinamis — tanpa ini Next.js mencoba prerender statis saat
// `next build` (di Vercel) dan query DB dijalankan saat build, bukan runtime.
export const dynamic = "force-dynamic";

export async function GET() {
  const locations = await db.location.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
  return NextResponse.json({ locations });
}
