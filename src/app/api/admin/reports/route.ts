import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// Panel Laporan (admin) — daftar laporan pelanggaran dari pengguna
// (penumpang → driver dan driver → penumpang), status terbuka/selesai.
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Hanya admin." }, { status: 403 });

  const reports = await db.report.findMany({
    include: {
      order: { select: { id: true, code: true, type: true } },
      reporter: { select: { id: true, name: true } },
      target: { select: { id: true, name: true, role: true, banned: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const openCount = reports.filter((r) => r.status === "OPEN").length;
  return NextResponse.json({ reports, openCount });
}
