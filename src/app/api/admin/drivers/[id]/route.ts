import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { msgDriverBanned, msgDriverUnbanned, sendPushToUser } from "@/lib/push";

// Blokir / buka blokir driver (admin) — penindakan pelanggaran aturan
// (mis. minta top-up pulsa, tidak konfirmasi tambahan harga). Blokir
// bersifat operasional: login tetap boleh, driver dipaksa offline dan
// tidak bisa menerima pesanan baru; pesanan aktif masih bisa
// diselesaikannya agar penumpang tidak terkatung-katung.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Hanya admin." }, { status: 403 });

  const { id } = await ctx.params;
  const driver = await db.user.findUnique({ where: { id } });
  if (!driver || driver.role !== "DRIVER") {
    return NextResponse.json({ error: "Driver tidak ditemukan." }, { status: 404 });
  }

  const body = await req.json();
  const action = body.action as string;
  if (!["ban", "unban"].includes(action)) {
    return NextResponse.json({ error: "Parameter tidak valid." }, { status: 400 });
  }

  if (action === "ban") {
    const reason = String(body.reason || "").trim();
    if (reason.length < 4) {
      return NextResponse.json({ error: "Tulis alasan pemblokiran (min. 4 karakter)." }, { status: 400 });
    }
    if (reason.length > 200) {
      return NextResponse.json({ error: "Alasan maksimal 200 karakter." }, { status: 400 });
    }
    const updated = await db.user.update({
      where: { id },
      data: { banned: true, banReason: reason, bannedAt: new Date(), isOnline: false },
    });
    await sendPushToUser(id, msgDriverBanned({ name: driver.name, reason })).catch(() => {});
    return NextResponse.json({
      driver: { id: updated.id, banned: updated.banned },
      message: `${driver.name} diblokir. Driver tidak bisa online/menerima pesanan baru.`,
    });
  }

  const updated = await db.user.update({
    where: { id },
    data: { banned: false, banReason: null, bannedAt: null },
  });
  await sendPushToUser(id, msgDriverUnbanned({ name: driver.name })).catch(() => {});
  return NextResponse.json({
    driver: { id: updated.id, banned: updated.banned },
    message: `Blokir ${driver.name} dibuka. Driver bisa online kembali.`,
  });
}
