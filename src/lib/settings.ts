import { db } from "@/lib/db";

// Pengaturan aplikasi (key-value) yang bisa diatur admin.
export const KEY_BASE_FARE = "BASE_FARE";
export const DEFAULT_BASE_FARE = 6000;

export async function getSetting(key: string): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await db.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

/** Tarif dasar dalam kampus (Rp) — diatur admin, fallback Rp6.000. */
export async function getBaseFare(): Promise<number> {
  const raw = await getSetting(KEY_BASE_FARE);
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_BASE_FARE;
}
