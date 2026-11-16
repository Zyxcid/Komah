// Tarif resmi KOMAH — "Daftar Harga Bike & Delivery" dari admin KOMAH
// (diberlakukan 15 November 2026). Menggantikan sistem tarif zona lama:
// kini berbasis JARAK TEMPUH rute + surcharge resmi (hujan, porsi, tempat
// pembelian, waktu tunggu, jam malam). Kolom Location.fare & Setting
// "baseFare" tidak dipakai lagi untuk harga.

export type FareOrderType = "OJEK" | "BARANG" | "MAKANAN";

// ===================== 1) Harga jarak tempuh =====================
// 100 m–2,2 km Rp6.000, lalu bertingkat tiap 0,5 km hingga 10 km,
// dan per km utuh (11–25 km) sesuai daftar resmi.

/** Tingkatan ≤10 km: [batas atas km, tarif Rp]. */
const TIERS: ReadonlyArray<readonly [number, number]> = [
  [2.2, 6000],
  [3.0, 7000],
  [4.0, 8000],
  [4.5, 9000],
  [5.0, 10000],
  [5.5, 11000],
  [6.0, 12000],
  [6.5, 13000],
  [7.0, 14000],
  [7.5, 15000],
  [8.0, 16000],
  [8.5, 17000],
  [9.0, 18000],
  [9.5, 19000],
  [10.0, 20000],
];

/** Tarif per km utuh >10 km: [km, tarif Rp]. */
const KM_FARE: Readonly<Record<number, number>> = {
  11: 24000,
  12: 26000,
  13: 28000,
  14: 30000,
  15: 32000,
  16: 34000,
  17: 36000,
  18: 38000,
  19: 40000,
  20: 43000,
  21: 45000,
  22: 47000,
  23: 49000,
  24: 51000,
  25: 55000,
};

/**
 * Tarif jarak tempuh. Jarak dibulatkan KE ATAS per 0,1 km (≤10 km) atau
 * per km utuh (>10 km) — konvensi ojek: 2,25 km dihitung 2,3 km.
 * Di atas 25 km (di luar daftar resmi): Rp55.000 + Rp2.000/km berikutnya,
 * mengikuti pola 21–24 km.
 */
export function distanceFare(kmInput: number): { km: number; fare: number } {
  const km = Number.isFinite(kmInput) && kmInput > 0 ? kmInput : 0.1; // minimal 100 m
  if (km <= 10) {
    const d = Math.ceil(km * 10) / 10;
    for (const [upTo, fare] of TIERS) {
      if (d <= upTo) return { km: d, fare };
    }
  }
  const whole = Math.max(11, Math.ceil(km));
  if (whole <= 25) return { km: whole, fare: KM_FARE[whole] };
  return { km: whole, fare: 55000 + (whole - 25) * 2000 };
}

// ===================== 2) Surcharge resmi =====================

/** Hujan (pelanggan tetap minta jalan): ≤10 km +2.000, >10 km +4.000. */
export function rainSurcharge(km: number): number {
  return km <= 10 ? 2000 : 4000;
}

/** Hujan khusus antar makanan (aturan Food Delivery): tambahan flat 2.000. */
export const FOOD_RAIN_FLAT = 2000;

/** Porsi makanan/minuman: 1–2 normal, 3–4 +2.000, 5–6 +3.000, 7–8 +4.000, ≥9 +5.000. */
export function portionSurcharge(portions: number): number {
  if (portions >= 9) return 5000;
  if (portions >= 7) return 4000;
  if (portions >= 5) return 3000;
  if (portions >= 3) return 2000;
  return 0;
}

/** Tempat pembelian: 1 +0, 2 +1.000, 3 +2.000, 4 +3.000, ≥5 +5.000. */
export function placeSurcharge(places: number): number {
  if (places >= 5) return 5000;
  if (places >= 4) return 3000;
  if (places >= 3) return 2000;
  if (places >= 2) return 1000;
  return 0;
}

/** Ambang waktu tunggu resmi (menit → tambahan Rp), menurun agar mudah dicari. */
const WAITING_STEPS: ReadonlyArray<readonly [number, number]> = [
  [60, 8000],
  [52, 7000],
  [45, 6000],
  [37, 5000],
  [30, 4000],
  [22, 3000],
  [15, 2000],
  [7, 1000],
];

/**
 * Waktu tunggu di tempat pembelian: ≥7 mnt +1.000, ≥15 +2.000, ≥22 +3.000,
 * ≥30 +4.000, ≥37 +5.000, ≥45 +6.000, ≥52 +7.000, ≥60 +8.000 (maksimum).
 */
export function waitingSurcharge(minutes: number): number {
  for (const [from, add] of WAITING_STEPS) {
    if (minutes >= from) return add;
  }
  return 0;
}

/** Ambang resmi waktu tunggu — dipakai pilihan chip di aplikasi driver. */
export const WAITING_CHOICES = [0, 7, 15, 22, 30, 37, 45, 52, 60] as const;

/**
 * Jam malam (antar makanan): 22:30 +1.000, 23:00 +2.000, 00:00 +5.000
 * (kesepakatan driver & pelanggan). Waktu dihitung WIB (UTC+7) secara
 * eksplisit agar sama di server (UTC) dan perangkat apa pun.
 * Asumsi: tarif 00:00 berlaku hingga 05:00 WIB (daftar resmi hanya memberi
 * titik awal 00:00).
 */
export function nightSurcharge(at: Date = new Date()): number {
  // Milidetik sejak tengah malam WIB (mod ganda menjaga hasil selalu 0–24 jam).
  const msSinceMidnightWib = (((at.getTime() + 7 * 3600_000) % 86_400_000) + 86_400_000) % 86_400_000;
  const minutesOfDay = Math.floor(msSinceMidnightWib / 60_000);
  if (minutesOfDay >= 23 * 60) return 2000; // 23:00–24:00
  if (minutesOfDay >= 22 * 60 + 30) return 1000; // 22:30–23:00
  if (minutesOfDay < 5 * 60) return 5000; // 00:00–05:00
  return 0;
}

// ===================== 3) Perhitungan utama =====================

export interface FareInput {
  /** Jarak rute tempuh dalam km (bukan garis lurus). */
  distanceKm: number;
  type: FareOrderType;
  /** Pelanggan tetap minta jalan saat hujan. */
  rain?: boolean;
  /** MAKANAN: jumlah porsi/bungkus makanan-minuman. */
  portions?: number;
  /** MAKANAN: jumlah tempat pembelian. */
  places?: number;
  /** MAKANAN: lama driver menunggu (menit) — diisi saat pesanan diselesaikan. */
  waitingMinutes?: number;
  /** Waktu pesanan dibuat (untuk surcharge jam malam). */
  orderTime?: Date;
}

export interface FareBreakdown {
  /** Jarak yang dipakai (km, sudah dibulatkan per aturan resmi). */
  distanceKm: number;
  /** Tarif jarak tempuh. */
  base: number;
  /** Tambahan hujan (aturan jarak tempuh). */
  rain: number;
  /** Tambahan hujan khusus antar makanan. */
  foodRain: number;
  /** Tambahan jumlah porsi. */
  portions: number;
  /** Tambahan jumlah tempat pembelian. */
  places: number;
  /** Tambahan waktu tunggu. */
  waiting: number;
  /** Tambahan jam malam. */
  night: number;
  total: number;
}

/**
 * Hitung tarif resmi lengkap. Aturan Food Delivery (porsi, tempat, tunggu,
 * hujan flat, jam malam) hanya berlaku untuk layanan MAKANAN; surcharge
 * hujan berbasis jarak berlaku untuk semua layanan.
 */
export function calcOfficialFare(input: FareInput): FareBreakdown {
  const { km, fare: base } = distanceFare(input.distanceKm);
  const isFood = input.type === "MAKANAN";
  const rain = input.rain ? rainSurcharge(km) : 0;
  const foodRain = isFood && input.rain ? FOOD_RAIN_FLAT : 0;
  const portions = isFood ? portionSurcharge(input.portions ?? 1) : 0;
  const places = isFood ? placeSurcharge(input.places ?? 1) : 0;
  const waiting = isFood ? waitingSurcharge(input.waitingMinutes ?? 0) : 0;
  const night = isFood ? nightSurcharge(input.orderTime ?? new Date()) : 0;
  return {
    distanceKm: km,
    base,
    rain,
    foodRain,
    portions,
    places,
    waiting,
    night,
    total: base + rain + foodRain + portions + places + waiting + night,
  };
}

// ===================== 4) Jarak rute =====================

/** Jarak garis lurus dua koordinat (km) — rumus haversine. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Faktor perkiraan jarak jalan vs garis lurus — hanya dipakai bila jarak
 * rute (OSRM) tidak tersedia saat pesanan dibuat.
 */
export const ROAD_FACTOR = 1.3;

/**
 * Tentukan jarak (meter) yang dipakai server saat membuat pesanan:
 * pakai hasil ukur rute dari klien (OSRM) bila wajar, jika tidak pakai
 * perkiraan garis lurus × ROAD_FACTOR. Jarak klien dianggap wajar bila
 * ≥80% garis lurus (jarak jalan selalu ≥ garis lurus) dan ≤3,5× garis
 * lurus. Bila kedua lokasi tanpa koordinat → null (tarif minimum).
 */
export function resolveDistanceMeters(
  clientMeters: number | null | undefined,
  a: { lat: number | null; lng: number | null },
  b: { lat: number | null; lng: number | null }
): number | null {
  const hasA = a.lat != null && a.lng != null;
  const hasB = b.lat != null && b.lng != null;
  const straight = hasA && hasB ? haversineKm(a as { lat: number; lng: number }, b as { lat: number; lng: number }) * 1000 : null;
  const m = typeof clientMeters === "number" && Number.isFinite(clientMeters) && clientMeters > 0 ? clientMeters : null;
  if (m && straight && m >= straight * 0.8 && m <= straight * 3.5) return Math.round(m);
  if (m && straight === null) return Math.round(m);
  if (straight) return Math.round(straight * ROAD_FACTOR);
  return null;
}
