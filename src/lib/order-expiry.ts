import { db } from "@/lib/db";
import { msgOrderExpired, sendPushToUser } from "@/lib/push";

// Pesanan MENCARI lebih dari 30 menit tanpa driver → dibatalkan otomatis.
export const MENCARI_EXPIRY_MS = 30 * 60 * 1000;

// Kedaluwarsa "malas" (lazy): pesanan usang dibatalkan saat endpoint pesanan
// tersentuh (beranda, dashboard driver, detail pesanan, accept) — tanpa cron,
// kompatibel dengan hosting serverless (Vercel free plan). Setiap batch
// dibatasi 50 supaya request tetap ringan.
export async function expireStaleMencariOrders(): Promise<void> {
  const cutoff = new Date(Date.now() - MENCARI_EXPIRY_MS);
  const stale = await db.order.findMany({
    where: { status: "MENCARI", createdAt: { lt: cutoff } },
    select: { id: true, code: true, userId: true },
    take: 50,
  });
  if (stale.length === 0) return;
  await db.order.updateMany({
    where: { id: { in: stale.map((o) => o.id) } },
    data: { status: "DIBATALKAN", cancelledAt: new Date() },
  });
  for (const o of stale) {
    await sendPushToUser(o.userId, msgOrderExpired({ code: o.code })).catch(() => {});
  }
}
