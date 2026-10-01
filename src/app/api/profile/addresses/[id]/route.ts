import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });

  const { id } = await ctx.params;
  const address = await db.savedAddress.findUnique({ where: { id } });
  if (!address || address.userId !== user.id) {
    return NextResponse.json({ error: "Alamat tidak ditemukan." }, { status: 404 });
  }
  await db.savedAddress.delete({ where: { id } });
  return NextResponse.json({ ok: true, message: "Alamat dihapus." });
}
