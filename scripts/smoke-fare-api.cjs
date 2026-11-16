// Smoke test API tarif end-to-end (server produksi lokal, SQLite):
// 1) GET config (belum pernah disimpan → default resmi).
// 2) PUT config baru (format tabel jarak tunggal) → tersimpan.
// 3) GET ulang → sama persis (roundtrip).
// 4) Skenario upgrade: suntikkan config FORMAT LAMA (v5: tiers/kmFare/rainShort)
//    langsung ke DB, lalu GET → harus tetap 200 dengan config valid (surcharge
//    lama dipertahankan, tabel jarak kembali ke daftar resmi).
// Jalankan: node scripts/smoke-fare-api.cjs  (server harus hidup di :3100)
const BASE = "http://localhost:3100";
const fs = require("fs");

let pass = 0, fail = 0;
function ok(cond, label, extra) {
  if (cond) { pass++; console.log(`PASS ${label}`); }
  else { fail++; console.log(`FAIL ${label}${extra ? " — " + extra : ""}`); }
}

async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@komah.id", password: "komah123" }),
  });
  const cookie = r.headers.get("set-cookie")?.split(";")[0] || "";
  ok(r.status === 200, "login admin", String(r.status));
  return cookie;
}

(async () => {
  const cookie = await login();
  const H = { "Content-Type": "application/json", Cookie: cookie };

  // 1) GET awal
  let r = await fetch(`${BASE}/api/admin/fare-config`, { headers: H });
  ok(r.status === 200, "GET fare-config 200", String(r.status));
  let j = await r.json();
  ok(Array.isArray(j.config?.distance) && j.config.distance.length === 30, "GET: tabel jarak 30 baris", `dapat ${j.config?.distance?.length}`);
  ok(j.config?.rainTiers?.length === 2 && j.config.rainTiers[1].upTo === null, "GET: rentang hujan 2 (akhir tanpa batas)");

  // 2) PUT format baru — ubah beberapa angka
  const cfg = j.config;
  cfg.distance[1] = { fromKm: 2.3, fare: 7500 };
  cfg.rainTiers = [{ upTo: 8, add: 2500 }, { upTo: null, add: 5000 }];
  r = await fetch(`${BASE}/api/admin/fare-config`, { method: "PUT", headers: H, body: JSON.stringify({ config: cfg }) });
  ok(r.status === 200, "PUT fare-config 200", String(r.status));
  j = await r.json();
  ok(j.config?.distance?.[1]?.fare === 7500, "PUT: tarif 2,3 km tersimpan 7500", String(j.config?.distance?.[1]?.fare));
  ok(j.config?.rainTiers?.[0]?.upTo === 8 && j.config?.rainTiers?.[0]?.add === 2500, "PUT: rentang hujan tersimpan");

  // 3) GET ulang — roundtrip
  r = await fetch(`${BASE}/api/admin/fare-config`, { headers: H });
  j = await r.json();
  ok(j.config?.distance?.[1]?.fare === 7500, "roundtrip GET: 7500 bertahan");
  ok(j.config?.rainTiers?.[1]?.add === 5000 && j.config.rainTiers[1].upTo === null, "roundtrip GET: hujan >8 km = 5000");

  // 4) Skenario upgrade: suntik config FORMAT LAMA (v5) langsung ke SQLite.
  //    Butuh better-sqlite3 (opsional, hanya untuk uji ini):
  //    npm i better-sqlite3
  let Database = null;
  try { Database = require("better-sqlite3"); } catch { /* tidak terpasang → lewati */ }
  if (Database) {
    const oldCfg = {
      tiers: [{ upTo: 2.2, fare: 6000 }, { upTo: 3, fare: 7000 }],
      kmFare: [{ km: 11, fare: 24000 }],
      over25Base: 55000, over25PerKm: 2000,
      rainShort: 2000, rainLong: 4000, rainKmLimit: 10,
      foodRainFlat: 2000,
      portionSteps: [{ from: 3, add: 2000 }],
      placeSteps: [{ from: 2, add: 1000 }],
      waitingSteps: [{ from: 7, add: 1000 }],
      night2230: 1000, night2300: 2000, night0000: 5000,
    };
    const dbPath = require("path").join(__dirname, "..", "db", "custom.db");
    const db = new Database(dbPath);
    db.prepare("INSERT OR REPLACE INTO Setting (key, value) VALUES (?, ?)").run("fareConfig", JSON.stringify(oldCfg));
    db.close();

    r = await fetch(`${BASE}/api/admin/fare-config`, { headers: { ...H, "Cache-Control": "no-cache" } });
    ok(r.status === 200, "upgrade: GET config lama tetap 200", String(r.status));
    j = await r.json();
    ok(Array.isArray(j.config?.distance) && j.config.distance.length === 30, "upgrade: tabel jarak kembali resmi 30 baris", `dapat ${j.config?.distance?.length}`);
    ok(j.config?.rainTiers?.length >= 1, "upgrade: rentang hujan valid");

    // bersihkan: kembalikan DB ke kondisi tanpa fareConfig
    const db2 = new Database(dbPath);
    db2.prepare("DELETE FROM Setting WHERE key = ?").run("fareConfig");
    db2.close();
  } else {
    console.log("SKIP skenario upgrade config lama (better-sqlite3 tidak terpasang — npm i better-sqlite3 untuk mengaktifkan)");
  }

  console.log(`\n${pass} lulus, ${fail} gagal`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
