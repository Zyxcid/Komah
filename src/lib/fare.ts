// Tarif resmi KOMAH — "Daftar Harga Bike & Delivery" dari admin KOMAH
// (diberlakukan 15 November 2026). Menggantikan sistem tarif zona lama:
// kini berbasis JARAK TEMPUH rute + surcharge resmi (hujan, porsi, tempat
// pembelian, waktu tunggu, jam malam).
//
// Sejak v5 SELURUH ANGKA tarif dapat diubah admin lewat panel Kelola Tarif
// (disimpan di tabel Setting, key "fareConfig", bentuk JSON FareConfig).
// DEFAULT_FARE_CONFIG = daftar resmi 15 Nov 2026 — dipakai bila admin belum
// pernah mengubah apa pun. Fungsi-fungsi di file ini MURNI (tanpa DB):
// pemanggil server memuat config lewat getFareConfig() (src/lib/fare-config.ts),
// klien mengambilnya dari GET /api/fare-config.

export type FareOrderType = "OJEK" | "BARANG" | "MAKANAN";

// ===================== 0) Konfigurasi tarif =====================

/** Seluruh angka tarif — diedit admin di panel Kelola Tarif. */
export interface FareConfig {
  /** Tingkatan ≤10 km: batas atas (km) → tarif Rp. Harus naik & ≤10. */
  tiers: Array<{ upTo: number; fare: number }>;
  /** Tarif per km utuh 11–25 km. */
  kmFare: Array<{ km: number; fare: number }>;
  /** Di atas 25 km (di luar daftar): tarif dasar + per km berikutnya. */
  over25Base: number;
  over25PerKm: number;
  /** Tambahan hujan (semua layanan): ≤ rainKmLimit → rainShort, di atasnya rainLong. */
  rainShort: number;
  rainLong: number;
  rainKmLimit: number;
  /** Hujan khusus antar makanan (aturan Food Delivery): tambahan flat. */
  foodRainFlat: number;
  /** Porsi makanan: dari porsi ke-N → tambahan Rp (menurun agar mudah dicari). */
  portionSteps: Array<{ from: number; add: number }>;
  /** Tempat pembelian: dari tempat ke-N → tambahan Rp. */
  placeSteps: Array<{ from: number; add: number }>;
  /** Waktu tunggu: dari menit ke-N → tambahan Rp. */
  waitingSteps: Array<{ from: number; add: number }>;
  /** Jam malam (antar makanan): 22:30 / 23:00 / 00:00–05:00 WIB. */
  night2230: number;
  night2300: number;
  night0000: number;
}

/** Daftar resmi 15 November 2026 — nilai bawaan. */
export const DEFAULT_FARE_CONFIG: FareConfig = {
  tiers: [
    { upTo: 2.2, fare: 6000 },
    { upTo: 3.0, fare: 7000 },
    { upTo: 4.0, fare: 8000 },
    { upTo: 4.5, fare: 9000 },
    { upTo: 5.0, fare: 10000 },
    { upTo: 5.5, fare: 11000 },
    { upTo: 6.0, fare: 12000 },
    { upTo: 6.5, fare: 13000 },
    { upTo: 7.0, fare: 14000 },
    { upTo: 7.5, fare: 15000 },
    { upTo: 8.0, fare: 16000 },
    { upTo: 8.5, fare: 17000 },
    { upTo: 9.0, fare: 18000 },
    { upTo: 9.5, fare: 19000 },
    { upTo: 10.0, fare: 20000 },
  ],
  kmFare: [
    { km: 11, fare: 24000 },
    { km: 12, fare: 26000 },
    { km: 13, fare: 28000 },
    { km: 14, fare: 30000 },
    { km: 15, fare: 32000 },
    { km: 16, fare: 34000 },
    { km: 17, fare: 36000 },
    { km: 18, fare: 38000 },
    { km: 19, fare: 40000 },
    { km: 20, fare: 43000 },
    { km: 21, fare: 45000 },
    { km: 22, fare: 47000 },
    { km: 23, fare: 49000 },
    { km: 24, fare: 51000 },
    { km: 25, fare: 55000 },
  ],
  over25Base: 55000,
  over25PerKm: 2000,
  rainShort: 2000,
  rainLong: 4000,
  rainKmLimit: 10,
  foodRainFlat: 2000,
  portionSteps: [
    { from: 9, add: 5000 },
    { from: 7, add: 4000 },
    { from: 5, add: 3000 },
    { from: 3, add: 2000 },
  ],
  placeSteps: [
    { from: 5, add: 5000 },
    { from: 4, add: 3000 },
    { from: 3, add: 2000 },
    { from: 2, add: 1000 },
  ],
  waitingSteps: [
    { from: 60, add: 8000 },
    { from: 52, add: 7000 },
    { from: 45, add: 6000 },
    { from: 37, add: 5000 },
    { from: 30, add: 4000 },
    { from: 22, add: 3000 },
    { from: 15, add: 2000 },
    { from: 7, add: 1000 },
  ],
  night2230: 1000,
  night2300: 2000,
  night0000: 5000,
};

// ===================== 1) Harga jarak tempuh =====================

/**
 * Tarif jarak tempuh. Jarak dibulatkan KE ATAS per 0,1 km (≤10 km) atau
 * per km utuh (>10 km) — konvensi ojek: 2,25 km dihitung 2,3 km.
 * Di atas 25 km: over25Base + over25PerKm/km berikutnya.
 */
export function distanceFare(kmInput: number, cfg: FareConfig = DEFAULT_FARE_CONFIG): { km: number; fare: number } {
  const km = Number.isFinite(kmInput) && kmInput > 0 ? kmInput : 0.1; // minimal 100 m
  if (km <= 10) {
    const d = Math.ceil(km * 10) / 10;
    for (const t of cfg.tiers) {
      if (d <= t.upTo) return { km: d, fare: t.fare };
    }
  }
  const whole = Math.max(11, Math.ceil(km));
  const entry = [...cfg.kmFare].sort((a, b) => a.km - b.km).find((e) => e.km === whole);
  if (entry && whole <= 25) return { km: whole, fare: entry.fare };
  return { km: whole, fare: cfg.over25Base + (whole - 25) * cfg.over25PerKm };
}

// ===================== 2) Surcharge =====================

/** Hujan (pelanggan tetap minta jalan): beda jarak pendek/panjang. */
export function rainSurcharge(km: number, cfg: FareConfig = DEFAULT_FARE_CONFIG): number {
  return km <= cfg.rainKmLimit ? cfg.rainShort : cfg.rainLong;
}

/** Porsi makanan/minuman (aturan Food Delivery). */
export function portionSurcharge(portions: number, cfg: FareConfig = DEFAULT_FARE_CONFIG): number {
  for (const s of cfg.portionSteps) {
    if (portions >= s.from) return s.add;
  }
  return 0;
}

/** Tempat pembelian. */
export function placeSurcharge(places: number, cfg: FareConfig = DEFAULT_FARE_CONFIG): number {
  for (const s of cfg.placeSteps) {
    if (places >= s.from) return s.add;
  }
  return 0;
}

/**
 * Waktu tunggu di tempat pembelian (maksimum = langkah terbesar).
 */
export function waitingSurcharge(minutes: number, cfg: FareConfig = DEFAULT_FARE_CONFIG): number {
  for (const s of cfg.waitingSteps) {
    if (minutes >= s.from) return s.add;
  }
  return 0;
}

/** Ambang pilihan waktu tunggu di aplikasi driver (menit — bukan uang). */
export const WAITING_CHOICES = [0, 7, 15, 22, 30, 37, 45, 52, 60] as const;

/**
 * Jam malam (antar makanan): 22:30 / 23:00 / 00:00–05:00 WIB
 * (kesepakatan driver & pelanggan). Waktu dihitung WIB (UTC+7) secara
 * eksplisit agar sama di server (UTC) dan perangkat apa pun.
 */
export function nightSurcharge(at: Date = new Date(), cfg: FareConfig = DEFAULT_FARE_CONFIG): number {
  // Milidetik sejak tengah malam WIB (mod ganda menjaga hasil selalu 0–24 jam).
  const msSinceMidnightWib = (((at.getTime() + 7 * 3600_000) % 86_400_000) + 86_400_000) % 86_400_000;
  const minutesOfDay = Math.floor(msSinceMidnightWib / 60_000);
  if (minutesOfDay >= 23 * 60) return cfg.night2300; // 23:00–24:00
  if (minutesOfDay >= 22 * 60 + 30) return cfg.night2230; // 22:30–23:00
  if (minutesOfDay < 5 * 60) return cfg.night0000; // 00:00–05:00
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
 * Hitung tarif lengkap. Aturan Food Delivery (porsi, tempat, tunggu,
 * hujan flat, jam malam) hanya berlaku untuk layanan MAKANAN; surcharge
 * hujan berbasis jarak berlaku untuk semua layanan. Angka mengikuti
 * config (default = daftar resmi).
 */
export function calcOfficialFare(input: FareInput, cfg: FareConfig = DEFAULT_FARE_CONFIG): FareBreakdown {
  const { km, fare: base } = distanceFare(input.distanceKm, cfg);
  const isFood = input.type === "MAKANAN";
  const rain = input.rain ? rainSurcharge(km, cfg) : 0;
  const foodRain = isFood && input.rain ? cfg.foodRainFlat : 0;
  const portions = isFood ? portionSurcharge(input.portions ?? 1, cfg) : 0;
  const places = isFood ? placeSurcharge(input.places ?? 1, cfg) : 0;
  const waiting = isFood ? waitingSurcharge(input.waitingMinutes ?? 0, cfg) : 0;
  const night = isFood ? nightSurcharge(input.orderTime ?? new Date(), cfg) : 0;
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
