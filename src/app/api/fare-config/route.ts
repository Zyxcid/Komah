import { NextResponse } from "next/server";
import { getFareConfig } from "@/lib/fare-config";

// Daftar tarif aktif (publik) — dipakai aplikasi penumpang & driver untuk
// preview harga dengan angka yang sama persis dengan server. Bukan rahasia:
// ini daftar harga yang memang ditampilkan ke pengguna.
export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getFareConfig();
  return NextResponse.json({ config });
}
