import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { msgDriverBanned, sendPushToUser } from "@/lib/push";

// Tindak lanjut laporan (admin): blokir driver yang dilaporkan (langsung
// menutup laporan), atau tandai laporan selesai dengan catatan.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Hanya admin." }, { status: 403 });

  const { id } = await ctx.params;
  const report = await db.report.findUnique({ where: { id }, include: { target: true } });
  if (!report) return NextResponse.json({ error: "Laporan tidak ditemukan." }, { status: 404 });

  const body = await req.json();
  const action = body.action as string;

  if (action === "ban_target") {
    if (report.target.role !== "DRIVER") {
      return NextResponse.json({ error: "Blokir penumpang belum didukung — tindak lewat kontak langsung." }, { status: 400 });
    }
    if (report.target.banned) {
      return NextResponse.json({ error: "Driver ini sudah diblokir." }, { status: 409 });
    }
    const reason = String(body.reason || "").trim();
    if (reason.length < 4 || reason.length > 200) {
      return NextResponse.json({ error: "Tulis alasan pemblokiran (4–200 karakter)." }, { status: 400 });
    }
    await db.user.update({
      where: { id: report.targetId },
      data: { banned: true, banReason: reason, bannedAt: new Date(), isOnline: false },
    });
    await sendPushToUser(report.targetId, msgDriverBanned({ name: report.target.name, reason })).catch(() => {});
    const updated = await db.report.update({
      where: { id },
      data: { status: "RESOLVED", resolution: `Driver diblokir: ${reason}`, resolvedAt: new Date() },
      include: {
        order: { select: { id: true, code: true, type: true } },
        reporter: { select: { id: true, name: true } },
        target: { select: { id: true, name: true, role: true, banned: true } },
      },
    });
    return NextResponse.json({
      report: updated,
      message: `${report.target.name} diblokir dan laporan ditutup.`,
    });
  }

  if (action === "resolve") {
    const resolution = String(body.resolution || "").trim().slice(0, 300) || null;
    const updated = await db.report.update({
      where: { id },
      data: { status: "RESOLVED", resolution, resolvedAt: new Date() },
      include: {
        order: { select: { id: true, code: true, type: true } },
        reporter: { select: { id: true, name: true } },
        target: { select: { id: true, name: true, role: true, banned: true } },
      },
    });
    return NextResponse.json({ report: updated, message: "Laporan ditandai selesai." });
  }

  return NextResponse.json({ error: "Parameter tidak valid." }, { status: 400 });
}
