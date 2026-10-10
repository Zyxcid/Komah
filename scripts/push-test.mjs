// Kirim notifikasi push UJI ke semua langganan push di database.
// Pakai: node scripts/push-test.mjs ["Pesan uji kustom"]
import { PrismaClient } from "@prisma/client";
import webpush from "web-push";
import { readFileSync } from "node:fs";

// Baca .env sederhana (tanpa dependensi tambahan).
const env = {};
try {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+)\s*$/);
    if (m) env[m[1]] = m[2];
  }
} catch {}

process.env.DATABASE_URL = process.env.DATABASE_URL || env.DATABASE_URL;

const pub = process.env.VAPID_PUBLIC_KEY || env.VAPID_PUBLIC_KEY;
const priv = process.env.VAPID_PRIVATE_KEY || env.VAPID_PRIVATE_KEY;
if (!pub || !priv) {
  console.error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY tidak ditemukan di .env");
  console.error("Generate pasangan kunci: npx web-push generate-vapid-keys");
  process.exit(1);
}
webpush.setVapidDetails(env.VAPID_SUBJECT || "mailto:admin@komah.id", pub, priv);

const db = new PrismaClient();
const subs = await db.pushSubscription.findMany();
if (subs.length === 0) {
  console.log("Belum ada langganan push di database.");
  console.log("Nyalakan toggle notifikasi di dashboard driver dulu, lalu jalankan lagi.");
  await db.$disconnect();
  process.exit(0);
}

const payload = JSON.stringify({
  title: "Tes notifikasi KOMAH",
  body: process.argv[2] || "Kalau kamu melihat ini, push berfungsi!",
  tag: "komah-test-" + Date.now(),
  url: "/#/mode-driver",
});

let ok = 0;
let fail = 0;
for (const s of subs) {
  const label = s.endpoint.slice(0, 60) + "…";
  try {
    await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
    ok++;
    console.log("TERKIRIM →", label);
  } catch (err) {
    fail++;
    console.error("GAGAL ←", label, "(", err?.statusCode || err?.message, ")");
    if (err?.statusCode === 404 || err?.statusCode === 410) {
      await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      console.error("         langganan kadaluarsa → dihapus dari database");
    }
  }
}
console.log(`\nSelesai: ${ok} terkirim, ${fail} gagal.`);
await db.$disconnect();
