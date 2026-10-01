import { db } from "@/lib/db";

/** Tarif dasar dalam kampus — diatur admin lewat panel (Setting "baseFare"). */
export async function getBaseFare(): Promise<number> {
  try {
    const s = await db.setting.findUnique({ where: { key: "baseFare" } });
    const n = s ? parseInt(s.value, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 6000;
  } catch {
    return 6000;
  }
}
