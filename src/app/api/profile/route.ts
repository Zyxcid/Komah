import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, toSafeUser } from "@/lib/session";

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });

  const body = await req.json();
  const data: { name?: string; phone?: string; avatarUrl?: string } = {};
  if (body.name?.trim()) data.name = body.name.trim();
  if (body.phone?.trim()) data.phone = body.phone.trim();
  if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Tidak ada perubahan." }, { status: 400 });
  }

  const updated = await db.user.update({ where: { id: user.id }, data });
  return NextResponse.json({ user: toSafeUser(updated), message: "Profil diperbarui." });
}
