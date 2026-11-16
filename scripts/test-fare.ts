// Uji src/lib/fare.ts terhadap "Daftar Harga Bike & Delivery" resmi KOMAH.
// Menjalankan: npx tsx scripts/test-fare.ts

import {
  distanceFare,
  rainSurcharge,
  FOOD_RAIN_FLAT,
  portionSurcharge,
  placeSurcharge,
  waitingSurcharge,
  nightSurcharge,
  calcOfficialFare,
  haversineKm,
  resolveDistanceMeters,
} from "../src/lib/fare";

let pass = 0;
let fail = 0;

function eq(actual: unknown, expected: unknown, label: string) {
  if (actual === expected) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL ${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

// ==== 1) Semua baris daftar "Harga Jarak Tempuh" ====
// [jarak km, tarif resmi]
const DISTANCE_TABLE: Array<[number, number]> = [
  [0.1, 6000], [1.0, 6000], [2.2, 6000],
  [2.3, 7000], [3.0, 7000],
  [3.1, 8000], [4.0, 8000],
  [4.1, 9000], [4.5, 9000],
  [4.6, 10000], [5.0, 10000],
  [5.1, 11000], [5.5, 11000],
  [5.6, 12000], [6.0, 12000],
  [6.1, 13000], [6.5, 13000],
  [6.6, 14000], [7.0, 14000],
  [7.1, 15000], [7.5, 15000],
  [7.6, 16000], [8.0, 16000],
  [8.1, 17000], [8.5, 17000],
  [8.6, 18000], [9.0, 18000],
  [9.1, 19000], [9.5, 19000],
  [9.6, 20000], [10.0, 20000],
  [11, 24000], [12, 26000], [13, 28000], [14, 30000], [15, 32000],
  [16, 34000], [17, 36000], [18, 38000], [19, 40000], [20, 43000],
  [21, 45000], [22, 47000], [23, 49000], [24, 51000], [25, 55000],
];
for (const [km, fare] of DISTANCE_TABLE) {
  eq(distanceFare(km).fare, fare, `jarak ${km} km`);
}

// ==== 2) Perilaku batas (pembulatan ke atas per 0,1 km / per km utuh) ====
eq(distanceFare(2.24).fare, 7000, "2,24 km → dibulatkan 2,3 km");
eq(distanceFare(10.01).fare, 24000, "10,01 km → dibulatkan 11 km");
eq(distanceFare(10.9).fare, 24000, "10,9 km → dibulatkan 11 km");
eq(distanceFare(25.5).fare, 57000, "25,5 km → 26 km (55k + 2k lanjutan)");
eq(distanceFare(0).fare, 6000, "jarak 0 → minimum 100 m");

// ==== 3) Surcharge hujan ====
eq(rainSurcharge(5), 2000, "hujan ≤10 km +2k");
eq(rainSurcharge(10), 2000, "hujan tepat 10 km +2k");
eq(rainSurcharge(11), 4000, "hujan >10 km +4k");
eq(FOOD_RAIN_FLAT, 2000, "hujan makanan flat 2k");

// ==== 4) Surcharge porsi ====
eq(portionSurcharge(1), 0, "1 porsi normal");
eq(portionSurcharge(2), 0, "2 porsi normal");
eq(portionSurcharge(3), 2000, "3 porsi +2k");
eq(portionSurcharge(4), 2000, "4 porsi +2k");
eq(portionSurcharge(5), 3000, "5 porsi +3k");
eq(portionSurcharge(6), 3000, "6 porsi +3k");
eq(portionSurcharge(7), 4000, "7 porsi +4k");
eq(portionSurcharge(8), 4000, "8 porsi +4k");
eq(portionSurcharge(9), 5000, "9 porsi +5k");
eq(portionSurcharge(15), 5000, "15 porsi +5k");

// ==== 5) Surcharge tempat pembelian ====
eq(placeSurcharge(1), 0, "1 tempat +0");
eq(placeSurcharge(2), 1000, "2 tempat +1k");
eq(placeSurcharge(3), 2000, "3 tempat +2k");
eq(placeSurcharge(4), 3000, "4 tempat +3k");
eq(placeSurcharge(5), 5000, "5 tempat +5k");
eq(placeSurcharge(8), 5000, "8 tempat +5k");

// ==== 6) Surcharge waktu tunggu ====
const WAITING_TABLE: Array<[number, number]> = [
  [0, 0], [6, 0], [7, 1000], [14, 1000], [15, 2000], [21, 2000], [22, 3000],
  [29, 3000], [30, 4000], [36, 4000], [37, 5000], [44, 5000], [45, 6000],
  [51, 6000], [52, 7000], [59, 7000], [60, 8000], [90, 8000],
];
for (const [m, add] of WAITING_TABLE) {
  eq(waitingSurcharge(m), add, `tunggu ${m} menit`);
}

// ==== 7) Surcharge jam malam (contoh waktu UTC) ====
const wib = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 15, h - 7, m));
eq(nightSurcharge(wib(10)), 0, "10:00 siang +0");
eq(nightSurcharge(wib(22, 29)), 0, "22:29 +0");
eq(nightSurcharge(wib(22, 30)), 1000, "22:30 +1k");
eq(nightSurcharge(wib(22, 59)), 1000, "22:59 +1k");
eq(nightSurcharge(wib(23, 0)), 2000, "23:00 +2k");
eq(nightSurcharge(wib(23, 59)), 2000, "23:59 +2k");
eq(nightSurcharge(wib(0, 0)), 5000, "00:00 +5k");
eq(nightSurcharge(wib(3, 30)), 5000, "03:30 +5k");
eq(nightSurcharge(wib(5, 0)), 0, "05:00 selesai jendela malam (asumsi)");

// ==== 8) Kombinasi lengkap (MAKANAN) ====
// 5 km hujan, 4 porsi, 2 tempat, tunggu 15 mnt, jam 22:30 WIB:
// 10.000 + 2.000 + 2.000 + 2.000 + 1.000 + 2.000 + 1.000 = 20.000
const combo = calcOfficialFare({
  distanceKm: 5,
  type: "MAKANAN",
  rain: true,
  portions: 4,
  places: 2,
  waitingMinutes: 15,
  orderTime: wib(22, 30),
});
eq(combo.total, 20000, "kombinasi MAKANAN 5 km hujan 4 porsi 2 tempat tunggu 15 mnt 22:30");
eq(combo.base, 10000, "kombinasi: base");
eq(combo.rain, 2000, "kombinasi: hujan jarak");
eq(combo.foodRain, 2000, "kombinasi: hujan makanan");
eq(combo.portions, 2000, "kombinasi: porsi");
eq(combo.places, 1000, "kombinasi: tempat");
eq(combo.waiting, 2000, "kombinasi: tunggu");
eq(combo.night, 1000, "kombinasi: malam");

// OJEK tidak kena aturan Food Delivery.
const ojek = calcOfficialFare({ distanceKm: 5, type: "OJEK", rain: true, portions: 9, places: 5, waitingMinutes: 60 });
eq(ojek.total, 12000, "OJEK 5 km hujan = 10k + 2k (tanpa aturan makanan)");

// BARANG juga hanya kena hujan berbasis jarak.
eq(calcOfficialFare({ distanceKm: 12, type: "BARANG", rain: true }).total, 30000, "BARANG 12 km hujan = 26k + 4k");

// ==== 9) Jarak & resolveDistanceMeters ====
const parkit = { lat: -0.8963, lng: 100.3541 };
const ft = { lat: -0.8989, lng: 100.3521 };
const straight = haversineKm(parkit, ft);
if (straight > 0.2 && straight < 0.6) pass++;
else {
  fail++;
  console.error(`FAIL haversine Parkit→FT: ${straight} km (diharapkan ±0,4 km)`);
}
eq(resolveDistanceMeters(450, parkit, ft), 450, "jarak klien wajar dipakai");
eq(resolveDistanceMeters(50000, parkit, ft), Math.round(straight * 1000 * 1.3), "jarak klien mustahil → fallback garis lurus ×1,3");
eq(resolveDistanceMeters(null, parkit, ft), Math.round(straight * 1000 * 1.3), "tanpa jarak klien → fallback");
eq(resolveDistanceMeters(null, { lat: null, lng: null }, ft), null, "tanpa koordinat → null (tarif minimum)");

console.log(`\n${pass} lulus, ${fail} gagal`);
process.exit(fail > 0 ? 1 : 0);
