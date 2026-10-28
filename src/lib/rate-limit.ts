// Pembatas percobaan login sederhana di memori (per akun, jendela 15 menit).
// Setelah 5 kegagalan, akun terkunci sementara — mencegah brute force password.
//
// Catatan serverless (Vercel): Map ini hidup per-instance Lambda, jadi batasnya
// longgar (instance baru mulai dari nol). Tetap jauh lebih baik daripada tanpa
// pembatas sama sekali; untuk pengerasan penuh gunakan Redis/Upstash nanti.

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 menit

type Bucket = { fails: number; until: number };

const buckets = new Map<string, Bucket>();

// Hapus bucket kedaluwarsa sesekali agar memori tidak bocor.
function sweep(now: number) {
  if (buckets.size < 1000) return;
  for (const [k, b] of buckets) if (b.until <= now) buckets.delete(k);
}

/** Catat kegagalan login untuk sebuah kunci (email). */
export function registerLoginFailure(key: string): void {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.until <= now) {
    buckets.set(key, { fails: 1, until: now + WINDOW_MS });
  } else {
    b.fails += 1;
  }
}

/** Hapus catatan kegagalan (dipanggil saat login sukses). */
export function clearLoginFailures(key: string): void {
  buckets.delete(key);
}

/**
 * Apakah kunci (email) sedang terkunci?
 * Mengembalikan null bila boleh mencoba, atau sisa detik bila terkunci.
 */
export function loginLockedFor(key: string): number | null {
  const b = buckets.get(key);
  if (!b || b.until <= Date.now()) return null;
  if (b.fails >= MAX_ATTEMPTS) return Math.ceil((b.until - Date.now()) / 1000);
  return null;
}

/** Sisa percobaan sebelum terkunci (untuk pesan peringatan). */
export function loginAttemptsLeft(key: string): number {
  const b = buckets.get(key);
  if (!b || b.until <= Date.now()) return MAX_ATTEMPTS;
  return Math.max(0, MAX_ATTEMPTS - b.fails);
}
