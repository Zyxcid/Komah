import { db } from "@/lib/db";
import { DEFAULT_FARE_CONFIG, type FareConfig } from "@/lib/fare";

// Muat konfigurasi tarif yang diatur admin (tabel Setting, key "fareConfig").
// Cache in-memory 30 detik supaya hitungan tarif per pesanan tidak membaca
// DB setiap kali; cache dibatalkan saat admin menyimpan perubahan.

const SETTING_KEY = "fareConfig";
const CACHE_TTL_MS = 30_000;

let cache: { at: number; cfg: FareConfig } | null = null;

export function invalidateFareConfigCache(): void {
  cache = null;
}

// ===================== Sanitasi input admin =====================
// Nilai dari admin tidak dipercaya mentah: setiap angka divalidasi &
// dibatasi agar tarif tetap masuk akal dan JSON tidak membengkak.

const MAX_STEP_ROWS = 20;
const MAX_DISTANCE_ROWS = 60;
const MAX_FARE = 10_000_000; // Rp10 juta — batas atas grosir anti-salah ketik
const MAX_KM = 100;

function num(v: unknown, fallback: number, max = MAX_FARE): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(Math.round(n), max);
}

function km1(v: unknown, fallback: number): number {
  // km dengan 1 desimal (batas tingkat tarif)
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.round(n * 10) / 10, MAX_KM);
}

/** Baris langkah "dari N → +Rp": validasi dari>0 (menit/porsi/tempat/km utuh). */
function steps(
  raw: unknown,
  fallback: Array<{ from: number; add: number }>,
  integerFrom: boolean
): Array<{ from: number; add: number }> {
  if (!Array.isArray(raw)) return fallback;
  const out: Array<{ from: number; add: number }> = [];
  for (const r of raw.slice(0, MAX_STEP_ROWS)) {
    if (typeof r !== "object" || r === null) continue;
    const from = (r as { from?: unknown }).from;
    const add = (r as { add?: unknown }).add;
    let f = Number(from);
    if (!Number.isFinite(f) || f <= 0) continue;
    f = integerFrom ? Math.round(f) : km1(f, 1);
    out.push({ from: f, add: num(add, 0) });
  }
  if (out.length === 0) return fallback;
  out.sort((a, b) => b.from - a.from); // menurun — pola pencarian surcharge
  return out;
}

/**
 * Satu tabel jarak "dari km → tarif": urut naik, baris pertama dipakai
 * untuk jarak di bawah "dari km" terkecil (tarif minimum).
 */
function distanceRows(
  raw: unknown,
  fallback: Array<{ fromKm: number; fare: number }>
): Array<{ fromKm: number; fare: number }> {
  if (!Array.isArray(raw)) return fallback;
  const out: Array<{ fromKm: number; fare: number }> = [];
  for (const r of raw.slice(0, MAX_DISTANCE_ROWS)) {
    if (typeof r !== "object" || r === null) continue;
    const o = r as { fromKm?: unknown; fare?: unknown };
    const fromKm = km1(o.fromKm, 0);
    if (fromKm <= 0) continue;
    out.push({ fromKm, fare: num(o.fare, 0) });
  }
  if (out.length === 0) return fallback;
  out.sort((a, b) => a.fromKm - b.fromKm);
  return out;
}

/**
 * Rentang hujan: baris berbatas (upTo) urut naik + SATU baris tanpa batas
 * di akhir (jarak di atas batas terbesar). Baris tanpa batas hilang/salah
 * → ditambahkan otomatis memakai tambahan baris berbatas terakhir.
 */
function rainTiers(
  raw: unknown,
  fallback: Array<{ upTo: number | null; add: number }>
): Array<{ upTo: number | null; add: number }> {
  const ensureTail = (bounded: Array<{ upTo: number; add: number }>, tail: { upTo: null; add: number }) => [
    ...bounded,
    tail,
  ];
  if (!Array.isArray(raw)) return fallback;
  const bounded: Array<{ upTo: number; add: number }> = [];
  let tail: { upTo: null; add: number } | null = null;
  for (const r of raw.slice(0, MAX_STEP_ROWS)) {
    if (typeof r !== "object" || r === null) continue;
    const o = r as { upTo?: unknown; add?: unknown };
    if (o.upTo === null || o.upTo === undefined) {
      tail = { upTo: null, add: num(o.add, 0) };
      continue;
    }
    const upTo = km1(o.upTo, 0);
    if (upTo <= 0) continue;
    bounded.push({ upTo, add: num(o.add, 0) });
  }
  if (bounded.length === 0 && tail === null) return fallback;
  bounded.sort((a, b) => a.upTo - b.upTo);
  return ensureTail(bounded, tail ?? { upTo: null, add: bounded[bounded.length - 1]?.add ?? 0 });
}

/**
 * Validasi menyeluruh config dari admin; kunci hilang/salah → default.
 * Config format lama (tiers/kmFare terpisah, hujan satu batas) tetap
 * diterima: bagian surcharge yang masih segenerasi dipertahankan, tabel
 * jarak & rentang hujan kembali ke daftar resmi.
 */
export function sanitizeFareConfig(raw: unknown): FareConfig {
  const d = DEFAULT_FARE_CONFIG;
  if (typeof raw !== "object" || raw === null) return d;
  const r = raw as Record<string, unknown>;

  return {
    distance: distanceRows(r.distance, d.distance),
    overMaxBase: num(r.overMaxBase ?? r.over25Base, d.overMaxBase),
    overMaxPerKm: num(r.overMaxPerKm ?? r.over25PerKm, d.overMaxPerKm),
    rainTiers: rainTiers(r.rainTiers, d.rainTiers),
    foodRainFlat: num(r.foodRainFlat, d.foodRainFlat),
    portionSteps: steps(r.portionSteps, d.portionSteps, true),
    placeSteps: steps(r.placeSteps, d.placeSteps, true),
    waitingSteps: steps(r.waitingSteps, d.waitingSteps, true),
    night2230: num(r.night2230, d.night2230),
    night2300: num(r.night2300, d.night2300),
    night0000: num(r.night0000, d.night0000),
  };
}

// ===================== Baca / simpan =====================

export async function getFareConfig(): Promise<FareConfig> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.cfg;
  let cfg = DEFAULT_FARE_CONFIG;
  try {
    const row = await db.setting.findUnique({ where: { key: SETTING_KEY } });
    if (row) cfg = sanitizeFareConfig(JSON.parse(row.value));
  } catch {
    // DB bermasalah / JSON rusak → pakai daftar resmi default.
  }
  cache = { at: Date.now(), cfg };
  return cfg;
}

export async function saveFareConfig(raw: unknown): Promise<FareConfig> {
  const cfg = sanitizeFareConfig(raw);
  await db.setting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: JSON.stringify(cfg) },
    update: { value: JSON.stringify(cfg) },
  });
  invalidateFareConfigCache();
  return cfg;
}
