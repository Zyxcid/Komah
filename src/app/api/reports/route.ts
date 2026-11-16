import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { msgNewReport, sendPushToAdmins } from "@/lib/push";
import { REPORT_REASONS } from "@/lib/report-reasons";

// Laporan pelanggaran — dua arah: penumpang melaporkan driver, atau driver
// melaporkan penumpang, terkait satu pesanan. Kategori tetap agar mudah
// ditindak admin; uraian tambahan opsional. Satu laporan per pesanan per
// pelapor; admin menerima notifikasi push.

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });

  const { orderId, reason, note } = await req.json();
  if (!orderId || typeof reason !== "string" || !REPORT_REASONS.includes(reason as (typeof REPORT_REASONS)[number])) {
    return NextResponse.json({ error: "Kategori laporan tidak valid." }, { status: 400 });
  }
  const trimmedNote = typeof note === "string" ? note.trim().slice(0, 500) || null : null;

  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });

  // Hanya pihak pesanan yang boleh melapor; target = pihak lainnya.
  const isPassenger = order.userId === user.id;
  const isDriver = order.driverId === user.id;
  if (!isPassenger && !isDriver) {
    return NextResponse.json({ error: "Tidak berhak." }, { status: 403 });
  }
  const targetId = isPassenger ? order.driverId : order.userId;
  if (!targetId) {
    return NextResponse.json({ error: "Pesanan belum memiliki driver — belum ada yang bisa dilaporkan." }, { status: 400 });
  }
  // Laporan hanya untuk pesanan yang benar-benar berjalan (sudah ada driver).
  if (order.status === "MENCARI") {
    return NextResponse.json({ error: "Pesanan belum berjalan — belum ada pihak yang bisa dilaporkan." }, { status: 400 });
  }

  // Anti-duplikat: satu laporan per pesanan per pelapor.
  const dup = await db.report.findUnique({
    where: { orderId_reporterId: { orderId, reporterId: user.id } },
  });
  if (dup) {
    return NextResponse.json({ error: "Kamu sudah melaporkan pesanan ini." }, { status: 409 });
  }

  const target = await db.user.findUnique({ where: { id: targetId }, select: { name: true } });
  const report = await db.report.create({
    data: { orderId, reporterId: user.id, targetId, reason, note: trimmedNote },
    include: {
      order: { select: { code: true } },
      reporter: { select: { name: true } },
      target: { select: { name: true } },
    },
  });

  await sendPushToAdmins(
    msgNewReport({
      reporterName: user.name,
      targetName: target?.name || "pengguna",
      reason,
      code: order.code,
    })
  ).catch(() => {});

  return NextResponse.json({
    report,
    message: "Laporan terkirim ke admin KOMAH. Terima kasih sudah menjaga layanan tetap aman.",
  });
}
