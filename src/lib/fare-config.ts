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

const MAX_ROWS = 20;
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
  for (const r of raw.slice(0, MAX_ROWS)) {
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

/** Validasi menyeluruh config dari admin; kunci hilang/salah → default. */
export function sanitizeFareConfig(raw: unknown): FareConfig {
  const d = DEFAULT_FARE_CONFIG;
  if (typeof raw !== "object" || raw === null) return d;
  const r = raw as Record<string, unknown>;

  const tiers = Array.isArray(r.tiers)
    ? r.tiers
        .slice(0, MAX_ROWS)
        .map((t) => {
          const o = (t ?? {}) as { upTo?: unknown; fare?: unknown };
          return { upTo: km1(o.upTo, 0), fare: num(o.fare, 0) };
        })
        .filter((t) => t.upTo > 0)
        .sort((a, b) => a.upTo - b.upTo)
    : [];
  const kmFareRows = Array.isArray(r.kmFare)
    ? r.kmFare
        .slice(0, MAX_ROWS)
        .map((k) => {
          const o = (k ?? {}) as { km?: unknown; fare?: unknown };
          return { from: Math.round(Number(o.km)) || 0, add: num(o.fare, 0) };
        })
        .filter((k) => k.from > 0)
        .sort((a, b) => b.from - a.from)
    : [];
  const kmFare = (kmFareRows.length > 0 ? kmFareRows : d.kmFare.map((k) => ({ from: k.km, add: k.fare }))).map((s) => ({
    km: s.from,
    fare: s.add,
  }));

  return {
    tiers: tiers.length > 0 ? tiers : d.tiers,
    kmFare,
    over25Base: num(r.over25Base, d.over25Base),
    over25PerKm: num(r.over25PerKm, d.over25PerKm),
    rainShort: num(r.rainShort, d.rainShort),
    rainLong: num(r.rainLong, d.rainLong),
    rainKmLimit: km1(r.rainKmLimit, d.rainKmLimit),
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
