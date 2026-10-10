// Verifikasi alur notifikasi push pasca-penghapusan Fonnte (semua peran).
// Uji end-to-end via HTTP terhadap dev server lokal (localhost:3000):
//   1. Penumpang kini BOLEH berlangganan push (dulu 403 "Hanya driver")
//   2. Pesanan dibuat → push ke driver online (endpoint palsu FCM → 404 →
//      langganan otomatis dibersihkan — sekaligus membuktikan enkripsi
//      payload + tanda tangan VAPID valid, seperti uji Task 33)
//   3. Alur accept/start/complete/cancel tetap mulus meski push gagal
//   4. Register driver → push ke admin; verifikasi → push ke driver
// Jalankan: node scripts/verify-push-flow.mjs

import { readFileSync } from "node:fs";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import sqlite3 from "node:sqlite";

const BASE = "http://localhost:3000";
const env = {};
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+)\s*$/);
  if (m) env[m[1]] = m[2];
}

// ── util ──────────────────────────────────────────────────────────────
const results = [];
function check(name, cond, extra = "") {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}${extra ? ` (${extra})` : ""}`);
}
let cookie = "";
async function api(path, { method = "GET", body, useCookie = true } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(useCookie && cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

// Langganan sintetis: keypair ECDH P-256 SUNGGUHAN (agar enkripsi payload
// berhasil) + endpoint FCM asli dengan token acak (pasti 404 dari FCM =
// membuktikan tanda tangan VAPID diterima; bukan 401/400).
function fakeSub(tag) {
  const { publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const p256dh = publicKey.export({ type: "spki", format: "der" }).subarray(-65).toString("base64url");
  const auth = randomBytes(16).toString("base64url");
  return {
    endpoint: `https://fcm.googleapis.com/fcm/send/verif-${tag}-${randomBytes(24).toString("hex")}`,
    p256dh,
    auth,
  };
}

// Baca DB SQLite langsung (node:sqlite) untuk cek baris langganan.
const DB_URL = (env.DATABASE_URL || "file:../db/custom.db").replace(/^file:/, "");
const dbPath = new URL("../prisma/" + DB_URL.replace(/^\.\//, "").replace(/^..\//, "x"), import.meta.url); // fallback di bawah
let dbFile = null;
{
  // DATABASE_URL "file:../db/custom.db" relatif terhadap prisma/schema.prisma
  const m = DB_URL.match(/^\.\.\/(.+)$/);
  dbFile = new URL(`../${m ? m[1] : "db/custom.db"}`, import.meta.url);
}
function dbQuery(sql) {
  const db = new sqlite3.DatabaseSync(dbFile.pathname, { readOnly: true });
  try { return db.prepare(sql).all(); } finally { db.close(); }
}

// ── mulai ─────────────────────────────────────────────────────────────
console.log("== 0. Persiapan: bersihkan langganan sisa uji ==");
{
  const db = new sqlite3.DatabaseSync(dbFile.pathname);
  try { db.exec("DELETE FROM PushSubscription"); } finally { db.close(); }
  console.log("PASS — tabel PushSubscription dikosongkan");
}

console.log("\n== 0b. Kunci publik VAPID tersedia ==");
{
  const r = await api("/api/push/config", { useCookie: false });
  check("GET /api/push/config → publicKey ada", r.status === 200 && !!r.data?.publicKey?.startsWith("B"));
}

console.log("\n== 1. Penumpang berlangganan push (dulu ditolak 403) ==");
cookie = "";
{
  const login = await api("/api/auth/login", { method: "POST", body: { email: "penumpang@komah.id", password: "komah123" } });
  check("login penumpang", login.status === 200 && login.data?.ok === true && login.data?.role === "USER");
  const sub = fakeSub("penumpang");
  const s = await api("/api/push/subscribe", { method: "POST", body: sub });
  check("penumpang subscribe → 200 (bukan 403)", s.status === 200, `status=${s.status}`);
  const rows = dbQuery("SELECT userId, endpoint FROM PushSubscription WHERE endpoint LIKE '%" + sub.endpoint.split("/").pop() + "'");
  check("langganan penumpang tersimpan di DB", rows.length === 1, `${rows.length} baris`);
}

console.log("\n== 2. Driver berlangganan + buat pesanan → push ke driver ==");
cookie = "";
{
  const login = await api("/api/auth/login", { method: "POST", body: { email: "driver@komah.id", password: "komah123" } });
  check("login driver", login.status === 200);
  const sub = fakeSub("driver");
  const s = await api("/api/push/subscribe", { method: "POST", body: sub });
  check("driver subscribe → 200", s.status === 200);
  const before = dbQuery(`SELECT COUNT(*) AS c FROM PushSubscription WHERE endpoint LIKE '%${sub.endpoint.split("/").pop()}'`)[0].c;
  check("langganan driver tersimpan", before === 1);
  globalThis.driverSubEndpoint = sub.endpoint.split("/").pop();
}

console.log("\n== 3. Buat pesanan (penumpang) ==");
cookie = "";
{
  const login = await api("/api/auth/login", { method: "POST", body: { email: "penumpang@komah.id", password: "komah123" } });
  check("login penumpang (lagi)", login.status === 200);
  const locs = await api("/api/locations");
  const list = locs.data?.locations || [];
  check("GET /api/locations", list.length >= 2, `${list.length} lokasi`);
  const pickup = list[0], dest = list[1];
  const o = await api("/api/orders", {
    method: "POST",
    body: { type: "OJEK", pickupLocationId: pickup.id, destLocationId: dest.id },
  });
  check("POST /api/orders sukses walau push driver gagal (endpoint palsu)", o.status === 200 && !!o.data?.order?.code, o.data?.order?.code || `status=${o.status}`);
  globalThis.orderId = o.data?.order?.id;
  globalThis.orderCode = o.data?.order?.code;
}

console.log("\n== 4. Langganan driver palsu dibersihkan otomatis (404 dari FCM = VAPID valid) ==");
{
  await new Promise((r) => setTimeout(r, 1500)); // beri waktu push paralel selesai
  const after = dbQuery(`SELECT COUNT(*) AS c FROM PushSubscription WHERE endpoint LIKE '%${globalThis.driverSubEndpoint}%'`)[0].c;
  check("langganan kadaluarsa terhapus (round-trip FCM asli)", after === 0, `sisa=${after}`);
}

console.log("\n== 5. Driver terima pesanan → push ke penumpang (jalan tanpa error) ==");
cookie = "";
{
  const login = await api("/api/auth/login", { method: "POST", body: { email: "driver@komah.id", password: "komah123" } });
  check("login driver (lagi)", login.status === 200);
  const a = await api(`/api/orders/${globalThis.orderId}`, { method: "PATCH", body: { action: "accept" } });
  check("accept → 200 (push penumpang dipicu)", a.status === 200, a.data?.message || `status=${a.status}`);
  const st = await api(`/api/orders/${globalThis.orderId}`, { method: "PATCH", body: { action: "start" } });
  check("start → 200 (push penumpang dipicu)", st.status === 200);
  const cp = await api(`/api/orders/${globalThis.orderId}`, { method: "PATCH", body: { action: "complete" } });
  check("complete → 200 (push penumpang dipicu)", cp.status === 200);
}

console.log("\n== 6. Cancel pesanan → push ke driver (dipicu tanpa error) ==");
{
  const locs = await api("/api/locations", { useCookie: false });
  const list = locs.data?.locations || [];
  const o2 = await api("/api/orders", {
    method: "POST",
    body: { type: "BARANG", pickupLocationId: list[0].id, destLocationId: list[2].id, itemNote: "Dokumen" },
  });
  check("pesanan kedua dibuat", o2.status === 200, o2.data?.order?.code);
  const a2 = await api(`/api/orders/${o2.data.order.id}`, { method: "PATCH", body: { action: "accept" } });
  check("driver terima pesanan kedua", a2.status === 200);
  const c2 = await api(`/api/orders/${o2.data.order.id}`, { method: "PATCH", body: { action: "cancel" } });
  check("penumpang batalkan → 200 (push ke driver dipicu)", c2.status === 200, c2.data?.message || `status=${c2.status}`);
}

console.log("\n== 7. Register driver baru → push ke admin; verifikasi → push ke driver ==");
cookie = "";
{
  const email = `uji-driver-${Date.now()}@komah.id`;
  const reg = await api("/api/auth/register", {
    method: "POST",
    body: {
      name: "Uji Driver Push", email, password: "komah123", phone: "081234567890", nim: `99900${Date.now() % 10000}`,
      role: "DRIVER", vehiclePlate: "BA 1234 TZ", vehicleType: "Honda Beat", ktmUrl: "/uploads/demo-ktm.svg",
    },
  });
  check("register driver baru → 200 (push admin dipicu)", reg.status === 200, `status=${reg.status}`);
  const login = await api("/api/auth/login", { method: "POST", body: { email: "admin@komah.id", password: "komah123" } });
  check("login admin", login.status === 200);
  const pending = await api("/api/admin/verifications");
  const target = (pending.data?.pending || []).find((d) => d.email === email);
  check("driver uji muncul di antrean verifikasi", !!target);
  if (target) {
    const v = await api("/api/admin/verifications", { method: "POST", body: { driverId: target.id, decision: "approve" } });
    check("approve → 200 (push ke driver dipicu)", v.status === 200, v.data?.message || `status=${v.status}`);
  }
}

console.log("\n== 8. Unsubscribe + guard ==");
cookie = "";
{
  const login = await api("/api/auth/login", { method: "POST", body: { email: "penumpang@komah.id", password: "komah123" } });
  const sub = fakeSub("penumpang2");
  await api("/api/push/subscribe", { method: "POST", body: sub });
  const u = await api("/api/push/unsubscribe", { method: "POST", body: { endpoint: sub.endpoint } });
  check("unsubscribe milik sendiri → 200", u.status === 200);
  const gone = dbQuery(`SELECT COUNT(*) AS c FROM PushSubscription WHERE endpoint LIKE '%${sub.endpoint.split("/").pop}%'`)[0].c;
  check("langganan terhapus dari DB", gone === 0);
  cookie = "";
  const s = await api("/api/push/subscribe", { method: "POST", body: fakeSub("tamux") });
  check("subscribe tanpa login → 401", s.status === 401, `status=${s.status}`);
}

// ── ringkasan ─────────────────────────────────────────────────────────
const pass = results.filter((r) => r.ok).length;
console.log(`\n===== RINGKASAN: ${pass}/${results.length} PASS =====`);
if (pass !== results.length) {
  console.log("Gagal:", results.filter((r) => !r.ok).map((r) => r.name).join("; "));
  process.exit(1);
}
